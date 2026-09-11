/**
 * web_view.js — renders the "second body" panel.
 *
 * The backend runs a headless Chromium (Phase 2 embodiment) that cycles
 * through Solana-oriented crypto sites, screenshotting each one and
 * pulling structured tokens out of the DOM. This module paints:
 *
 *   * a live JPEG screenshot of the page the brain just looked at
 *   * the URL + which stop on the tour it was
 *   * the tokens it extracted, with change hints when visible
 *   * a rolling log of recent visits (site · duration · ok/error)
 *
 * Everything is derived from `payload.web`, streamed on every tick.
 */

const RELATIVE_TIME_UPDATE_MS = 1000;

let panelEl = null;
let renderedShotKey = null; // fingerprint: url + at_s so we only paint changes
let lastPayload = null;
let tickTimer = null;

export function initWebView(container) {
  panelEl = container;
  panelEl.innerHTML = renderShell();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => tickTimestamps(), RELATIVE_TIME_UPDATE_MS);
}

export function updateWebView(web) {
  lastPayload = web || {};
  if (!panelEl) return;

  const enabledEl   = panelEl.querySelector("[data-slot=enabled]");
  const urlEl       = panelEl.querySelector("[data-slot=url]");
  const siteEl      = panelEl.querySelector("[data-slot=site]");
  const nextEl      = panelEl.querySelector("[data-slot=next]");
  const shotWrapEl  = panelEl.querySelector("[data-slot=shot-wrap]");
  const shotImgEl   = panelEl.querySelector("[data-slot=shot]");
  const shotEmptyEl = panelEl.querySelector("[data-slot=shot-empty]");
  const shotAtEl    = panelEl.querySelector("[data-slot=shot-at]");
  const tokensEl    = panelEl.querySelector("[data-slot=tokens]");
  const visitsEl    = panelEl.querySelector("[data-slot=visits]");
  const statsEl     = panelEl.querySelector("[data-slot=stats]");
  const errorsEl    = panelEl.querySelector("[data-slot=errors]");

  if (!web || web.enabled === false) {
    enabledEl.textContent = "off";
    enabledEl.className = "web-badge off";
    urlEl.textContent = "";
    siteEl.textContent = "web embodiment disabled";
    nextEl.textContent = "";
    shotEmptyEl.style.display = "block";
    shotImgEl.style.display = "none";
    tokensEl.innerHTML = "";
    visitsEl.innerHTML = "";
    statsEl.textContent = web && web.boot_error ? `boot error: ${web.boot_error}` : "";
    return;
  }

  const latest = web.latest || null;

  enabledEl.textContent = "live";
  enabledEl.className = "web-badge on";

  if (latest) {
    siteEl.textContent = latest.site_name || "(unnamed page)";
    urlEl.textContent = latest.url || "";
    urlEl.href = latest.url || "#";
  } else {
    siteEl.textContent = "warming up chromium…";
    urlEl.textContent = "";
    urlEl.removeAttribute("href");
  }

  const nextName = web.next_up_name;
  const interval = web.interval_s || 20;
  nextEl.textContent = nextName
    ? `next up: ${nextName} · every ${Math.round(interval)}s`
    : "";

  // Screenshot — only re-paint the <img> when the shot actually changed.
  if (latest && latest.screenshot_b64) {
    const key = `${latest.url}|${latest.screenshot_at_s}`;
    if (key !== renderedShotKey) {
      renderedShotKey = key;
      shotImgEl.src = `data:image/jpeg;base64,${latest.screenshot_b64}`;
      shotImgEl.alt = latest.site_name || "web screenshot";
    }
    shotImgEl.style.display = "block";
    shotEmptyEl.style.display = "none";
    shotAtEl.dataset.atS = String(latest.screenshot_at_s || 0);
    shotAtEl.textContent = formatAgo(latest.screenshot_at_s);
  } else {
    shotImgEl.style.display = "none";
    shotEmptyEl.style.display = "block";
    shotAtEl.textContent = "";
  }

  // Extracted tokens.
  const tokens = (latest && latest.tokens) || [];
  if (tokens.length === 0) {
    tokensEl.innerHTML = `<div class="web-empty">no tokens extracted from this page — screenshot only</div>`;
  } else {
    tokensEl.innerHTML = tokens.slice(0, 24).map((t) => renderTokenRow(t)).join("");
  }

  // Recent visits.
  const visits = (web.recent_visits || []).slice(-8).reverse();
  if (visits.length === 0) {
    visitsEl.innerHTML = `<li class="web-empty">no visits yet</li>`;
  } else {
    visitsEl.innerHTML = visits.map((v) => renderVisitRow(v)).join("");
  }

  // Stats line.
  const disc = (web.discovered_symbols || []).length;
  const addrs = web.discovered_addrs_count || 0;
  const done = web.visits_done || 0;
  statsEl.textContent =
    `${done} page visit(s) · ${disc} unique symbols · ${addrs} unique mints seen · ` +
    `chromium ${web.enabled ? "up" : "down"}`;

  // Errors (last few).
  const errs = (web.errors || []).slice(-4);
  if (errs.length === 0) {
    errorsEl.innerHTML = "";
  } else {
    errorsEl.innerHTML = `<div class="web-errors-title">Recent errors</div>` +
      errs.map((e) => `<div class="web-err">
        <span class="web-err-site">${escapeHtml(e.site_name || "")}</span>
        <span class="web-err-msg mono">${escapeHtml(e.error || "")}</span>
      </div>`).join("");
  }
}

