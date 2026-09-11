/**
 * trading.js — the "Trading Desk" panel.
 *
 * Renders the paper trader's book, hot Solana tokens, tracked smart wallets,
 * our from-scratch PnL leaderboard, and a small equity-curve sparkline.
 * Also exposes an "add wallet" form so the user can plug in extra addresses
 * they think are alpha.
 */

let onCommand = () => {};

export function initTrading(panelEl, opts = {}) {
  onCommand = opts.onCommand || (() => {});
  panelEl.innerHTML = `
    <div class="trading-intro">
      <strong>Paper trading only — no real money.</strong>
      The brain watches a batch of Solana wallets, does behaviour cloning on
      their on-chain trades, then simulates buys/sells at live prices with the
      cloned policy. Closed-trade PnL is back-propagated into the cortex, with
      more profitable wallets getting more weight.
      <span class="warn">⚠ Phase 4 (real on-chain execution) is <strong>disabled</strong>
      — enabling it requires you to plug in a Solana private key and hard limits.</span>
    </div>

    <div class="trading-summary" id="trading-summary"></div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Paper equity curve</span>
        <span class="count" id="eqcurve-hint">—</span>
      </div>
      <div class="equity-curve-wrap"><svg id="eq-curve" preserveAspectRatio="none"></svg></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Positions</span><span class="count" id="pos-count">0</span>
      </div>
      <div id="pos-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>🔥 Hot Solana meme tokens</span><span class="count" id="hot-count">0</span>
      </div>
      <div id="hot-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>🧠 Smart-money leaderboard (rolling 24h realized PnL)</span>
      </div>
      <div id="lb-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>👁 Tracked wallets</span>
        <span class="count" id="w-count">0</span>
        <span class="trading-block-note" id="w-auto-note">auto-discovering…</span>
      </div>
      <div id="wallets-body"></div>
      <div class="trading-add-wallet">
        <input id="w-addr" placeholder="Solana wallet address…" spellcheck="false"/>
        <input id="w-label" class="label" placeholder="Label (optional)"/>
        <button class="btn btn-mini" id="w-track">+ Track</button>
      </div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Recent closes</span><span class="count" id="closed-count">0</span>
      </div>
      <div id="closed-body"></div>
    </div>
  `;

  document.getElementById("w-track").addEventListener("click", () => {
    const addr = document.getElementById("w-addr").value.trim();
    const label = document.getElementById("w-label").value.trim();
    if (!addr || addr.length < 32) return;
    onCommand("add_wallet", { address: addr, label });
    document.getElementById("w-addr").value = "";
    document.getElementById("w-label").value = "";
  });
}

const fmtUsd = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(6);
};
const fmtBig = (v) => {
  const n = Number(v || 0);
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(0);
};
const fmtPct = (v) => (v >= 0 ? "+" : "") + Number(v || 0).toFixed(2) + "%";
const clsSign = (v) => (Number(v) > 0 ? "pos" : (Number(v) < 0 ? "neg" : ""));
const escapeHtml = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (s, n = 4) => (!s ? "—" : (s.length > n * 2 + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s));

export function updateTrading(trading) {
  if (!trading) return;
  updateSummary(trading);
  updateEquityCurve(trading.paper.equity_curve || [], trading.paper.start_usd);
  updatePositions(trading.paper.positions || []);
  updateHot(trading.hot_tokens || []);
  updateLeaderboard(trading.leaderboard || []);
  updateWallets(trading.tracked_wallets || [], trading.discovery_status || {},
                trading.tuning || {});
  updateClosed(trading.paper.closed_recent || []);
}

function updateSummary(t) {
  const p = t.paper || {};
  const st = t.trader_cortex_stats || {};
  const eq = p.equity_usd || 0;
  const pnl = p.total_pnl_usd || 0;
  const pnlPct = p.total_pnl_pct || 0;
  const html = `
    <div class="meter"><div class="meter-label">EQUITY</div>
      <div class="meter-value">${fmtUsd(eq)}</div></div>
    <div class="meter"><div class="meter-label">TOTAL PnL</div>
      <div class="meter-value ${clsSign(pnl)}">${fmtUsd(pnl)}<br/><span style="font-size:10px">${fmtPct(pnlPct)}</span></div></div>
    <div class="meter"><div class="meter-label">TRADES · WIN%</div>
      <div class="meter-value">${p.n_trades_closed || 0}<br/><span style="font-size:10px">${Math.round((p.win_rate || 0) * 100)}%</span></div></div>
    <div class="meter"><div class="meter-label">CORTEX UPDATES</div>
      <div class="meter-value">${st.bc_updates || 0} BC<br/><span style="font-size:10px">${st.rl_updates || 0} RL</span></div></div>
  `;
  document.getElementById("trading-summary").innerHTML = html;
}

