/**
 * knowledge.js — the "knowledge bank" panel.
 *
 * Loads the full concept list from /api/knowledge (crypto + Einstein), renders
 * it grouped by category, and lights up the chip the brain is currently
 * associating to whenever `active_concept` changes.
 */

let CONCEPTS = [];
let CATEGORIES = {};
let CHIPS = new Map();   // id -> DOM element
let currentLitId = null;

const CATEGORY_ORDER = [
  "crypto_core",
  "meme_coin",
  "crypto_tech",
  "crypto_culture",
  "einstein_physics",
  "einstein_math",
  "einstein_life",
];

export async function loadKnowledge(panelEl) {
  try {
    const res = await fetch("/api/knowledge", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    CONCEPTS = data.concepts || [];
    CATEGORIES = data.categories || {};
    renderPanel(panelEl, data);
    return data;
  } catch (e) {
    panelEl.innerHTML = `<div class="knowledge-intro">Failed to load knowledge bank: ${escapeHtml(e.message)}</div>`;
    return null;
  }
}

function renderPanel(panelEl, data) {
  const mode = (data.mode || "").toUpperCase();
  const total = CONCEPTS.length;

  const intro = document.createElement("div");
  intro.className = "knowledge-intro";
  intro.innerHTML = `
    Not "understanding" — these are <strong>${total} semantic seeds</strong> loaded
    into the hippocampus at boot. While the brain thinks, it occasionally
    <strong>associates</strong> to one of them (the lit chip below is the one it's
    on right now). Current mode: <strong>${escapeHtml(mode)}</strong>.
    Association uses no LLM.
  `;
  panelEl.innerHTML = "";
  panelEl.appendChild(intro);

  CHIPS = new Map();
  const grouped = groupByCategory(CONCEPTS);
  const ordered = orderCategories(Object.keys(grouped));

  for (const cat of ordered) {
    const items = grouped[cat] || [];
    if (!items.length) continue;
    const meta = CATEGORIES[cat] || {};
    const color = meta.color || "#7dd3fc";

    const catEl = document.createElement("div");
    catEl.className = "knowledge-cat";
    catEl.style.setProperty("--cat-color", color);

    const title = document.createElement("div");
    title.className = "knowledge-cat-title";
    title.innerHTML = `
      <span class="swatch"></span>
      <span>${escapeHtml(meta.en || cat)}</span>
      <span class="count">· ${items.length}</span>
    `;
    catEl.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "knowledge-grid";
    for (const c of items) {
      const chip = document.createElement("div");
      chip.className = "knowledge-chip";
      chip.style.setProperty("--chip-color", color);
      chip.title = `${c.en}\n${c.desc_en}`;
      chip.innerHTML = `<span>${escapeHtml(c.en)}</span>`;
      grid.appendChild(chip);
      CHIPS.set(c.id, chip);
    }
    catEl.appendChild(grid);
    panelEl.appendChild(catEl);
  }
}

function groupByCategory(concepts) {
  const out = {};
  for (const c of concepts) {
    (out[c.category] = out[c.category] || []).push(c);
  }
  return out;
}

function orderCategories(cats) {
  const known = CATEGORY_ORDER.filter((c) => cats.includes(c));
  const unknown = cats.filter((c) => !CATEGORY_ORDER.includes(c));
  return [...known, ...unknown];
}

/**
 * Called every frame with the brain's active_concept (or null).
 * Lights the corresponding chip and scrolls it into view (once per new id).
 */
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
  return (CATEGORIES[cat] && CATEGORIES[cat].color) || "#7dd3fc";
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
