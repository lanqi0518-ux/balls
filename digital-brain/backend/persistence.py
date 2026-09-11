"""Persistence layer — save / restore everything the brain has learned.

By default writes to ``$DATA_DIR/state.pt`` where DATA_DIR defaults to
``./data`` (Fly.io: mount a volume at /data and set DATA_DIR=/data). We
also keep the two most recent snapshots as ``state.pt.prev`` so a
corrupted primary file never loses more than one save-interval of work.

What we save
------------
* **Brain**: PFC actor-critic weights, hippocampus episodic memories,
  amygdala learned fear templates + fear scalar, NAcc reward baseline,
  lifetime step count, first-boot timestamp, boot count, cumulative
  wall-clock uptime.
* **Trader cortex**: BC + RL trained MLP + counters + autonomy stats.
* **Paper trader**: open positions, equity curve, closed trades.

Knowledge memories (crypto + Einstein concepts) are re-seeded from
``backend/knowledge.py`` at boot, so they're intentionally NOT written to
disk — the fewer bytes we serialize, the safer atomic writes are.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
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
        self.backup_path = self.dir / "state.pt.prev"
        self.meta_path = self.dir / "state.json"

    def save(self, *, brain=None, trader_cortex=None, paper_trader=None,
             extra: Optional[dict] = None) -> None:
        """Atomically write the full brain + trading snapshot to disk.

        Any subsystem argument that's None is skipped, so callers can save
        partial state without breaking the file.
        """
        try:
            payload: dict = {"saved_at": time.time(), "extra": extra or {}}
            if brain is not None:
                payload["brain"] = brain.state_dict_serializable()
            if trader_cortex is not None:
                payload["trader_cortex"] = trader_cortex.state_dict_serializable()
            if paper_trader is not None:
                payload["paper_trader"] = paper_trader.state_dict_serializable()

            tmp = self.state_path.with_suffix(".pt.tmp")
            torch.save(payload, tmp)
            # Rotate: current → prev, new → current. This means even if
            # torch.load rejects the primary next boot, we always have
            # one clean fallback.
            if self.state_path.exists():
                try:
                    shutil.copy2(self.state_path, self.backup_path)
                except Exception:  # noqa: BLE001
                    pass
            os.replace(tmp, self.state_path)

            self.meta_path.write_text(json.dumps({
                "saved_at": payload["saved_at"],
                "bytes": self.state_path.stat().st_size,
                "has_brain": "brain" in payload,
                "has_trader_cortex": "trader_cortex" in payload,
                "has_paper_trader": "paper_trader" in payload,
            }, indent=2))
        except Exception as e:  # noqa: BLE001
            LOG.warning("persistence save failed: %s", e)

    def load_into(self, *, brain=None, trader_cortex=None,
                  paper_trader=None) -> bool:
        """Restore whichever subsystems the caller passed in. Returns True
        if we managed to load anything at all."""
        payload = self._load_payload()
        if payload is None:
            return False
        loaded_any = False
        try:
            if brain is not None and "brain" in payload:
                brain.load_state_dict_safe(payload["brain"])
                loaded_any = True
            if trader_cortex is not None and "trader_cortex" in payload:
                trader_cortex.load_state_dict_safe(payload["trader_cortex"])
                loaded_any = True
            if paper_trader is not None and "paper_trader" in payload:
                paper_trader.load_state(payload["paper_trader"])
                loaded_any = True
            if loaded_any:
                LOG.info(
                    "persistence: restored (brain=%s, trader_cortex=%s, paper=%s) from %s",
                    "brain" in payload, "trader_cortex" in payload,
                    "paper_trader" in payload, self.state_path,
                )
        except Exception as e:  # noqa: BLE001
            LOG.warning("persistence load-into failed: %s", e)
        return loaded_any

    def _load_payload(self) -> Optional[dict]:
        """Load the primary snapshot; if it's corrupt, transparently fall
        back to the backup so a killed-mid-write pod can't wipe learning."""
        for path in (self.state_path, self.backup_path):
            if not path.exists():
                continue
            try:
                return torch.load(path, map_location="cpu", weights_only=False)
            except Exception as e:  # noqa: BLE001
                LOG.warning("persistence: %s unreadable (%s), trying next", path, e)
        return None
