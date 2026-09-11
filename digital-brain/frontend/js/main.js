/**
 * main.js — wire together the 3D brain, environment, thoughts, and controls.
 *
 * Speaks WebSocket to the backend at /ws. Reconnects on drop.
 */

import { BrainScene } from "/static/js/brain3d.js";
import { EnvironmentView, renderEnvStats } from "/static/js/environment.js";
import { ThoughtStream } from "/static/js/thoughtstream.js";
import { loadKnowledge, setActiveConcept, categoryColor } from "/static/js/knowledge.js";
import { initTrading, updateTrading } from "/static/js/trading.js";

// ---------- DOM refs ----------
const brainContainer = document.getElementById("brain3d");
const envCanvas = document.getElementById("env-canvas");
const envStatsEl = document.getElementById("env-stats");
const regionDetailEl = document.getElementById("region-detail");
const regionTitleEl = document.getElementById("region-title");
const thoughtEl = document.getElementById("thought-stream");

const connDot = document.getElementById("conn-dot");
const connLabel = document.getElementById("conn-label");
const tickLabel = document.getElementById("tick-label");
const rewardLabel = document.getElementById("reward-label");
const modeBadge = document.getElementById("mode-badge");
const modeLabel = document.getElementById("mode-label");
const footerKnowledge = document.getElementById("footer-knowledge");
const btnResetEnv = document.getElementById("btn-reset-env");
const btnPokeFood = document.getElementById("btn-poke-food");
const btnPokeHazard = document.getElementById("btn-poke-hazard");
const tickHzInput = document.getElementById("tick-hz");
const tickHzLabel = document.getElementById("tick-hz-label");

const knowledgePanel = document.getElementById("knowledge-panel");
const tradingPanel = document.getElementById("trading-panel");
const detailTabs = document.getElementById("detail-tabs");

// Hero panel — main-view focus: what he's thinking + what he's about to do
const heroThinking          = document.getElementById("hero-thinking");
const heroThinkingHeadline  = document.getElementById("hero-thinking-headline");
const heroThinkingDetail    = document.getElementById("hero-thinking-detail");
const heroThinkingSrc       = document.getElementById("hero-thinking-src");
const heroIntent            = document.getElementById("hero-intent");
const intentWorldAction     = document.getElementById("intent-world-action");
const intentWorldConf       = document.getElementById("intent-world-conf");
const intentWorldProbs      = document.getElementById("intent-world-probs");
const intentTraderAction    = document.getElementById("intent-trader-action");
const intentTraderConf      = document.getElementById("intent-trader-conf");
const intentTraderSymbol    = document.getElementById("intent-trader-symbol");
const intentTraderProbs     = document.getElementById("intent-trader-probs");

const paperEquityEl = document.getElementById("paper-equity");
const paperPnlEl = document.getElementById("paper-pnl");
const footerTrader = document.getElementById("footer-trader");

// ---------- Init subsystems ----------
let selectedRegionName = null;

const brainScene = new BrainScene(brainContainer, {
  onRegionSelect: (r) => {
    selectedRegionName = r.name;
    switchDetailView("region");
    renderRegionDetail(r);
  },
});
const envView = new EnvironmentView(envCanvas);
const thoughtStream = new ThoughtStream(thoughtEl);

let latestBrain = null;
let detailView = "region";
let lastConceptId = null;
let modeInitialized = false;

loadKnowledge(knowledgePanel);
initTrading(tradingPanel, { onCommand: (cmd, extra) => send(cmd, extra) });

detailTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab[data-view]");
  if (!btn) return;
  switchDetailView(btn.dataset.view);
});

