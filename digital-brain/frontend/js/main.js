/**
 * main.js — wire together the 3D brain, environment, thoughts, and controls.
 *
 * Speaks WebSocket to the backend at /ws. Reconnects on drop.
 */

import { BrainScene } from "/static/js/brain3d.js";
import { EnvironmentView, renderEnvStats } from "/static/js/environment.js";
import { ThoughtStream } from "/static/js/thoughtstream.js";
import { loadKnowledge, setActiveConcept, categoryColor, mergeLearnedConcepts } from "/static/js/knowledge.js";
import { initTrading, updateTrading } from "/static/js/trading.js";
import { initWebView, updateWebView, updateWebTopbarStrip } from "/static/js/web_view.js";
import { AmbientMesh } from "/static/js/ambient.js";

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
const tickHzLabel = document.getElementById("tick-hz-label");
const tickHzDot = document.getElementById("tick-hz-dot");
const walletLabel = document.getElementById("wallet-label");
const specimenNeurons = document.getElementById("specimen-neurons");
const specimenDecision = document.getElementById("specimen-decision");

const knowledgePanel = document.getElementById("knowledge-panel");
const tradingPanel = document.getElementById("trading-panel");
const webPanel = document.getElementById("web-panel");
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
const footerLifetime = document.getElementById("footer-lifetime");
const uptimeLabel = document.getElementById("uptime-label");
const uptimeStrip = document.getElementById("uptime-strip");

// Snapshot the last brain lifetime state so the topbar clock ticks
// smoothly every second between WebSocket frames.
let lifetimeSnapshot = null;

function fmtDurationCompact(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "—";
  const s = Math.floor(secs);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${rem}s`;
  return `${rem}s`;
}

function fmtCount(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function renderUptime() {
  if (!lifetimeSnapshot || !uptimeLabel) return;
  const nowS = Date.now() / 1000;
  const drift = nowS - lifetimeSnapshot.receivedAtWallSec;
  const liveLifetime = lifetimeSnapshot.lifetimeUptimeS + Math.max(0, drift);
  const liveProc = lifetimeSnapshot.processUptimeS + Math.max(0, drift);
  uptimeLabel.textContent =
    `uptime ${fmtDurationCompact(liveLifetime)} (this boot ${fmtDurationCompact(liveProc)})`;
  if (uptimeStrip) {
    uptimeStrip.classList.toggle("stale", drift > 10);
  }
  if (footerLifetime) {
    footerLifetime.textContent =
      `Lifetime: ${fmtCount(lifetimeSnapshot.lifetimeStepCount)} ticks · boot #${lifetimeSnapshot.bootCount}`;
  }
}

setInterval(renderUptime, 1000);

// Ambient neural-mesh backdrop. Pulses with every incoming WS frame so the
// UI viscerally feels the tick. Purely decorative — safe to skip if the
// canvas isn't in the DOM (e.g. reduced-motion or an older cached shell).
let ambient = null;
const ambientCanvas = document.getElementById("ambient-canvas");
if (ambientCanvas) {
  try {
    ambient = new AmbientMesh(ambientCanvas);
  } catch (e) {
    console.warn("Ambient mesh failed to init", e);
  }
}

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
initWebView(webPanel);

detailTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab[data-view]");
  if (!btn) return;
  switchDetailView(btn.dataset.view);
});

