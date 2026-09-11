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

    // Background
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, W, H);

    if (!s) return;

    const N = s.size;
    const cell = Math.min(W, H) / N;
    const pad = 0;

    // Grid
    ctx.strokeStyle = "#1a2434";
    ctx.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      const p = pad + i * cell + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad, p);
      ctx.lineTo(pad + N * cell, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, pad);
      ctx.lineTo(p, pad + N * cell);
      ctx.stroke();
    }

    // Hazards
    for (const [x, y] of s.hazards) {
      const cx = pad + x * cell + cell / 2;
      const cy = pad + y * cell + cell / 2;
      ctx.save();
      ctx.translate(cx, cy);
      // pulsing glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.9);
      glow.addColorStop(0, "rgba(239, 68, 68, 0.5)");
      glow.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, cell * 0.9, 0, Math.PI * 2);
      ctx.fill();
      // core cross / spike
      const r = cell * 0.28;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-r, -r); ctx.lineTo(r, r);
      ctx.moveTo(r, -r);  ctx.lineTo(-r, r);
      ctx.stroke();
      ctx.restore();
    }

    // Food pellets
    for (const [x, y] of s.food) {
      const cx = pad + x * cell + cell / 2;
      const cy = pad + y * cell + cell / 2;
      const pulse = 1 + Math.sin(this._pulse + x + y) * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.6);
      glow.addColorStop(0, "rgba(52, 211, 153, 0.55)");
      glow.addColorStop(1, "rgba(52, 211, 153, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.55 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.18 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Agent
    const [ax, ay] = s.agent;
    const acx = pad + ax * cell + cell / 2;
    const acy = pad + ay * cell + cell / 2;
    ctx.save();
    ctx.translate(acx, acy);
    // aura
    const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 1.1);
    aura.addColorStop(0, "rgba(125, 211, 252, 0.35)");
    aura.addColorStop(1, "rgba(125, 211, 252, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, cell * 1.1, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e8edf5";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Direction arrow based on last action
    const dirs = { 0: [0,-1], 1: [0,1], 2: [-1,0], 3: [1,0], 4: [0,0] };
    const [dx, dy] = dirs[s.last_action] || [0, 0];
    if (dx || dy) {
      ctx.strokeStyle = "#e8edf5";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dx * cell * 0.3, dy * cell * 0.3);
      ctx.stroke();
    }
    ctx.restore();

    // Reward flash
    if (s.last_reward > 0.5) {
      ctx.fillStyle = `rgba(52, 211, 153, ${Math.max(0, 0.4 - (this._pulse % 1) * 0.4)})`;
      ctx.fillRect(0, 0, W, H);
    } else if (s.last_reward < -0.5) {
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.max(0, 0.4 - (this._pulse % 1) * 0.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}


export function renderEnvStats(container, envState, brainState) {
  if (!envState) return;
  const rw = brainState?.reward_stats?.cumulative_reward ?? 0;
  const rwCls = rw > 0 ? "good" : (rw < 0 ? "bad" : "");
  container.innerHTML = `
    <div class="env-stat">
      <div class="env-stat-label">EPISODE</div>
      <div class="env-stat-value">${envState.episode}</div>
    </div>
    <div class="env-stat">
      <div class="env-stat-label">FOOD ATE</div>
      <div class="env-stat-value good">${envState.food_eaten}</div>
    </div>
    <div class="env-stat">
      <div class="env-stat-label">HAZARDS HIT</div>
      <div class="env-stat-value bad">${envState.hazards_hit}</div>
    </div>
    <div class="env-stat">
      <div class="env-stat-label">Σ REWARD</div>
      <div class="env-stat-value ${rwCls}">${rw.toFixed(2)}</div>
    </div>
  `;
}
