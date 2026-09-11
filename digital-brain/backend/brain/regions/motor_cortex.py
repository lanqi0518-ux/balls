"""Motor cortex — samples the actual action from the PFC's policy.

The PFC produces intent (logits). The motor cortex is what turns intent
into a single, discrete motor command. It also modulates activation by how
'confident' the chosen action was.
"""

from __future__ import annotations

import torch
import torch.nn.functional as F
from torch.distributions import Categorical

from ..region import BrainRegion, RegionMeta


ACTION_NAMES = {
    0: "move up",
    1: "move down",
    2: "move left",
    3: "move right",
    4: "stay",
}
ACTION_NAMES_ZH = {
    0: "向上",
    1: "向下",
    2: "向左",
    3: "向右",
    4: "停留",
}


class MotorCortex(BrainRegion):
    meta = RegionMeta(
        name="motor_cortex",
        display_name="Motor cortex (M1)",
        zh_name="运动皮层",
        position=(0.0, 20.0, 60.0),
        color="#a78bfa",
        role="Selects and issues the motor command",
        role_zh="选择并发出运动指令",
    )

    def __init__(self, num_actions: int = 5):
        super().__init__()
        self.num_actions = num_actions
        self.last_action: int = 4
        self.last_confidence: float = 0.0
        self.neurons_total = num_actions * 8

    def act(self, logits: torch.Tensor, greedy: bool = False):
        probs = F.softmax(logits, dim=-1)
        dist = Categorical(probs=probs)
        if greedy:
            action = int(probs.argmax().item())
        else:
            action = int(dist.sample().item())
        log_prob = dist.log_prob(torch.tensor(action))
        confidence = float(probs[action].item())
        self.last_action = action
        self.last_confidence = confidence
        self._set_activity(confidence, int(confidence * self.neurons_total))
        return action, log_prob, probs

    def action_label(self) -> str:
        return ACTION_NAMES.get(self.last_action, "unknown")

    def action_label_zh(self) -> str:
        return ACTION_NAMES_ZH.get(self.last_action, "未知")

    def stats(self) -> dict:
        return {
            "last_action": self.last_action,
            "action_label": self.action_label(),
            "action_label_zh": self.action_label_zh(),
            "confidence": round(self.last_confidence, 3),
        }
