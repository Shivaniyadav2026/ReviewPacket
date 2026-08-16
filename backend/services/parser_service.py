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
        "Restricted Access",
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
        "Work Product Type",
        "Checklist",
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
        "restricted uploads/deletions": "Restricted Access",
        "restricted uploads deletions": "Restricted Access",
        "restricted access": "Restricted Access",
        "overview": "Overview",
        "work product version": "Work Product Version",
        "meeting details": "Meeting Details",
        "producing site": "Production Site",
        "producing site ": "Production Site",
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
        "participants": "",
        "defects": "",
        "work product type": "Work Product Type",
    }

    def parse_review_json(self, payload: Mapping[str, Any] | list[Any] | None) -> dict[str, str]:
        if not payload:
            return self._empty_required_fields()

        if isinstance(payload, Mapping) and "body" in payload:
            payload = payload["body"]

        review = self._extract_review_object(payload)
        if not review:
            return self._empty_required_fields()

        fields: dict[str, str] = {}
        fields["Review Status"] = self._scalar_to_text(
            review.get("reviewPhase") or review.get("reviewStatus")
        )
        fields["Review Title"] = self._scalar_to_text(
            review.get("title") or review.get("displayText")
        )
        fields["Created"] = self._scalar_to_text(review.get("creationDate"))
        fields["Group"] = self._scalar_to_text(
            review.get("groupName") or review.get("group") or review.get("groupGuid")
        )
        fields["Template"] = self._scalar_to_text(review.get("templateName"))
        fields["Deadline"] = self._scalar_to_text(review.get("deadline"))
        # Completed on may be provided as 'lastActivity' in some API responses
        fields["Completed on"] = self._scalar_to_text(
            review.get("lastActivity") or review.get("completedOn")
        )
        fields["Restricted Access"] = self._scalar_to_text(review.get("restrictAccess") or review.get("restrictAccesses") or review.get("restrictAccess"))

        self._merge_named_field_list(
            fields,
            self._get_list_field(review, ["customFields", "customfields", "custom_fields"]),
        )
        self._merge_named_field_list(
            fields,
            self._get_list_field(
                review,
                [
                    "internalCustomFields",
                    "internalcustomfields",
                    "internal_custom_fields",
                    "internalCustomEields",
                ],
            ),
        )
        self._merge_named_field_list(
            fields,
            self._get_list_field(
                review,
                ["participantCustomFields", "participantcustomfields", "participant_custom_fields"],
            ),
        )
        self._merge_named_field_list(
            fields,
            self._get_list_field(
                review,
                [
                    "checklistItemCustomFields",
                    "checklistitemcustomfields",
                    "checklist_item_custom_fields",
                ],
            ),
        )

        flattened = self._flatten(review)
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

            if canonical and not fields.get(canonical):
                fields[canonical] = value

        self._normalize_project_fields(fields)
        # Extract participants and review effort summary
        participants_list, review_effort_count = self._extract_participants_summary(review)
        if participants_list:
            fields["Participants List"] = participants_list
        fields["Review Effort Count"] = str(review_effort_count)
        fields["Review Effort OK"] = "true" if review_effort_count >= 3 else "false"

        # Compute checklist status
        fields["Checklist"] = self._compute_checklist_status(review)

        # maintain backward-compatible key name
        fields["Restricted Uploads/Deletions"] = fields.get("Restricted Access", "")

        return self._normalize_required_fields(fields)

    def _extract_participants_summary(self, review: Mapping[str, Any]) -> tuple[str, int]:
        participants = self._get_list_field(review, ["reviewParticipants", "reviewparticipants", "participants"])
        names: list[str] = []
        effort_count = 0
        if not isinstance(participants, list):
            return ("", 0)

        for participant in participants:
            if not isinstance(participant, Mapping):
                continue
            user = participant.get("user") or {}
            name = self._scalar_to_text(user.get("fullName") or user.get("displayName") or user.get("initials") or user.get("name"))
            if not name:
                name = self._scalar_to_text(participant.get("displayName") or participant.get("name"))
            if name:
                names.append(name)

            # Detect review effort in participant's custom fields
            custom_list = self._get_list_field(participant, ["customFieldValue", "customFields", "customfields", "custom_fields"])
            if isinstance(custom_list, list):
                for entry in custom_list:
                    if not isinstance(entry, Mapping):
                        continue
                    title = self._scalar_to_text(entry.get("customFieldTitle") or entry.get("name") or entry.get("title"))
                    value = ""
                    raw_value = entry.get("customFieldValue") or entry.get("value") or entry.get("values")
                    if raw_value is None:
                        for k, v in entry.items():
                            if str(k).lower().startswith("value"):
                                raw_value = v
                                break
                    if isinstance(raw_value, list):
                        value = ", ".join(self._scalar_to_text(x) for x in raw_value if self._scalar_to_text(x))
                    else:
                        value = self._scalar_to_text(raw_value)

                    if title and title.lower().strip().startswith("review effort") and value:
                        effort_count += 1
                        break

            # If participant-level fields also include role.systemName == Author, set Role to Author
            role = participant.get("role") or {}
            role_system = self._scalar_to_text(role.get("systemName") or role.get("systemname") or role.get("name"))
            if role_system and role_system.lower() == "author":
                # prefer to set top-level Role to Author
                # this will be merged into fields via canonicalization if not already present
                # add a special flattened key so it will be picked up
                if not review.get("role"):
                    review["role"] = "Author"

        return (", ".join(names), effort_count)

    def _compute_checklist_status(self, review: Mapping[str, Any]) -> str:
        # Walk reviewChecklists and count checked/total. If unchecked items have comments, consider them checked.
        lists = self._get_list_field(review, ["reviewChecklists", "reviewchecklists", "review_checklists"])
        if not isinstance(lists, list):
            return ""

        true_count = 0
        total = 0

        def _walk(obj: Any):
            nonlocal true_count, total
            if isinstance(obj, Mapping):
                if "checked" in obj:
                    total += 1
                    checked = obj.get("checked")
                    if isinstance(checked, bool):
                        is_checked = checked
                    else:
                        is_checked = str(checked).lower() == "true"
                    if not is_checked:
                        # check for comments
                        comments = obj.get("comments") or obj.get("Comments") or obj.get("comment")
                        if comments and self._scalar_to_text(comments):
                            is_checked = True
                    if is_checked:
                        true_count += 1
                for v in obj.values():
                    _walk(v)
            elif isinstance(obj, list):
                for item in obj:
                    _walk(item)

        for entry in lists:
            _walk(entry)

        if total == 0:
            return ""
        if true_count == total:
            return "All checked"
        return f"Fail/{true_count}/{total}"
    def _extract_review_object(self, payload: Any) -> dict[str, Any]:
        if isinstance(payload, Mapping):
            result = payload.get("result")
            if isinstance(result, Mapping):
                return {**payload, **result}
            return dict(payload)

        if isinstance(payload, list):
            for item in payload:
                if not isinstance(item, Mapping):
                    continue

                result = item.get("result", {})
                merged = {**item, **result} if isinstance(result, Mapping) else dict(item)
                if any(key in merged for key in ("reviewId", "title", "displayText", "reviewPhase", "customFields")):
                    return merged
            return {}

        return {}

    def _merge_named_field_list(self, fields: dict[str, str], items: Any) -> None:
        if not isinstance(items, list):
            return

        for entry in items:
            if not isinstance(entry, Mapping):
                continue

            # Accept various naming conventions used by different API versions
            name = self._scalar_to_text(
                entry.get("name") or entry.get("title") or entry.get("customFieldTitle") or entry.get("customfieldtitle")
            )
            if not name:
                continue

            raw_value = entry.get("value") or entry.get("customFieldValue") or entry.get("customfieldvalue")
            if raw_value is None:
                for key, value in entry.items():
                    kl = str(key).lower()
                    if kl.startswith("value") or kl.startswith("customfieldvalue"):
                        raw_value = value
                        break

            if isinstance(raw_value, list):
                value = ", ".join(
                    self._scalar_to_text(item) for item in raw_value if self._scalar_to_text(item)
                )
            else:
                value = self._scalar_to_text(raw_value)

            canonical = self._canonicalize_key(name)
            if canonical and value and not fields.get(canonical):
                fields[canonical] = value

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

    def _empty_required_fields(self) -> dict[str, str]:
        return {required: "" for required in self.REQUIRED_FIELDS}

    def _normalize_required_fields(self, fields: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for required in self.REQUIRED_FIELDS:
            normalized[required] = fields.get(required, "")
        return normalized

    def _get_list_field(self, review: Mapping[str, Any], candidates: list[str]) -> Any:
        for key in candidates:
            if key in review:
                return review.get(key)

        lower_map = {str(key).lower(): key for key in review.keys()}
        for key in candidates:
            match = lower_map.get(key.lower())
            if match is not None:
                return review.get(match)
        return None