function updateEquityCurve(curve, startUsd) {
  const svg = document.getElementById("eq-curve");
  const W = svg.clientWidth || 300, H = 90;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const hint = document.getElementById("eqcurve-hint");
  if (!curve.length) {
    svg.innerHTML = `<text x="50%" y="50%" fill="#5a6a82" font-size="10" text-anchor="middle" font-family="JetBrains Mono">waiting for first equity sample…</text>`;
    hint.textContent = "";
    return;
  }
  const values = curve.map((c) => c.eq);
  const min = Math.min(...values, startUsd);
  const max = Math.max(...values, startUsd);
  const pad = Math.max(1, (max - min) * 0.08);
  const yMin = min - pad, yMax = max + pad;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * (W - 4) + 2;
    const y = H - ((v - yMin) / (yMax - yMin)) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaPts = pts + ` ${W - 2},${H} 2,${H}`;
  const baseY = H - ((startUsd - yMin) / (yMax - yMin)) * (H - 4) - 2;
  svg.innerHTML = `
    <defs>
      <linearGradient id="eqGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#f97316" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line class="equity-curve-baseline" x1="0" x2="${W}" y1="${baseY}" y2="${baseY}"/>
    <polygon class="equity-curve-area" points="${areaPts}"/>
    <polyline class="equity-curve-line" points="${pts}"/>
  `;
  hint.textContent = `${values.length} samples · start ${fmtUsd(startUsd)} · now ${fmtUsd(values[values.length - 1])}`;
}

function updatePositions(positions) {
  document.getElementById("pos-count").textContent = positions.length;
  const el = document.getElementById("pos-body");
  if (!positions.length) {
    el.innerHTML = `<div class="trading-empty">no open positions</div>`;
    return;
  }
  el.innerHTML = `<table class="trading-table"><thead><tr>
      <th>TOKEN</th><th>ENTRY</th><th>NOW</th><th>PnL</th><th>%</th><th>HOLD</th>
    </tr></thead><tbody>
    ${positions.map((p) => `
      <tr>
        <td class="sym">${escapeHtml(p.token_symbol || short(p.token_mint))}</td>
        <td>${fmtUsd(p.entry_price_usd)}</td>
        <td>${fmtUsd(p.current_price_usd)}</td>
        <td class="${clsSign(p.pnl_usd)}">${fmtUsd(p.pnl_usd)}</td>
        <td class="${clsSign(p.pnl_pct)}">${fmtPct(p.pnl_pct)}</td>
        <td class="mono-sm">${fmtDuration(p.hold_seconds)}</td>
      </tr>
    `).join("")}
    </tbody></table>`;
}

function updateHot(hot) {
  document.getElementById("hot-count").textContent = hot.length;
  const el = document.getElementById("hot-body");
  if (!hot.length) {
    el.innerHTML = `<div class="trading-empty">fetching from DexScreener…</div>`;
    return;
  }
  el.innerHTML = `<table class="trading-table"><thead><tr>
      <th>TOKEN</th><th>PRICE</th><th>1H</th><th>24H</th><th>VOL 24H</th><th>LIQ</th><th>AGE</th>
    </tr></thead><tbody>
    ${hot.slice(0, 12).map((p) => `
      <tr>
        <td class="sym"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.base_symbol || "?")}</a></td>
        <td>${fmtUsd(p.price_usd)}</td>
        <td class="${clsSign(p.price_change_h1)}">${fmtPct(p.price_change_h1)}</td>
        <td class="${clsSign(p.price_change_h24)}">${fmtPct(p.price_change_h24)}</td>
        <td>${fmtBig(p.volume_h24)}</td>
        <td>${fmtBig(p.liquidity_usd)}</td>
        <td class="mono-sm">${p.age_hours > 24 ? (p.age_hours / 24).toFixed(1) + "d" : p.age_hours.toFixed(1) + "h"}</td>
      </tr>
    `).join("")}
    </tbody></table>`;
}

