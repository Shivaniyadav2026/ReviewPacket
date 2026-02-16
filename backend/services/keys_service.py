from __future__ import annotations

from pathlib import Path

from backend.repositories.data_store import DATA_STORE
from backend.utils.file_loader import load_issue_keys


class KeysService:
    ISSUE_KEY_COLUMN = "Issue Key"

    def load_keys(self, file_path: Path) -> list[str]:
        keys = load_issue_keys(file_path, self.ISSUE_KEY_COLUMN)
        with DATA_STORE.lock:
            DATA_STORE.issue_keys = keys
        return keys

    def set_keys_from_text(self, keys_text: str) -> list[str]:
        keys = [key.strip() for key in keys_text.split(",")]
        keys = [key for key in keys if key]
        with DATA_STORE.lock:
            DATA_STORE.issue_keys = keys
        return keys

    def get_keys(self) -> list[str]:
        with DATA_STORE.lock:
            return list(DATA_STORE.issue_keys)
