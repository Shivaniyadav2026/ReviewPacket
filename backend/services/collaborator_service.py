from __future__ import annotations

import re
from typing import Iterable

import pandas as pd

from backend.repositories.data_store import DATA_STORE
from backend.services.config_service import ConfigService


class CollaboratorService:
    REVIEW_INFO_COLUMN = "Review Info"

    def __init__(self) -> None:
        self._config_service = ConfigService()

    def extract_review_ids(self) -> list[str]:
        with DATA_STORE.lock:
            if DATA_STORE.dump_df is None:
                raise ValueError("No dump loaded. Upload the dump file first.")
            dump_df = DATA_STORE.dump_df.copy()

        review_info_col = self._find_column(dump_df, self.REVIEW_INFO_COLUMN)
        if review_info_col is None:
            raise ValueError("Column 'Review Info' not found in dump.")

        values = dump_df[review_info_col].astype(str).tolist()
        review_ids = self._normalize_review_ids(values)
        return sorted(set(review_ids), key=review_ids.index)

    def build_review_url(self, review_id: str) -> str:
        config = self._config_service.get_collaborator_config()
        base = config.base_url.rstrip("/")
        review_path = config.review_path_template.format(reviewId=review_id.strip())
        return f"{base}{review_path}"

    def build_review_urls(self, review_ids: Iterable[str]) -> dict[str, str]:
        return {review_id: self.build_review_url(review_id) for review_id in review_ids if review_id.strip()}

    def _find_column(self, df: pd.DataFrame, name: str) -> str | None:
        target = name.strip().lower()
        for col in df.columns:
            if str(col).strip().lower() == target:
                return col
        return None

    def _normalize_review_ids(self, values: Iterable[str]) -> list[str]:
        review_ids: list[str] = []
        for value in values:
            for token in re.split(r"[,;\n\t ]+", str(value).strip()):
                clean = token.strip()
                if clean:
                    review_ids.append(clean)
        return review_ids
