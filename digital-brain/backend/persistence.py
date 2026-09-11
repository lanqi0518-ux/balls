"""Persistence layer — save/load Trader Cortex + PaperTrader across restarts.

By default writes to ``$DATA_DIR/state.pt`` where DATA_DIR defaults to
``./data`` (Fly.io: mount a volume at /data and set DATA_DIR=/data).
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import torch


LOG = logging.getLogger("persistence")

DEFAULT_DATA_DIR = os.environ.get("DATA_DIR", "./data")


class Persistence:
    def __init__(self, data_dir: str = DEFAULT_DATA_DIR):
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.dir / "state.pt"
        self.meta_path = self.dir / "state.json"

    def save(self, *, trader_cortex, paper_trader, extra: Optional[dict] = None) -> None:
        try:
            payload = {
                "saved_at": time.time(),
                "trader_cortex": trader_cortex.state_dict_serializable(),
                "paper_trader": paper_trader.state_dict_serializable(),
                "extra": extra or {},
            }
            tmp = self.state_path.with_suffix(".pt.tmp")
            torch.save(payload, tmp)
            os.replace(tmp, self.state_path)
            self.meta_path.write_text(json.dumps({
                "saved_at": payload["saved_at"],
                "bytes": self.state_path.stat().st_size,
            }, indent=2))
        except Exception as e:  # noqa: BLE001
            LOG.warning("persistence save failed: %s", e)

    def load_into(self, *, trader_cortex, paper_trader) -> bool:
        if not self.state_path.exists():
            return False
        try:
            payload = torch.load(self.state_path, map_location="cpu", weights_only=False)
        except Exception as e:  # noqa: BLE001
            LOG.warning("persistence load failed: %s", e)
            return False
        try:
            if "trader_cortex" in payload:
                trader_cortex.load_state_dict_safe(payload["trader_cortex"])
            if "paper_trader" in payload:
                paper_trader.load_state(payload["paper_trader"])
            LOG.info("persistence: restored state from %s", self.state_path)
            return True
        except Exception as e:  # noqa: BLE001
            LOG.warning("persistence load-into failed: %s", e)
            return False
