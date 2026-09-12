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
    <div class="trading-summary" id="trading-summary"></div>

    <div class="trading-block trading-block-live" id="live-block" style="display:none">
      <div class="trading-block-title">
        <span>Live on-chain wallet · Solana</span>
        <span class="count" id="live-status">—</span>
      </div>
      <div id="live-body"></div>
    </div>

    <div class="trading-block trading-block-hood" id="hood-block" style="display:none">
      <div class="trading-block-title">
        <span>Live on-chain wallet · Robinhood Chain</span>
        <span class="count" id="hood-status">—</span>
      </div>
      <div id="hood-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Fresh launches · Solana + Robinhood-chain</span>
        <span class="count" id="fresh-count">0</span>
      </div>
      <div id="fresh-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Candidate pool · fresh + small-cap · mega-caps filtered</span>
        <span class="count" id="hot-count">0</span>
      </div>
      <div id="hot-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Smart-money leaderboard · rolling 24h realized PnL</span>
      </div>
      <div id="lb-body"></div>
    </div>

    <div class="trading-block">
      <div class="trading-block-title">
        <span>Tracked wallets</span>
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
  updateLive(trading.live);
  updateHood(trading.hood);
  updateFresh(trading.fresh_launches || []);
  updateHot(trading.hot_tokens || []);
  updateLeaderboard(trading.leaderboard || []);
  updateWallets(trading.tracked_wallets || [], trading.discovery_status || {},
                trading.tuning || {});
}

function updateLive(live) {
  const block = document.getElementById("live-block");
  if (!block) return;
  if (!live) {
    block.style.display = "none";
    return;
  }
  block.style.display = "";
  const st = document.getElementById("live-status");
  if (st) {
    st.textContent = live.halted
      ? "HALTED"
      : (live.dry_run ? "DRY-RUN" : "ARMED");
    st.className = "count " + (live.halted ? "neg" : (live.dry_run ? "warn" : "pos"));
  }
  const solscanUrl = `https://solscan.io/account/${live.wallet}`;
  const L = live.limits || {};
  const rowsHtml = (live.recent_trades || []).slice().reverse().map((r) => {
    const cls = r.status === "confirmed" ? "pos"
              : r.status === "blocked"   ? "neg"
              : r.status === "failed"    ? "neg"
              : "";
    const sigCell = r.tx_sig
      ? `<a class="mono" href="https://solscan.io/tx/${r.tx_sig}" target="_blank" rel="noopener">${short(r.tx_sig, 6)}</a>`
      : "—";
    return `<tr>
      <td class="mono">${new Date(r.t * 1000).toLocaleTimeString()}</td>
      <td class="${r.side === 'buy' ? 'pos' : 'neg'}">${r.side.toUpperCase()}</td>
      <td>${escapeHtml(r.token_symbol || "—")}</td>
      <td class="mono num">${Math.abs(r.sol_amount).toFixed(4)}</td>
      <td class="mono ${cls}">${r.status.toUpperCase()}</td>
      <td>${sigCell}</td>
    </tr>`;
  }).join("");
  const body = document.getElementById("live-body");
  if (body) {
    body.innerHTML = `
      <div class="live-header">
        <div class="live-header-cell">
          <div class="live-header-label">WALLET</div>
          <div class="live-header-value mono">
            <a href="${solscanUrl}" target="_blank" rel="noopener">${short(live.wallet, 6)}</a>
          </div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">SOL BALANCE</div>
          <div class="live-header-value mono">${(live.sol_balance || 0).toFixed(4)}</div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">HOURLY / DAILY</div>
          <div class="live-header-value mono">
            ${(live.spent_last_hour_sol || 0).toFixed(4)} /
            ${(live.spent_last_day_sol || 0).toFixed(4)} SOL
          </div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">CAPS · trade / hr / day / positions</div>
          <div class="live-header-value mono">
            ${(L.max_trade_sol || 0).toFixed(4)} ·
            ${(L.max_hourly_sol || 0).toFixed(4)} ·
            ${(L.max_daily_sol || 0).toFixed(4)} ·
            ${L.max_positions || 0}
          </div>
        </div>
      </div>
      ${rowsHtml ? `
        <table class="trading-table live-tx-table">
          <thead><tr>
            <th>TIME</th><th>SIDE</th><th>TOKEN</th><th>SOL</th><th>STATUS</th><th>TX</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      ` : `<div class="empty">No on-chain trades yet. The brain will fire real swaps once it clears the ${((L.min_confidence || 0) * 100).toFixed(0)}% confidence gate on a candidate with ≥ $${(L.min_liquidity_usd || 0).toLocaleString()} liquidity.</div>`}
    `;
  }
}

