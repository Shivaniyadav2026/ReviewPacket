from __future__ import annotations

from typing import Iterable
import pandas as pd

from backend.repositories.data_store import DATA_STORE


class PreviewService:
    ISSUE_KEY_COLUMN = "Issue Key"
    SUMMARY_COLUMN = "Summary"

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

        column_map = {}
        for name in filters:
            column = self._find_column(dump_df, name)
            if column is None:
                dump_df[name] = ""
                column = name
            column_map[name] = column

        output_rows = []
        for _, row in dump_df.iterrows():
            row_data = {
                "Issue Key": row.get(issue_col, ""),
                "Summary": row.get(summary_col, ""),
            }

            blanks = []
            for display_name, col_name in column_map.items():
                value = str(row.get(col_name, "")).strip()
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