function switchDetailView(view) {
  if (!["region", "knowledge", "trading"].includes(view)) return;
  detailView = view;
  document.querySelectorAll("#detail-tabs .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
  document.getElementById("region-detail").style.display = view === "region" ? "" : "none";
  document.getElementById("knowledge-panel").style.display = view === "knowledge" ? "flex" : "none";
  document.getElementById("trading-panel").style.display  = view === "trading"   ? "flex" : "none";
}

// ---------- WebSocket ----------
let ws = null;
let reconnectDelay = 1000;

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}/ws`;
  ws = new WebSocket(url);
  connDot.className = "status-dot";
  connLabel.textContent = "connecting…";

  ws.onopen = () => {
    connDot.className = "status-dot online";
    connLabel.textContent = "connected";
    reconnectDelay = 1000;
  };
  ws.onclose = () => {
    connDot.className = "status-dot offline";
    connLabel.textContent = "disconnected — reconnecting…";
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 8000);
  };
  ws.onerror = () => {
    try { ws.close(); } catch (_) {}
  };
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      handlePayload(data);
    } catch (e) {
      console.error("Failed to parse payload", e);
    }
  };
}

function send(cmd, extra = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ cmd, ...extra }));
  }
}

// ---------- Payload handling ----------
function handlePayload(data) {
  const brain = data.brain;
  const env = data.env;
  latestBrain = brain;

  tickLabel.textContent = `t = ${brain.step}`;
  const cum = brain.reward_stats?.cumulative_reward ?? 0;
  rewardLabel.textContent = `Σreward ${cum.toFixed(2)}`;
  rewardLabel.style.color = cum > 0 ? "var(--good)" : (cum < 0 ? "var(--bad)" : "var(--text-secondary)");

  if (!modeInitialized && brain.mode) {
    modeLabel.textContent = brain.mode === "einstein" ? "◈ EINSTEIN" : "◇ DEFAULT";
    modeBadge.classList.toggle("mode-default", brain.mode !== "einstein");
    modeInitialized = true;
  }
  const knowN = brain.hippocampus_stats?.knowledge ?? 0;
  const memN = brain.hippocampus_stats?.memories ?? 0;
  footerKnowledge.textContent = `Memory: ${memN} eps + ${knowN} knowledge`;

  if (data.trading) {
    updateTradingStrip(data.trading);
    updateTrading(data.trading);
    const st = data.trading.trader_cortex_stats || {};
    footerTrader.textContent =
      `Trader: ${st.bc_updates || 0} BC / ${st.rl_updates || 0} RL updates`;
  }

  brainScene.updateRegions(brain.regions);
  envView.update(env);
  renderEnvStats(envStatsEl, env, brain);
  thoughtStream.addFromSnapshot(brain.thoughts);

  // Main-view hero: what the brain is thinking, and what it plans to do.
  updateHeroThinking(brain);
  updateHeroIntent(brain.motor_stats, data.trading && data.trading.latest_intent);

  // If the user hasn't clicked a region yet, auto-select the most active
  // one so the detail panel is never empty. Once they DO click, respect
  // their choice.
  if (!selectedRegionName && brain.regions && brain.regions.length) {
    const mostActive = [...brain.regions].sort(
      (a, b) => (b.activation || 0) - (a.activation || 0),
    )[0];
    if (mostActive) {
      selectedRegionName = mostActive.name;
      brainScene.select(mostActive.name);
    }
  }

  if (selectedRegionName) {
    const r = brain.regions.find((r) => r.name === selectedRegionName);
    if (r) renderRegionDetail(r);
  }
}

function updateTradingStrip(trading) {
  const p = trading.paper || {};
  const eq = p.equity_usd || 0;
  const pnl = p.total_pnl_usd || 0;
  const pnlPct = p.total_pnl_pct || 0;
  paperEquityEl.textContent = "$" + eq.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const cls = pnl > 0 ? "up" : (pnl < 0 ? "down" : "");
  paperPnlEl.className = "mono " + cls;
  const sign = pnl >= 0 ? "+" : "";
  paperPnlEl.textContent = `${sign}${pnl.toFixed(0)} (${sign}${pnlPct.toFixed(2)}%)`;
}

// ---------- Hero: NOW THINKING -----------------------------------------
// The main visual: what the brain is thinking RIGHT NOW.
// Preferred source is the current "active concept" (a knowledge-bank chip
// the hippocampus just associated to). If nothing is lit, we fall back to
// the most recent PFC/associate/thought text so this card is never empty.
function updateHeroThinking(brain) {
  const active = brain.active_concept;
  setActiveConcept(active);

  const step = brain.step;

  if (active) {
    const color = categoryColor(active.category);
    heroThinking.dataset.empty = "false";
    heroThinking.style.setProperty("--hero-color", color);
    heroThinkingHeadline.textContent = active.en;
    heroThinkingDetail.textContent = active.desc_en || "";
    heroThinkingSrc.textContent = `#${active.category || "concept"} · t=${step}`;
    if (active.id !== lastConceptId) {
      heroThinking.classList.remove("lit");
      void heroThinking.offsetWidth; // restart animation
      heroThinking.classList.add("lit");
      lastConceptId = active.id;
    }
    return;
  }

  // No lit concept — fall back to the most recent notable thought.
  lastConceptId = null;
  const thoughts = brain.thoughts || [];
  // Prefer PFC / associate / plan; else newest anything.
  const preferred = [...thoughts].reverse().find(
    (t) => t.region === "prefrontal_cortex" ||
           t.kind === "associate" || t.kind === "plan",
  ) || thoughts[thoughts.length - 1];

  if (preferred) {
    heroThinking.dataset.empty = "false";
    heroThinking.style.setProperty("--hero-color", "var(--accent)");
    heroThinkingHeadline.textContent = truncate(preferred.text || preferred.text_zh || "…", 90);
    heroThinkingDetail.textContent = "";
    heroThinkingSrc.textContent = `${preferred.region || "cortex"} · t=${preferred.step}`;
    heroThinking.classList.remove("lit");
  } else {
    heroThinking.dataset.empty = "true";
    heroThinking.classList.remove("lit");
    heroThinking.style.setProperty("--hero-color", "var(--accent)");
    heroThinkingHeadline.textContent = "warming up…";
    heroThinkingDetail.textContent = "the cortex hasn't associated to anything yet.";
    heroThinkingSrc.textContent = "";
  }
}

