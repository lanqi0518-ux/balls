/**
 * thoughtstream.js — renders the brain's live stream of thoughts.
 *
 * Backend pushes a rolling window of recent thoughts every tick. We only
 * append the ones we haven't seen (dedup by (step, region, kind, text)) so
 * the stream doesn't jitter.
 */

const REGION_LABELS = {
  visual_cortex: "视觉皮层",
  thalamus: "丘脑",
  hippocampus: "海马体",
  amygdala: "杏仁核",
  nucleus_accumbens: "伏隔核",
  prefrontal_cortex: "前额叶",
  motor_cortex: "运动皮层",
  default_mode: "默认网络",
};

const REGION_LABELS_EN = {
  visual_cortex: "Visual cortex",
  thalamus: "Thalamus",
  hippocampus: "Hippocampus",
  amygdala: "Amygdala",
  nucleus_accumbens: "Nucleus accumbens",
  prefrontal_cortex: "Prefrontal cortex",
  motor_cortex: "Motor cortex",
  default_mode: "Default mode",
};

export class ThoughtStream {
  constructor(container, tabsContainer) {
    this.container = container;
    this.seen = new Set();
    this.buffer = []; // keep raw list so we can re-render on language change
    this.lang = "zh";
    if (tabsContainer) {
      tabsContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab");
        if (!btn) return;
        tabsContainer.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.lang = btn.dataset.lang;
        this._rerender();
      });
    }
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
      // trim seen set (rebuild from buffer)
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
    const label = this.lang === "zh"
      ? (REGION_LABELS[t.region] || t.region)
      : (REGION_LABELS_EN[t.region] || t.region);
    const text = this.lang === "zh" ? (t.text_zh || t.text) : t.text;
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
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
