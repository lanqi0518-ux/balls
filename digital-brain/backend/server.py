"""FastAPI + WebSocket server.

Runs the Brain/Environment loop in a background asyncio task and streams
each tick's state to any connected browser. Also serves the static
frontend so `python -m backend.server` is all you need to try it out.
"""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .brain import Brain
from .env import GridWorld


ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"


class Simulation:
    """Owns the Brain, the Environment, and the broadcast loop."""

    def __init__(self):
        self.brain = Brain()
        self.env = GridWorld(size=9, n_food=5, n_hazard=4, max_steps=250, seed=42)
        self.clients: Set[WebSocket] = set()
        self.running: bool = True
        self.tick_hz: float = 6.0  # frames per second the brain "lives" at
        self._current_obs = self.env.reset()

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
        if cmd == "pause":
            self.running = False
        elif cmd == "resume":
            self.running = True
        elif cmd == "reset":
            self._current_obs = self.env.reset()
        elif cmd == "reset_brain":
            self.brain = Brain()
            self._current_obs = self.env.reset()
        elif cmd == "speed":
            hz = float(msg.get("hz", 6.0))
            self.tick_hz = max(0.5, min(30.0, hz))
        elif cmd == "poke_food":
            # User manually spawns a food pellet somewhere free
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

    async def run_forever(self) -> None:
        while True:
            interval = 1.0 / max(0.5, self.tick_hz)
            if self.running:
                info = self.brain.step(self._current_obs)
                self._current_obs = self.env.step(info["action"])
                await self._broadcast(self._payload(action_info=info))
            else:
                # still push heartbeat so client stays in sync
                await self._broadcast(self._payload(action_info=None))
            await asyncio.sleep(interval)


sim = Simulation()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(sim.run_forever())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


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


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "clients": len(sim.clients), "running": sim.running,
            "tick_hz": sim.tick_hz, "step": sim.brain.step_count}


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{path:path}")
    async def spa(path: str) -> FileResponse:
        target = FRONTEND_DIR / path
        if target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIR / "index.html")


def main() -> None:
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.server:app", host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