// ---------- Hero: ABOUT TO DO ------------------------------------------
// Two rows: gridworld motor decision, and paper-trader decision.
// Both come from the *policy's* raw probabilities, so this shows genuine
// intent — not just the action that ended up firing.
function updateHeroIntent(motorStats, latestIntent) {
  // --- GRIDWORLD row ---
  if (motorStats && motorStats.probs && motorStats.action_names) {
    heroIntent.setAttribute("data-flavour", "world");
    intentWorldAction.textContent = motorStats.action_label || "—";
    const c = motorStats.confidence != null ? motorStats.confidence : 0;
    intentWorldConf.textContent = `conf ${(c * 100).toFixed(0)}%`;
    intentWorldConf.className = "intent-conf mono " + (c > 0.7 ? "strong" : c < 0.4 ? "weak" : "");
    renderProbBars(intentWorldProbs, motorStats.probs, motorStats.action_names);
  } else {
    intentWorldAction.textContent = "…";
    intentWorldConf.textContent = "";
    intentWorldProbs.innerHTML = "";
  }

  // --- TRADER row ---
  if (latestIntent) {
    heroIntent.setAttribute("data-flavour", "trader");
    const actName = (latestIntent.action_name || "HOLD").toUpperCase();
    intentTraderAction.textContent = actName;
    const tc = latestIntent.confidence != null ? latestIntent.confidence : 0;
    intentTraderConf.textContent = `conf ${(tc * 100).toFixed(0)}%`;
    intentTraderConf.className = "intent-conf mono " + (tc > 0.7 ? "strong" : tc < 0.4 ? "weak" : "");
    const sym = latestIntent.symbol || "?";
    const price = latestIntent.price_usd;
    const ch1 = latestIntent.price_change_h1;
    const priceStr = price != null && price > 0 ? "$" + formatPrice(price) : "—";
    const chStr = ch1 != null ? ` (${ch1 >= 0 ? "+" : ""}${ch1.toFixed(1)}% h1)` : "";
    intentTraderSymbol.textContent = `$${sym} @ ${priceStr}${chStr}`;
    renderProbBars(intentTraderProbs, latestIntent.probs, ["HOLD", "BUY", "SELL"]);
  } else {
    intentTraderAction.textContent = "…";
    intentTraderConf.textContent = "";
    intentTraderSymbol.textContent = "no candidate yet — waiting for a hot token";
    intentTraderProbs.innerHTML = "";
  }
}

function renderProbBars(container, probs, labels) {
  if (!probs || !probs.length) {
    container.innerHTML = "";
    return;
  }
  // Find argmax to mark the "top" pick.
  let topIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[topIdx]) topIdx = i;
  }
  const rows = probs.map((p, i) => {
    const pct = Math.max(0, Math.min(1, p)) * 100;
    const label = (labels && labels[i]) || `a${i}`;
    const isTop = i === topIdx;
    return `<div class="prob-bar ${isTop ? "top" : ""}">
      <span class="prob-label">${escapeHtml(label)}</span>
      <span class="prob-track"><span class="prob-fill" style="width:${pct.toFixed(1)}%"></span></span>
      <span class="prob-value">${(p * 100).toFixed(0)}%</span>
    </div>`;
  });
  container.innerHTML = rows.join("");
}

