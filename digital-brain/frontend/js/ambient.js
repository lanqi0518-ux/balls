/**
 * ambient.js — subtle neural-mesh background that lives underneath the
 * entire UI. Not a game engine; just a slow, low-density constellation
 * of blue/violet nodes that connect when close, drift, and pulse in
 * time with the WebSocket tick.
 *
 * Everything is one <canvas> pinned behind the layout. It's aggressively
 * cheap — max 60 nodes, capped at ~30 fps, and pauses redraws when the
 * tab is hidden. On a laptop it uses < 1% CPU.
 */

const NODES_TARGET = 58;          // desktop node count
const NODES_MIN = 32;             // mobile fallback
const CONNECT_DIST = 170;         // px within which two nodes draw a line
const DRIFT_SPEED = 0.15;         // px/frame base speed
const PULSE_DECAY = 0.94;         // how fast a tick-pulse fades

const COLORS = {
  node:   [110, 231, 255],        // #6EE7FF electric cyan
  edge:   [110, 231, 255],        // #6EE7FF electric cyan
  spark:  [240, 171, 252],        // #F0ABFC magenta cognition pulse
  bright: [232, 253, 255],        // near-white flash with cyan tint
};

function rgba(triplet, a) {
  return `rgba(${triplet[0]}, ${triplet[1]}, ${triplet[2]}, ${a})`;
}

export class AmbientMesh {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.nodes = [];
    this.pulse = 0;                    // 0..1 — decays every frame
    this.lastFrame = 0;
    this.running = true;
    this.paused = false;
    this._resizeBound = () => this._resize();
    this._visBound = () => this._onVisibility();
    window.addEventListener("resize", this._resizeBound);
    document.addEventListener("visibilitychange", this._visBound);
    this._resize();
    this._seedNodes();
    requestAnimationFrame((t) => this._loop(t));
  }

  destroy() {
    this.running = false;
    window.removeEventListener("resize", this._resizeBound);
    document.removeEventListener("visibilitychange", this._visBound);
  }

  /** Called every time the WS delivers a fresh tick. Kicks off a soft
   * ripple through the mesh so users viscerally feel the pulse. */
  onBrainTick() {
    this.pulse = Math.min(1, this.pulse + 0.35);
  }

  // --- internals ---

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.w = w;
    this.h = h;
    if (this.nodes.length) this._retargetNodesToBounds();
  }

  _seedNodes() {
    const count = window.innerWidth < 900 ? NODES_MIN : NODES_TARGET;
    this.nodes = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = DRIFT_SPEED * (0.4 + Math.random() * 0.9);
      this.nodes.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.2 + Math.random() * 1.6,
        /** per-node phase for the breathing brightness envelope */
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  _retargetNodesToBounds() {
    for (const n of this.nodes) {
      if (n.x > this.w) n.x = Math.random() * this.w;
      if (n.y > this.h) n.y = Math.random() * this.h;
    }
  }

  _onVisibility() {
    this.paused = document.hidden;
    if (!this.paused) this.lastFrame = 0;
  }

  _loop(t) {
    if (!this.running) return;
    if (this.paused) {
      requestAnimationFrame((tt) => this._loop(tt));
      return;
    }
    // Cap at ~30 fps for cheapness. Even at 30 fps the drift is smooth
    // because we're moving at < 0.5 px per frame.
    if (t - this.lastFrame < 33) {
      requestAnimationFrame((tt) => this._loop(tt));
      return;
    }
    const dt = this.lastFrame === 0 ? 16 : Math.min(48, t - this.lastFrame);
    this.lastFrame = t;
    this._step(dt / 16);
    this._draw(t);
    requestAnimationFrame((tt) => this._loop(tt));
  }

  _step(scale) {
    for (const n of this.nodes) {
      n.x += n.vx * scale;
      n.y += n.vy * scale;
      // Soft bounce off edges (keeps the drift bounded without teleport pops)
      if (n.x < 0 || n.x > this.w) n.vx *= -1;
      if (n.y < 0 || n.y > this.h) n.vy *= -1;
      n.phase += 0.008 * scale;
    }
    this.pulse *= PULSE_DECAY;
  }

  _draw(t) {
    const { ctx, w, h, dpr } = this;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ---- edges (lines) ----
    // We draw the connections first so nodes float on top of them.
    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const b = this.nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > CONNECT_DIST * CONNECT_DIST) continue;
        const d = Math.sqrt(d2);
        // Base alpha falls off with distance; extra alpha from the pulse.
        const base = 0.05 * (1 - d / CONNECT_DIST);
        const extra = 0.18 * this.pulse * (1 - d / CONNECT_DIST);
        const alpha = base + extra;
        if (alpha < 0.005) continue;
        // During a pulse tint edges toward magenta ("cognition"); resting
        // state is quiet cyan.
        const useSpark = this.pulse > 0.15;
        ctx.strokeStyle = useSpark
          ? rgba(COLORS.spark, alpha)
          : rgba(COLORS.edge, alpha);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // ---- nodes ----
    for (const n of this.nodes) {
      // Breathing brightness so the field feels alive even at rest.
      const breathe = 0.5 + 0.5 * Math.sin(n.phase + t * 0.0006);
      const brightness = 0.28 + 0.22 * breathe + 0.35 * this.pulse;
      const glowR = n.r * (1.8 + this.pulse * 1.6);
      // Soft glow
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR * 4);
      grad.addColorStop(0, rgba(COLORS.node, brightness * 0.6));
      grad.addColorStop(1, rgba(COLORS.node, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR * 4, 0, Math.PI * 2);
      ctx.fill();
      // Core dot
      ctx.fillStyle = rgba(this.pulse > 0.3 ? COLORS.spark : COLORS.bright, brightness);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