function updateHood(hood) {
  const block = document.getElementById("hood-block");
  if (!block) return;
  if (!hood) {
    block.style.display = "none";
    return;
  }
  block.style.display = "";
  const st = document.getElementById("hood-status");
  if (st) {
    const funded = (hood.eth_balance || 0) > 0;
    const label = hood.halted    ? "HALTED"
                : hood.dry_run   ? "DRY-RUN"
                : !funded        ? "AWAITING ETH"
                : "ARMED";
    st.textContent = label;
    st.className = "count " + (hood.halted ? "neg"
                            : hood.dry_run  ? "warn"
                            : !funded       ? "warn"
                            : "pos");
  }
  const explorerAddr = hood.explorer_addr
    || `https://robinhoodchain.blockscout.com/address/${hood.wallet}`;
  const L = hood.limits || {};
  const rowsHtml = (hood.recent_trades || []).slice().reverse().map((r) => {
    const cls = r.status === "confirmed" ? "pos"
              : r.status === "blocked"   ? "neg"
              : r.status === "failed"    ? "neg"
              : "";
    const sigCell = r.tx_hash
      ? `<a class="mono" href="https://robinhoodchain.blockscout.com/tx/${r.tx_hash}" target="_blank" rel="noopener">${short(r.tx_hash, 6)}</a>`
      : "—";
    return `<tr>
      <td class="mono">${new Date(r.t * 1000).toLocaleTimeString()}</td>
      <td class="${r.side === 'buy' ? 'pos' : 'neg'}">${(r.side || '').toUpperCase()}</td>
      <td>${escapeHtml(r.token_symbol || "—")}</td>
      <td class="mono num">${Math.abs(r.eth_amount || 0).toFixed(6)}</td>
      <td class="mono ${cls}">${(r.status || '').toUpperCase()}</td>
      <td>${sigCell}</td>
    </tr>`;
  }).join("");
  const body = document.getElementById("hood-body");
  if (body) {
    const pnl = hood.pnl || {};
    const openRows = (pnl.open_positions || []).map((p) => {
      const pnlCls = clsSign(p.pnl_eth);
      const pctStr = p.pnl_pct == null ? "—" : (p.pnl_pct >= 0 ? "+" : "") + Number(p.pnl_pct).toFixed(1) + "%";
      const cur = p.current_eth > 0 ? Number(p.current_eth).toFixed(6) : "quoting…";
      return `<tr>
        <td>${escapeHtml(p.symbol || "—")}</td>
        <td class="mono num">${Number(p.eth_in || 0).toFixed(6)}</td>
        <td class="mono num">${cur}</td>
        <td class="mono num ${pnlCls}">${Number(p.pnl_eth || 0).toFixed(6)}</td>
        <td class="mono ${pnlCls}">${pctStr}</td>
        <td>${p.buy_hash ? `<a class="mono" target="_blank" rel="noopener" href="https://robinhoodchain.blockscout.com/tx/${p.buy_hash}">${short(p.buy_hash, 5)}</a>` : "—"}</td>
      </tr>`;
    }).join("");
    const closedRows = (pnl.recent_closed || []).map((c) => {
      const pnlCls = clsSign(c.pnl_eth);
      const pctStr = (c.pnl_pct >= 0 ? "+" : "") + Number(c.pnl_pct || 0).toFixed(1) + "%";
      return `<tr>
        <td class="mono">${new Date(c.closed_at_s * 1000).toLocaleTimeString()}</td>
        <td>${escapeHtml(c.symbol || "—")}</td>
        <td class="mono num">${Number(c.eth_in || 0).toFixed(6)}</td>
        <td class="mono num">${Number(c.eth_out || 0).toFixed(6)}</td>
        <td class="mono num ${pnlCls}">${Number(c.pnl_eth || 0).toFixed(6)}</td>
        <td class="mono ${pnlCls}">${pctStr}</td>
        <td>${c.sell_hash ? `<a class="mono" target="_blank" rel="noopener" href="https://robinhoodchain.blockscout.com/tx/${c.sell_hash}">${short(c.sell_hash, 5)}</a>` : "—"}</td>
      </tr>`;
    }).join("");
    const totalCls = clsSign(pnl.total_pnl_eth);
    const realizedCls = clsSign(pnl.realized_pnl_eth);
    const unrealCls = clsSign(pnl.unrealized_pnl_eth);
    const winRate = pnl.n_closed > 0
      ? ((pnl.closed_wins || 0) / pnl.n_closed * 100).toFixed(0) + "%"
      : "—";
    body.innerHTML = `
      <div class="live-header">
        <div class="live-header-cell">
          <div class="live-header-label">WALLET · chainId ${hood.chain_id || 4663}</div>
          <div class="live-header-value mono">
            <a href="${explorerAddr}" target="_blank" rel="noopener">${short(hood.wallet, 6)}</a>
          </div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">ETH BALANCE</div>
          <div class="live-header-value mono">${(hood.eth_balance || 0).toFixed(6)}</div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">TOTAL P&amp;L</div>
          <div class="live-header-value mono ${totalCls}">
            ${(pnl.total_pnl_eth >= 0 ? "+" : "") + Number(pnl.total_pnl_eth || 0).toFixed(6)} ETH
          </div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">REALIZED / UNREALIZED</div>
          <div class="live-header-value mono">
            <span class="${realizedCls}">${(pnl.realized_pnl_eth >= 0 ? "+" : "") + Number(pnl.realized_pnl_eth || 0).toFixed(6)}</span>
            /
            <span class="${unrealCls}">${(pnl.unrealized_pnl_eth >= 0 ? "+" : "") + Number(pnl.unrealized_pnl_eth || 0).toFixed(6)}</span>
          </div>
        </div>
        <div class="live-header-cell">
          <div class="live-header-label">TRADES · win rate</div>
          <div class="live-header-value mono">
            ${pnl.n_open || 0} open · ${pnl.n_closed || 0} closed · ${winRate}
          </div>
        </div>
      </div>

      ${openRows ? `
        <div class="trading-block-subtitle">OPEN POSITIONS · live-marked to Uniswap V3 quote</div>
        <table class="trading-table live-tx-table">
          <thead><tr>
            <th>TOKEN</th><th>ETH IN</th><th>ETH NOW</th><th>P&amp;L (ETH)</th><th>P&amp;L %</th><th>BUY TX</th>
          </tr></thead>
          <tbody>${openRows}</tbody>
        </table>
      ` : ""}

      ${closedRows ? `
        <div class="trading-block-subtitle">RECENT CLOSES · realized</div>
        <table class="trading-table live-tx-table">
          <thead><tr>
            <th>TIME</th><th>TOKEN</th><th>ETH IN</th><th>ETH OUT</th><th>P&amp;L</th><th>%</th><th>SELL TX</th>
          </tr></thead>
          <tbody>${closedRows}</tbody>
        </table>
      ` : ""}
      ${rowsHtml ? `
        <table class="trading-table live-tx-table">
          <thead><tr>
            <th>TIME</th><th>SIDE</th><th>TOKEN</th><th>ETH</th><th>STATUS</th><th>TX</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      ` : `<div class="empty">
        Robinhood-Chain executor is armed.  It routes through Uniswap V3
        (SwapRouter02 <span class="mono">${short(hood.router || "", 6)}</span>).
        ${(hood.eth_balance || 0) <= 0
          ? `Send some ETH on Robinhood Chain (chainId 4663) to
             <span class="mono">${short(hood.wallet, 6)}</span> to arm live
             swaps; until then the brain trades HOOD-chain tokens in paper
             only.`
          : `Waiting for a HOOD-chain candidate to clear the
             ${((L.min_confidence || 0) * 100).toFixed(0)}% confidence gate
             with ≥ $${(L.min_liquidity_usd || 0).toLocaleString()} liquidity.`}
      </div>`}
    `;
  }
}

