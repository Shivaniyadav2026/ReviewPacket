from __future__ import annotations

import json
from pathlib import Path
from pydantic import BaseModel, Field

from backend.config import DEFAULT_COLLABORATOR_CONFIG_PATH


class CollaboratorConfig(BaseModel):
    base_url: str = Field(alias="baseUrl")
    review_path_template: str = Field(alias="reviewPathTemplate")
    request_timeout_seconds: int = Field(default=30, alias="requestTimeoutSeconds")
    max_retries: int = Field(default=2, alias="maxRetries")
    batch_size: int = Field(default=10, alias="batchSize")


class ConfigService:
    def __init__(self, config_path: Path = DEFAULT_COLLABORATOR_CONFIG_PATH) -> None:
        self._config_path = config_path

    def get_collaborator_config(self) -> CollaboratorConfig:
        payload = json.loads(self._config_path.read_text(encoding="utf-8"))
        return CollaboratorConfig.model_validate(payload)
