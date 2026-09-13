"""Learning service — the brain's autodidact loop.

This is what the brain does *instead of* trading. Every few seconds it
reads a slice of the live web — world/tech news headlines (Hacker News +
a rotation of RSS feeds) and, best-effort, social chatter — and files
each fresh thing it reads into its permanent knowledge bank via
``Brain.learn_concept``. Over hours and days the knowledge bank grows;
that growth *is* the brain "slowly growing up" (慢慢成长).

Design principles (consistent with the rest of the project):

* **No LLM.** We do not summarise or rewrite anything with a model. We
  take the real headline text the source published and store it as-is.
* **All best-effort.** Any per-source failure (network, feed change,
  dead mirror) is caught, logged into a rolling error rail, and the tour
  moves on. The brain keeps running.
* **Reliable transport.** Plain HTTP (httpx) against JSON/RSS endpoints,
  not headless-browser scraping — feeds are stable and cheap. The
  headless-Chromium "eyes" (web_embodiment) still show *what* the brain
  is looking at; this module is the part that actually reads + remembers.
* **Restart-safe growth.** ``learn_concept`` is idempotent and persisted,
  so a redeploy never double-files the same headline.

Disable with ``LEARNING=0``.
"""

from __future__ import annotations

import asyncio
import hashlib
import html
import logging
import os
import re
import time
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass
from typing import Any, Deque, Dict, List, Optional, Tuple


LOG = logging.getLogger("learning")

DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/129.0.0.0 Safari/537.36"
)

# Rolling news RSS feeds. Kept deliberately broad — world, tech, science
# — so the brain grows a general education rather than a crypto-only one.
DEFAULT_RSS: List[Tuple[str, str]] = [
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"),
    ("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
]

# Best-effort social chatter via public Nitter mirrors (Twitter/X without
# an API key). Nitter mirrors come and go; every one is optional and the
# brain simply skips the source when they are all down.
DEFAULT_NITTER_MIRRORS: List[str] = [
    "https://nitter.net",
    "https://nitter.poast.org",
    "https://nitter.privacyredirect.com",
]
# Public accounts / topics the brain "follows" to read social chatter.
DEFAULT_NITTER_HANDLES: List[str] = ["BBCBreaking", "TheEconomist", "sciencemagazine"]


@dataclass
class ReadItem:
    source: str
    kind: str            # "news" | "voice"
    title: str
    url: str
    at_s: float

    def to_public(self) -> dict:
        return {
            "source": self.source,
            "kind": self.kind,
            "title": self.title,
            "url": self.url,
            "at_s": self.at_s,
        }


def _clean_text(s: str, n: int = 200) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)     # strip any embedded HTML
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]


def _cid_for(title: str, prefix: str) -> str:
    h = hashlib.sha1(title.strip().lower().encode("utf-8")).hexdigest()[:16]
    return f"{prefix}::{h}"


