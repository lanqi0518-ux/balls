/**
 * knowledge.js — the "knowledge bank" panel.
 *
 * Loads the seed concept list from /api/knowledge (crypto + Einstein + Einstein),
 * then GROWS itself in real time as the brain LEARNS new concepts at runtime
 * (fresh tokens it has just seen, new launchpads it just registered, big
 * outcomes it wants to remember). Learned concepts arrive via the WS stream
 * on `brain.learned_concepts` and are pushed in via `mergeLearnedConcepts()`.
 */

let CONCEPTS = [];              // seed + learned, merged and rendered
let SEEN_IDS = new Set();       // for de-dup during merge
let CATEGORIES = {};
let CHIPS = new Map();          // id -> DOM element
let CAT_ELS = new Map();        // cat -> {catEl, gridEl, countEl}
let PANEL_EL = null;
let currentLitId = null;

const CATEGORY_ORDER = [
  "crypto_core",
  "meme_coin",
  "crypto_tech",
  "crypto_culture",
  "einstein_physics",
  "einstein_math",
  "einstein_life",
  // Learned-at-runtime categories always render at the bottom, in this order.
  "learned_token",
  "learned_pattern",
  "learned_event",
];

export async function loadKnowledge(panelEl) {
  PANEL_EL = panelEl;
  try {
    const res = await fetch("/api/knowledge", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    CONCEPTS = data.concepts || [];
    CATEGORIES = data.categories || {};
    for (const c of CONCEPTS) SEEN_IDS.add(c.id);
    renderPanel(panelEl, data);
    return data;
  } catch (e) {
    panelEl.innerHTML = `<div class="knowledge-intro">Failed to load knowledge bank: ${escapeHtml(e.message)}</div>`;
    return null;
  }
}

/** Called every WS frame with `brain.learned_concepts` — a running list of
 * concepts the brain has added at runtime. Idempotent: already-seen ids
 * are skipped. New ones become permanent chips in the correct category. */
export function mergeLearnedConcepts(learned) {
  if (!Array.isArray(learned) || !PANEL_EL) return;
  let anyAdded = false;
  for (const c of learned) {
    if (!c || !c.id || SEEN_IDS.has(c.id)) continue;
    SEEN_IDS.add(c.id);
    CONCEPTS.push({ ...c, __learned: true });
    addChipForConcept(c, /*learned=*/true);
    anyAdded = true;
  }
  if (anyAdded) refreshIntroCount();
}

function renderPanel(panelEl, data) {
  const mode = (data.mode || "").toUpperCase();

  const intro = document.createElement("div");
  intro.className = "knowledge-intro";
  intro.id = "knowledge-intro";
  intro.innerHTML = introHtml(CONCEPTS.length, 0, mode);
  panelEl.innerHTML = "";
  panelEl.appendChild(intro);

  CHIPS = new Map();
  CAT_ELS = new Map();
  const grouped = groupByCategory(CONCEPTS);
  const ordered = orderCategories(Object.keys(grouped).concat(
    // Ensure learned categories always have containers, even if empty at boot.
    ["learned_token", "learned_pattern", "learned_event"],
  ));

  for (const cat of ordered) {
    const items = grouped[cat] || [];
    ensureCategoryContainer(cat);
    // Populate initial items
    for (const c of items) {
      addChipForConcept(c, /*learned=*/Boolean(c.__learned));
    }
  }
  refreshIntroCount();
}

function introHtml(seedTotal, learnedTotal, mode) {
  return `
    A live knowledge bank. <strong>${seedTotal}</strong> semantic seeds were
    loaded at boot; the brain then <strong>grows this bank on its own</strong>
    as it encounters new tokens, launchpads and outcomes in the wild
    (dashed chips = learned at runtime, currently <strong>${learnedTotal}</strong>).
    While the brain thinks it occasionally <strong>associates</strong> to one
    of them — the lit chip is the one it's on right now.
    Current mode: <strong>${escapeHtml(mode || "—")}</strong>. Association uses no LLM.
  `;
}

function refreshIntroCount() {
  const intro = document.getElementById("knowledge-intro");
  if (!intro) return;
  const learned = CONCEPTS.filter((c) => c.__learned).length;
  const seed = CONCEPTS.length - learned;
  const mode = intro.dataset.mode || "";
  intro.innerHTML = introHtml(seed, learned, mode);
}

function ensureCategoryContainer(cat) {
  if (CAT_ELS.has(cat)) return CAT_ELS.get(cat);
  const meta = CATEGORIES[cat] || {};
  const color = meta.color || "var(--accent)";

  const catEl = document.createElement("div");
  catEl.className = "knowledge-cat";
  catEl.style.setProperty("--cat-color", color);

  const title = document.createElement("div");
  title.className = "knowledge-cat-title";
  const countEl = document.createElement("span");
  countEl.className = "count";
  countEl.textContent = "· 0";
  title.innerHTML = `
    <span class="swatch"></span>
    <span>${escapeHtml(meta.en || cat)}</span>
  `;
  title.appendChild(countEl);
  catEl.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "knowledge-grid";
  catEl.appendChild(grid);

  PANEL_EL.appendChild(catEl);
  const rec = { catEl, gridEl: grid, countEl };
  CAT_ELS.set(cat, rec);
  return rec;
}

function addChipForConcept(c, learned) {
  const cat = c.category || "learned_pattern";
  const rec = ensureCategoryContainer(cat);
  const meta = CATEGORIES[cat] || {};
  const color = meta.color || "var(--accent)";

  const chip = document.createElement("div");
  chip.className = "knowledge-chip" + (learned ? " learned" : "");
  chip.style.setProperty("--chip-color", color);
  chip.title = `${c.en || c.id}\n${c.desc_en || ""}${learned ? "\n\n(learned at runtime)" : ""}`;
  chip.innerHTML = `<span>${escapeHtml(c.en || c.id)}</span>`;
  rec.gridEl.appendChild(chip);
  CHIPS.set(c.id, chip);

  // Update category count
  const total = rec.gridEl.children.length;
  rec.countEl.textContent = `· ${total}`;
}

function groupByCategory(concepts) {
  const out = {};
  for (const c of concepts) {
    (out[c.category] = out[c.category] || []).push(c);
  }
  return out;
}

function orderCategories(cats) {
  const seen = new Set();
  const out = [];
  for (const c of CATEGORY_ORDER) {
    if (cats.includes(c) && !seen.has(c)) {
      out.push(c);
      seen.add(c);
    }
  }
  for (const c of cats) {
    if (!seen.has(c)) {
      out.push(c);
      seen.add(c);
    }
  }
  return out;
}

/** Lights the chip the brain is currently associating to. */
export function setActiveConcept(activeConcept) {
  const newId = activeConcept ? activeConcept.id : null;
  if (newId === currentLitId) return;
  if (currentLitId) {
    const prev = CHIPS.get(currentLitId);
    if (prev) prev.classList.remove("lit");
  }
  currentLitId = newId;
  if (newId) {
    const chip = CHIPS.get(newId);
    if (chip) {
      chip.classList.add("lit");
      chip.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}

export function getConceptById(id) {
  return CONCEPTS.find((c) => c.id === id);
}

export function categoryColor(cat) {
  return (CATEGORIES[cat] && CATEGORIES[cat].color) || "var(--accent)";
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
