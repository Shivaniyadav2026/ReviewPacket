from __future__ import annotations

import logging
from typing import Iterable
import pandas as pd

from backend.repositories.data_store import DATA_STORE
from backend.utils.merge import normalize_header_name


class PreviewService:
    ISSUE_KEY_COLUMN = "Issue Key"
    SUMMARY_COLUMN = "Summary"

    def __init__(self) -> None:
        self._logger = logging.getLogger("collaborator")

    def build_preview(self, filters: Iterable[str]) -> pd.DataFrame:
        filters = [name.strip() for name in filters if name.strip()]
        with DATA_STORE.lock:
            if DATA_STORE.dump_df is None:
                raise ValueError("No dump loaded. Upload the dump file first.")
            dump_df = DATA_STORE.dump_df.copy()
            issue_keys = list(DATA_STORE.issue_keys)

        issue_col = self._find_column(dump_df, self.ISSUE_KEY_COLUMN)
        if issue_col is None:
            raise ValueError(f"Missing required column: {self.ISSUE_KEY_COLUMN}")

        summary_col = self._find_column(dump_df, self.SUMMARY_COLUMN)
        if summary_col is None:
            dump_df[self.SUMMARY_COLUMN] = ""
            summary_col = self.SUMMARY_COLUMN

        if issue_keys:
            normalized_keys = {key.strip() for key in issue_keys if key.strip()}
            dump_df = dump_df[dump_df[issue_col].astype(str).isin(normalized_keys)]

        column_map = {name: self._find_columns(dump_df, name) for name in filters}
        self._logger.info("Preview column map: %s", column_map)

        output_rows = []
        for _, row in dump_df.iterrows():
            row_data = {
                "Issue Key": row.get(issue_col, ""),
                "Summary": row.get(summary_col, ""),
            }

            blanks = []
            for display_name, column_names in column_map.items():
                value = self._merge_row_values(row, column_names)
                row_data[display_name] = value
                if value == "":
                    blanks.append(f"{display_name} is blank")

            row_data["Comment"] = ", ".join(blanks) if blanks else "Review completed"
            output_rows.append(row_data)

        return pd.DataFrame(output_rows)

    def _find_column(self, df: pd.DataFrame, name: str) -> str | None:
        target = name.strip().lower()
        for col in df.columns:
            if str(col).strip().lower() == target:
                return col
        return None

    def _find_columns(self, df: pd.DataFrame, name: str) -> list[str]:
        target = name.strip().lower()
        matched = [
            str(col)
            for col in df.columns
            if normalize_header_name(col).strip().lower() == target
        ]
        if matched:
            return matched
        return [name]

    def _merge_row_values(self, row: pd.Series, column_names: list[str]) -> str:
        values: list[str] = []
        seen: set[str] = set()
        for column_name in column_names:
            raw_value = str(row.get(column_name, "")).strip()
            if not raw_value or raw_value in seen:
                continue
            seen.add(raw_value)
            values.append(raw_value)
        return ", ".join(values)
