"""Insular cortex — interoception, risk-as-feeling.

Biologically, the insula integrates internal bodily signals (heartbeat,
gut, breath) into a "somatic marker" that biases decisions even before
conscious reasoning gets involved. Damasio's classic finding: insular
damage reliably produces reckless decision-making, because the gut
feeling never arrives to modulate the plan.

Reference:
    10|  Craig, A. D. (2009) "How do you feel — now? The anterior insula and
  human awareness", Nat. Rev. Neurosci.
  Bechara, A. & Damasio, A. R. (2005) "The somatic marker hypothesis:
  a neural theory of economic decision", Games and Economic Behavior.
  Loewenstein, G. F. et al. (2001) "Risk as feelings", Psych. Bulletin.

Implementation: the insula reads two exteroceptive proxies of the
agent's "body state" — the volatility of recent realized P&L and the
fraction of open positions currently underwater. These get folded into
a scalar ``gut_feeling`` ∈ [-1, +1]. Negative values push a mild extra
    20|amount into the amygdala's driving signal (raise the fear floor); the
PFC therefore becomes more cautious when the gut, but not yet the head,
is saying something is wrong.
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from ..region import BrainRegion, RegionMeta


class InsularCortex(BrainRegion):
    meta = RegionMeta(
        name="insular_cortex",
        display_name="Insular cortex",
        zh_name="脑岛皮层",
        position=(-22.0, 4.0, -4.0),
        color="#fb7185",
        role="Interoception · risk-as-feeling",
        role_zh="内感受 · 风险感觉",
    )

    def __init__(self, window: int = 30):
        super().__init__()
        self.neurons_total = 72
        self.window = window
        self.pnl_hist: Deque[float] = deque(maxlen=window)
        self.gut_feeling: float = 0.0        # -1..+1
        self.pnl_volatility: float = 0.0
        self.underwater_frac: float = 0.0

    def observe(self, recent_pnl_pct: float | None,
                 underwater_fraction: float) -> float:
        """Called every tick with the latest realized-PnL fraction and
        the fraction of open positions currently at loss.
        Returns the current gut_feeling scalar."""
        if recent_pnl_pct is not None:
            self.pnl_hist.append(float(recent_pnl_pct))
        # Rolling std of realized PnL as volatility proxy.
        if len(self.pnl_hist) >= 3:
            mean = sum(self.pnl_hist) / len(self.pnl_hist)
            var = sum((x - mean) ** 2 for x in self.pnl_hist) / len(self.pnl_hist)
            self.pnl_volatility = float(var ** 0.5)
        self.underwater_frac = float(max(0.0, min(1.0, underwater_fraction)))
        # Gut feeling: negative when volatility is high AND we're
        # currently sitting on losses. Positive when calm and winning.
        recent_mean = (sum(self.pnl_hist) / len(self.pnl_hist)) if self.pnl_hist else 0.0
        vol_penalty = min(0.6, self.pnl_volatility * 0.8)
        underwater_penalty = self.underwater_frac * 0.5
        winner_boost = max(0.0, recent_mean) * 0.6
        raw = winner_boost - vol_penalty - underwater_penalty
        self.gut_feeling = float(max(-1.0, min(1.0, raw)))
        act = min(1.0, abs(self.gut_feeling) * 0.9 + 0.1)
        self._set_activity(act, int(act * self.neurons_total))
        if self.gut_feeling < -0.4:
            self.note(f"gut says caution ({self.gut_feeling:+.2f})")
        elif self.gut_feeling > 0.4:
            self.note(f"gut says go ({self.gut_feeling:+.2f})")
        return self.gut_feeling

    def fear_boost(self) -> float:
        """The additive term the amygdala gets from the insula. Positive
        when the gut says caution (raise fear), zero otherwise."""
        return max(0.0, -self.gut_feeling) * 0.35

    def stats(self) -> dict:
        return {
            "gut_feeling": round(self.gut_feeling, 3),
            "pnl_volatility": round(self.pnl_volatility, 4),
            "underwater_fraction": round(self.underwater_frac, 3),
            "samples": len(self.pnl_hist),
        }

    def state_dict_serializable(self) -> dict:
        return {
            "pnl_hist": list(self.pnl_hist),
            "gut_feeling": self.gut_feeling,
            "pnl_volatility": self.pnl_volatility,
            "underwater_frac": self.underwater_frac,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.pnl_hist = deque(sd.get("pnl_hist", []) or [], maxlen=self.window)
            self.gut_feeling = float(sd.get("gut_feeling", 0.0))
            self.pnl_volatility = float(sd.get("pnl_volatility", 0.0))
            self.underwater_frac = float(sd.get("underwater_frac", 0.0))
        except Exception:  # noqa: BLE001
            pass
