/**
 * main.js — wire together the 3D brain, environment, thoughts, and controls.
 *
 * Speaks WebSocket to the backend at /ws. Reconnects on drop.
 */

import { BrainScene } from "/static/js/brain3d.js";
import { EnvironmentView, renderEnvStats } from "/static/js/environment.js";
import { ThoughtStream } from "/static/js/thoughtstream.js";
import { loadKnowledge, setActiveConcept, categoryColor } from "/static/js/knowledge.js";

// ---------- DOM refs ----------
const brainContainer = document.getElementById("brain3d");
const envCanvas = document.getElementById("env-canvas");
const envStatsEl = document.getElementById("env-stats");
const regionDetailEl = document.getElementById("region-detail");
const regionTitleEl = document.getElementById("region-title");
const thoughtEl = document.getElementById("thought-stream");
const tabsEl = document.querySelector(".panel-thoughts .tabs");

const connDot = document.getElementById("conn-dot");
const connLabel = document.getElementById("conn-label");
const tickLabel = document.getElementById("tick-label");
const rewardLabel = document.getElementById("reward-label");
const modeBadge = document.getElementById("mode-badge");
const modeLabel = document.getElementById("mode-label");
const footerKnowledge = document.getElementById("footer-knowledge");
const btnPause = document.getElementById("btn-pause");
const btnResetEnv = document.getElementById("btn-reset-env");
const btnResetBrain = document.getElementById("btn-reset-brain");
const btnPokeFood = document.getElementById("btn-poke-food");
const btnPokeHazard = document.getElementById("btn-poke-hazard");
const tickHzInput = document.getElementById("tick-hz");
const tickHzLabel = document.getElementById("tick-hz-label");

const knowledgePanel = document.getElementById("knowledge-panel");
const detailTabs = document.getElementById("detail-tabs");
const thinkingRibbon = document.getElementById("thinking-ribbon");
const thinkingTitle = document.getElementById("thinking-title");
const thinkingDesc = document.getElementById("thinking-desc");

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
const thoughtStream = new ThoughtStream(thoughtEl, tabsEl);

let latestBrain = null;
let detailView = "region";
let lastConceptId = null;
let modeInitialized = false;

loadKnowledge(knowledgePanel);

detailTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab[data-view]");
  if (!btn) return;
  switchDetailView(btn.dataset.view);
});

function switchDetailView(view) {
  if (view !== "region" && view !== "knowledge") return;
  detailView = view;
  document.querySelectorAll("#detail-tabs .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
  document.getElementById("region-detail").style.display = view === "region" ? "" : "none";
  document.getElementById("knowledge-panel").style.display = view === "knowledge" ? "flex" : "none";
}

// ---------- WebSocket ----------
let ws = null;
let running = true;
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

  brainScene.updateRegions(brain.regions);
  envView.update(env);
  renderEnvStats(envStatsEl, env, brain);
  thoughtStream.addFromSnapshot(brain.thoughts);
  updateThinkingRibbon(brain.active_concept);

  if (selectedRegionName) {
    const r = brain.regions.find((r) => r.name === selectedRegionName);
    if (r) renderRegionDetail(r);
  }

  running = !!data.running;
  btnPause.textContent = running ? "⏸ Pause" : "▶ Resume";
}

function updateThinkingRibbon(active) {
  setActiveConcept(active);
  if (!active) {
    thinkingRibbon.dataset.empty = "true";
    thinkingRibbon.classList.remove("lit");
    thinkingRibbon.style.setProperty("--ribbon-color", "var(--accent)");
    thinkingTitle.textContent = "—";
    thinkingDesc.textContent = "brain is between associations…";
    lastConceptId = null;
    return;
  }
  thinkingRibbon.dataset.empty = "false";
  const color = categoryColor(active.category);
  thinkingRibbon.style.setProperty("--ribbon-color", color);
  thinkingTitle.textContent = `${active.zh}  ·  ${active.en}`;
  thinkingDesc.textContent = active.desc_zh;
  if (active.id !== lastConceptId) {
    thinkingRibbon.classList.remove("lit");
    void thinkingRibbon.offsetWidth; // restart animation
    thinkingRibbon.classList.add("lit");
    lastConceptId = active.id;
  }
}

// ---------- Region detail ----------
function renderRegionDetail(r) {
  regionTitleEl.textContent = `${r.zh_name || r.display_name} · ${r.display_name}`;
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
    extra = `<div class="meter"><div class="meter-label">LAST ACTION</div><div class="meter-value">${s.action_label_zh}</div></div>
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
        <div class="zh">${r.zh_name}</div>
      </div>
    </div>
    <div class="region-detail-role" style="color:${r.color}">
      <span style="color: var(--text-secondary)">${r.role_zh || r.role}</span>
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
      <h4>最近事件</h4>
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
btnPause.addEventListener("click", () => {
  send(running ? "pause" : "resume");
});
btnResetEnv.addEventListener("click", () => send("reset"));
btnResetBrain.addEventListener("click", () => {
  if (confirm("重置大脑会清空所有记忆和学到的策略，确定？")) send("reset_brain");
});
btnPokeFood.addEventListener("click", () => send("poke_food"));
btnPokeHazard.addEventListener("click", () => send("poke_hazard"));
tickHzInput.addEventListener("input", (e) => {
  const hz = parseInt(e.target.value, 10);
  tickHzLabel.textContent = `${hz} Hz`;
  send("speed", { hz });
});

// ---------- Go ----------
connect();