function updateSummary(t) {
  const st = t.trader_cortex_stats || {};
  const live = t.live || {};
  const hood = t.hood || {};
  const solBal = Number(live.sol_balance || 0);
  const ethBal = Number(hood.eth_balance || 0);
  const liveTrades = (live.recent_trades || []).filter((r) => r.status === "confirmed").length
                    + (hood.recent_trades || []).filter((r) => r.status === "confirmed").length;
  const openPos = Number(live.open_positions_count || 0) + Number(hood.open_positions_count || 0);
  const armed = (live.wallet && !live.halted && !live.dry_run)
             || (hood.wallet && !hood.halted && !hood.dry_run);
  const html = `
    <div class="meter"><div class="meter-label">STATUS</div>
      <div class="meter-value ${armed ? 'pos' : 'warn'}">${armed ? 'LIVE' : 'STANDBY'}<br/><span style="font-size:10px">on-chain body</span></div></div>
    <div class="meter"><div class="meter-label">SOL WALLET</div>
      <div class="meter-value mono">${solBal.toFixed(4)}<br/><span style="font-size:10px">${live.wallet ? live.wallet.slice(0,4) + '…' + live.wallet.slice(-4) : '—'}</span></div></div>
    <div class="meter"><div class="meter-label">ETH WALLET</div>
      <div class="meter-value mono">${ethBal.toFixed(6)}<br/><span style="font-size:10px">${hood.wallet ? hood.wallet.slice(0,4) + '…' + hood.wallet.slice(-4) : '—'}</span></div></div>
    <div class="meter"><div class="meter-label">ON-CHAIN TRADES · OPEN</div>
      <div class="meter-value">${liveTrades}<br/><span style="font-size:10px">${openPos} open</span></div></div>
    <div class="meter"><div class="meter-label">CORTEX UPDATES</div>
      <div class="meter-value">${st.bc_updates || 0} BC<br/><span style="font-size:10px">${st.rl_updates || 0} RL</span></div></div>
    <div class="meter" title="How often the brain formed its own opinion (independent agree + conviction) vs. copied a wallet."><div class="meter-label">AUTONOMY</div>
      <div class="meter-value">${(st.autonomy_pct ?? 0).toFixed(1)}%<br/><span style="font-size:10px">${st.independent_agrees || 0} own · ${st.convictions || 0} conv · ${st.imitated || 0} imit</span></div></div>
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
      <th>TOKEN</th><th>CHAIN</th><th>PRICE</th><th>1H</th><th>24H</th><th>VOL 24H</th><th>LIQ</th><th>AGE</th>
    </tr></thead><tbody>
    ${hot.slice(0, 12).map((p) => `
      <tr>
        <td class="sym">
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.base_symbol || "?")}</a>
          ${p.is_fresh_launch ? `<span class="fresh-badge" title="fresh launch, ${p.fresh_age_minutes}m old">NEW</span>` : ""}
        </td>
        <td>${chainBadge(p.chain)}</td>
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

