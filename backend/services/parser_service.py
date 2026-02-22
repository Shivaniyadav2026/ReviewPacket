from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any


class ParserService:
    """Normalizes Collaborator JSON API payloads into flat validation fields."""

    REQUIRED_FIELDS: list[str] = [
        "Review Status",
        "Review Title",
        "Role",
        "Created",
        "Group",
        "Template",
        "Deadline",
        "Completed on",
        "Restricted Uploads/Deletions",
        "Overview",
        "Work Product Version",
        "Meeting Details",
        "Production Site",
        "SW Criticality Level",
        "Oversight Review Type",
        "Review Effort (hh:mm)",
        "Project",
        "Aero - Project Name",
        "Aero - Software load under work/test",
        "Supporting Materials/Comments",
        "Functional Area",
        "Participants",
        "Defects",
    ]

    _CANONICAL_LABELS: dict[str, str] = {
        "review status": "Review Status",
        "review title": "Review Title",
        "title": "Review Title",
        "role": "Role",
        "created": "Created",
        "group": "Group",
        "template": "Template",
        "deadline": "Deadline",
        "completed on": "Completed on",
        "restricted uploads/deletions": "Restricted Uploads/Deletions",
        "restricted uploads deletions": "Restricted Uploads/Deletions",
        "overview": "Overview",
        "work product version": "Work Product Version",
        "meeting details": "Meeting Details",
        "production site": "Production Site",
        "sw criticality level": "SW Criticality Level",
        "oversight review type": "Oversight Review Type",
        "review effort (hh:mm)": "Review Effort (hh:mm)",
        "review effort hh:mm": "Review Effort (hh:mm)",
        "review effort hh mm": "Review Effort (hh:mm)",
        "aero - project name": "Aero - Project Name",
        "aero project name": "Aero - Project Name",
        "aero - software load under work/test": "Aero - Software load under work/test",
        "aero software load under work/test": "Aero - Software load under work/test",
        "supporting materials/comments": "Supporting Materials/Comments",
        "supporting materials comments": "Supporting Materials/Comments",
        "functional area": "Functional Area",
        "project": "Project",
        "participants": "Participants",
        "defects": "Defects",
    }

    def parse_review_json(self, payload: Mapping[str, Any] | None) -> dict[str, str]:
        if not payload:
            return {}

        flattened = self._flatten(payload)
        fields: dict[str, str] = {}

        for key_path, value in flattened.items():
            if not value:
                continue

            candidate_keys = [key_path.split(".")[-1], key_path]
            canonical = ""
            for candidate in candidate_keys:
                canonical = self._canonicalize_key(candidate)
                if canonical in self.REQUIRED_FIELDS:
                    break
                canonical = ""

            if canonical:
                fields.setdefault(canonical, value)

        self._normalize_project_fields(fields)

        # Include non-empty required fields even if not present, as empty values for deterministic output
        normalized: dict[str, str] = {}
        for required in self.REQUIRED_FIELDS:
            normalized[required] = fields.get(required, "")

        return normalized

    def _flatten(self, obj: Any, prefix: str = "") -> dict[str, str]:
        result: dict[str, str] = {}

        if isinstance(obj, Mapping):
            for key, value in obj.items():
                key_text = str(key).strip()
                if not key_text:
                    continue
                child_prefix = f"{prefix}.{key_text}" if prefix else key_text
                result.update(self._flatten(value, child_prefix))
            return result

        if isinstance(obj, list):
            scalar_items = [self._scalar_to_text(item) for item in obj if self._scalar_to_text(item)]
            if scalar_items and prefix:
                result[prefix] = ", ".join(scalar_items)
            for index, item in enumerate(obj):
                child_prefix = f"{prefix}[{index}]" if prefix else f"[{index}]"
                result.update(self._flatten(item, child_prefix))
            return result

        text = self._scalar_to_text(obj)
        if text and prefix:
            result[prefix] = text
        return result

    def _scalar_to_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, str):
            return re.sub(r"\s+", " ", value).strip()
        return ""

    def _canonicalize_key(self, key: str) -> str:
        normalized = str(key).strip().rstrip(":")
        normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", normalized)
        normalized = re.sub(r"\s+", " ", normalized)
        normalized = re.sub(r"[_-]", " ", normalized).lower()
        normalized = normalized.replace("/", " / ")
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return self._CANONICAL_LABELS.get(normalized, "")

    def _normalize_project_fields(self, fields: dict[str, str]) -> None:
        project = fields.get("Project", "").strip()
        aero_project = fields.get("Aero - Project Name", "").strip()
        if project and not aero_project:
            fields["Aero - Project Name"] = project
        if aero_project and not project:
            fields["Project"] = aero_project
