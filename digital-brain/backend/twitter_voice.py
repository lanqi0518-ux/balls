"""TwitterVoice — the brain's autonomous mouth.

This is the plumbing that turns Broca's area (``backend/brain/regions/broca.py``)
into a real, self-posting X/Twitter account. It runs one background loop
that, on three different cadences, asks Broca to serialise the brain's
*live internal state* into a tweet and then posts it:

  * **Status** — every 15-30 min (jittered), a spontaneous "thinking out
    loud" line from whatever the cortex is doing right now.
  * **Daily digest** — once per day at 00:00 UTC, a diary entry over the
    last 24h (ticks processed, busiest regions, best trade, tokens
    discovered, mood).
  * **Weekly milestone** — every Sunday, a reflection over the week
    (ticks, trades, new tokens, serotonin-baseline drift).

Design notes
------------
* **Zero LLM.** Broca composes every word from real scalars. This service
  only schedules and transmits.
* **Restart-safe.** All scheduling markers (last-status time, last daily
  date, last weekly key, and the per-window baselines the digests diff
  against) are persisted to ``$DATA_DIR/twitter_voice.json`` so a Fly
  rolling deploy — which can restart the pod several times a day — never
  double-posts or resets the digest windows.
* **Dry-run by default when unkeyed.** If the four X API credentials
  aren't present in the environment (Fly secrets), the service still runs:
  it composes and logs every tweet it *would* have sent, so the website's
  "latest brain tweet" panel works without any account attached. The
  moment the secrets are set and the pod restarts, it starts really
  posting. Set ``TWITTER_DRY_RUN=1`` to force compose-only even when keyed.

Credentials (any alias works):
    TWITTER_CONSUMER_KEY  | TWITTER_API_KEY   | X_API_KEY
    TWITTER_CONSUMER_SECRET | TWITTER_API_SECRET | X_API_SECRET
    TWITTER_ACCESS_TOKEN  | X_ACCESS_TOKEN
    TWITTER_ACCESS_TOKEN_SECRET | TWITTER_ACCESS_SECRET | X_ACCESS_TOKEN_SECRET
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

LOG = logging.getLogger("twitter_voice")

try:  # tweepy is optional at import time so the server still boots without it.
    import tweepy  # type: ignore
except Exception:  # noqa: BLE001
    tweepy = None  # type: ignore


def _first_env(*names: str) -> str:
    for n in names:
        v = os.getenv(n)
        if v and v.strip():
            return v.strip()
    return ""


def _truthy(v: str) -> bool:
    return str(v).strip().lower() in ("1", "true", "yes", "on")


class TwitterVoice:
    def __init__(self, brain, trading, *,
                 learning=None,
                 data_dir: Optional[str] = None,
                 status_min_minutes: Optional[float] = None,
                 status_max_minutes: Optional[float] = None):
        self.brain = brain
        self.trading = trading
        # Optional LearningService — when present the brain talks about what
        # it is reading and how its knowledge is growing.
        self.learning = learning

        self.consumer_key = _first_env(
            "TWITTER_CONSUMER_KEY", "TWITTER_API_KEY", "X_API_KEY")
        self.consumer_secret = _first_env(
            "TWITTER_CONSUMER_SECRET", "TWITTER_API_SECRET", "X_API_SECRET")
        self.access_token = _first_env(
            "TWITTER_ACCESS_TOKEN", "X_ACCESS_TOKEN")
        self.access_token_secret = _first_env(
            "TWITTER_ACCESS_TOKEN_SECRET", "TWITTER_ACCESS_SECRET",
            "X_ACCESS_TOKEN_SECRET")

        self.has_credentials = all([
            self.consumer_key, self.consumer_secret,
            self.access_token, self.access_token_secret,
        ])
        # Master switch (default on) + dry-run override.
        self.enabled = _truthy(os.getenv("TWITTER_VOICE", "1"))
        forced_dry = _truthy(os.getenv("TWITTER_DRY_RUN", "0"))
        # We really post only when: enabled AND keyed AND tweepy present AND
        # not forced into dry-run.
        self.dry_run = forced_dry or (not self.has_credentials) or (tweepy is None)

        self.status_min_s = float(
            status_min_minutes if status_min_minutes is not None
            else float(os.getenv("TWITTER_STATUS_MIN_MINUTES", "15"))) * 60.0
        self.status_max_s = float(
            status_max_minutes if status_max_minutes is not None
            else float(os.getenv("TWITTER_STATUS_MAX_MINUTES", "30"))) * 60.0
        if self.status_max_s < self.status_min_s:
            self.status_max_s = self.status_min_s

        # Spontaneous ("say what it wants, when it wants") posting: fires off
        # the back of real internal events, gated only by a short cool-down
        # so the brain can react in near real-time without spamming.
        self.spontaneous_enabled = _truthy(os.getenv("TWITTER_SPONTANEOUS", "1"))
        self.spontaneous_gap_s = float(
            os.getenv("TWITTER_SPONTANEOUS_MIN_MINUTES", "5")) * 60.0
        # A gentler, separate cool-down for "I just read something" reactions
        # so the news chatter doesn't dominate the timeline.
        self.news_react_gap_s = float(
            os.getenv("TWITTER_NEWS_REACT_MIN_MINUTES", "20")) * 60.0
        self._spont = {
            "closed_count": self._closed_trades(),
            "last_action": {},   # symbol -> last seen action name
            "last_fear": 0.0,
            "last_mood": "",
            "last_reading_key": "",
        }

        base_dir = data_dir or os.getenv("DATA_DIR", "./data")
        self.state_path = Path(base_dir) / "twitter_voice.json"

        self._client = None            # tweepy.Client (v2 posting)
        self._screen_name: str = ""
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self._rng = random.Random()

        # Rolling log of what we posted this process (for the API/UI).
        self._events: List[dict] = []
        self._max_events = 60
        # Detect BUY→HOLD-style intent switches between consecutive statuses.
        self._prev_intent: Dict[str, str] = {}

        # Scheduling / digest-window markers (persisted).
        now = time.time()
        self._marks: Dict = {
            "last_status_at": now,          # first status fires ~1 interval from boot
            "next_status_interval_s": self._pick_interval(),
            "last_daily_date": self._utc_date_key(),   # wait until next midnight
            "last_weekly_key": self._utc_week_key(),   # wait until next Sunday
            "day_start_lifetime_step": self._lifetime_step(),
            "day_start_learned": self._learned_count(),
            "day_start_read": self._read_count(),
            "week_start_lifetime_step": self._lifetime_step(),
            "week_start_trades": self._closed_trades(),
            "week_start_learned": self._learned_count(),
            "week_start_read": self._read_count(),
            "week_start_5ht": self._tonic_5ht(),
            "last_spontaneous_at": 0.0,
            "last_news_react_at": 0.0,
        }
        self._load_marks()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop.clear()
        if not self.enabled:
            LOG.info("TwitterVoice disabled via TWITTER_VOICE=0")
            return
        if self.dry_run:
            reason = ("no credentials" if not self.has_credentials
                      else ("tweepy missing" if tweepy is None else "forced"))
            LOG.info("TwitterVoice running in DRY-RUN (%s) — composing but not posting", reason)
        else:
            try:
                self._client = tweepy.Client(
                    consumer_key=self.consumer_key,
                    consumer_secret=self.consumer_secret,
                    access_token=self.access_token,
                    access_token_secret=self.access_token_secret,
                )
                me = self._client.get_me()
                self._screen_name = getattr(getattr(me, "data", None), "username", "") or ""
                LOG.info("TwitterVoice authenticated as @%s", self._screen_name or "?")
                self._push_event("auth", f"authenticated as @{self._screen_name}")
            except Exception as e:  # noqa: BLE001
                LOG.warning("TwitterVoice auth failed (%s) — falling back to dry-run", e)
                self.dry_run = True
                self._client = None
        self._task = asyncio.create_task(self._loop(), name="twitter-voice")

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
            self._task = None
        self._save_marks()

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------
    async def _loop(self) -> None:
        # Small initial delay so the brain/trading loops have warmed up and
        # published some real state before the first possible tweet.
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=20.0)
        except asyncio.TimeoutError:
            pass
        while not self._stop.is_set():
            try:
                self._maybe_post_weekly()
                self._maybe_post_daily()
                self._maybe_post_spontaneous()
                self._maybe_post_learning_reaction()
                self._maybe_post_status()
            except Exception as e:  # noqa: BLE001
                LOG.warning("twitter voice tick failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=30.0)
            except asyncio.TimeoutError:
                pass

    # ------------------------------------------------------------------
    # Schedulers
    # ------------------------------------------------------------------
    def _maybe_post_status(self) -> None:
        now = time.time()
        interval = float(self._marks.get("next_status_interval_s") or self._pick_interval())
        if now - float(self._marks.get("last_status_at", now)) < interval:
            return
        state = self._gather_state()
        text = self.brain.broca.compose_status(state)
        self._emit("status", text)
        self._marks["last_status_at"] = now
        self._marks["next_status_interval_s"] = self._pick_interval()
        self._save_marks()

    def _maybe_post_daily(self) -> None:
        today = self._utc_date_key()
        if self._marks.get("last_daily_date") == today:
            return
        state = self._gather_state()
        state["daily"] = self._daily_window()
        text = self.brain.broca.compose_daily_digest(state)
        self._emit("daily", text)
        # Reset the day window baselines.
        self._marks["last_daily_date"] = today
        self._marks["day_start_lifetime_step"] = self._lifetime_step()
        self._marks["day_start_learned"] = self._learned_count()
        self._marks["day_start_read"] = self._read_count()
        self._save_marks()

    def _maybe_post_weekly(self) -> None:
        utcnow = datetime.now(timezone.utc)
        if utcnow.weekday() != 6:  # Sunday
            return
        week_key = self._utc_week_key()
        if self._marks.get("last_weekly_key") == week_key:
            return
        state = self._gather_state()
        state["weekly"] = self._weekly_window()
        text = self.brain.broca.compose_weekly_milestone(state)
        self._emit("weekly", text)
        # Reset the week window baselines.
        self._marks["last_weekly_key"] = week_key
        self._marks["week_start_lifetime_step"] = self._lifetime_step()
        self._marks["week_start_trades"] = self._closed_trades()
        self._marks["week_start_learned"] = self._learned_count()
        self._marks["week_start_read"] = self._read_count()
        self._marks["week_start_5ht"] = self._tonic_5ht()
        self._save_marks()

    def _maybe_post_spontaneous(self) -> None:
        """Detect a notable internal event and, if past the cool-down, let
        the brain blurt out a reaction. Trackers are updated every tick so a
        trigger only ever fires on a genuinely fresh change."""
        if not self.spontaneous_enabled:
            return
        trigger: Optional[str] = None
        event: Optional[dict] = None
        prev_action: Optional[str] = None

        # 1) A trade just closed with a material P&L.
        cc = self._closed_trades()
        if cc > int(self._spont.get("closed_count", 0)):
            try:
                newest = self.trading.paper.closed[-1]
                if abs(float(newest.pnl_pct)) >= 0.15:
                    trigger = "win" if newest.pnl_pct > 0 else "loss"
                    event = {
                        "symbol": newest.token_symbol,
                        "pnl_pct": round(float(newest.pnl_pct) * 100, 2),
                        "reason": newest.reason,
                    }
            except Exception:  # noqa: BLE001
                pass
        self._spont["closed_count"] = cc

        # 2) The trader cortex flipped its mind on the hottest token.
        intent = getattr(self.trading, "_latest_intent", None)
        if intent:
            sym = intent.get("symbol")
            actn = intent.get("action_name")
            if sym and actn:
                prev = self._spont["last_action"].get(sym)
                if (trigger is None and prev and prev != actn
                        and actn in ("buy", "sell")):
                    trigger = "switch"
                    prev_action = prev
                self._spont["last_action"][sym] = actn

        # 3) A fear spike, or 4) a swing into a strong mood.
        emo = self.brain.emotion_state()
        fear = emo.get("fear", 0.0)
        mood = emo.get("mood", "")
        if trigger is None and fear >= 0.75 and float(self._spont.get("last_fear", 0.0)) < 0.75:
            trigger = "panic"
        if (trigger is None and mood in ("EUPHORIC", "FEARFUL")
                and mood != self._spont.get("last_mood", "")):
            trigger = "mood"
        self._spont["last_fear"] = fear
        self._spont["last_mood"] = mood

        if trigger is None:
            return
        now = time.time()
        if now - float(self._marks.get("last_spontaneous_at", 0.0)) < self.spontaneous_gap_s:
            return

        state = self._gather_state()
        if event:
            state["event"] = event
        if trigger == "switch" and prev_action and state.get("trader_intent"):
            state["trader_intent"]["prev_action_name"] = prev_action
        text = self.brain.broca.compose_spontaneous(trigger, state)
        self._emit("spontaneous", text, trigger=trigger)
        self._marks["last_spontaneous_at"] = now
        self._save_marks()

    def _maybe_post_learning_reaction(self) -> None:
        """The brain reacts, in near real-time, to a fresh thing it just read
        off the live web — 'say whatever it wants'. Fires only when the item
        it's reading has actually changed, and only past a gentle cool-down."""
        if not self.spontaneous_enabled or self.learning is None:
            return
        try:
            lsnap = self.learning.snapshot()
        except Exception:  # noqa: BLE001
            return
        reading = lsnap.get("reading_now") or {}
        title = reading.get("title")
        if not title:
            return
        key = reading.get("url") or title
        if key == self._spont.get("last_reading_key"):
            return
        now = time.time()
        # Always advance the marker so we react to the *latest* thing read
        # once the cool-down clears, not to a stale headline.
        self._spont["last_reading_key"] = key
        if now - float(self._marks.get("last_news_react_at", 0.0)) < self.news_react_gap_s:
            return
        state = self._gather_state()
        text = self.brain.broca.compose_spontaneous("learned", state)
        self._emit("spontaneous", text, trigger="learned")
        self._marks["last_news_react_at"] = now
        self._save_marks()

    # ------------------------------------------------------------------
    # Emit (compose already done) → post or dry-run, then log everywhere.
    # ------------------------------------------------------------------
    def _emit(self, kind: str, text: str, *, trigger: str = "") -> None:
        text = (text or "").strip()
        if not text:
            return
        posted = False
        url = ""
        error = ""
        if not self.dry_run and self._client is not None:
            try:
                resp = self._client.create_tweet(text=text)
                tweet_id = None
                data = getattr(resp, "data", None)
                if isinstance(data, dict):
                    tweet_id = data.get("id")
                if tweet_id:
                    posted = True
                    handle = self._screen_name or "i"
                    url = f"https://twitter.com/{handle}/status/{tweet_id}"
            except Exception as e:  # noqa: BLE001
                error = str(e)
                LOG.warning("tweet failed [%s]: %s", kind, e)

        rec = self.brain.broca.register_utterance(kind, text)
        # register_utterance stores the dict in Broca's deque; mutate it so
        # transmission metadata rides along to the UI/persistence.
        rec["posted"] = posted
        rec["dry_run"] = self.dry_run
        rec["url"] = url
        if trigger:
            rec["trigger"] = trigger
        if error:
            rec["error"] = error

        status = ("posted" if posted else ("dry-run" if self.dry_run else "failed"))
        label = f"{kind}:{trigger}" if trigger else kind
        self._push_event(kind, f"[{status}] {text}", extra={
            "posted": posted, "dry_run": self.dry_run, "url": url,
            "error": error, "chars": len(text), "trigger": trigger,
        })
        try:
            self.brain._add_thought(
                "broca",
                f"spoke ({label}, {status}): {text}",
                f"发声（{label}，{status}）：{text}",
                kind="speak",
                extra={"posted": posted, "url": url, "channel": kind,
                       "trigger": trigger},
            )
        except Exception:  # noqa: BLE001
            pass

    # ------------------------------------------------------------------
    # State gathering — read live internals for Broca to serialise.
    # ------------------------------------------------------------------
    def _gather_state(self) -> dict:
        b = self.brain
        state: dict = {
            "step": getattr(b, "step_count", 0),
            "lifetime_step": getattr(b, "lifetime_step_count", 0),
            "engagement": round(float(getattr(b, "engagement", 0.0)), 3),
            "fear": round(float(getattr(b.amygdala, "fear", 0.0)), 3),
            "gut_feeling": round(float(getattr(b.insular_cortex, "gut_feeling", 0.0)), 3),
            "lc_gain": round(float(getattr(b.locus_coeruleus, "gain_scalar", 1.0)), 3),
            "pred_error": round(float(getattr(b.nucleus_accumbens, "last_error", 0.0)), 3),
            "cumulative_reward": round(float(getattr(b.nucleus_accumbens, "cumulative_reward", 0.0)), 2),
            "patience": round(float(getattr(b.raphe_nuclei, "patience", 0.5)), 3),
            "tonic_5ht": round(float(getattr(b.raphe_nuclei, "tonic_5ht", 0.5)), 3),
        }
        # Fold in the shared emotion summary (mood/valence/arousal) so the
        # tweets agree with the face beside the 3D brain.
        try:
            state.update(self.brain.emotion_state())
        except Exception:  # noqa: BLE001
            pass

        # Most-active region (excluding Broca itself, so it never just talks
        # about talking).
        top = None
        for r in getattr(b, "regions", []):
            if getattr(r, "meta", None) is None or r.meta.name == "broca":
                continue
            if top is None or r.activation > top.activation:
                top = r
        if top is not None:
            state["top_region"] = {
                "display_name": top.meta.display_name,
                "name": top.meta.name,
                "activation": round(float(top.activation), 3),
            }

        # Newest learned concept.
        learned = getattr(b, "learned_concepts", []) or []
        if learned:
            last = learned[-1]
            state["learned"] = {"en": last.get("en") or last.get("id"),
                                 "count": len(learned)}

        # Live learning state — what it is reading + how deep the bank is.
        if self.learning is not None:
            try:
                lsnap = self.learning.snapshot()
                state["learning"] = {
                    "reading_now": lsnap.get("reading_now"),
                    "knowledge_total": lsnap.get("knowledge_total"),
                    "items_read": lsnap.get("items_read"),
                    "recent": (lsnap.get("recent") or [])[:5],
                }
            except Exception:  # noqa: BLE001
                pass

        # Trader intent + P&L only make sense when the brain is actually
        # trading. In learning mode we skip them entirely so tweets never
        # mention a book it isn't running.
        if not getattr(self.trading, "enabled", True):
            return state

        # Trader intent (+ detect a switch since last status).
        intent = getattr(self.trading, "_latest_intent", None)
        if intent:
            sym = intent.get("symbol")
            action_name = intent.get("action_name")
            ti = {
                "symbol": sym,
                "action_name": action_name,
                "confidence": intent.get("confidence", 0.0),
                "price_change_h1": intent.get("price_change_h1"),
            }
            prev_action = self._prev_intent.get(sym)
            if prev_action and action_name and prev_action != action_name:
                ti["prev_action_name"] = prev_action
            if sym and action_name:
                self._prev_intent = {sym: action_name}
            state["trader_intent"] = ti

        # Paper-book P&L.
        state["pnl"] = self._paper_pnl()
        return state

    def _paper_pnl(self) -> dict:
        try:
            paper = self.trading.paper
            pairs = self.trading.tokens.snapshot()
            prices = {p.base_address: p.price_usd for p in pairs if p.price_usd > 0}
            for mint, pos in paper.positions.items():
                prices.setdefault(mint, pos.entry_price_usd)
            snap = paper.snapshot(prices)
            return {
                "total_pnl_pct": snap.get("total_pnl_pct"),
                "total_pnl_usd": snap.get("total_pnl_usd"),
                "realized_pnl_usd": snap.get("realized_pnl_usd"),
                "win_rate": snap.get("win_rate"),
                "n_trades_closed": snap.get("n_trades_closed"),
                "equity_usd": snap.get("equity_usd"),
            }
        except Exception:  # noqa: BLE001
            return {}

    def _daily_window(self) -> dict:
        d: dict = {}
        d["steps"] = max(0, self._lifetime_step() - int(self._marks.get("day_start_lifetime_step", 0)))
        d["new_ideas"] = max(0, self._learned_count() - int(self._marks.get("day_start_learned", 0)))
        d["read"] = max(0, self._read_count() - int(self._marks.get("day_start_read", 0)))
        if self.trading.enabled:
            d["new_tokens"] = d["new_ideas"]
        # Busiest regions right now (top 3, excluding Broca).
        regs = [r for r in getattr(self.brain, "regions", [])
                if getattr(r, "meta", None) and r.meta.name != "broca"]
        regs.sort(key=lambda r: r.activation, reverse=True)
        d["top_regions"] = [r.meta.display_name for r in regs[:3]]
        # Best trade closed in the last ~24h.
        best = self._best_recent_trade(window_s=24 * 3600)
        if best:
            d["best_trade"] = best
        return d

    def _weekly_window(self) -> dict:
        w: dict = {}
        w["ticks"] = max(0, self._lifetime_step() - int(self._marks.get("week_start_lifetime_step", 0)))
        w["new_ideas"] = max(0, self._learned_count() - int(self._marks.get("week_start_learned", 0)))
        w["read"] = max(0, self._read_count() - int(self._marks.get("week_start_read", 0)))
        if self.trading.enabled:
            w["trades"] = max(0, self._closed_trades() - int(self._marks.get("week_start_trades", 0)))
            w["new_tokens"] = w["new_ideas"]
        w["serotonin_start"] = float(self._marks.get("week_start_5ht", self._tonic_5ht()))
        w["serotonin_now"] = self._tonic_5ht()
        return w

    def _best_recent_trade(self, window_s: float) -> Optional[dict]:
        try:
            cutoff = time.time() - window_s
            best = None
            for t in getattr(self.trading.paper, "closed", []):
                if float(getattr(t, "closed_at_s", 0.0)) < cutoff:
                    continue
                if best is None or t.pnl_pct > best.pnl_pct:
                    best = t
            if best is not None:
                return {"symbol": best.token_symbol,
                        "pnl_pct": round(float(best.pnl_pct) * 100, 2)}
        except Exception:  # noqa: BLE001
            pass
        return None

    # ------------------------------------------------------------------
    # Small readers with graceful fallbacks
    # ------------------------------------------------------------------
    def _lifetime_step(self) -> int:
        return int(getattr(self.brain, "lifetime_step_count", 0) or 0)

    def _learned_count(self) -> int:
        return len(getattr(self.brain, "learned_concepts", []) or [])

    def _read_count(self) -> int:
        if self.learning is None:
            return 0
        try:
            return int(self.learning.snapshot().get("items_read", 0) or 0)
        except Exception:  # noqa: BLE001
            return 0

    def _closed_trades(self) -> int:
        try:
            return len(self.trading.paper.closed)
        except Exception:  # noqa: BLE001
            return 0

    def _tonic_5ht(self) -> float:
        return round(float(getattr(self.brain.raphe_nuclei, "tonic_5ht", 0.5)), 3)

    # ------------------------------------------------------------------
    # Time keys
    # ------------------------------------------------------------------
    @staticmethod
    def _utc_date_key() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    @staticmethod
    def _utc_week_key() -> str:
        iso = datetime.now(timezone.utc).isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"

    def _pick_interval(self) -> float:
        return self._rng.uniform(self.status_min_s, self.status_max_s)

    # ------------------------------------------------------------------
    # Persistence of scheduling markers
    # ------------------------------------------------------------------
    def _load_marks(self) -> None:
        try:
            if self.state_path.exists():
                data = json.loads(self.state_path.read_text())
                if isinstance(data, dict):
                    self._marks.update(data)
        except Exception as e:  # noqa: BLE001
            LOG.debug("twitter voice marks load failed: %s", e)

    def _save_marks(self) -> None:
        try:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.state_path.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(self._marks, indent=2))
            os.replace(tmp, self.state_path)
        except Exception as e:  # noqa: BLE001
            LOG.debug("twitter voice marks save failed: %s", e)

    # ------------------------------------------------------------------
    # Events + snapshot
    # ------------------------------------------------------------------
    def _push_event(self, kind: str, text: str, extra: Optional[dict] = None) -> None:
        ev = {"t": int(time.time()), "kind": kind, "text": text}
        if extra:
            ev["extra"] = extra
        self._events.append(ev)
        if len(self._events) > self._max_events:
            self._events[:] = self._events[-self._max_events:]

    def snapshot(self) -> dict:
        now = time.time()
        interval = float(self._marks.get("next_status_interval_s") or self.status_min_s)
        next_in = max(0.0, interval - (now - float(self._marks.get("last_status_at", now))))
        return {
            "enabled": bool(self.enabled),
            "dry_run": bool(self.dry_run),
            "has_credentials": bool(self.has_credentials),
            "screen_name": self._screen_name,
            "utterance_count": int(getattr(self.brain.broca, "utterance_count", 0)),
            "next_status_in_s": round(next_in, 1),
            "status_interval_min": round(self.status_min_s / 60.0, 1),
            "status_interval_max": round(self.status_max_s / 60.0, 1),
            "utterances": self.brain.broca.utterances_public(limit=12),
            "events": list(self._events[-30:]),
        }
