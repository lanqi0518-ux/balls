"""FastAPI + WebSocket server.

Runs the Brain/Environment loop in a background asyncio task and streams
each tick's state to any connected browser. Also serves the static
frontend so `python -m backend.server` is all you need to try it out.

Reliability model
-----------------
Once this process starts, the brain is designed to be **impossible to
stop cleanly**:

* The main tick loop is wrapped in a supervisor that catches every
  exception, logs it, and immediately restarts the loop. If the brain
  code itself is buggy, the loop is restarted with an exponential
  backoff up to 5s; it never stops for good while the process lives.
* We disk-persist the full brain state every 60s AND on every SIGTERM
  handler, so a hard pod-kill never loses more than a minute of
  learning.
* ``/health`` returns non-200 the moment the brain stops advancing its
  step counter for more than 30s, which triggers a Fly.io container
  restart. Combined with ``min_machines_running = 1`` in ``fly.toml``,
  this means even a silent asyncio freeze is auto-recovered.
* No HTTP or WebSocket command accepts pause / stop / reset / shutdown.
  Users can only prod the gridworld environment or add wallets — the
  cortex keeps running regardless.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import signal
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .brain import Brain
from .env import GridWorld
from .knowledge import categories_public, concepts_public
from .trading_service import TradingService
from .web_embodiment import WebEmbodiment


LOG = logging.getLogger("server")

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"


class Simulation:
    """Owns the Brain, the Environment, and the broadcast loop."""

    def __init__(self):
        self.brain = Brain()
        self.env = GridWorld(size=9, n_food=5, n_hazard=4, max_steps=250, seed=42)
        self.clients: Set[WebSocket] = set()
        # The simulation never pauses. We keep `running` as an always-True
        # flag for the payload so old clients that still watch it don't get
        # confused. There is no code path that ever sets this to False.
        self.running: bool = True
        self.tick_hz: float = 6.0  # frames per second the brain "lives" at
        self._current_obs = self.env.reset()
        self.trading: TradingService = TradingService(self.brain)
        self.web: WebEmbodiment | None = None
        if os.getenv("WEB_EMBODIMENT", "1") != "0":
            self.web = WebEmbodiment(
                interval_s=float(os.getenv("WEB_TOUR_INTERVAL_S", "22.0")),
            )
            self.trading.attach_web_embodiment(self.web)
        # Watchdog / liveness state:
        # * _last_tick_at_s — wall-clock time of the last successful brain
        #   step. Health-check flags the pod unhealthy if this stalls.
        # * _tick_crashes — how many times run_forever's inner loop has
        #   raised. Never causes the loop to stop; just surfaced in UI.
        # * _restart_count — how many times the supervisor has had to
        #   rebuild the inner loop.
        self._last_tick_at_s: float = time.time()
        self._tick_crashes: int = 0
        self._restart_count: int = 0

    # ------------------------------------------------------------------

    async def add_client(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)
        try:
            await ws.send_json(self._payload(action_info=None))
        except Exception:
            pass

    def remove_client(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def handle_command(self, ws: WebSocket, msg: dict) -> None:
        cmd = msg.get("cmd")
        # NOTE: `pause`, `resume`, `reset_brain`, `stop`, `shutdown`,
        # `kill` are intentionally NOT accepted. The brain is designed to
        # run and learn continuously; the only things users can touch are
        # the toy gridworld body and their own tracked wallets.
        if cmd == "reset":
            self._current_obs = self.env.reset()
        elif cmd == "add_wallet":
            addr = str(msg.get("address", "")).strip()
            label = str(msg.get("label", "")).strip()
            self.trading.add_wallet(addr, label)
        elif cmd == "remove_wallet":
            addr = str(msg.get("address", "")).strip()
            self.trading.remove_wallet(addr)
        elif cmd == "trading_save":
            self.trading._save_now()
        # NOTE: `speed` is intentionally NOT handled. Tick rate is a
        # function of the brain's own engagement (see _inner_loop). We
        # keep the elif structure below so old client messages become
        # no-ops instead of errors.
        elif cmd == "poke_food":
            from random import randrange
            free = {tuple(self.env.agent_pos)} | set(self.env.food) | set(self.env.hazards)
            while True:
                p = (randrange(self.env.size), randrange(self.env.size))
                if p not in free:
                    self.env.food.append(p)
                    break
        elif cmd == "poke_hazard":
            from random import randrange
            free = {tuple(self.env.agent_pos)} | set(self.env.food) | set(self.env.hazards)
            while True:
                p = (randrange(self.env.size), randrange(self.env.size))
                if p not in free:
                    self.env.hazards.append(p)
                    break

    # ------------------------------------------------------------------

    def _payload(self, action_info: dict | None) -> dict:
        return {
            "brain": self.brain.snapshot(),
            "env": self.env.snapshot(),
            "action": action_info,
            "running": self.running,
            "tick_hz": self.tick_hz,
            "tick_crashes": self._tick_crashes,
            "restart_count": self._restart_count,
            "last_tick_ago_s": round(max(0.0, time.time() - self._last_tick_at_s), 2),
            "trading": self.trading.snapshot(),
            "web": self.web.snapshot() if self.web else {"enabled": False},
        }

    async def _broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self.clients):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.remove_client(ws)

    async def _tick_once(self) -> None:
        info = self.brain.step(self._current_obs)
        self._current_obs = self.env.step(info["action"])
        self._last_tick_at_s = time.time()
        await self._broadcast(self._payload(action_info=info))

    # --- Auto tick rate ------------------------------------------------
    # The brain's `engagement` scalar (0 = idle, 1 = strongly aroused)
    # drives the tick rate. We map it into a comfortable [2.5 Hz, 11 Hz]
    # window and EMA-smooth it so the number the UI shows doesn't
    # visibly jitter every frame.
    _TICK_HZ_MIN: float = 2.5
    _TICK_HZ_MAX: float = 11.0
    _TICK_HZ_EMA_ALPHA: float = 0.15  # slow smoother

    def _target_tick_hz(self) -> float:
        eng = float(getattr(self.brain, "engagement", 0.5) or 0.5)
        eng = max(0.0, min(1.0, eng))
        return self._TICK_HZ_MIN + (self._TICK_HZ_MAX - self._TICK_HZ_MIN) * eng

    async def _inner_loop(self) -> None:
        while True:
            target = self._target_tick_hz()
            self.tick_hz = (1 - self._TICK_HZ_EMA_ALPHA) * self.tick_hz + \
                           self._TICK_HZ_EMA_ALPHA * target
            interval = 1.0 / max(0.5, self.tick_hz)
            await self._tick_once()
            await asyncio.sleep(interval)

    async def run_forever(self) -> None:
        """Supervisor loop: never exits while the process lives.

        If the inner tick loop raises anything (including a MemoryError,
        a torch NaN, an ill-typed observation, whatever), we catch it,
        log it, back off briefly, and rebuild the loop from scratch. The
        brain's persistent state stays in memory across the restart —
        we're just recovering the driver, not the cortex.
        """
        backoff = 0.5
        while True:
            try:
                await self._inner_loop()
            except asyncio.CancelledError:
                # This is the ONLY way out — happens during lifespan
                # teardown when the whole process is going down.
                raise
            except Exception as e:  # noqa: BLE001
                self._tick_crashes += 1
                self._restart_count += 1
                LOG.exception(
                    "brain tick loop crashed (restart #%d, backoff %.1fs): %s",
                    self._restart_count, backoff, e,
                )
                try:
                    self.trading._save_now()
                except Exception:  # noqa: BLE001
                    pass
                await asyncio.sleep(backoff)
                backoff = min(5.0, backoff * 1.8)
            else:
                backoff = 0.5

    async def emergency_save(self) -> None:
        """Called from SIGTERM / lifespan-shutdown. Writes the whole
        brain state to disk before we let the process exit."""
        try:
            self.trading._save_now()
        except Exception as e:  # noqa: BLE001
            LOG.warning("emergency save failed: %s", e)


sim = Simulation()


def _install_signal_handlers(loop: asyncio.AbstractEventLoop) -> None:
    """When Fly sends SIGTERM (rolling deploy, VM migration, manual
    ``fly machine stop``), we get ~5s before SIGKILL. Use it to flush
    the brain to disk so the next boot resumes exactly here."""
    def _handler(signame: str) -> None:
        LOG.warning("received %s — flushing brain to disk before shutdown", signame)
        try:
            asyncio.ensure_future(sim.emergency_save())
        except Exception:
            pass

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _handler, sig.name)
        except (NotImplementedError, RuntimeError):
            # Windows or the loop already closed — best effort only.
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    _install_signal_handlers(loop)
    task = asyncio.create_task(sim.run_forever(), name="brain-supervisor")
    await sim.trading.start()
    if sim.web is not None:
        await sim.web.start()
    try:
        yield
    finally:
        # Save FIRST, then let subsystems stop. Order matters: if trading
        # stops before we save, we lose the very-latest trader state.
        await sim.emergency_save()
        await sim.trading.stop()
        if sim.web is not None:
            await sim.web.stop()
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Digital Human Brain", lifespan=lifespan)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await sim.add_client(ws)
    try:
        while True:
            msg = await ws.receive_text()
            try:
                data = json.loads(msg)
            except json.JSONDecodeError:
                continue
            await sim.handle_command(ws, data)
    except WebSocketDisconnect:
        pass
    finally:
        sim.remove_client(ws)


# Freeze detector: if the brain hasn't ticked in > FREEZE_S seconds,
# report unhealthy so Fly restarts the container. Kept generous (30s) to
# avoid false positives during a burst of long web-embodiment page loads.
HEALTH_FREEZE_THRESHOLD_S = 30.0


@app.get("/health")
async def health():
    tr = sim.trading
    now = time.time()
    since_tick = now - sim._last_tick_at_s
    brain_ok = since_tick <= HEALTH_FREEZE_THRESHOLD_S
    body = {
        "ok": brain_ok,
        "clients": len(sim.clients),
        "running": sim.running,
        "tick_hz": sim.tick_hz,
        "since_last_tick_s": round(since_tick, 2),
        "step": sim.brain.step_count,
        "lifetime_step": sim.brain.lifetime_step_count,
        "boot_count": sim.brain.boot_count,
        "lifetime_uptime_s": round(
            sim.brain.lifetime_uptime_s + (now - sim.brain.process_started_at_s), 1
        ),
        "restart_count": sim._restart_count,
        "tick_crashes": sim._tick_crashes,
        "mode": sim.brain.config.mode,
        "knowledge": len(sim.brain.hippocampus.knowledge),
        "trading": {
            "hot_tokens": len(tr.tokens.snapshot()),
            "tracked_wallets": len(tr.wallets.wallets()),
            "paper_equity_usd": tr.paper.equity_usd(
                {p.base_address: p.price_usd for p in tr.tokens.snapshot() if p.price_usd > 0}
            ),
            "bc_updates": tr.brain.trader_cortex.bc_updates,
            "rl_updates": tr.brain.trader_cortex.rl_updates,
        },
    }
    status = 200 if brain_ok else 503
    return JSONResponse(body, status_code=status)


@app.get("/api/trading")
async def api_trading() -> dict:
    return sim.trading.snapshot()


@app.get("/api/knowledge")
async def api_knowledge() -> dict:
    return {
        "mode": sim.brain.config.mode,
        "config": sim.brain.config.to_public(),
        "categories": categories_public(),
        "concepts": concepts_public(),
    }


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")

    # Root-level asset paths that browsers hit implicitly. Explicit
    # routes so the SPA fallback below never returns index.html HTML
    # in place of an image, manifest, or robots.txt (which corrupts
    # tab favicons, PWA installs, and search-engine indexing).
    _ROOT_STATIC = {
        "/favicon.ico":         "favicon.ico",
        "/favicon.svg":         "favicon.svg",
        "/favicon-16.png":      "favicon-16.png",
        "/favicon-32.png":      "favicon-32.png",
        "/favicon-96.png":      "favicon-96.png",
        "/apple-touch-icon.png":"apple-touch-icon.png",
        "/apple-touch-icon-precomposed.png": "apple-touch-icon.png",
        "/icon-192.png":        "icon-192.png",
        "/icon-512.png":        "icon-512.png",
        "/manifest.webmanifest":"manifest.webmanifest",
    }

    def _make_root_asset_route(fs_name: str):
        async def _handler() -> FileResponse:
            return FileResponse(FRONTEND_DIR / fs_name)
        return _handler

    for _route, _fname in _ROOT_STATIC.items():
        app.add_api_route(_route, _make_root_asset_route(_fname),
                          methods=["GET"], include_in_schema=False)

    # A short list of file extensions the SPA fallback must NEVER serve
    # index.html for — those requests are asset lookups, not routes,
    # and getting HTML back for them silently breaks tab icons, images,
    # manifests, source maps, etc.
    _NON_SPA_EXTS = (
        ".ico", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
        ".webmanifest", ".map", ".txt", ".xml", ".json", ".css", ".js",
        ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mp3", ".wasm",
    )

    @app.get("/{path:path}")
    async def spa(path: str) -> FileResponse:
        target = FRONTEND_DIR / path
        if target.exists() and target.is_file():
            return FileResponse(target)
        # If the path clearly looks like a missing asset, return a real
        # 404 rather than the SPA shell.
        low = path.lower()
        if low.endswith(_NON_SPA_EXTS) or low.startswith("static/"):
            return JSONResponse({"error": "not found", "path": path}, status_code=404)
        return FileResponse(FRONTEND_DIR / "index.html")


def main() -> None:
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.server:app", host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
