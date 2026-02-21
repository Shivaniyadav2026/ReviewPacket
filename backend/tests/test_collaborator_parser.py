from pathlib import Path

from backend.services.parser_service import ParserService


def test_parse_review_html_extracts_flexible_fields():
    fixture = Path(__file__).resolve().parent / "fixtures" / "collaborator_mock.html"
    html = fixture.read_text(encoding="utf-8")

    parser = ParserService()
    fields = parser.parse_review_html(html)

    assert fields["Review Title"] == "Payments API Review"
    assert fields["Role"] == "Author"
    assert fields["Project"] == "Core Banking"
    assert fields["Overview"] == "Validate transaction posting flow."
    assert fields["Participants"] == "Alice, Bob"
    assert fields["Defects"] == "None"
