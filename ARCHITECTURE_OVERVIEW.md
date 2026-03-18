# ReviewPackets Architecture Overview

This document explains the project architecture in a beginner-friendly way.

## Big Picture

`ReviewPackets` is a desktop application made of 3 main parts:

1. `Electron`
- Runs the app as a Windows desktop application
- Starts the Python backend automatically
- Opens the Angular UI in a desktop window
- Manages Collaborator login/session

2. `Angular Frontend`
- Shows the screens, buttons, tables, filters, and loaders
- Sends requests to the backend
- Displays preview and Collaborator validation results

3. `Python FastAPI Backend`
- Reads Excel/CSV files
- Merges duplicate columns
- Builds preview rows
- Extracts review IDs
- Parses Collaborator JSON data
- Validates review fields

---

## Beginner-Friendly Architecture Diagram

```text
+-------------------------------------------------------------+
|                    ReviewPackets Desktop App                |
|                  (Electron + Angular + Python)              |
+-------------------------------------------------------------+

            User
             |
             v
+------------------------+
|   Electron Desktop     |
|   `electron/main.js`   |
+------------------------+
| - starts backend       |
| - opens app window     |
| - manages login window |
| - stores auth locally  |
| - uses browser cookies |
+------------------------+
             |
             | preload bridge
             v
+-------------------------------+
|        Angular Frontend       |
| `frontend/src/app/...`        |
+-------------------------------+
| - upload dump / keys          |
| - select filters              |
| - show preview table          |
| - export CSVs                 |
| - fetch collaborator details  |
| - show validation table       |
+-------------------------------+
             |
             | HTTP on localhost
             v
+-------------------------------+
|        FastAPI Backend        |
|       `backend/main.py`       |
|     `backend/api/routes.py`   |
+-------------------------------+
| - receives files/requests     |
| - reads Excel/CSV             |
| - merges duplicate columns    |
| - builds preview rows         |
| - extracts review IDs         |
| - parses collaborator JSON    |
| - validates required fields   |
+-------------------------------+
             |
             v
+-------------------------------+
|       In-Memory Data Store    |
| `backend/repositories/...`    |
+-------------------------------+
| - loaded dump dataframe       |
| - issue keys                  |
+-------------------------------+

Collaborator side:
------------------
User -> Electron login window -> Collaborator website
                                  |
                                  v
                        session cookies stored in Electron
                                  |
                                  v
                      Electron JSON API call to Collaborator
                                  |
                                  v
                         JSON response sent to backend
                                  |
                                  v
                    backend parser + validator -> frontend table
```

---

## Simple Layer View

```text
[ User ]
   |
   v
[ Angular UI ]
   |
   v
[ FastAPI API ]
   |
   v
[ Services Layer ]
   |
   v
[ Data Store / File Parsing ]
```

---

## How the App Starts

Main file:
- `electron/main.js`

What happens:
1. Electron starts
2. Electron starts the Python backend
3. Electron opens the Angular UI in a desktop window
4. User sees one desktop application

Why this is useful:
- user does not need to start Python manually
- user does not need to open a browser manually

---

## Frontend Flow

Main UI files:
- `frontend/src/app/app.component.ts`
- `frontend/src/app/app.component.html`

What they do:
- accept dump upload
- accept issue keys
- show filter dropdown
- generate preview table
- export CSV files
- load review IDs into Collaborator validation section
- fetch and display Collaborator validation results

Why Angular is used:
- keeps UI logic and screen layout organized
- easy to manage app state

---

## Backend Flow

Main backend files:
- `backend/main.py`
- `backend/api/routes.py`

What happens:
1. frontend sends request
2. FastAPI route receives it
3. route calls service classes
4. service classes process data
5. backend returns clean result to frontend

Why this is useful:
- UI stays simple
- backend handles heavy data processing

---

## Where Dump File Is Loaded

Files:
- `backend/services/dump_service.py`
- `backend/utils/file_loader.py`

What happens:
1. user uploads Excel or CSV
2. backend reads file
3. data is stored in memory

Why:
- other services can reuse the loaded dump without reading the file again

---

## How Duplicate Columns Are Handled

File:
- `backend/utils/merge.py`

Problem example:
- dump may contain repeated headers like:
  - `Component/s`
  - `Component/s`
  - `Component/s`

Pandas may rename them automatically like:
- `Component/s`
- `Component/s.1`
- `Component/s.2`

What we do:
- normalize them back to one logical header
- merge their values into one cell

Example merged value:
```text
Value A, Value B, Value C
```

Why:
- filter dropdown should show one header only
- preview should show one column only

---

## Where Preview Rows Are Built

File:
- `backend/services/preview_service.py`

What it does:
1. receives selected filters
2. optionally filters rows by issue keys
3. builds preview rows with:
   - `Issue Key`
   - `Summary`
   - selected filters
   - `Comment`

Comment rules:
- if selected fields are blank:
  - `FieldName is blank`
- if all selected fields are filled:
  - `Review completed`

Why:
- user can quickly see which issues are ready and which are missing details

---

## Where Default Filters Come From

File:
- `backend/config.py`

This file stores:
- app-level constants
- default filters
- directories and config paths

Why:
- easier to update defaults in one place

---