function switchDetailView(view) {
  if (!["region", "knowledge", "trading", "web"].includes(view)) return;
  detailView = view;
  document.querySelectorAll("#detail-tabs .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
  document.getElementById("region-detail").style.display = view === "region"    ? "" : "none";
  document.getElementById("knowledge-panel").style.display = view === "knowledge" ? "flex" : "none";
  document.getElementById("trading-panel").style.display  = view === "trading"  ? "flex" : "none";
  document.getElementById("web-panel").style.display      = view === "web"      ? "flex" : "none";
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

  if (ambient) ambient.onBrainTick();

  tickLabel.textContent = `t = ${brain.step}`;
  const cum = brain.reward_stats?.cumulative_reward ?? 0;
  rewardLabel.textContent = `Σreward ${cum.toFixed(2)}`;
  rewardLabel.style.color = cum > 0 ? "var(--good)" : (cum < 0 ? "var(--bad)" : "var(--text-secondary)");

  if (!modeInitialized && brain.mode) {
    modeLabel.textContent = brain.mode === "einstein" ? "◈ PRIME" : "◇ DEFAULT";
    modeBadge.classList.toggle("mode-default", brain.mode !== "einstein");
    modeInitialized = true;
  }
  const knowN = brain.hippocampus_stats?.knowledge ?? 0;
  const memN = brain.hippocampus_stats?.memories ?? 0;
  const learnedN = brain.learned_concepts_count ?? 0;
  footerKnowledge.textContent = learnedN
    ? `Memory: ${memN} eps + ${knowN} knowledge (${learnedN} self-learned)`
    : `Memory: ${memN} eps + ${knowN} knowledge`;

  if (specimenNeurons) {
    // Rough back-of-napkin "counts" so the fomofly-style header has real
    // numbers to show. Neurons ≈ sum of each region's neuron budget; if
    // the backend doesn't expose one we synthesise a reasonable count.
    let neurons = 0;
    let synapses = 0;
    for (const r of (brain.regions || [])) {
      const n = r.n_neurons ?? r.neurons ?? 512;
      neurons += n;
      synapses += n * (r.avg_syn ?? 40);
    }
    if (neurons) {
      specimenNeurons.textContent =
        `${neurons.toLocaleString()} neurons · ${synapses.toLocaleString()} synapses`;
    }
  }
  if (specimenDecision && brain.regions && brain.regions.length) {
    const top = [...brain.regions]
      .sort((a, b) => (b.activation || 0) - (a.activation || 0))
      .slice(0, 3)
      .map((r) => (r.display_name || r.name || "").toUpperCase())
      .join("  →  ");
    specimenDecision.textContent = `DECISION PATH · ${top}`;
  }

  if (brain.learned_concepts) {
    mergeLearnedConcepts(brain.learned_concepts);
  }

  // Capture lifetime state for the uptime strip. The clock updates
  // every second between frames, so we snapshot the moment the frame
  // arrived and interpolate against wall-clock drift.
  if (brain.lifetime_uptime_s !== undefined) {
    lifetimeSnapshot = {
      lifetimeUptimeS: brain.lifetime_uptime_s || 0,
      processUptimeS: brain.process_uptime_s || 0,
      lifetimeStepCount: brain.lifetime_step ?? brain.step ?? 0,
      bootCount: brain.boot_count ?? 1,
      firstBootAtS: brain.first_boot_at_s || 0,
      receivedAtWallSec: Date.now() / 1000,
    };
    renderUptime();
  }

  if (data.trading) {
    updateTradingStrip(data.trading);
    updateTrading(data.trading);
    const st = data.trading.trader_cortex_stats || {};
    const auton = (st.autonomy_pct ?? 0).toFixed(0);
    footerTrader.textContent =
      `Trader: ${st.bc_updates || 0} BC / ${st.rl_updates || 0} RL · autonomy ${auton}%`;
    if (walletLabel) {
      const live = data.trading.live || {};
      const hood = data.trading.hood || {};
      const funded = Number(live.sol_balance || 0) > 0 || Number(hood.eth_balance || 0) > 0;
      walletLabel.textContent = funded ? "LIVE" : "STANDBY";
    }
  }

  // Auto-updating tick-rate readout in the footer. The backend drives this
  // from the brain's engagement signal; we just display it and give the
  // dot a matching color intensity.
  if (typeof data.tick_hz === "number" && tickHzLabel) {
    const hz = Math.max(0.1, data.tick_hz);
    tickHzLabel.textContent = hz.toFixed(1) + " Hz";
    if (tickHzDot) {
      const t = Math.max(0, Math.min(1, (hz - 2) / 10));
      tickHzDot.style.background = `hsl(${190 - t * 50}, ${60 + t * 30}%, ${45 + t * 25}%)`;
      tickHzDot.style.boxShadow = `0 0 ${4 + t * 10}px hsla(${190 - t * 50}, 80%, 60%, ${0.4 + t * 0.5})`;
    }
  }

  if (data.web !== undefined) {
    updateWebView(data.web);
    updateWebTopbarStrip(data.web);
  }

  brainScene.updateRegions(brain.regions, buildRegionLiveMetrics(brain, data));
  // Drive the vessel heartbeat from the brain's live engagement signal.
  // Falls back to tick_hz-derived proxy when engagement isn't published.
  let engagementForVessels = null;
  if (typeof brain.engagement === "number") {
    engagementForVessels = brain.engagement;
  } else if (typeof data.tick_hz === "number") {
    engagementForVessels = Math.max(0, Math.min(1, (data.tick_hz - 2.5) / 8.5));
  }
  if (engagementForVessels != null) {
    brainScene.setEngagement(engagementForVessels);
  }
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
  const live = trading.live || {};
  const hood = trading.hood || {};
  const sol = Number(live.sol_balance || 0);
  const eth = Number(hood.eth_balance || 0);
  paperEquityEl.textContent = sol.toFixed(sol < 0.1 ? 4 : 3) + " SOL";
  const confirmed = (live.recent_trades || []).filter((r) => r.status === "confirmed").length
                  + (hood.recent_trades || []).filter((r) => r.status === "confirmed").length;
  const open = Number(live.open_positions_count || 0) + Number(hood.open_positions_count || 0);
  const armed = sol > 0 || eth > 0;
  paperPnlEl.className = "mono " + (armed ? "up" : "");
  paperPnlEl.textContent = `${confirmed} tx · ${open} open`;
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

// ---------- Per-region live micro-metric ----------
// For each region, dig into the richer per-cortex stats the backend
// publishes each tick (hippocampus_stats, amygdala_stats, motor_stats,
// central_complex_stats, reward_stats, latest_intent) and expose one
// compact `{label, value}` pair the cortex tile can print next to its
// sparkline.  Purely a UI layer — the backend already has the numbers.
function buildRegionLiveMetrics(brain, data) {
  const out = {};
  if (!brain) return out;
  const trading = data && data.trading ? data.trading : null;
  const trader = brain.trader_cortex_stats || (trading && trading.trader_cortex_stats) || null;
  const intent = trading && trading.latest_intent;

  const hs = brain.hippocampus_stats;
  if (hs) out.hippocampus = { label: "recall", value: (+hs.last_similarity || 0).toFixed(2) };

  const as = brain.amygdala_stats;
  if (as) {
    const fearPct = Math.round((+as.fear || 0) * 100);
    out.amygdala = { label: "fear", value: `${fearPct}%` };
  }

  const rs = brain.reward_stats;
  if (rs) {
    const dr = +rs.last_prediction_error || 0;
    const sign = dr >= 0 ? "+" : "−";
    out.nucleus_accumbens = { label: "Δrew", value: `${sign}${Math.abs(dr).toFixed(2)}` };
  }

  const ms = brain.motor_stats;
  if (ms) {
    const confPct = Math.round((+ms.confidence || 0) * 100);
    const label = ms.action_label ? String(ms.action_label).slice(0, 6) : "act";
    out.motor_cortex = { label, value: `${confPct}%` };
  }

  const cc = brain.central_complex_stats;
  if (cc) out.central_complex = { label: cc.compass || "ring", value: `${(+cc.pop_rate_hz || 0).toFixed(1)}Hz` };

  if (intent) {
    const confPct = Math.round((+intent.confidence || 0) * 100);
    const sym = intent.symbol ? String(intent.symbol).slice(0, 6) : "—";
    out.trader_cortex = { label: sym, value: `${confPct}%` };
  } else if (trader) {
    const confPct = Math.round((+trader.last_confidence || 0) * 100);
    out.trader_cortex = { label: "conf", value: `${confPct}%` };
  }

  if (intent) {
    const pfcConf = Math.round((+intent.confidence || 0) * 100);
    const pfcVal = (+intent.value_estimate || 0).toFixed(2);
    out.prefrontal_cortex = { label: `V ${pfcVal}`, value: `${pfcConf}%` };
  }

  const eng = typeof brain.engagement === "number" ? brain.engagement : null;
  if (eng != null) {
    out.default_mode = { label: "eng", value: `${Math.round(eng * 100)}%` };
    out.thalamus = { label: "gate", value: `${Math.round(eng * 100)}%` };
  }
  const vis = (brain.regions || []).find((r) => r.name === "visual_cortex");
  if (vis) out.visual_cortex = { label: "V1-V4", value: `${vis.neurons_active}` };
  return out;
}

// ---------- Region detail ----------
function renderRegionDetail(r) {
  regionTitleEl.textContent = r.display_name;
  regionDetailEl.classList.remove("region-detail-empty");
  regionDetailEl.classList.add("region-detail");

  // The central complex is a real spiking module and deserves its own
  // visualisation (ring bump + spike raster). Route to a dedicated renderer.
  if (r.name === "central_complex" && latestBrain && latestBrain.central_complex_stats) {
    renderCentralComplexDetail(r, latestBrain.central_complex_stats);
    return;
  }

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
    <div class="region-detail-live" style="--rd-color:${r.color}">
      <div class="region-detail-live-head">
        <span class="mono">ACTIVATION · LIVE</span>
        <span class="mono region-detail-live-pct" id="region-detail-pct">${(r.activation * 100).toFixed(0)}%</span>
      </div>
      <canvas id="region-detail-spark" class="region-detail-spark"></canvas>
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
  _drawRegionDetailSparkline(r);
}

// Ring buffer for the currently-selected region's activation waveform.
let _regionDetailBuf = null;
let _regionDetailName = null;
function _drawRegionDetailSparkline(r) {
  const N = 180;
  if (_regionDetailName !== r.name) {
    _regionDetailBuf = new Float32Array(N);
    _regionDetailName = r.name;
  }
  const buf = _regionDetailBuf;
  buf.copyWithin(0, 1);
  buf[N - 1] = r.activation;

  const canvas = document.getElementById("region-detail-spark");
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 64;
  const tw = Math.max(1, Math.round(cssW * dpr));
  const th = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== tw || canvas.height !== th) {
    canvas.width = tw;
    canvas.height = th;
  }
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const step = w / (N - 1);
  const yFor = (v) => h - 3 - Math.max(0, Math.min(1, v)) * (h - 6);
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < N; i++) ctx.lineTo(i * step, yFor(buf[i]));
  ctx.lineTo(w, h);
  ctx.closePath();
  const hex = r.color || "#9aa6c8";
  const [rr, gg, bb] = _hexToRgb(hex);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(${rr},${gg},${bb},0.6)`);
  grad.addColorStop(1, `rgba(${rr},${gg},${bb},0.02)`);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const x = i * step, y = yFor(buf[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = hex;
  ctx.lineWidth = 1.8 * dpr;
  ctx.shadowColor = hex;
  ctx.shadowBlur = 8 * dpr;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const hy = yFor(buf[N - 1]);
  ctx.fillStyle = hex;
  ctx.beginPath(); ctx.arc(w - 2 * dpr, hy, 2.6 * dpr, 0, Math.PI * 2); ctx.fill();
}
function _hexToRgb(hex) {
  if (!hex || hex[0] !== "#") return [200, 200, 255];
  const s = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

// ---------- Central complex: ring bump + spike raster ---------------
// This region is the only real spiking module in the brain. It gets its
// own view: a compass with a bump indicating heading, and a raster plot
// of the last ~60 integration frames × 16 EPG neurons.
function renderCentralComplexDetail(r, s) {
  const events = (r.recent || []).map((e) => `<li>${escapeHtml(e)}</li>`).join("") ||
    `<li style="color: var(--text-muted); font-family: var(--font-sans);">(spinning up…)</li>`;

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
        <div class="meter-label">BUMP HEADING</div>
        <div class="meter-value" style="color:${r.color}">${s.compass} · ${s.bump_angle_deg}°</div>
      </div>
      <div class="meter">
        <div class="meter-label">BUMP PEAKEDNESS</div>
        <div class="meter-value">${(s.bump_amplitude * 100).toFixed(0)}%</div>
      </div>
      <div class="meter">
        <div class="meter-label">POP RATE</div>
        <div class="meter-value">${s.pop_rate_hz.toFixed(1)} Hz</div>
      </div>
      <div class="meter">
        <div class="meter-label">CELLS</div>
        <div class="meter-value">${s.num_epg}+${s.num_pen}+${s.num_peg} LIF</div>
      </div>
    </div>
    <div class="cc-visuals">
      <div class="cc-ring-wrap">
        <div class="cc-mini-label">EPG ring · heading bump</div>
        <canvas id="cc-ring" width="200" height="200"></canvas>
      </div>
      <div class="cc-raster-wrap">
        <div class="cc-mini-label">EPG spike raster · last ${(s.raster || []).length} frames</div>
        <canvas id="cc-raster" width="360" height="180"></canvas>
      </div>
    </div>
    <div class="region-events">
      <h4>Recent events</h4>
      <ul>${events}</ul>
    </div>
  `;

  drawRingBump(document.getElementById("cc-ring"), s, r.color);
  drawSpikeRaster(document.getElementById("cc-raster"), s, r.color);
}

