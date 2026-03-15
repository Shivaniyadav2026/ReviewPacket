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


def test_parse_review_json_extracts_custom_fields():
    payload = {
        "result": {
            "reviewId": 60872,
            "reviewPhase": "COMPLETED",
            "title": "ABFMS-32559 SRD Updates",
            "creationDate": "2025-07-28T19:29:40Z",
            "groupGuid": "group-1",
            "templateName": "Template A",
            "deadline": "2025-08-01T00:00:00Z",
            "restrictAccess": "GROUP_OR_PARTICIPANTS",
            "customFields": [
                {"name": "Work Product Version", "value": ["Initial commit id: 42f1"]},
                {"name": "Aero - Project Name", "value": ["FMS Airbus"]},
                {"name": "Producing Site", "value": ["North Phoenix"]},
                {"name": "Overview", "value": ["Sample overview"]},
                {"name": "Review Effort (hh:mm)", "value": ["06:30"]},
            ],
        }
    }

    parser = ParserService()
    fields = parser.parse_review_json(payload)

    assert fields["Review Status"] == "COMPLETED"
    assert fields["Review Title"] == "ABFMS-32559 SRD Updates"
    assert fields["Group"] == "group-1"
    assert fields["Work Product Version"] == "Initial commit id: 42f1"
    assert fields["Aero - Project Name"] == "FMS Airbus"
    assert fields["Production Site"] == "North Phoenix"
    assert fields["Overview"] == "Sample overview"
    assert fields["Review Effort (hh:mm)"] == "06:30"
