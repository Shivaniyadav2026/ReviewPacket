from __future__ import annotations

from pathlib import Path
import pandas as pd

from backend.repositories.data_store import DATA_STORE
from backend.utils.file_loader import load_table


class DumpService:
    ISSUE_KEY_COLUMN = "Issue Key"

    def load_dump(self, file_path: Path) -> pd.DataFrame:
        df = load_table(file_path)
        if self._find_column(df, self.ISSUE_KEY_COLUMN) is None:
            raise ValueError(f"Missing required column: {self.ISSUE_KEY_COLUMN}")

        with DATA_STORE.lock:
            DATA_STORE.dump_df = df
        return df

    def get_headers(self) -> list[str]:
        with DATA_STORE.lock:
            if DATA_STORE.dump_df is None:
                return []
            return list(DATA_STORE.dump_df.columns)

    def _find_column(self, df: pd.DataFrame, name: str) -> str | None:
        target = name.strip().lower()
        for col in df.columns:
            if str(col).strip().lower() == target:
                return col
        return None
