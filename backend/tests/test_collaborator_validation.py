from backend.services.validation_service import ValidationService


def test_validation_incomplete_when_required_field_missing():
    service = ValidationService()
    row = service.validate(
        review_id="CR-2001",
        selected_fields=["Role", "Overview"],
        parsed_fields={"Role": "Author", "Overview": ""},
    )

    assert row.status == "Incomplete"
    assert row.missing_fields == ["Overview"]
    assert row.comment == "Missing: Overview"


def test_validation_complete_when_all_fields_present():
    service = ValidationService()
    row = service.validate(
        review_id="CR-2002",
        selected_fields=["Role", "Overview"],
        parsed_fields={"Role": "Author", "Overview": "Filled"},
    )

    assert row.status == "Complete"
    assert row.missing_fields == []
    assert row.comment == "All required fields present"
