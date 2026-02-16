# How Electron Launches Python

- On app start, Electron checks `app.isPackaged`.
- Packaged mode: it starts `resources/backend/ReviewPacketsBackend.exe`.
- Dev mode: it runs `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`.
- Electron then loads the Angular UI:
  - Packaged: `frontend/dist/reviewpackets/index.html`
  - Dev: `http://localhost:4200`
- On app close, Electron terminates the backend process.