export function updateWebTopbarStrip(web) {
  const label = document.getElementById("browser-strip-label");
  if (!label) return;
  if (!web || web.enabled === false) {
    label.textContent = "browser off";
    return;
  }
  const latest = web.latest || null;
  if (!latest) {
    label.textContent = `browser warming (${web.tour_length || 0} sites)`;
    return;
  }
  const siteShort = (latest.site_name || "").split("·")[0].trim() || latest.site_name || "";
  label.textContent = `${siteShort} · ${latest.token_count || 0} tokens`;
}

// ----------------------------------------------------------------------
function renderShell() {
  return `
    <div class="web-top">
      <div class="web-top-left">
        <span class="web-badge on" data-slot="enabled">live</span>
        <span class="web-site" data-slot="site">warming up…</span>
      </div>
      <a class="web-url mono" data-slot="url" target="_blank" rel="noopener noreferrer"></a>
      <div class="web-next mono" data-slot="next"></div>
    </div>
    <div class="web-body">
      <div class="web-shot-col">
        <div class="web-shot-wrap" data-slot="shot-wrap">
          <img class="web-shot" data-slot="shot" alt="" />
          <div class="web-shot-empty" data-slot="shot-empty">no screenshot yet</div>
          <span class="web-shot-at mono" data-slot="shot-at"></span>
        </div>
      </div>
      <div class="web-side-col">
        <div class="web-side-head">Tokens visible on this page</div>
        <div class="web-tokens" data-slot="tokens"></div>
        <div class="web-side-head">Recent visits</div>
        <ul class="web-visits" data-slot="visits"></ul>
      </div>
    </div>
    <div class="web-footer">
      <span class="web-stats mono" data-slot="stats"></span>
      <div class="web-errors" data-slot="errors"></div>
    </div>
  `;
}

function renderTokenRow(t) {
  const sym = t.symbol || "?";
  const change = t.change_hint || "";
  let changeCls = "";
  if (change.startsWith("+")) changeCls = "up";
  else if (change.startsWith("-")) changeCls = "down";
  const text = t.text || "";
  const addr = t.address || "";
  const shortAddr = addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
  return `
    <div class="web-tok">
      <span class="web-tok-sym">$${escapeHtml(sym)}</span>
      <span class="web-tok-change mono ${changeCls}">${escapeHtml(change)}</span>
      <span class="web-tok-text">${escapeHtml(text.slice(0, 60))}</span>
      <span class="web-tok-addr mono">${escapeHtml(shortAddr)}</span>
    </div>
  `;
}

function renderVisitRow(v) {
  const cls = v.ok ? "ok" : "err";
  const label = v.ok ? "ok" : "err";
  const dur = v.duration_ms != null ? `${v.duration_ms}ms` : "";
  return `
    <li class="web-visit ${cls}">
      <span class="web-visit-status">${label}</span>
      <span class="web-visit-site">${escapeHtml(v.site_name || "")}</span>
      <span class="web-visit-meta mono">${escapeHtml(dur)} · ${escapeHtml(v.token_count + " tok")}</span>
      <span class="web-visit-at mono" data-at-s="${v.at_s}">${formatAgo(v.at_s)}</span>
    </li>
  `;
}

function formatAgo(ts) {
  if (!ts) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function tickTimestamps() {
  if (!panelEl) return;
  panelEl.querySelectorAll("[data-at-s]").forEach((el) => {
    const ts = parseFloat(el.dataset.atS || "0");
    if (ts) el.textContent = formatAgo(ts);
  });
  const shotAtEl = panelEl.querySelector("[data-slot=shot-at]");
  if (shotAtEl && shotAtEl.dataset.atS) {
    shotAtEl.textContent = formatAgo(parseFloat(shotAtEl.dataset.atS));
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
