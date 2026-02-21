from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ValidationRow:
    review_id: str
    field_values: dict[str, str]
    missing_fields: list[str]
    comment: str
    status: str


class ValidationService:
    def validate(self, review_id: str, selected_fields: list[str], parsed_fields: dict[str, str]) -> ValidationRow:
        missing_fields: list[str] = []
        normalized_values: dict[str, str] = {}

        for field in selected_fields:
            value = str(parsed_fields.get(field, "")).strip()
            normalized_values[field] = value
            if not value:
                missing_fields.append(field)

        if missing_fields:
            comment = f"Missing: {', '.join(missing_fields)}"
            status = "Incomplete"
        else:
            comment = "All required fields present"
            status = "Complete"

        return ValidationRow(
            review_id=review_id,
            field_values=normalized_values,
            missing_fields=missing_fields,
            comment=comment,
            status=status,
        )
