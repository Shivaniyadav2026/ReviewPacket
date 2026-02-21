from __future__ import annotations

import json
import logging
from pathlib import Path
import sys

from pydantic import BaseModel, Field

from backend.config import DEFAULT_COLLABORATOR_CONFIG_PATH


class CollaboratorConfig(BaseModel):
    base_url: str = Field(alias="baseUrl")
    review_path_template: str = Field(alias="reviewPathTemplate")
    request_timeout_seconds: int = Field(default=30, alias="requestTimeoutSeconds")
    max_retries: int = Field(default=2, alias="maxRetries")
    batch_size: int = Field(default=10, alias="batchSize")


DEFAULT_COLLABORATOR_CONFIG = CollaboratorConfig.model_validate(
    {
        "baseUrl": "https://collaborator.server.com",
        "reviewPathTemplate": "/user/{reviewId}",
        "requestTimeoutSeconds": 30,
        "maxRetries": 2,
        "batchSize": 10,
    }
)


class ConfigService:
    def __init__(self, config_path: Path = DEFAULT_COLLABORATOR_CONFIG_PATH) -> None:
        self._config_path = config_path
        self._logger = logging.getLogger("collaborator")

    def get_collaborator_config(self) -> CollaboratorConfig:
        for candidate in self._candidate_paths():
            try:
                if candidate.exists():
                    payload = json.loads(candidate.read_text(encoding="utf-8-sig"))
                    config = CollaboratorConfig.model_validate(payload)
                    self._logger.info("Loaded Collaborator config from %s", str(candidate))
                    return config
            except Exception as exc:  # noqa: BLE001
                self._logger.error("Failed to parse Collaborator config at %s: %s", str(candidate), str(exc))

        self._logger.warning("Using default Collaborator config because no valid config file was found.")
        return DEFAULT_COLLABORATOR_CONFIG

    def _candidate_paths(self) -> list[Path]:
        candidates: list[Path] = []

        candidates.append(self._config_path)
        candidates.append(Path(str(sys.argv[0])).parent / "collaborator_config.json")

        if hasattr(sys, "_MEIPASS"):
            candidates.append(Path(getattr(sys, "_MEIPASS")) / "collaborator_config.json")

        seen: set[str] = set()
        unique: list[Path] = []
        for path in candidates:
            key = str(path.resolve()) if path.exists() else str(path)
            if key in seen:
                continue
            seen.add(key)
            unique.append(path)
        return unique