## Where Review IDs Are Extracted

File:
- `backend/services/collaborator_service.py`

This service reads the `Review Info` text and extracts valid review IDs.

Supported examples:
- `review:id=60872`
- `reviewid=60872`
- `review id=60872`
- `review packet: 60872`
- `review # 60872`
- `#60872`

Ignored examples:
- `ABFMS-32560`
- `ABFMS:32560`
- `ABFMS=32560`

Why:
- `Review Info` often contains paragraphs, not clean IDs
- app needs only real review IDs

---

## Collaborator Parsing

File:
- `backend/services/parser_service.py`

What it does:
- receives Collaborator JSON response
- extracts fields like:
  - `Review Status`
  - `Review Title`
  - `Created`
  - `Group`
  - `Template`
  - `Deadline`
  - `Overview`
  - `Production Site`
  - `SW Criticality Level`
  - and more

Why:
- raw JSON is not UI-friendly
- frontend needs clean field names and values

---

## Collaborator Validation

File:
- `backend/services/validation_service.py`

What it does:
- checks selected Collaborator fields
- marks row status:
  - `Complete`
  - `Incomplete`

Why:
- user wants to know if all required review fields are available

---

## Shared Data Store

File:
- `backend/repositories/data_store.py`

What it stores:
- loaded dump dataframe
- selected issue keys

Why:
- backend services need shared in-memory state while the app is running

---

## How Angular Talks to Backend

File:
- `frontend/src/app/services/api.service.ts`

This file contains the frontend API calls such as:
- upload dump
- upload keys
- generate preview
- export CSV
- get Collaborator config
- parse and validate Collaborator reviews

Why:
- keeps all HTTP calls in one clean place

---

## How Electron Talks to Angular Safely

File:
- `electron/preload.js`

Why this file exists:
- Angular should not directly access Node/Electron internals
- preload exposes only safe functions to the frontend

Examples:
- open Collaborator login
- fetch review data
- download PDFs
- load stored auth

---

## How Collaborator Login Works

Main file:
- `electron/main.js`

What happens:
1. user clicks `Open Collaborator Login`
2. Electron opens Collaborator login page
3. login cookies are stored in Electron session
4. same session is reused when calling Collaborator JSON API

Why:
- user should not manually paste cookies
- login behaves like a normal browser session

---

## How Username and Ticket Are Stored

Stored file:
- `%LOCALAPPDATA%\\ReviewPackets\\collaborator-auth.json`

Behavior:
- first time user enters username and ticket
- app stores them locally
- next launch auto-loads them

Why:
- avoids asking user every time

---

## Logs

Log folder:
- `%LOCALAPPDATA%\\ReviewPackets\\logs`

Important file:
- `logs.txt`

Why logs are useful:
- debug dump loading
- debug preview generation
- debug Collaborator fetch and parsing
- debug backend startup

---

## End-to-End User Flow

```text
1. User opens ReviewPackets
2. Electron starts backend
3. Angular UI opens
4. User uploads dump
5. Backend reads file and prepares headers
6. User selects filters
7. Backend builds preview rows
8. User exports CSV or loads review IDs from completed preview rows
9. User opens Collaborator login
10. Electron uses session cookies + stored auth
11. Collaborator JSON is fetched
12. Backend parses and validates fields
13. UI shows Collaborator validation results
```

---

## Why This Architecture Is Good

This separation helps because:

- `Electron` handles desktop behavior
- `Angular` handles UI behavior
- `FastAPI` handles business/data logic
- `Services` keep logic modular and easier to test

Benefits:
- easier to debug
- easier to change one part without breaking others
- cleaner packaging for Windows desktop delivery

---

## Key Files Summary

### Electron
- `electron/main.js`
  - desktop startup
  - backend process start
  - Collaborator session/auth handling

- `electron/preload.js`
  - safe bridge between Angular and Electron

### Frontend
- `frontend/src/app/app.component.ts`
  - main UI logic

- `frontend/src/app/app.component.html`
  - main UI layout

- `frontend/src/app/services/api.service.ts`
  - backend API calls

### Backend
- `backend/main.py`
  - FastAPI app startup

- `backend/api/routes.py`
  - API endpoints

- `backend/config.py`
  - default filters and config constants

- `backend/services/dump_service.py`
  - dump loading

- `backend/services/preview_service.py`
  - preview generation

- `backend/services/collaborator_service.py`
  - review ID extraction and review URL building

- `backend/services/parser_service.py`
  - Collaborator JSON parsing

- `backend/services/validation_service.py`
  - field validation

- `backend/utils/file_loader.py`
  - reads CSV/Excel

- `backend/utils/merge.py`
  - duplicate header and duplicate value consolidation

- `backend/repositories/data_store.py`
  - in-memory shared state

---

## Final Note

If you are new to the project, the best order to understand it is:

1. `frontend/src/app/app.component.ts`
2. `frontend/src/app/services/api.service.ts`
3. `backend/api/routes.py`
4. `backend/services/preview_service.py`
5. `backend/services/collaborator_service.py`
6. `backend/services/parser_service.py`
7. `electron/main.js`

That path helps you understand:
- what the user clicks
- which API gets called
- what backend logic runs
- how Collaborator integration works
