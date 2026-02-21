# Collaborator Integration Architecture

## Overview
ReviewPackets now extends into a hybrid validation flow:

1. Electron manages authenticated Collaborator session (SSO + MFA done manually by user).
2. Electron fetches Collaborator review pages with the same cookie jar.
3. Angular sends fetched HTML to FastAPI.
4. Backend parses fields, validates required fields, returns structured results.
5. CSV and PDF workflows run from validated data.

## Components
- Electron main process: session partition, login window, HTML fetch, PDF generation.
- Angular UI: review ID list, field selector, progress, validation table, export controls.
- FastAPI services:
  - `CollaboratorService`: extract review IDs + build review URLs.
  - `ParserService`: flexible HTML parsing via BeautifulSoup.
  - `ValidationService`: required field validation rules.
  - `PDFService`: output folder and filename planning.

## Security Model
- No credential automation.
- User authenticates manually in Collaborator login window.
- Session cookies remain in Electron persistent partition.
- Review HTML fetch/PDF generation only through Electron authenticated browser context.
- Backend does not hold Collaborator credentials.