function chainBadge(chain) {
  const c = (chain || "solana").toLowerCase();
  const map = {
    solana:   { label: "SOL",   cls: "chain-sol" },
    robinhood:{ label: "HOOD",  cls: "chain-hood" },
    ethereum: { label: "ETH",   cls: "chain-eth" },
    base:     { label: "BASE",  cls: "chain-base" },
    bsc:      { label: "BSC",   cls: "chain-bsc" },
  };
  const m = map[c] || { label: c.toUpperCase().slice(0, 6), cls: "chain-other" };
  return `<span class="chain-badge ${m.cls}">${m.label}</span>`;
}

function chainExplorerUrl(mint, chain) {
  // Chain-aware explorer link.
  const c = (chain || "solana").toLowerCase();
  if (c === "robinhood") {
    // Robinhood-chain uses EVM addresses. DexScreener is the best
    // neutral explorer we can link to without picking a Robinhood-side
    // block-explorer URL scheme that may change.
    return `https://dexscreener.com/robinhood/${encodeURIComponent(mint)}`;
  }
  if (c === "ethereum")  return `https://etherscan.io/token/${encodeURIComponent(mint)}`;
  if (c === "base")      return `https://basescan.org/token/${encodeURIComponent(mint)}`;
  if (c === "bsc")       return `https://bscscan.com/token/${encodeURIComponent(mint)}`;
  return `https://solscan.io/token/${encodeURIComponent(mint)}`;
}

function updateFresh(fresh) {
  document.getElementById("fresh-count").textContent = fresh.length;
  const el = document.getElementById("fresh-body");
  if (!fresh.length) {
    el.innerHTML = `<div class="trading-empty">
      polling every Solana launchpad for freshly-minted tokens…
    </div>`;
    return;
  }
  el.innerHTML = `<table class="trading-table"><thead><tr>
      <th>TOKEN</th><th>CHAIN</th><th>NAME</th><th>AGE</th><th>MCAP</th><th>STATUS</th><th>LINKS</th>
    </tr></thead><tbody>
    ${fresh.slice(0, 14).map((c) => {
      const mintUrl = chainExplorerUrl(c.mint, c.chain);
      const ageStr = c.age_minutes < 60
        ? `${Math.round(c.age_minutes)}m`
        : `${(c.age_minutes / 60).toFixed(1)}h`;
      const status = c.complete
        ? `<span class="fresh-badge grad">GRAD</span>`
        : (c.king_of_the_hill
            ? `<span class="fresh-badge koth">KOTH</span>`
            : `<span class="mono-sm" style="color:var(--text-muted)">bonding</span>`);
      const links = [
        c.twitter ? `<a href="${escapeHtml(c.twitter)}" target="_blank" rel="noopener" title="twitter">𝕏</a>` : "",
        c.telegram ? `<a href="${escapeHtml(c.telegram)}" target="_blank" rel="noopener" title="telegram">TG</a>` : "",
        c.website ? `<a href="${escapeHtml(c.website)}" target="_blank" rel="noopener" title="website">web</a>` : "",
      ].filter(Boolean).join(" ");
      return `
      <tr>
        <td class="sym">
          <a href="${escapeHtml(mintUrl)}" target="_blank" rel="noopener">${escapeHtml(c.symbol || "?")}</a>
        </td>
        <td>${chainBadge(c.chain)}</td>
        <td class="mono-sm" style="color:var(--text-muted)">${escapeHtml((c.name || "").slice(0, 22))}</td>
        <td class="mono-sm">${ageStr}</td>
        <td>${fmtBig(c.usd_market_cap)}</td>
        <td>${status}</td>
        <td class="mono-sm">${links || "—"}</td>
      </tr>`;
    }).join("")}
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
