# Collaborator Data Flow

1. User uploads dump.
2. Backend extracts review IDs from `Review Info`.
3. User opens Collaborator login window (Electron).
4. User completes SSO + MFA manually.
5. Angular requests Electron to fetch each review HTML with session cookies.
6. Angular sends `{review_id, html}` list + selected fields to backend.
7. Backend parses HTML, validates fields, returns result rows.
8. User exports CSV from backend.
9. User requests PDFs for `Complete` rows.
10. Backend returns PDF plan (urls + output paths); Electron generates PDFs.
