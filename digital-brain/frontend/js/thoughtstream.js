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
  anterior_cingulate: "Anterior cingulate",
  ventral_tegmental: "Ventral tegmental area",
  hypothalamus: "Hypothalamus",
  entorhinal_cortex: "Entorhinal cortex",
  posterior_parietal: "Posterior parietal",
  raphe_nuclei: "Raphe nuclei",
  broca: "Broca's area",
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
    this._trim();
    if (appended) this._rerender();
  }

  /**
   * Fold the brain's voice — the things it wants to say (Broca's
   * utterances / tweets) — into the same stream, styled as speech so the
   * panel reads as "what's on its mind + what it wants to say".
   */
  addUtterances(utts) {
    if (!utts || !utts.length) return;
    let appended = 0;
    // utterances arrive newest-first; append oldest-first so the newest
    // lands at the bottom next to the live cortex thoughts.
    for (const u of [...utts].reverse()) {
      const key = `voice|${u.n}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      this.buffer.push({
        _voice: true,
        n: u.n,
        kind: u.kind,
        text: u.text,
        trigger: u.trigger || "",
        posted: u.posted,
        dry_run: u.dry_run,
        at_s: u.at_s,
      });
      appended++;
    }
    this._trim();
    if (appended) this._rerender();
  }

  _trim() {
    if (this.buffer.length > 60) {
      this.buffer.splice(0, this.buffer.length - 60);
    }
    if (this.seen.size > 300) {
      this.seen = new Set(this.buffer.map((t) =>
        t._voice ? `voice|${t.n}` : `${t.step}|${t.region}|${t.kind}|${t.text}`));
    }
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
    if (t._voice) return this._renderVoice(t);
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

  _renderVoice(t) {
    const kind = String(t.kind || "thought");
    const flag = t.posted ? "posted" : (t.dry_run ? "unsent" : "");
    const tag = t.trigger ? `${kind} · ${t.trigger}` : kind;
    return `<div class="thought thought-voice voice-kind-${escapeHtml(kind)}">
      <div class="thought-meta">
        <span class="region voice-speaker">Broca · wants to say</span>
        <span>· ${escapeHtml(tag)}</span>
        ${flag ? `<span class="voice-flag ${flag === "posted" ? "ok" : ""}">${flag}</span>` : ""}
      </div>
      <div class="thought-voice-text">${escapeHtml(t.text || "")}</div>
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
