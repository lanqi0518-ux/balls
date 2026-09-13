"""GridWorld — the tiny toy body the brain is embodied in.

A minimal, dependency-light 2-D grid the cortex perceives through a
3-channel "retina" image and acts on with five discrete moves
(up / down / left / right / stay). It exists purely to give the brain a
continuous stream of perception → action → reward so the deep-learning
regions always have *something* to learn from; the real trading cortex
runs independently.

Contract (relied on by ``backend/server.py``, ``backend/brain/brain.py``
and ``frontend/js/environment.js``):

* ``GridWorld(size, n_food, n_hazard, max_steps, seed)``
* ``reset() -> observation``
* ``step(action: int) -> observation``
* attributes: ``size``, ``agent_pos`` (``[x, y]``), ``food`` /
  ``hazards`` (lists of ``(x, y)`` tuples)
* ``snapshot() -> dict`` for the UI.

``observation`` is the dict ``Brain.step`` expects::

    {
        'image':   torch.FloatTensor (3, size, size) in [0, 1],
        'danger':  float in [0, 1]   — proximity to the nearest hazard,
        'reward':  float             — reward for the action just taken,
        'position': (x, y)           — the agent's current cell,
        'done':    bool              — episode ended on this step,
    }

Coordinates are ``(x, y)`` with ``x`` the column and ``y`` the row, ``y``
increasing downward — matching the direction vectors the frontend uses
(0=up (0,-1), 1=down (0,1), 2=left (-1,0), 3=right (1,0), 4=stay).
"""

from __future__ import annotations

import random
from typing import List, Optional, Tuple

import torch

Cell = Tuple[int, int]

# action id -> (dx, dy); mirrors ACTION_NAMES in motor_cortex.py and the
# `dirs` map in frontend/js/environment.js.
_MOVES = {
    0: (0, -1),   # up
    1: (0, 1),    # down
    2: (-1, 0),   # left
    3: (1, 0),    # right
    4: (0, 0),    # stay
}

# Reward shaping — small step cost so lingering isn't free, a clear
# positive for food and a clear negative for hazards (the amygdala
# conditions on rewards below -0.5, food/hazard cross that threshold).
_R_FOOD = 1.0
_R_HAZARD = -1.0
_R_STEP = -0.01


class GridWorld:
    def __init__(self, size: int = 9, n_food: int = 5, n_hazard: int = 4,
                 max_steps: int = 250, seed: Optional[int] = 42):
        self.size = int(size)
        self.n_food = int(n_food)
        self.n_hazard = int(n_hazard)
        self.max_steps = int(max_steps)
        self._rng = random.Random(seed)

        # Lifetime, cross-episode counters the UI shows as GAIN / LOSS.
        self.food_eaten = 0
        self.hazards_hit = 0
        self.episode = 0

        # Per-step telemetry surfaced in snapshot() for the canvas.
        self.last_action = 4
        self.last_reward = 0.0

        self.agent_pos: List[int] = [self.size // 2, self.size // 2]
        self.food: List[Cell] = []
        self.hazards: List[Cell] = []
        self.steps = 0
        self.reset()

    # ------------------------------------------------------------------
    # Spawning helpers
    # ------------------------------------------------------------------
    def _all_occupied(self) -> set:
        return {tuple(self.agent_pos)} | set(self.food) | set(self.hazards)

    def _random_free_cell(self) -> Optional[Cell]:
        occupied = self._all_occupied()
        free = [(x, y)
                for x in range(self.size)
                for y in range(self.size)
                if (x, y) not in occupied]
        if not free:
            return None
        return self._rng.choice(free)

    # ------------------------------------------------------------------
    # Episode lifecycle
    # ------------------------------------------------------------------
    def reset(self) -> dict:
        """Start a fresh episode. Cumulative GAIN/LOSS counters persist."""
        self.episode += 1
        self.steps = 0
        self.last_action = 4
        self.last_reward = 0.0

        self.agent_pos = [self.size // 2, self.size // 2]
        self.food = []
        self.hazards = []
        for _ in range(self.n_hazard):
            c = self._random_free_cell()
            if c is not None:
                self.hazards.append(c)
        for _ in range(self.n_food):
            c = self._random_free_cell()
            if c is not None:
                self.food.append(c)
        return self._observe(reward=0.0, done=False)

    def step(self, action: int) -> dict:
        """Apply one action, return the resulting observation.

        The episode auto-resets when ``max_steps`` is reached so the
        server's tick loop never has to intervene; that terminal step is
        flagged ``done=True``.
        """
        try:
            action = int(action)
        except (TypeError, ValueError):
            action = 4
        dx, dy = _MOVES.get(action, (0, 0))
        self.last_action = action

        nx = min(self.size - 1, max(0, self.agent_pos[0] + dx))
        ny = min(self.size - 1, max(0, self.agent_pos[1] + dy))
        self.agent_pos = [nx, ny]
        cell = (nx, ny)

        reward = _R_STEP

        if cell in self.food:
            reward = _R_FOOD
            self.food.remove(cell)
            self.food_eaten += 1
            # Keep the pantry stocked so the agent always has a goal.
            c = self._random_free_cell()
            if c is not None:
                self.food.append(c)

        if cell in self.hazards:
            reward = _R_HAZARD
            self.hazards_hit += 1

        self.steps += 1
        self.last_reward = reward

        done = self.steps >= self.max_steps
        if done:
            # Roll straight into the next episode; report the terminal
            # transition, then the fresh grid is already in place.
            obs = self._observe(reward=reward, done=True)
            self.reset()
            return obs
        return self._observe(reward=reward, done=False)

    # ------------------------------------------------------------------
    # Perception
    # ------------------------------------------------------------------
    def _danger(self) -> float:
        if not self.hazards:
            return 0.0
        ax, ay = self.agent_pos
        d_min = min(abs(hx - ax) + abs(hy - ay) for (hx, hy) in self.hazards)
        # Graded local proximity: on/next-to a hazard is scary, far is calm.
        return float(max(0.0, min(1.0, 1.0 - d_min / 4.0)))

    def _image(self) -> torch.Tensor:
        img = torch.zeros(3, self.size, self.size, dtype=torch.float32)
        ax, ay = self.agent_pos
        img[0, ay, ax] = 1.0
        for (fx, fy) in self.food:
            img[1, fy, fx] = 1.0
        for (hx, hy) in self.hazards:
            img[2, hy, hx] = 1.0
        return img

    def _observe(self, reward: float, done: bool) -> dict:
        return {
            "image": self._image(),
            "danger": self._danger(),
            "reward": float(reward),
            "position": (int(self.agent_pos[0]), int(self.agent_pos[1])),
            "done": bool(done),
        }

    # ------------------------------------------------------------------
    # UI snapshot (JSON-serializable)
    # ------------------------------------------------------------------
    def snapshot(self) -> dict:
        return {
            "size": self.size,
            "agent": [int(self.agent_pos[0]), int(self.agent_pos[1])],
            "food": [[int(x), int(y)] for (x, y) in self.food],
            "hazards": [[int(x), int(y)] for (x, y) in self.hazards],
            "last_action": int(self.last_action),
            "last_reward": float(self.last_reward),
            "episode": int(self.episode),
            "food_eaten": int(self.food_eaten),
            "hazards_hit": int(self.hazards_hit),
        }
