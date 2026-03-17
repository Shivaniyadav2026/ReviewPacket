from backend.services.parser_service import ParserService


def test_parse_review_json_extracts_required_fields():
    payload = {
        "reviewStatus": "Complete",
        "reviewTitle": "SmartBear Login",
        "deadline": "2026-03-01",
        "customFields": [
            {"name": "Overview", "value": ["Flow check"]},
            {"name": "Functional Area", "value": ["Auth"]},
            {"name": "Aero - Project Name", "value": ["Avionics"]},
        ],
    }

    parser = ParserService()
    fields = parser.parse_review_json(payload)

    assert fields["Review Status"] == "Complete"
    assert fields["Review Title"] == "SmartBear Login"
    assert fields["Deadline"] == "2026-03-01"
    assert fields["Overview"] == "Flow check"
    assert fields["Functional Area"] == "Auth"
    assert fields["Project"] == "Avionics"
    assert fields["Aero - Project Name"] == "Avionics"


def test_parse_review_json_fallback_from_aero_project():
    payload = {
        "title": "Title",
        "customFields": [{"name": "Aero - Project Name", "value": ["AER-999"]}],
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


def test_parse_review_json_extracts_from_wrapped_body_array():
    payload = {
        "body": [
            {"result": {}},
            {
                "result": {
                    "reviewId": 60872,
                    "reviewPhase": "COMPLETED",
                    "title": "ABFMS-32559 SRD Updates",
                    "deadline": "2025-08-01T00:00:00Z",
                    "customFields": [
                        {"name": "Producing Site", "value": ["North Phoenix"]},
                        {"name": "Overview", "value": ["Sample overview"]},
                        {"name": "Functional Area", "value": ["CI"]},
                    ],
                }
            },
        ]
    }

    parser = ParserService()
    fields = parser.parse_review_json(payload)

    assert fields["Review Status"] == "COMPLETED"
    assert fields["Review Title"] == "ABFMS-32559 SRD Updates"
    assert fields["Deadline"] == "2025-08-01T00:00:00Z"
    assert fields["Production Site"] == "North Phoenix"
    assert fields["Overview"] == "Sample overview"
    assert fields["Functional Area"] == "CI"


def test_parse_review_json_handles_command_array_and_value_prefix_keys():
    payload = {
        "body": [
            {"result": {}},
            {
                "result": {
                    "creator": {"fullName": "abc", "login": "323nn"},
                    "creationDate": "2025-07-28T19:29:40Z",
                    "reviewPhase": "COMPLETED",
                    "title": "ABFMS-32559 SRD Updates & ABFMS-32560 Code updates",
                    "groupGuid": "d07dbe5d-1c8e-4118-8ace-7167c3630231",
                    "templateName": "AERO DO-178B/178C template",
                    "deadline": "2025-08-01T00:00:00Z",
                    "restrictAccess": "GROUP_OR_PARTICIPANTS",
                    "customFields": [
                        {"name": "Work Product Version", "value:": ["Initial commit id: 42f13037e11"]},
                        {"name": "Aero - Project Name", "value": ["FMS Airbus"]},
                        {"name": "Producing Site", "value": ["North Phoenix"]},
                        {"name": "Overview", "value": ["The following applies"]},
                        {"name": "SW Criticality Level", "value": ["B"]},
                        {"name": "Review Effort (hh:mm)", "value": ["06:30"]},
                        {"name": "Aero - Software load under work/test", "value": ["CR1"]},
                        {"name": "Supporting Materials/Comments", "value": ["MCDU FPLN Latest Baseline DTS"]},
                        {"name": "Oversight Review Type", "value": ["No Oversight Needed"]},
                        {"name": "Meeting Details", "value": [""]},
                        {"name": "Functional Area", "value": ["CI"]},
                    ],
                    "reviewId": 60872,
                }
            },
        ]
    }

    parser = ParserService()
    fields = parser.parse_review_json(payload)

    assert fields["Review Status"] == "COMPLETED"
    assert fields["Review Title"] == "ABFMS-32559 SRD Updates & ABFMS-32560 Code updates"
    assert fields["Created"] == "2025-07-28T19:29:40Z"
    assert fields["Group"] == "d07dbe5d-1c8e-4118-8ace-7167c3630231"
    assert fields["Template"] == "AERO DO-178B/178C template"
    assert fields["Deadline"] == "2025-08-01T00:00:00Z"
    assert fields["Restricted Uploads/Deletions"] == "GROUP_OR_PARTICIPANTS"
    assert fields["Work Product Version"] == "Initial commit id: 42f13037e11"
    assert fields["Aero - Project Name"] == "FMS Airbus"
    assert fields["Project"] == "FMS Airbus"
    assert fields["Production Site"] == "North Phoenix"
    assert fields["Overview"] == "The following applies"
    assert fields["SW Criticality Level"] == "B"
    assert fields["Review Effort (hh:mm)"] == "06:30"
    assert fields["Aero - Software load under work/test"] == "CR1"
    assert fields["Supporting Materials/Comments"] == "MCDU FPLN Latest Baseline DTS"
    assert fields["Oversight Review Type"] == "No Oversight Needed"
    assert fields["Functional Area"] == "CI"
