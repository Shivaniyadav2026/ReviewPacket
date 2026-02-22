from backend.services.parser_service import ParserService


def test_parse_review_json_extracts_required_fields():
    payload = {
        "reviewStatus": "Complete",
        "reviewTitle": "SmartBear Login",
        "role": "Author",
        "created": "2026-02-01",
        "group": "QA",
        "template": "Standard",
        "deadline": "2026-03-01",
        "completedOn": "2026-02-15",
        "restrictedUploadsDeletions": "No",
        "overview": "Flow check",
        "workProductVersion": "1.0",
        "meetingDetails": "Teams",
        "productionSite": "Bangalore",
        "swCriticalityLevel": "High",
        "oversightReviewType": "Formal",
        "reviewEffortHhMm": "10:30",
        "project": "Avionics",
        "aeroProjectName": "",
        "aeroSoftwareLoadUnderWorkTest": "SL-42",
        "supportingMaterialsComments": "See spec",
        "functionalArea": "Auth",
        "participants": ["Alice", "Bob"],
        "defects": "None"
    }

    parser = ParserService()
    fields = parser.parse_review_json(payload)

    assert fields["Review Status"] == "Complete"
    assert fields["Review Title"] == "SmartBear Login"
    assert fields["Role"] == "Author"
    assert fields["Project"] == "Avionics"
    assert fields["Aero - Project Name"] == "Avionics"
    assert fields["Participants"] == "Alice, Bob"


def test_parse_review_json_fallback_from_aero_project():
    payload = {
        "aeroProjectName": "AER-999",
        "reviewTitle": "Title"
    }

    parser = ParserService()
    fields = parser.parse_review_json(payload)

    assert fields["Aero - Project Name"] == "AER-999"
    assert fields["Project"] == "AER-999"