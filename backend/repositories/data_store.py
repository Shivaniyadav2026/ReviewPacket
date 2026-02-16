from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
import pandas as pd


@dataclass
class DataStore:
    dump_df: pd.DataFrame | None = None
    issue_keys: list[str] = field(default_factory=list)
    lock: Lock = field(default_factory=Lock)


DATA_STORE = DataStore()
