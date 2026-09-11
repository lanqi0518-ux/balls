"""Trader cortex — a policy MLP that decides buy / hold / sell on Solana meme tokens.

Trained two ways, continually and simultaneously:

  * **Behavior cloning** — every time a *tracked smart-money wallet* buys
    or sells a token, we take a snapshot of that token's market features
    at that moment and treat the wallet's action as the target label. A
    cross-entropy step on our policy nudges it toward mimicking them.
  * **PnL reinforcement** — every time our own paper-trader closes a
    position, we do a one-step advantage update against the realized PnL
    (positive PnL -> reinforce the buy log-prob; negative -> discourage).

Input:  market feature vector (from ``market.features``, dim 16)
         + hint features (dim ~8: current position, unrealized PnL, cash)
Output: 3-way categorical (buy / hold / sell) + a confidence estimate
"""

from __future__ import annotations

from typing import Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from ..region import BrainRegion, RegionMeta, _count_active


ACTION_NAMES = ["hold", "buy", "sell"]
ACTION_NAMES_ZH = ["观望", "买入", "卖出"]
HOLD, BUY, SELL = 0, 1, 2

HINT_DIM = 6  # cash frac / position frac / unrealized pnl / hold seconds / last confidence / lit
INPUT_DIM_DEFAULT = 16 + HINT_DIM


