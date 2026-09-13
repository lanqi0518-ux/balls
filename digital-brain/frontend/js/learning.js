/**
 * learning.js — the "what is the brain reading / learning right now" panel.
 *
 * In learning mode the brain doesn't trade; it reads the live web (news +
 * social) and files what it reads into its knowledge bank. This panel makes
 * that legible at a glance: what it's reading this second, how big its
 * knowledge has grown, and the last handful of things it learned.
 */

let els = null;

function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function initLearning(panelEl) {
  if (!panelEl) return;
  panelEl.innerHTML = `
    <div class="learn-hero" id="learn-hero">
      <div class="learn-hero-label">
        <span class="learn-live-dot"></span>
        <span id="learn-hero-src">READING NOW</span>
      </div>
      <a class="learn-hero-title" id="learn-hero-title" href="#" target="_blank" rel="noopener">
        warming up — opening the day's news…
      </a>
    </div>

    <div class="learn-stats">
      <div class="learn-stat">
        <div class="learn-stat-v" id="learn-ideas">—</div>
        <div class="learn-stat-k">ideas learned</div>
      </div>
      <div class="learn-stat">
        <div class="learn-stat-v" id="learn-read">—</div>
        <div class="learn-stat-k">headlines read</div>
      </div>
      <div class="learn-stat">
        <div class="learn-stat-v" id="learn-source">—</div>
        <div class="learn-stat-k">now browsing</div>
      </div>
      <div class="learn-stat">
        <div class="learn-stat-v" id="learn-next">—</div>
        <div class="learn-stat-k">up next</div>
      </div>
    </div>

    <div class="learn-recent">
      <div class="learn-recent-head">Recently learned</div>
      <ul id="learn-recent-list" class="learn-recent-list">
        <li class="learn-recent-empty">nothing filed yet — the brain is opening its first pages…</li>
      </ul>
    </div>

    <div class="learn-sources" id="learn-sources"></div>
  `;
  els = {
    hero: panelEl.querySelector("#learn-hero"),
    heroSrc: panelEl.querySelector("#learn-hero-src"),
    heroTitle: panelEl.querySelector("#learn-hero-title"),
    ideas: panelEl.querySelector("#learn-ideas"),
    read: panelEl.querySelector("#learn-read"),
    source: panelEl.querySelector("#learn-source"),
    next: panelEl.querySelector("#learn-next"),
    recentList: panelEl.querySelector("#learn-recent-list"),
    sources: panelEl.querySelector("#learn-sources"),
  };
}

let lastKey = null;

export function updateLearning(l) {
  if (!els) return;
  if (!l || l.enabled === false) {
    els.heroSrc.textContent = "LEARNING OFF";
    els.heroTitle.textContent = "the brain is not reading right now.";
    els.heroTitle.removeAttribute("href");
    return;
  }

  const reading = l.reading_now || null;
  if (reading && reading.title) {
    els.heroSrc.textContent = `READING NOW · ${reading.source || "the web"}`;
    els.heroTitle.textContent = reading.title;
    if (reading.url) {
      els.heroTitle.setAttribute("href", reading.url);
    } else {
      els.heroTitle.removeAttribute("href");
    }
    const key = reading.url || reading.title;
    if (key !== lastKey) {
      els.hero.classList.remove("lit");
      void els.hero.offsetWidth;
      els.hero.classList.add("lit");
      lastKey = key;
    }
  }

  els.ideas.textContent = fmt(l.knowledge_total);
  els.read.textContent = fmt(l.items_read);
  els.source.textContent = shortSrc((reading && reading.source) || l.next_up || "—");
  els.next.textContent = shortSrc(l.next_up || "—");

  const recent = l.recent || [];
  if (recent.length) {
    els.recentList.innerHTML = recent.slice(0, 14).map((it) => {
      const kind = it.kind === "voice" ? "voice" : "news";
      const src = escapeHtml(it.source || "web");
      const title = escapeHtml(it.title || "");
      const inner = it.url
        ? `<a href="${escapeAttr(it.url)}" target="_blank" rel="noopener">${title}</a>`
        : title;
      return `<li class="learn-recent-item learn-kind-${kind}">
        <span class="learn-recent-src">${src}</span>
        <span class="learn-recent-title">${inner}</span>
      </li>`;
    }).join("");
  }

  const sources = l.sources || [];
  if (sources.length) {
    els.sources.textContent = "reading list · " + sources.join(" · ");
  }
}

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function shortSrc(s) {
  s = String(s || "—");
  return s.length > 22 ? s.slice(0, 21) + "…" : s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
