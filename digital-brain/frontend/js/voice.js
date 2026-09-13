/**
 * voice.js — the "Voice" panel: the brain's autonomous X/Twitter feed.
 *
 * Renders what Broca's area (the 21st region) has said. Every line here is
 * a tweet the brain composed from its own live internal state — no LLM,
 * no human. When the account is keyed via Fly secrets each line links to
 * the real posted tweet; unkeyed, it shows composed-but-unsent drafts so
 * the feature is visible before an account is attached.
 */

const KIND_LABEL = {
  status: "status",
  daily: "daily digest",
  weekly: "weekly milestone",
  spontaneous: "spontaneous",
};

export function initVoice(panelEl) {
  panelEl.innerHTML = `
    <div class="voice-head">
      <div class="voice-head-l">
        <span class="voice-title">Broca's area · autonomous voice</span>
        <span class="voice-sub">the brain writes its own tweets from live internal state — zero LLM</span>
      </div>
      <div class="voice-head-r">
        <span class="voice-pill" id="voice-account">—</span>
        <span class="voice-pill" id="voice-next">next in —</span>
      </div>
    </div>
    <div class="voice-feed" id="voice-feed">
      <div class="voice-empty">warming up — the cortex hasn't spoken yet…</div>
    </div>
  `;
}

export function updateVoice(twitter) {
  if (!twitter) return;
  const account = document.getElementById("voice-account");
  const next = document.getElementById("voice-next");
  const feed = document.getElementById("voice-feed");
  const badge = document.getElementById("voice-badge");
  if (!feed) return;

  if (account) {
    if (twitter.screen_name) {
      account.textContent = `@${twitter.screen_name}`;
      account.className = "voice-pill live";
    } else if (twitter.dry_run) {
      account.textContent = twitter.has_credentials ? "dry-run" : "no account yet";
      account.className = "voice-pill draft";
    } else {
      account.textContent = "posting";
      account.className = "voice-pill live";
    }
  }
  if (badge) {
    badge.textContent = twitter.dry_run ? "draft" : "live";
  }
  if (next && typeof twitter.next_status_in_s === "number") {
    next.textContent = `next in ${fmtEta(twitter.next_status_in_s)}`;
  }

  const utterances = twitter.utterances || [];
  if (!utterances.length) {
    feed.innerHTML = `<div class="voice-empty">warming up — the cortex hasn't spoken yet…</div>`;
    return;
  }
  feed.innerHTML = utterances.map(renderUtterance).join("");
}

function renderUtterance(u) {
  let kind = KIND_LABEL[u.kind] || u.kind || "status";
  if (u.kind === "spontaneous" && u.trigger) kind = `spontaneous · ${u.trigger}`;
  const when = u.at_s ? fmtAgo(Date.now() / 1000 - u.at_s) : "";
  const posted = u.posted;
  const isDraft = !posted;
  let statusHtml;
  if (posted && u.url) {
    statusHtml = `<a class="voice-link" href="${escapeAttr(u.url)}" target="_blank" rel="noopener">view on X ↗</a>`;
  } else if (u.dry_run) {
    statusHtml = `<span class="voice-flag draft">draft · not sent</span>`;
  } else if (u.error) {
    statusHtml = `<span class="voice-flag err" title="${escapeAttr(u.error)}">send failed</span>`;
  } else {
    statusHtml = `<span class="voice-flag draft">queued</span>`;
  }
  return `<div class="voice-item ${isDraft ? "is-draft" : "is-posted"}">
    <div class="voice-item-meta">
      <span class="voice-kind voice-kind-${escapeAttr(u.kind || "status")}">${escapeHtml(kind)}</span>
      <span class="voice-when">${escapeHtml(when)}</span>
      <span class="voice-chars mono">${u.chars || (u.text || "").length}/280</span>
    </div>
    <div class="voice-text">${escapeHtml(u.text || "")}</div>
    <div class="voice-item-foot">${statusHtml}</div>
  </div>`;
}

function fmtEta(s) {
  s = Math.max(0, Math.floor(s));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

function fmtAgo(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
