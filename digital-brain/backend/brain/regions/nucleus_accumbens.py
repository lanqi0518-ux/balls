"""Nucleus accumbens / VTA — reward and reward-prediction error.

In real brains, dopaminergic VTA neurons fire on *unexpected* reward and
project to the nucleus accumbens, which drives motivation and reinforces
whatever action led to the reward.

Implementation: keeps a running expected-reward baseline (like a value
baseline in reinforcement learning). When actual reward exceeds baseline,
we produce a positive prediction error — the RL surprise signal.
"""

from __future__ import annotations

from ..region import BrainRegion, RegionMeta


class NucleusAccumbens(BrainRegion):
    meta = RegionMeta(
        name="nucleus_accumbens",
        display_name="Nucleus accumbens / VTA",
        zh_name="伏隔核 & 腹侧被盖区",
        position=(0.0, 12.0, -18.0),
        color="#22d3ee",
        role="Reward prediction error and motivation",
        role_zh="奖励预测误差与动机",
    )

    def __init__(self, tau: float = 0.95):
        super().__init__()
        self.baseline: float = 0.0
        self.last_reward: float = 0.0
        self.last_error: float = 0.0
        self.cumulative_reward: float = 0.0
        self.tau = tau
        self.neurons_total = 48

    def perceive(self, actual_reward: float) -> float:
        error = actual_reward - self.baseline
        self.last_reward = float(actual_reward)
        self.last_error = float(error)
        self.baseline = self.tau * self.baseline + (1 - self.tau) * actual_reward
        self.cumulative_reward += actual_reward
        # Dopaminergic-style activation: absolute prediction error.
        act = min(1.0, abs(error) * 1.5 + 0.05)
        self._set_activity(act, int(act * self.neurons_total))
        if error > 0.3:
            self.note(f"↑ positive surprise +{error:.2f}")
        elif error < -0.3:
            self.note(f"↓ disappointment {error:.2f}")
        return error

    def stats(self) -> dict:
        return {
            "baseline": round(self.baseline, 3),
            "last_reward": round(self.last_reward, 3),
            "last_prediction_error": round(self.last_error, 3),
            "cumulative_reward": round(self.cumulative_reward, 2),
        }

    def state_dict_serializable(self) -> dict:
        return {
            "baseline": float(self.baseline),
            "last_reward": float(self.last_reward),
            "last_error": float(self.last_error),
            "cumulative_reward": float(self.cumulative_reward),
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.baseline = float(sd.get("baseline", 0.0))
            self.last_reward = float(sd.get("last_reward", 0.0))
            self.last_error = float(sd.get("last_error", 0.0))
            self.cumulative_reward = float(sd.get("cumulative_reward", 0.0))
        except Exception:  # noqa: BLE001
            pass
