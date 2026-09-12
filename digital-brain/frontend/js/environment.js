/**
 * environment.js — draws the tiny GridWorld the brain is embodied in.
 *
 * The agent, food pellets, hazards, and the "vision cone" hint are all
 * rendered on a 2D canvas that scales with the panel.
 */

export class EnvironmentView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = null;
    this._pulse = 0;
    this._loop();
  }

  update(state) {
    this.state = state;
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    this._pulse += 0.05;
    this._draw();
  }

  _draw() {
    const ctx = this.ctx;
    const s = this.state;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // OLED background with a barely-there radial to give the surface
    // depth — matches the premium panel treatment site-wide.
    ctx.fillStyle = "#03040A";
    ctx.fillRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, "rgba(110, 231, 255, 0.06)");
    bg.addColorStop(1, "rgba(0, 0, 0, 0.65)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (!s) return;

    const N = s.size;
    const cell = Math.min(W, H) / N;
    const pad = 0;

    // Hairline grid — every other line is a whisper stronger so the
    // eye reads it as a proper technical grid, not a checkerboard.
    for (let i = 0; i <= N; i++) {
      const p = pad + i * cell + 0.5;
      ctx.strokeStyle = i % 3 === 0
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(255, 255, 255, 0.025)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(pad + N * cell, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, pad + N * cell); ctx.stroke();
    }
    // Frame — sharpen the boundary against the vignette.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, N * cell - 1, N * cell - 1);

    // Hazards — subtle rose glow with a diamond core, replacing the
    // loud red X. Still legibly a "danger" cell but doesn't shout.
    for (const [x, y] of s.hazards) {
      const cx = pad + x * cell + cell / 2;
      const cy = pad + y * cell + cell / 2;
      ctx.save();
      ctx.translate(cx, cy);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.85);
      glow.addColorStop(0, "rgba(251, 113, 133, 0.35)");
      glow.addColorStop(1, "rgba(251, 113, 133, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.85, 0, Math.PI * 2); ctx.fill();
      const r = cell * 0.24;
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "rgba(251, 113, 133, 0.9)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Food pellets — champagne gold. Money is gold in the premium
    // palette; keeping the reward token in the same accent tightens
    // the whole design language across every panel.
    for (const [x, y] of s.food) {
      const cx = pad + x * cell + cell / 2;
      const cy = pad + y * cell + cell / 2;
      const pulse = 1 + Math.sin(this._pulse + x + y) * 0.14;
      ctx.save();
      ctx.translate(cx, cy);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.65);
      glow.addColorStop(0, "rgba(232, 217, 166, 0.55)");
      glow.addColorStop(1, "rgba(232, 217, 166, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.6 * pulse, 0, Math.PI * 2); ctx.fill();
      // Inner ring + core dot — a tiny mint coin.
      ctx.strokeStyle = "rgba(232, 217, 166, 0.75)";
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.24 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(253, 230, 138, 1)";
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.11 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Agent — cyan halo, magenta accent ring, white core. Its aura
    // breathes with the global pulse so the eye locks onto the brain.
    const [ax, ay] = s.agent;
    const acx = pad + ax * cell + cell / 2;
    const acy = pad + ay * cell + cell / 2;
    const breathe = 1 + Math.sin(this._pulse * 1.5) * 0.08;
    ctx.save();
    ctx.translate(acx, acy);
    const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 1.25 * breathe);
    aura.addColorStop(0.0, "rgba(110, 231, 255, 0.36)");
    aura.addColorStop(0.5, "rgba(240, 171, 252, 0.14)");
    aura.addColorStop(1.0, "rgba(110, 231, 255, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, cell * 1.25 * breathe, 0, Math.PI * 2); ctx.fill();
    // Outer cognition ring
    ctx.strokeStyle = "rgba(240, 171, 252, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.42, 0, Math.PI * 2); ctx.stroke();
    // Body
    const body = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.34);
    body.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    body.addColorStop(0.55, "rgba(110, 231, 255, 0.85)");
    body.addColorStop(1, "rgba(110, 231, 255, 0.05)");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.34, 0, Math.PI * 2); ctx.fill();
    // Direction indicator (thin line)
    const dirs = { 0: [0,-1], 1: [0,1], 2: [-1,0], 3: [1,0], 4: [0,0] };
    const [dx, dy] = dirs[s.last_action] || [0, 0];
    if (dx || dy) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * cell * 0.36, dy * cell * 0.36);
      ctx.stroke();
    }
    ctx.restore();

    // Reward flash — softer, colour-coded to our palette (gold for
    // gain, rose for loss) rather than pure green / red.
    if (s.last_reward > 0.5) {
      ctx.fillStyle = `rgba(232, 217, 166, ${Math.max(0, 0.28 - (this._pulse % 1) * 0.28)})`;
      ctx.fillRect(0, 0, W, H);
    } else if (s.last_reward < -0.5) {
      ctx.fillStyle = `rgba(251, 113, 133, ${Math.max(0, 0.28 - (this._pulse % 1) * 0.28)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Outer vignette — matches the panel treatment.
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
}


export function renderEnvStats(container, envState, brainState) {
  if (!envState) return;
  const rw = brainState?.reward_stats?.cumulative_reward ?? 0;
  container.innerHTML = `
    <div class="env-stat">
      <div class="env-stat-label">CYCLE</div>
      <div class="env-stat-value">${envState.episode}</div>
    </div>
    <div class="env-stat">
      <div class="env-stat-label">+ SIGNAL</div>
      <div class="env-stat-value">${envState.food_eaten}</div>
    </div>
    <div class="env-stat">
      <div class="env-stat-label">− SIGNAL</div>
      <div class="env-stat-value">${envState.hazards_hit}</div>
    </div>
    <div class="env-stat">
      <div class="env-stat-label">Σ VALUE</div>
      <div class="env-stat-value">${rw.toFixed(2)}</div>
    </div>
  `;
}