class TraderCortex(BrainRegion):
    meta = RegionMeta(
        name="trader_cortex",
        display_name="Trader cortex",
        zh_name="交易皮层",
        position=(35.0, 40.0, 20.0),
        color="#f97316",
        role="Hunts fresh pump.fun launches; forms its own opinions; learns from smart money only when uncertain",
        role_zh="扫描 pump.fun 新发射，独立判断，仅在不确定时才向聪明钱学习",
    )

    def __init__(self, market_feature_dim: int = 16, hidden: int = 96,
                 lr_bc: float = 3e-3, lr_rl: float = 5e-4):
        super().__init__()
        self.input_dim = market_feature_dim + HINT_DIM
        self.hidden = hidden
        self.trunk = nn.Sequential(
            nn.Linear(self.input_dim, hidden),
            nn.Tanh(),
            nn.Linear(hidden, hidden),
            nn.Tanh(),
        )
        self.policy_head = nn.Linear(hidden, 3)
        # Start biased toward HOLD so an untrained cortex doesn't randomly
        # scalp itself into the ground while it accumulates BC/RL signal.
        with torch.no_grad():
            self.policy_head.bias.data = torch.tensor([1.6, -0.3, -0.3])
        self.value_head = nn.Linear(hidden, 1)
        self.optim_bc = torch.optim.Adam(self._all_params(), lr=lr_bc)
        self.optim_rl = torch.optim.Adam(self._all_params(), lr=lr_rl)
        self.neurons_total = hidden * 2 + 3 + 1

        # Stats
        self.bc_updates: int = 0
        self.rl_updates: int = 0
        self.last_bc_loss: float = 0.0
        self.last_rl_loss: float = 0.0
        self.last_confidence: float = 0.0
        self.total_wallet_trades_seen: int = 0

        # Autonomy accounting: for every wallet trade we observe, categorize
        # whether the brain (a) already agreed on its own, (b) disagreed with
        # conviction (and we respected that), or (c) was uncertain and
        # actually learned from the wallet.
        self.independent_agrees: int = 0
        self.convictions: int = 0
        self.imitated: int = 0
        # Confidence threshold above which the brain trusts its own call
        # over the wallet's. Lower → brain leans on wallets more, higher →
        # brain thinks for itself more.
        self.own_opinion_threshold: float = 0.60

    def _all_params(self):
        for p in self.trunk.parameters():
            yield p
        for p in self.policy_head.parameters():
            yield p
        for p in self.value_head.parameters():
            yield p

    # ------------------------------------------------------------------

    def forward(self, feats: torch.Tensor):
        h = self.trunk(feats)
        logits = self.policy_head(h)
        value = self.value_head(h).squeeze(-1)
        return logits, value, h

    def decide(self, market_feats: torch.Tensor, hints: torch.Tensor,
               temperature: float = 1.0) -> Tuple[int, torch.Tensor, torch.Tensor, torch.Tensor]:
        """Return (action, log_prob, probs, value)."""
        with torch.no_grad():
            x = torch.cat([market_feats, hints])
            logits, value, h = self.forward(x)
            if temperature != 1.0:
                logits = logits / max(1e-3, temperature)
            probs = F.softmax(logits, dim=-1)
        dist = torch.distributions.Categorical(probs=probs)
        action = int(dist.sample().item())
        log_prob = torch.log(probs[action] + 1e-9)
        self.last_confidence = float(probs[action].item())
        self._set_activity(min(1.0, float(h.abs().mean().item()) * 1.6),
                           _count_active(h))
        return action, log_prob, probs, value

    # ------------------------------------------------------------------
    # Behavior cloning
    # ------------------------------------------------------------------

    def clone_from_expert(self, market_feats: torch.Tensor, hints: torch.Tensor,
                         expert_action: int, weight: float = 1.0) -> float:
        x = torch.cat([market_feats, hints])
        logits, _, _ = self.forward(x)
        target = torch.tensor(expert_action, dtype=torch.long)
        loss = F.cross_entropy(logits.unsqueeze(0), target.unsqueeze(0)) * weight
        self.optim_bc.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(list(self._all_params()), 1.0)
        self.optim_bc.step()
        self.bc_updates += 1
        self.total_wallet_trades_seen += 1
        self.last_bc_loss = float(loss.item())
        return self.last_bc_loss

    # ------------------------------------------------------------------
    # PnL RL update — called when a paper position closes
    # ------------------------------------------------------------------

    def reinforce_from_pnl(self, market_feats: torch.Tensor, hints: torch.Tensor,
                          action_taken: int, pnl_frac: float) -> float:
        """One-step REINFORCE with baseline. ``pnl_frac`` is the % PnL from the trade."""
        x = torch.cat([market_feats, hints])
        logits, value, _ = self.forward(x)
        log_probs = F.log_softmax(logits, dim=-1)
        target = torch.tensor(float(pnl_frac), dtype=torch.float32)
        advantage = target - value.detach()
        policy_loss = -log_probs[action_taken] * advantage
        value_loss = F.smooth_l1_loss(value, target)
        loss = policy_loss + 0.5 * value_loss
        self.optim_rl.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(list(self._all_params()), 1.0)
        self.optim_rl.step()
        self.rl_updates += 1
        self.last_rl_loss = float(loss.item())
        return self.last_rl_loss

    # ------------------------------------------------------------------

    def stats(self) -> dict:
        total_reviewed = (self.independent_agrees
                          + self.convictions
                          + self.imitated)
        # Anneal BC influence as the brain sees more expert trades: at
        # ~3000 trades seen we cap BC's remaining pull at ~10%.
        bc_scale = max(0.1, 1.0 - self.total_wallet_trades_seen / 3000.0)
        return {
            "bc_updates": self.bc_updates,
            "rl_updates": self.rl_updates,
            "expert_trades_seen": self.total_wallet_trades_seen,
            "last_bc_loss": round(self.last_bc_loss, 4),
            "last_rl_loss": round(self.last_rl_loss, 4),
            "last_confidence": round(self.last_confidence, 3),
            "independent_agrees": self.independent_agrees,
            "convictions": self.convictions,
            "imitated": self.imitated,
            "autonomy_pct": (
                round(
                    100.0 * (self.independent_agrees + self.convictions)
                    / max(1, total_reviewed),
                    1,
                )
                if total_reviewed
                else 0.0
            ),
            "bc_scale": round(bc_scale, 3),
            "own_opinion_threshold": self.own_opinion_threshold,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "trunk": self.trunk.state_dict(),
            "policy_head": self.policy_head.state_dict(),
            "value_head": self.value_head.state_dict(),
            "bc_updates": self.bc_updates,
            "rl_updates": self.rl_updates,
            "total_wallet_trades_seen": self.total_wallet_trades_seen,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.trunk.load_state_dict(sd.get("trunk", {}), strict=False)
            self.policy_head.load_state_dict(sd.get("policy_head", {}), strict=False)
            self.value_head.load_state_dict(sd.get("value_head", {}), strict=False)
            self.bc_updates = int(sd.get("bc_updates", 0))
            self.rl_updates = int(sd.get("rl_updates", 0))
            self.total_wallet_trades_seen = int(sd.get("total_wallet_trades_seen", 0))
        except Exception:
            pass