function truncate(s, n) {
  s = String(s || "");
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatPrice(p) {
  if (p >= 1)     return p.toFixed(3);
  if (p >= 0.01)  return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  return p.toExponential(2);
}

// ---------- Region detail ----------
function renderRegionDetail(r) {
  regionTitleEl.textContent = r.display_name;
  regionDetailEl.classList.remove("region-detail-empty");
  regionDetailEl.classList.add("region-detail");

  // Region-specific stats to spotlight
  let extra = "";
  if (latestBrain && r.name === "hippocampus") {
    const s = latestBrain.hippocampus_stats;
    extra = `<div class="meter"><div class="meter-label">MEMORIES</div><div class="meter-value">${s.memories}/${s.capacity}</div></div>
             <div class="meter"><div class="meter-label">RECALL SIMILARITY</div><div class="meter-value">${s.last_similarity}</div></div>`;
  } else if (latestBrain && r.name === "amygdala") {
    const s = latestBrain.amygdala_stats;
    extra = `<div class="meter"><div class="meter-label">FEAR</div><div class="meter-value">${s.fear}</div></div>
             <div class="meter"><div class="meter-label">CONDITIONED</div><div class="meter-value">${s.conditioned_templates}</div></div>`;
  } else if (latestBrain && r.name === "nucleus_accumbens") {
    const s = latestBrain.reward_stats;
    extra = `<div class="meter"><div class="meter-label">BASELINE</div><div class="meter-value">${s.baseline}</div></div>
             <div class="meter"><div class="meter-label">Δ ERROR</div><div class="meter-value">${s.last_prediction_error}</div></div>
             <div class="meter"><div class="meter-label">Σ REWARD</div><div class="meter-value">${s.cumulative_reward}</div></div>`;
  } else if (latestBrain && r.name === "motor_cortex") {
    const s = latestBrain.motor_stats;
    extra = `<div class="meter"><div class="meter-label">LAST ACTION</div><div class="meter-value">${s.action_label}</div></div>
             <div class="meter"><div class="meter-label">CONFIDENCE</div><div class="meter-value">${s.confidence}</div></div>`;
  }

  // Neuron grid — visualise up to 128 "neurons"
  const total = Math.min(r.neurons_total || 128, 128);
  const active = Math.min(r.neurons_active || 0, total);
  const grid = [];
  for (let i = 0; i < total; i++) {
    const isActive = i < active;
    grid.push(`<div class="neuron-dot ${isActive ? "active" : ""}" style="color:${r.color}"></div>`);
  }

  const events = (r.recent || []).map((e) => `<li>${escapeHtml(e)}</li>`).join("") ||
    `<li style="color: var(--text-muted); font-family: var(--font-sans);">(no recent events)</li>`;

  regionDetailEl.innerHTML = `
    <div class="region-detail-header" style="color:${r.color}">
      <span class="swatch" style="background:${r.color}"></span>
      <div>
        <div class="name">${r.display_name}</div>
      </div>
    </div>
    <div class="region-detail-role" style="color:${r.color}">
      <span style="color: var(--text-secondary)">${r.role}</span>
    </div>
    <div class="region-detail-meters">
      <div class="meter">
        <div class="meter-label">ACTIVATION</div>
        <div class="meter-value" style="color:${r.color}">${(r.activation * 100).toFixed(0)}%</div>
      </div>
      <div class="meter">
        <div class="meter-label">ACTIVE NEURONS</div>
        <div class="meter-value">${r.neurons_active}/${r.neurons_total}</div>
      </div>
      ${extra}
    </div>
    <div class="region-detail-neuron-grid">${grid.join("")}</div>
    <div class="region-events">
      <h4>Recent events</h4>
      <ul>${events}</ul>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Controls ----------
// No pause / reset-brain buttons on purpose: the brain runs forever and
// keeps every neuron weight, every memory, every learned trade. The only
// user-facing knobs are: spawn a fresh gridworld, poke food/hazards, or
// change the tick speed. Learning is uninterrupted.
btnResetEnv.addEventListener("click", () => send("reset"));
btnPokeFood.addEventListener("click", () => send("poke_food"));
btnPokeHazard.addEventListener("click", () => send("poke_hazard"));
tickHzInput.addEventListener("input", (e) => {
  const hz = parseInt(e.target.value, 10);
  tickHzLabel.textContent = `${hz} Hz`;
  send("speed", { hz });
});

// ---------- Go ----------
connect();
