/**
 * thoughtstream.js — renders the brain's live stream of thoughts.
 *
 * Backend pushes a rolling window of recent thoughts every tick. We only
 * append the ones we haven't seen (dedup by (step, region, kind, text)) so
 * the stream doesn't jitter.
 */

const REGION_LABELS = {
  visual_cortex: "Visual cortex",
  thalamus: "Thalamus",
  hippocampus: "Hippocampus",
  amygdala: "Amygdala",
  nucleus_accumbens: "Nucleus accumbens",
  prefrontal_cortex: "Prefrontal cortex",
  motor_cortex: "Motor cortex",
  default_mode: "Default mode network",
  trader_cortex: "Trader cortex",
  central_complex: "Central complex",
  cerebellum: "Cerebellum",
  basal_ganglia: "Basal ganglia",
  insular_cortex: "Insular cortex",
  locus_coeruleus: "Locus coeruleus",
};

export class ThoughtStream {
  constructor(container) {
    this.container = container;
    this.seen = new Set();
    this.buffer = [];
  }

  addFromSnapshot(thoughts) {
    let appended = 0;
    for (const t of thoughts) {
      const key = `${t.step}|${t.region}|${t.kind}|${t.text}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      this.buffer.push(t);
      appended++;
    }
    if (this.buffer.length > 60) {
      this.buffer.splice(0, this.buffer.length - 60);
    }
    if (this.seen.size > 300) {
      this.seen = new Set(this.buffer.map((t) => `${t.step}|${t.region}|${t.kind}|${t.text}`));
    }
    if (appended) this._rerender();
  }

  _rerender() {
    const shouldStick = this._isAtBottom();
    const html = this.buffer.map((t) => this._render(t)).join("");
    this.container.innerHTML = html;
    if (shouldStick) this.container.scrollTop = this.container.scrollHeight;
  }

  _isAtBottom() {
    const el = this.container;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  _render(t) {
    const label = REGION_LABELS[t.region] || t.region;
    const text = t.text || t.text_zh || "";
    return `<div class="thought thought-kind-${t.kind}">
      <div class="thought-meta">
        <span class="step">t=${t.step}</span>
        <span class="region">${label}</span>
        <span>· ${t.kind}</span>
      </div>
      <div class="thought-text">${escapeHtml(text)}</div>
    </div>`;
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
