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

/* Mystical dust — a second, sparser layer of tiny floating motes with
   long-tail glows. Not connected to anything; they just drift like
   particles in a cathedral shaft of light. Cheap: each is a single
   radial gradient per frame, and there are only ~120 of them. */
const DUST_TARGET = 120;
const DUST_MIN = 70;
const DUST_DRIFT = 0.05;

/* Fireflies — 9 larger glowing motes that pulse slowly and drift
   with a gentle sine wobble. Each carries its own hue so the mesh
   reads as a real spectrum rather than a monochrome blur. */
const FIREFLY_TARGET = 9;
const FIREFLY_MIN = 6;

const COLORS = {
  node:   [110, 231, 255],        // #6EE7FF electric cyan
  edge:   [110, 231, 255],        // #6EE7FF electric cyan
  spark:  [240, 171, 252],        // #F0ABFC magenta cognition pulse
  bright: [232, 253, 255],        // near-white flash with cyan tint
  dust:   [200, 220, 255],        // soft near-white blue for the dust field
};

const FIREFLY_HUES = [
  [110, 231, 255],   // cyan
  [240, 171, 252],   // magenta
  [232, 217, 166],   // gold
  [168, 85, 247],    // violet
  [252, 176, 148],   // warm coral (rare)
  [110, 231, 255],   // cyan again — bias the mix
];

function rgba(triplet, a) {
  return `rgba(${triplet[0]}, ${triplet[1]}, ${triplet[2]}, ${a})`;
}

export class AmbientMesh {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._isMobile = window.matchMedia("(max-width: 800px)").matches;
    this.dpr = Math.min(this._isMobile ? 1 : 2, window.devicePixelRatio || 1);
    this._minFrameMs = this._isMobile ? 40 : 0;
    this.nodes = [];
    this.dust = [];
    this.fireflies = [];
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
    this._seedDust();
    this._seedFireflies();
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

  _seedDust() {
    const count = window.innerWidth < 900 ? DUST_MIN : DUST_TARGET;
    this.dust = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = DUST_DRIFT * (0.3 + Math.random() * 1.4);
      this.dust.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.02,   // very faint upward drift
        r: 0.5 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.18 + Math.random() * 0.35,
      });
    }
  }

  _seedFireflies() {
    const count = window.innerWidth < 900 ? FIREFLY_MIN : FIREFLY_TARGET;
    this.fireflies = [];
    for (let i = 0; i < count; i++) {
      const hue = FIREFLY_HUES[i % FIREFLY_HUES.length];
      this.fireflies.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        baseVx: (Math.random() - 0.5) * 0.10,
        baseVy: (Math.random() - 0.5) * 0.08,
        r: 2.2 + Math.random() * 1.6,
        hue,
        phase: Math.random() * Math.PI * 2,
        wobbleAmp: 0.35 + Math.random() * 0.45,
      });
    }
  }

  _retargetNodesToBounds() {
    for (const n of this.nodes) {
      if (n.x > this.w) n.x = Math.random() * this.w;
      if (n.y > this.h) n.y = Math.random() * this.h;
    }
    for (const d of this.dust) {
      if (d.x > this.w) d.x = Math.random() * this.w;
      if (d.y > this.h) d.y = Math.random() * this.h;
    }
    for (const f of this.fireflies) {
      if (f.x > this.w) f.x = Math.random() * this.w;
      if (f.y > this.h) f.y = Math.random() * this.h;
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
    if (t - this.lastFrame < Math.max(33, this._minFrameMs)) {
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
      if (n.x < 0 || n.x > this.w) n.vx *= -1;
      if (n.y < 0 || n.y > this.h) n.vy *= -1;
      n.phase += 0.008 * scale;
    }
    for (const d of this.dust) {
      d.x += d.vx * scale;
      d.y += d.vy * scale;
      d.phase += 0.006 * scale;
      // wrap around (dust reads as endless field, not bouncing)
      if (d.x < -10) d.x = this.w + 10;
      if (d.x > this.w + 10) d.x = -10;
      if (d.y < -10) d.y = this.h + 10;
      if (d.y > this.h + 10) d.y = -10;
    }
    for (const f of this.fireflies) {
      f.phase += 0.012 * scale;
      // Gentle sine wobble around the base velocity
      const vx = f.baseVx + Math.sin(f.phase) * 0.05 * f.wobbleAmp;
      const vy = f.baseVy + Math.cos(f.phase * 0.7) * 0.05 * f.wobbleAmp;
      f.x += vx * scale;
      f.y += vy * scale;
      if (f.x < -20) f.x = this.w + 20;
      if (f.x > this.w + 20) f.x = -20;
      if (f.y < -20) f.y = this.h + 20;
      if (f.y > this.h + 20) f.y = -20;
    }
    this.pulse *= PULSE_DECAY;
  }

  _draw(t) {
    const { ctx, w, h, dpr } = this;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ---- dust motes ----
    // Painted first so nodes and fireflies float on top.  These are the
    // tiny near-white specks that give the whole page a "cathedral shaft
    // of light" quality without ever demanding attention.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const d of this.dust) {
      const breathe = 0.55 + 0.45 * Math.sin(d.phase);
      const a = d.alpha * breathe;
      if (a < 0.02) continue;
      ctx.fillStyle = rgba(COLORS.dust, a * 0.9);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

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

    // ---- fireflies ----
    // Handful of larger, hue-shifted, slow-pulsing points that read as
    // roaming souls / lightning bugs across the whole page.  Painted
    // with additive blending so they bloom into whatever they cross.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of this.fireflies) {
      const breathe = 0.55 + 0.45 * Math.sin(f.phase * 0.6);
      const bright = 0.45 + 0.75 * breathe + 0.35 * this.pulse;
      const glowR = f.r * (9 + breathe * 4);
      // Outer wide halo — feels like a witch's lantern
      const outer = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glowR);
      outer.addColorStop(0.0, rgba(f.hue, bright * 0.65));
      outer.addColorStop(0.35, rgba(f.hue, bright * 0.28));
      outer.addColorStop(1.0, rgba(f.hue, 0));
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(f.x, f.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      // Inner tight core — the visible mote itself
      const inner = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3.2);
      inner.addColorStop(0.0, rgba(COLORS.bright, Math.min(1, bright)));
      inner.addColorStop(0.5, rgba(f.hue, bright * 0.6));
      inner.addColorStop(1.0, rgba(f.hue, 0));
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Bright pinpoint
      ctx.fillStyle = rgba(COLORS.bright, Math.min(1, bright * 1.15));
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}
