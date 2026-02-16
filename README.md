# ReviewPackets

Production-grade offline desktop app for review packet automation. It runs a local FastAPI server, an Angular UI, and an Electron shell. All components run on Windows without external services.

## Architecture (Clean + Service Layer)
- **API Layer**: FastAPI endpoints in `backend/api`.
- **Service Layer**: Business logic in `backend/services`.
- **Repositories**: In-memory data store in `backend/repositories`.
- **Models**: Pydantic request/response schemas in `backend/models`.
- **Utilities**: Excel parsing + duplicate header merging in `backend/utils`.

**Data flow**
1. Electron starts backend and loads UI.
2. Angular uploads Excel dump + issue keys.
3. Backend loads data into in-memory store.
4. Preview generation uses selected filters to compute comments.
5. UI renders preview and exports CSV.

## Project Structure
```
backend/
  api/
  services/
  models/
  repositories/
  utils/
  tests/
frontend/
  src/
    app/
    assets/
  angular.json
  package.json
electron/
  main.js
  preload.js
sample/
  ReviewPackets_Sample.xlsx
docs/
  architecture_diagram.txt
  api_contracts.md
  electron_launch.md
  packaging.md
scripts/
  create_sample_excel.ps1
```

## Local Dev (Optional)
- Backend: `uvicorn backend.main:app --host 127.0.0.1 --port 8000`
- Frontend: `cd frontend && npm install && npm start`
- Electron: `cd .. && npm install && npx electron .`

## Packaging
Build machine needs Python 3.11 or 3.12. See `docs/packaging.md`.
