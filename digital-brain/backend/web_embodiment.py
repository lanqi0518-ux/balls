"""Web embodiment — the brain's second body.

The gridworld body is a 15×15 pixel canvas. This body is the real, live
Web. Playwright drives a headless Chromium; every ~20 seconds it cycles
to the next site on a rotating tour, takes a screenshot, and pulls a
structured list of tokens out of the DOM. Both the screenshot (as a JPEG
downsampled to a few hundred px wide) and the extracted tokens are
streamed to the frontend so the user sees exactly what the brain is
"looking at" right now. Extracted tokens also flow into the trader's
candidate pool so the trader cortex gets a second, visually-grounded
source of hot names on top of the DexScreener REST API.

Compared to flybrain.online: same approach (headless browser + real DOM
+ real pixels), but our brain can read (we grab DOM text, they treat
text as 30×30-pixel texture) and we come to the page with an actual
goal (finding hot tokens to reason about), not novelty-driven wandering.

Failure model: any per-site error (timeout, Cloudflare challenge, DOM
change) is caught, logged into a rolling error stream, and the tour
moves on. The whole subsystem is optional — set ``WEB_EMBODIMENT=0``
in the environment to disable it entirely.
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import re
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Deque, Dict, List, Optional, Set, Tuple


LOG = logging.getLogger("web_embodiment")


DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/129.0.0.0 Safari/537.36"
)

# Where the installed Chromium binary lives inside the container.
DEFAULT_CHROMIUM_PATH = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")


@dataclass
class WebToken:
    """A token spotted on a real web page during a visit."""
    symbol: str
    address: Optional[str]        # Solana mint (or pair) if we could parse one
    price_hint: Optional[str]     # short text like "$0.00123" if visible
    change_hint: Optional[str]    # short text like "+382%" if visible
    text: str                     # first ~100 chars of the visible link/cell text

    def to_public(self) -> dict:
        return {
            "symbol": self.symbol,
            "address": self.address,
            "price_hint": self.price_hint,
            "change_hint": self.change_hint,
            "text": self.text,
        }


@dataclass
class WebVisit:
    site_name: str
    url: str
    at_s: float
    token_count: int
    duration_ms: int
    ok: bool
    error: Optional[str] = None


# ----------------------------------------------------------------------
# Per-site extractors
# ----------------------------------------------------------------------
# Each extractor takes a Playwright Page and returns a list of WebToken.
# They all wrap common patterns because most Solana-oriented sites use
# similar URL schemes for their token detail pages.

def _clean(s: str, n: int = 100) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s[:n]


async def _extract_via_link_pattern(
    page,
    href_pattern: str,
    symbol_hint_regex: str = r"\$?([A-Z][A-Z0-9]{1,9})",
) -> List[WebToken]:
    """Pull tokens out of a page by scanning for <a> tags whose href
    matches a Solana-token URL pattern (e.g. `/solana/<mint>` on
    DexScreener, `/coin/<mint>` on pump.fun).
    """
    js = f"""
    () => {{
      const rx = new RegExp({href_pattern!r});
      const out = [];
      const seen = new Set();
      for (const a of document.querySelectorAll('a[href]')) {{
        const href = a.getAttribute('href') || '';
        const m = href.match(rx);
        if (!m) continue;
        const addr = m[1];
        if (seen.has(addr)) continue;
        seen.add(addr);
        const txt = (a.innerText || a.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!txt) continue;
        out.push({{ addr, text: txt }});
        if (out.length >= 60) break;
      }}
      return out;
    }}
    """
    try:
        rows = await page.evaluate(js)
    except Exception as e:
        LOG.warning("evaluate failed: %s", e)
        return []

    sym_rx = re.compile(symbol_hint_regex)
    price_rx = re.compile(r"\$[0-9]+(?:[.,][0-9]+)?(?:[KMB])?")
    change_rx = re.compile(r"[-+]?\d+(?:\.\d+)?%")

    out: List[WebToken] = []
    for r in rows:
        text = _clean(r.get("text") or "", 120)
        if not text:
            continue
        sym_m = sym_rx.search(text)
        sym = sym_m.group(1) if sym_m else text.split(" ")[0][:12]
        price_m = price_rx.search(text)
        change_m = change_rx.search(text)
        out.append(WebToken(
            symbol=sym.upper()[:10],
            address=r.get("addr"),
            price_hint=price_m.group(0) if price_m else None,
            change_hint=change_m.group(0) if change_m else None,
            text=text,
        ))
    return out


async def _extract_visible_symbols(page, max_out: int = 40) -> List[WebToken]:
    """Fallback extractor: scrape visible text for symbol-shaped tokens.

    Some sites (Robinhood, Cloudflare-gated JS apps) don't expose
    Solana-mint-shaped href attributes we can match. We instead look at
    every visible element with short bold-ish text that looks like a
    ticker ("$XYZ" or "XYZ / USDC" or standalone 2-6 char uppercase),
    grabbing the surrounding cell text as context. Duplicates de-duped
    by symbol.

    Never guarantees a mint address — those get resolved later by the
    trader's DexScreener lookup.
    """
    js = f"""
    () => {{
      const symRx = /(^|[^A-Z0-9$])\\$?([A-Z][A-Z0-9]{{1,9}})(?![A-Z0-9])/;
      const priceRx = /\\$[0-9]+(?:[.,][0-9]+)?(?:[KMB])?/;
      const changeRx = /[-+]?[0-9]+(?:\\.[0-9]+)?%/;
      const skip = new Set([
        'USD','USDC','USDT','SOL','ETH','BTC','WBTC','BNB','MATIC',
        'AVAX','ARB','OP','NEAR','ATOM','APT','SUI','TRX','XRP','ADA',
        'DOGE','LTC','SHIB','LINK','DAI','PYUSD','USDS','WSOL','BUSD',
        'API','APR','APY','TVL','LP','CEX','DEX','NFT','KYC','GM','GN',
        'CEO','CTO','CFO','IPO','FAQ','TOS','EULA',
      ]);
      const nodes = document.querySelectorAll(
        'td, span, div, a, li, h2, h3, h4, p, strong, b'
      );
      const seen = new Set();
      const out = [];
      for (const n of nodes) {{
        const text = (n.innerText || n.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.length < 2 || text.length > 220) continue;
        const m = text.match(symRx);
        if (!m) continue;
        const sym = m[2];
        if (skip.has(sym) || seen.has(sym)) continue;
        // Symbol must look like a real ticker — 3-6 chars is the sweet spot.
        if (sym.length < 3 || sym.length > 8) continue;
        seen.add(sym);
        out.push({{ symbol: sym, text: text.slice(0, 200) }});
        if (out.length >= {max_out}) break;
      }}
      return out;
    }}
    """
    try:
        rows = await page.evaluate(js)
    except Exception as e:
        LOG.warning("visible-symbol evaluate failed: %s", e)
        return []
    price_rx = re.compile(r"\$[0-9]+(?:[.,][0-9]+)?(?:[KMB])?")
    change_rx = re.compile(r"[-+]?\d+(?:\.\d+)?%")
    out: List[WebToken] = []
    for r in rows:
        text = _clean(r.get("text") or "", 200)
        sym = (r.get("symbol") or "").upper()[:10]
        if not sym:
            continue
        price_m = price_rx.search(text)
        change_m = change_rx.search(text)
        out.append(WebToken(
            symbol=sym,
            address=None,
            price_hint=price_m.group(0) if price_m else None,
            change_hint=change_m.group(0) if change_m else None,
            text=text,
        ))
    return out


async def _merge_extractors(page, primary_href_pattern: str,
                            fallback: bool = True) -> List[WebToken]:
    """Run the href-pattern extractor first; if it yields very few tokens
    (Cloudflare partial render, JS-heavy page), also add visible-symbol
    hits. Symbols already seen via href are kept; the fallback fills in
    the gaps."""
    primary = await _extract_via_link_pattern(page, primary_href_pattern)
    if not fallback:
        return primary
    if len(primary) >= 6:
        return primary
    extra = await _extract_visible_symbols(page)
    seen_syms = {t.symbol for t in primary}
    for t in extra:
        if t.symbol in seen_syms:
            continue
        primary.append(t)
        seen_syms.add(t.symbol)
    return primary


async def _pumpfun_extractor(page) -> List[WebToken]:
    """pump.fun token pages: /coin/<mint>."""
    return await _merge_extractors(page, r"/coin/([A-Za-z0-9]{25,})")


async def _gmgn_extractor(page) -> List[WebToken]:
    """gmgn.ai token detail pages: /sol/token/<mint>. Their pair detail
    pages also use /sol/token/, so a single regex catches both feeds.
    Cloudflare occasionally serves partial content — fallback extractor
    scrapes visible symbols to compensate."""
    return await _merge_extractors(page, r"/sol/token/([A-Za-z0-9]{25,})")


async def _coingecko_extractor(page) -> List[WebToken]:
    """CoinGecko coin table: rows link to /en/coins/<slug>."""
    return await _merge_extractors(page, r"/en/coins/([a-z0-9\\-]{2,60})")


async def _robinhood_extractor(page) -> List[WebToken]:
    """Robinhood pages: /us/en/stocks/<TICKER>/ for stocks and
    /us/en/crypto/<TICKER>/ for supported crypto assets, plus a heavy
    JS shell on the discover pages. We use the URL-pattern extractor
    when we can and always augment with the visible-symbol fallback."""
    hits = await _extract_via_link_pattern(
        page, r"/us/en/(?:crypto|stocks)/([A-Z0-9\\-]{1,10})",
        symbol_hint_regex=r"\$?([A-Z][A-Z0-9]{1,9})",
    )
    extra = await _extract_visible_symbols(page)
    seen = {t.symbol for t in hits}
    for t in extra:
        if t.symbol in seen:
            continue
        hits.append(t)
        seen.add(t.symbol)
    return hits


async def _generic_extractor(page) -> List[WebToken]:
    return await _merge_extractors(page, r"/(?:solana|token|coin|currencies)/([A-Za-z0-9\\-]{2,60})")


# ----------------------------------------------------------------------
# The tour
# ----------------------------------------------------------------------
Extractor = Callable[[Any], Awaitable[List[WebToken]]]

# The tour is now oriented around FRESH launches, not established
# mega-caps. The old tour spent most of its time on CoinGecko /
# CoinMarketCap pages dominated by BNB / PEPE / SOL / WIF — coins that
# every bot on earth is already competing for. The brain's edge is
# reasoning about NEW small-cap projects the moment they appear, so we
# point the browser at pump.fun's newest boards and try gmgn.ai's
# discover pages.
#
# gmgn.ai gates bare HTTPS (Cloudflare 403), but their pages often
# render fine to a real headless Chromium with a proper UA + stealth
# init script — worst case a visit fails and we log it in the errors
# rail and move on. CoinGecko's Solana-meme-only page is kept as a
# single sanity anchor to prove the browser can reach the wider web.
# Site display names are intentionally launchpad-agnostic (e.g.
# "fresh Solana launches" instead of "pump.fun · new launches"). The
# actual URL still targets a specific launchpad, but the topbar's
# browser strip and the thought stream refer only to what the brain is
# LOOKING AT semantically, not to which brand hosts the page.
DEFAULT_TOUR: List[Tuple[str, str, Extractor]] = [
    ("fresh Solana launches",
     "https://pump.fun/board?sort=creation_time&order=DESC",
     _pumpfun_extractor),
    ("about-to-graduate tokens",
     "https://pump.fun/board?sort=market_cap&order=DESC",
     _pumpfun_extractor),
    ("king of the hill",
     "https://pump.fun/advanced",
     _pumpfun_extractor),
    ("new Solana pairs",
     "https://gmgn.ai/sol/discover?tab=new_pool",
     _gmgn_extractor),
    ("trending Solana",
     "https://gmgn.ai/sol",
     _gmgn_extractor),
    ("Solana meme category",
     "https://www.coingecko.com/en/categories/solana-meme-coins",
     _coingecko_extractor),
    # Robinhood crypto & stock discover pages. The brain's second cortex
    # is now looking at the retail flow, not just launchpad boards.
    # Robinhood's public routes are:
    #   /us/en/crypto/          — the full supported-crypto catalog
    #   /us/en/crypto/discover/ — the "Discover crypto" landing
    #   /us/en/lists/100-most-popular/ — trending stocks by retail volume
    ("Robinhood crypto",
     "https://robinhood.com/us/en/crypto/",
     _robinhood_extractor),
    ("Robinhood crypto discover",
     "https://robinhood.com/us/en/crypto/discover/",
     _robinhood_extractor),
    ("Robinhood 100 most popular",
     "https://robinhood.com/us/en/lists/100-most-popular/",
     _robinhood_extractor),
]


# ----------------------------------------------------------------------
# The service
# ----------------------------------------------------------------------
class WebEmbodiment:
    """A Playwright-driven headless Chromium that cycles the tour above,
    exposing the latest screenshot + extracted tokens for both the UI
    and the trading service.

    Everything is best-effort. If Chromium fails to start (missing libs,
    memory pressure) the whole subsystem gracefully disables itself and
    ``snapshot()`` reports the error — the rest of the brain keeps
    running unaffected.
    """

    def __init__(self,
                 interval_s: float = 22.0,
                 output_max_width: int = 720,
                 viewport: Tuple[int, int] = (1280, 900),
                 chromium_path: str = DEFAULT_CHROMIUM_PATH,
                 tour: Optional[List[Tuple[str, str, Extractor]]] = None):
        self.interval_s = interval_s
        self.output_max_width = output_max_width
        self.viewport = viewport
        self.chromium_path = chromium_path
        self.tour: List[Tuple[str, str, Extractor]] = list(tour or DEFAULT_TOUR)

        # Playwright resources.
        self._pw = None
        self._browser = None
        self._context = None
        self._page = None
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

        # Rotating state.
        self._tour_idx = 0
        self._latest: Optional[dict] = None
        self._history: Deque[WebVisit] = deque(maxlen=40)
        self._discovered_symbols: Set[str] = set()
        self._discovered_addrs: Set[str] = set()
        self._errors: Deque[dict] = deque(maxlen=15)
        self._boot_error: Optional[str] = None
        self._visits_done: int = 0
        self._started_at: Optional[float] = None
        self._enabled: bool = True

    # ------------------------------------------------------------------
    async def start(self) -> None:
        if self._task is not None or not self._enabled:
            return
        try:
            # Import here so the module is importable even if Playwright
            # isn't installed (dev machines without the browser deps).
            from playwright.async_api import async_playwright
        except Exception as e:  # noqa: BLE001
            self._boot_error = f"playwright not installed: {e}"
            LOG.error(self._boot_error)
            self._enabled = False
            return

        try:
            self._pw = await async_playwright().start()
            launch_kwargs = {
                "headless": True,
                "args": [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",
                ],
            }
            if self.chromium_path and os.path.exists(self.chromium_path):
                launch_kwargs["executable_path"] = self.chromium_path

            self._browser = await self._pw.chromium.launch(**launch_kwargs)
            self._context = await self._browser.new_context(
                viewport={"width": self.viewport[0], "height": self.viewport[1]},
                user_agent=DEFAULT_UA,
                locale="en-US",
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            # Cheap stealth: strip the `navigator.webdriver` flag so
            # basic bot-checks don't refuse us on the first page.
            await self._context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )
            self._page = await self._context.new_page()
            self._started_at = time.time()
        except Exception as e:  # noqa: BLE001
            self._boot_error = f"chromium failed to launch: {e}"
            LOG.exception("WebEmbodiment failed to start")
            self._enabled = False
            await self._cleanup()
            return

        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="web-embodiment")
        LOG.info("web embodiment started (tour length=%d, interval=%.1fs)",
                 len(self.tour), self.interval_s)

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        await self._cleanup()

    async def _cleanup(self) -> None:
        for attr in ("_page", "_context", "_browser"):
            obj = getattr(self, attr, None)
            if obj is None:
                continue
            try:
                await obj.close()
            except Exception:  # noqa: BLE001
                pass
            setattr(self, attr, None)
        if self._pw is not None:
            try:
                await self._pw.stop()
            except Exception:  # noqa: BLE001
                pass
            self._pw = None

    # ------------------------------------------------------------------
    async def _loop(self) -> None:
        # Small delay so the rest of the app finishes booting first.
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=6.0)
        except asyncio.TimeoutError:
            pass
        while not self._stop.is_set():
            await self._visit_next()
            try:
                await asyncio.wait_for(self._stop.wait(),
                                       timeout=self.interval_s)
            except asyncio.TimeoutError:
                pass

    async def _visit_next(self) -> None:
        if not self._enabled or self._page is None:
            return
        name, url, extractor = self.tour[self._tour_idx]
        self._tour_idx = (self._tour_idx + 1) % len(self.tour)
        t0 = time.time()
        ok = False
        err = None
        tokens: List[WebToken] = []
        try:
            await self._page.goto(url, timeout=25_000, wait_until="domcontentloaded")
            # Wait for the page's actual link-heavy content to render.
            # Failing this is fine — we still get a screenshot below.
            try:
                await self._page.wait_for_selector("a[href]", timeout=8_000, state="attached")
            except Exception:
                pass
            # Give SPAs a beat to finish hydrating.
            await asyncio.sleep(2.8)
            screenshot_bytes = await self._page.screenshot(
                type="jpeg", quality=62, full_page=False,
            )
            b64 = self._downsample_jpeg(screenshot_bytes)
            # Extraction is best-effort — if the page navigated under us,
            # skip and move on.
            try:
                tokens = await extractor(self._page)
            except Exception as e:
                LOG.debug("extraction skipped [%s]: %s", url, e)
                tokens = []
            # Trust anything the extractor emitted. Href-based hits give us
            # on-chain mints (25-44 chars, base58) or slugs like 'bonk'
            # (3-15 chars). The visible-symbol fallback gives us tokens
            # with no address at all (Robinhood shows tickers, not mints);
            # the trader resolves those via a DexScreener symbol lookup.
            tokens = [
                t for t in tokens
                if t.symbol and (
                    (t.address and len(t.address) >= 3) or (not t.address)
                )
            ]
            ok = True
            self._latest = {
                "site_name": name,
                "url": url,
                "screenshot_b64": b64,
                "screenshot_at_s": time.time(),
                "tokens": [t.to_public() for t in tokens],
                "token_count": len(tokens),
                "cycle": self._visits_done + 1,
            }
            for t in tokens:
                if t.symbol:
                    self._discovered_symbols.add(t.symbol)
                if t.address:
                    self._discovered_addrs.add(t.address)
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {str(e)[:160]}"
            LOG.warning("web visit failed [%s]: %s", url, err)
            self._errors.append({
                "site_name": name, "url": url,
                "error": err, "at_s": time.time(),
            })
        finally:
            dur_ms = int((time.time() - t0) * 1000)
            self._visits_done += 1
            self._history.append(WebVisit(
                site_name=name, url=url, at_s=time.time(),
                token_count=len(tokens), duration_ms=dur_ms,
                ok=ok, error=err,
            ))

    # ------------------------------------------------------------------
    def _downsample_jpeg(self, buf: bytes) -> str:
        """Resize + re-encode a JPEG so we can safely stream it over the
        WebSocket at every tick without saturating bandwidth."""
        try:
            from PIL import Image
        except Exception:
            return base64.b64encode(buf).decode("ascii")
        try:
            img = Image.open(io.BytesIO(buf))
            if img.mode != "RGB":
                img = img.convert("RGB")
            if img.width > self.output_max_width:
                ratio = self.output_max_width / img.width
                new_size = (self.output_max_width, int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=65, optimize=True)
            return base64.b64encode(out.getvalue()).decode("ascii")
        except Exception:  # noqa: BLE001
            return base64.b64encode(buf).decode("ascii")

    # ------------------------------------------------------------------
    def latest_token_candidates(self, limit: int = 30) -> List[dict]:
        """Return a de-duplicated list of tokens we've spotted across all
        visits, ordered most-recent first. Consumers (like the trader
        service) can widen their candidate pool with these.
        """
        seen: Dict[str, dict] = {}
        for visit in reversed([self._latest] if self._latest else []):
            for t in (visit or {}).get("tokens", []):
                addr = t.get("address")
                if not addr or addr in seen:
                    continue
                seen[addr] = t
                if len(seen) >= limit:
                    break
        return list(seen.values())

    def snapshot(self) -> dict:
        return {
            "enabled": self._enabled,
            "boot_error": self._boot_error,
            "interval_s": self.interval_s,
            "tour_length": len(self.tour),
            "tour_names": [name for name, _url, _fn in self.tour],
            "next_up_idx": self._tour_idx,
            "next_up_name": self.tour[self._tour_idx][0] if self.tour else None,
            "visits_done": self._visits_done,
            "started_at_s": self._started_at,
            "discovered_symbols": sorted(self._discovered_symbols)[:60],
            "discovered_addrs_count": len(self._discovered_addrs),
            "latest": self._latest,
            "recent_visits": [
                {"site_name": v.site_name, "url": v.url, "at_s": v.at_s,
                 "token_count": v.token_count, "duration_ms": v.duration_ms,
                 "ok": v.ok, "error": v.error}
                for v in list(self._history)[-15:]
            ],
            "errors": list(self._errors)[-10:],
        }