class LearningService:
    """Periodically reads the live web and grows the brain's knowledge."""

    def __init__(
        self,
        brain,
        *,
        interval_s: float = 40.0,
        learn_per_cycle: int = 2,
        rss_feeds: Optional[List[Tuple[str, str]]] = None,
        nitter_handles: Optional[List[str]] = None,
        read_twitter: Optional[bool] = None,
    ) -> None:
        self.brain = brain
        self.interval_s = max(8.0, float(os.environ.get("LEARNING_INTERVAL_S", interval_s)))
        self.learn_per_cycle = int(os.environ.get("LEARNING_PER_CYCLE", learn_per_cycle))
        self.rss_feeds = list(rss_feeds or DEFAULT_RSS)
        self.nitter_handles = list(nitter_handles or DEFAULT_NITTER_HANDLES)
        if read_twitter is None:
            read_twitter = os.environ.get("LEARNING_READ_TWITTER", "1") not in ("0", "false", "False", "")
        self.read_twitter = read_twitter

        # A tour of source "channels" the brain rotates through. Each entry
        # is (display_name, coroutine-factory). Hacker News first, then the
        # RSS feeds, then (best-effort) social chatter.
        self._sources: List[Tuple[str, Any]] = [("Hacker News", self._fetch_hn)]
        for name, url in self.rss_feeds:
            self._sources.append((name, self._make_rss_fetcher(url)))
        if self.read_twitter:
            self._sources.append(("Social chatter", self._fetch_social))

        self._src_idx = 0
        self._client = None
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

        # State surfaced to the UI + the tweet composer.
        self._reading_now: Optional[dict] = None
        self._recent: Deque[ReadItem] = deque(maxlen=60)
        self._errors: Deque[dict] = deque(maxlen=15)
        self._cycles_done = 0
        self._items_read = 0
        self._learned_new = 0
        self._started_at: Optional[float] = None
        self._enabled = True
        # Track HN ids already pulled so we page through fresh stories.
        self._hn_queue: Deque[int] = deque()
        self._hn_seen: set[int] = set()

    # ------------------------------------------------------------------
    async def start(self) -> None:
        if self._task is not None or not self._enabled:
            return
        try:
            import httpx  # noqa: F401
        except Exception as e:  # noqa: BLE001
            LOG.error("httpx not available, learning disabled: %s", e)
            self._enabled = False
            return
        import httpx
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(12.0),
            headers={"User-Agent": DEFAULT_UA, "Accept-Language": "en-US,en;q=0.9"},
            follow_redirects=True,
        )
        self._started_at = time.time()
        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="learning")
        LOG.info("learning service started (sources=%d, interval=%.1fs)",
                 len(self._sources), self.interval_s)

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # noqa: BLE001
                pass
            self._client = None

    # ------------------------------------------------------------------
    async def _loop(self) -> None:
        # Let the rest of the app boot first.
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=8.0)
        except asyncio.TimeoutError:
            pass
        while not self._stop.is_set():
            try:
                await self._read_next_source()
            except Exception as e:  # noqa: BLE001
                LOG.warning("learning cycle error: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval_s)
            except asyncio.TimeoutError:
                pass

    async def _read_next_source(self) -> None:
        name, fetcher = self._sources[self._src_idx]
        self._src_idx = (self._src_idx + 1) % len(self._sources)
        self._cycles_done += 1
        try:
            items = await fetcher()
        except Exception as e:  # noqa: BLE001
            self._errors.append({"source": name, "error": f"{type(e).__name__}: {str(e)[:140]}",
                                 "at_s": time.time()})
            LOG.debug("source failed [%s]: %s", name, e)
            return
        learned_this_cycle = 0
        for it in items:
            if learned_this_cycle >= self.learn_per_cycle:
                break
            if self._file_item(it):
                learned_this_cycle += 1

    # ------------------------------------------------------------------
    def _file_item(self, item: ReadItem) -> bool:
        """Store one read item in the brain's knowledge bank. Returns True
        when it was genuinely new (so the brain 'grew')."""
        title = _clean_text(item.title, 160)
        if not title or len(title) < 8:
            return False
        self._items_read += 1
        self._reading_now = item.to_public()
        self._recent.appendleft(item)
        prefix = "news" if item.kind == "news" else "voice"
        category = "learned_topic" if item.kind == "news" else "learned_voice"
        cid = _cid_for(title, prefix)
        label = title if len(title) <= 80 else title[:77] + "…"
        added = False
        try:
            added = self.brain.learn_concept(
                concept_id=cid,
                category=category,
                zh=label,
                en=label,
                desc_zh=f"读自 {item.source}：{title}",
                desc_en=f"Read from {item.source}: {title}",
                quiet=False,
            )
        except Exception as e:  # noqa: BLE001
            LOG.debug("learn_concept failed: %s", e)
            return False
        if added:
            self._learned_new += 1
        return added

    # ------------------------------------------------------------------
    # Fetchers
    # ------------------------------------------------------------------
    async def _fetch_hn(self) -> List[ReadItem]:
        """Hacker News top stories via the official Firebase API."""
        assert self._client is not None
        if not self._hn_queue:
            r = await self._client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
            r.raise_for_status()
            ids = r.json() or []
            for i in ids[:60]:
                if i not in self._hn_seen:
                    self._hn_queue.append(int(i))
        out: List[ReadItem] = []
        # Pull a small batch of items per cycle.
        for _ in range(min(4, len(self._hn_queue))):
            hid = self._hn_queue.popleft()
            self._hn_seen.add(hid)
            try:
                ir = await self._client.get(
                    f"https://hacker-news.firebaseio.com/v0/item/{hid}.json")
                ir.raise_for_status()
                item = ir.json() or {}
            except Exception:  # noqa: BLE001
                continue
            title = item.get("title")
            if not title:
                continue
            url = item.get("url") or f"https://news.ycombinator.com/item?id={hid}"
            out.append(ReadItem("Hacker News", "news", title, url, time.time()))
        return out

    def _make_rss_fetcher(self, url: str):
        async def _fetch() -> List[ReadItem]:
            return await self._fetch_rss(url)
        return _fetch

    async def _fetch_rss(self, url: str, kind: str = "news",
                         source_override: Optional[str] = None) -> List[ReadItem]:
        assert self._client is not None
        r = await self._client.get(url)
        r.raise_for_status()
        source, items = _parse_rss(r.text)
        source = source_override or source or "News"
        out: List[ReadItem] = []
        for title, link in items[:12]:
            out.append(ReadItem(source, kind, title, link or url, time.time()))
        return out

    async def _fetch_social(self) -> List[ReadItem]:
        """Best-effort Twitter/X reading via public Nitter mirrors."""
        assert self._client is not None
        handle = self.nitter_handles[self._cycles_done % max(1, len(self.nitter_handles))]
        last_err: Optional[Exception] = None
        for base in DEFAULT_NITTER_MIRRORS:
            url = f"{base}/{handle}/rss"
            try:
                r = await self._client.get(url)
                r.raise_for_status()
                _src, items = _parse_rss(r.text)
                out: List[ReadItem] = []
                for title, link in items[:8]:
                    out.append(ReadItem(f"@{handle}", "voice", title, link or url, time.time()))
                if out:
                    return out
            except Exception as e:  # noqa: BLE001
                last_err = e
                continue
        if last_err:
            raise last_err
        return []

    # ------------------------------------------------------------------
    def recent_public(self, limit: int = 30) -> List[dict]:
        return [it.to_public() for it in list(self._recent)[:limit]]

    def snapshot(self) -> dict:
        return {
            "enabled": self._enabled,
            "interval_s": self.interval_s,
            "sources": [name for name, _ in self._sources],
            "next_up": self._sources[self._src_idx][0] if self._sources else None,
            "reading_now": self._reading_now,
            "recent": self.recent_public(30),
            "items_read": self._items_read,
            "learned_new": self._learned_new,
            "knowledge_total": len(getattr(self.brain, "learned_concepts", []) or []),
            "cycles_done": self._cycles_done,
            "started_at_s": self._started_at,
            "errors": list(self._errors)[-8:],
        }


# ----------------------------------------------------------------------
# RSS / Atom parsing (stdlib only, best-effort)
# ----------------------------------------------------------------------
def _parse_rss(text: str) -> Tuple[Optional[str], List[Tuple[str, str]]]:
    """Return (channel_title, [(item_title, item_link), ...]) for RSS 2.0
    or Atom. Falls back to a forgiving regex if XML parsing fails."""
    try:
        root = ET.fromstring(text)
    except Exception:
        return _parse_rss_regex(text)

    def _localtag(t: str) -> str:
        return t.rsplit("}", 1)[-1].lower()

    channel_title: Optional[str] = None
    items: List[Tuple[str, str]] = []

    # RSS 2.0: <rss><channel><title/> <item><title/><link/></item></channel>
    channel = None
    for el in root.iter():
        if _localtag(el.tag) == "channel":
            channel = el
            break
    if channel is not None:
        for child in channel:
            if _localtag(child.tag) == "title" and channel_title is None:
                channel_title = _clean_text(child.text or "", 80)
        for it in channel.iter():
            if _localtag(it.tag) != "item":
                continue
            title, link = "", ""
            for c in it:
                lt = _localtag(c.tag)
                if lt == "title":
                    title = _clean_text(c.text or "", 200)
                elif lt == "link":
                    link = (c.text or "").strip()
            if title:
                items.append((title, link))
        if items:
            return channel_title, items

    # Atom: <feed><title/> <entry><title/><link href=.../></entry></feed>
    for el in root:
        if _localtag(el.tag) == "title" and channel_title is None:
            channel_title = _clean_text(el.text or "", 80)
    for entry in root.iter():
        if _localtag(entry.tag) != "entry":
            continue
        title, link = "", ""
        for c in entry:
            lt = _localtag(c.tag)
            if lt == "title":
                title = _clean_text(c.text or "", 200)
            elif lt == "link":
                link = (c.attrib.get("href") or c.text or "").strip()
        if title:
            items.append((title, link))
    return channel_title, items


def _parse_rss_regex(text: str) -> Tuple[Optional[str], List[Tuple[str, str]]]:
    items: List[Tuple[str, str]] = []
    for m in re.finditer(r"<item\b[\s\S]*?</item>", text, re.IGNORECASE):
        block = m.group(0)
        tm = re.search(r"<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</title>", block, re.IGNORECASE)
        lm = re.search(r"<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</link>", block, re.IGNORECASE)
        if tm:
            items.append((_clean_text(tm.group(1), 200), (lm.group(1).strip() if lm else "")))
    return None, items