function updateLeaderboard(rows) {
  const el = document.getElementById("lb-body");
  if (!rows.length) {
    el.innerHTML = `<div class="trading-empty">no PnL yet — waiting for tracked wallets to trade</div>`;
    return;
  }
  el.innerHTML = `<table class="trading-table"><thead><tr>
      <th>WALLET</th><th>LABEL</th><th>REALIZED PnL</th><th>TRADES</th><th>WIN%</th>
    </tr></thead><tbody>
    ${rows.map((r) => `
      <tr>
        <td class="mono-sm">${escapeHtml(short(r.wallet))}</td>
        <td class="mono-sm">${escapeHtml(r.label || "—")}</td>
        <td class="${clsSign(r.realized_pnl_usd)}">${fmtUsd(r.realized_pnl_usd)}</td>
        <td>${r.n_trades}</td>
        <td>${Math.round(r.win_rate * 100)}%</td>
      </tr>
    `).join("")}
    </tbody></table>`;
}

function updateWallets(wallets, discoveryStatus, tuning) {
  document.getElementById("w-count").textContent = wallets.length;
  const target = tuning.target_tracked_wallets || 20;
  const note = document.getElementById("w-auto-note");
  const scanSecs = tuning.discovery_interval || 180;
  const lastScanMs = discoveryStatus.last_scan_ms || 0;
  const lastScanAgo = lastScanMs
    ? fmtAgo(lastScanMs / 1000) : "never";
  note.textContent =
    `auto-discovery: target ${target} · scan every ${Math.round(scanSecs)}s · ` +
    `last scan ${lastScanAgo} · ${discoveryStatus.seen_wallet_count || 0} candidates seen so far`;

  const el = document.getElementById("wallets-body");
  if (!wallets.length) {
    el.innerHTML = `<div class="trading-empty">
      no wallets tracked yet — the brain is scanning pumping tokens on-chain
      for their most active traders. Or add one manually below.
    </div>`;
    return;
  }
  el.innerHTML = `<table class="trading-table"><thead><tr>
      <th>WALLET</th><th>SOURCE</th><th>LABEL</th><th>OBS TRADES</th><th>LAST</th>
    </tr></thead><tbody>
    ${wallets.map((w) => {
      const src = w.source || "user";
      let sym = "";
      let pump = "";
      if (w.extra && w.extra.source_token_symbol) {
        sym = w.extra.source_token_symbol;
        pump = w.extra.source_token_pump_pct_24h != null
          ? ` ${fmtPct(w.extra.source_token_pump_pct_24h)}` : "";
      }
      const srcCell = src === "auto"
        ? `<span class="src-tag src-auto" title="Discovered on-chain from $${sym}${pump}">AUTO · $${escapeHtml(sym)}</span>`
        : (src === "env"
            ? `<span class="src-tag src-env">ENV</span>`
            : `<span class="src-tag src-user">USER</span>`);
      return `
      <tr>
        <td class="mono-sm">${escapeHtml(short(w.wallet))}</td>
        <td class="mono-sm">${srcCell}</td>
        <td class="mono-sm">${escapeHtml(w.label || "—")}</td>
        <td>${w.recent_trade_count}</td>
        <td class="mono-sm">${w.last_trade_time ? fmtAgo(w.last_trade_time) : "—"}</td>
      </tr>
      `;
    }).join("")}
    </tbody></table>`;
}

function updateClosed(closed) {
  document.getElementById("closed-count").textContent = closed.length;
  const el = document.getElementById("closed-body");
  if (!closed.length) {
    el.innerHTML = `<div class="trading-empty">no closed trades yet</div>`;
    return;
  }
  el.innerHTML = `<table class="trading-table"><thead><tr>
      <th>TOKEN</th><th>PnL</th><th>%</th><th>HOLD</th><th>REASON</th>
    </tr></thead><tbody>
    ${[...closed].reverse().map((c) => `
      <tr>
        <td class="sym">${escapeHtml(c.token_symbol || short(c.token_mint))}</td>
        <td class="${clsSign(c.pnl_usd)}">${fmtUsd(c.pnl_usd)}</td>
        <td class="${clsSign(c.pnl_pct)}">${fmtPct(c.pnl_pct * 100)}</td>
        <td class="mono-sm">${fmtDuration(c.closed_at_s - c.opened_at_s)}</td>
        <td class="mono-sm">${escapeHtml(c.reason || "—")}</td>
      </tr>
    `).join("")}
    </tbody></table>`;
}

function fmtDuration(sec) {
  if (!sec || sec < 0) return "—";
  if (sec < 60) return sec.toFixed(0) + "s";
  if (sec < 3600) return (sec / 60).toFixed(0) + "m";
  if (sec < 86400) return (sec / 3600).toFixed(1) + "h";
  return (sec / 86400).toFixed(1) + "d";
}

function fmtAgo(unixSec) {
  const s = Date.now() / 1000 - unixSec;
  if (s < 0) return "just now";
  return fmtDuration(s) + " ago";
}