function drawRingBump(canvas, s, color) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const rOuter = Math.min(W, H) * 0.42;
  const rInner = rOuter * 0.58;
  const N = s.num_epg || 16;

  ctx.clearRect(0, 0, W, H);

  // Compute per-wedge spike counts over the last few frames = brightness.
  const raster = s.raster || [];
  const window = raster.slice(-8);
  const counts = new Array(N).fill(0);
  for (const frame of window) {
    for (let k = 0; k < N; k++) counts[k] += frame[k] || 0;
  }
  const maxCount = Math.max(1, ...counts);

  // Draw wedges (each of the 16 EPG cells is a pie-slice).
  for (let k = 0; k < N; k++) {
    const brightness = counts[k] / maxCount;
    const a0 = (k / N) * Math.PI * 2 - Math.PI / 2 - Math.PI / N;
    const a1 = ((k + 1) / N) * Math.PI * 2 - Math.PI / 2 - Math.PI / N;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, a0, a1);
    ctx.arc(cx, cy, rInner, a1, a0, true);
    ctx.closePath();
    const alpha = 0.08 + brightness * 0.92;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Compass ticks + N/E/S/W labels.
  ctx.fillStyle = "rgba(200,220,240,0.55)";
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const compassLabels = ["N", "E", "S", "W"];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const lx = cx + Math.cos(a) * (rOuter + 12);
    const ly = cy + Math.sin(a) * (rOuter + 12);
    ctx.fillText(compassLabels[i], lx, ly);
  }

  // The bump direction arrow.
  if (s.bump_amplitude > 0.1) {
    const ang = s.bump_angle_rad - Math.PI / 2;  // shift so 0 rad = up
    const ex = cx + Math.cos(ang) * rInner * 0.88;
    const ey = cy + Math.sin(ang) * rInner * 0.88;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Arrowhead.
    const ah = 6;
    const perp = ang + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(ang) * 5, ey + Math.sin(ang) * 5);
    ctx.lineTo(ex + Math.cos(perp) * ah, ey + Math.sin(perp) * ah);
    ctx.lineTo(ex - Math.cos(perp) * ah, ey - Math.sin(perp) * ah);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Center dot.
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSpikeRaster(canvas, s, color) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const N = s.num_epg || 16;
  const raster = s.raster || [];
  const F = raster.length;

  ctx.fillStyle = "rgba(6, 10, 20, 0.85)";
  ctx.fillRect(0, 0, W, H);

  if (F === 0) return;

  const dx = W / F;
  const dy = H / N;

  for (let f = 0; f < F; f++) {
    const frame = raster[f];
    for (let k = 0; k < N; k++) {
      if (frame[k]) {
        const x = f * dx;
        const y = k * dy;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.fillRect(x, y + 1, Math.max(1.5, dx - 0.5), Math.max(2, dy - 2));
      }
    }
  }
  ctx.shadowBlur = 0;

  // Y-axis: EPG neuron indices (every 4).
  ctx.fillStyle = "rgba(200,220,240,0.35)";
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let k = 0; k < N; k += 4) {
    ctx.fillText(`E${k}`, 2, k * dy + dy / 2);
  }
  // X-axis label: "now" on the right.
  ctx.textAlign = "right";
  ctx.fillText("now →", W - 4, H - 8);
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Controls ----------
// No pause, no reset, no speed slider. The brain runs continuously and
// its tick rate rises and falls with its own engagement — that number
// is streamed down each frame and rendered in the footer.

// ---------- Go ----------
connect();
