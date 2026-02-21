# Collaborator Packaging Notes

1. Build backend EXE first so Electron ships latest parser/validation services.
2. Build Angular assets so packaged path `frontend/dist/reviewpackets/browser/index.html` exists.
3. Build Electron installer with signing disabled for local unsigned enterprise installs.
4. Verify `backend/collaborator_config.json` is included in packaged resources.
5. User workflow in installed app:
   - Open Collaborator login window.
   - Complete SSO + MFA manually.
   - Run Fetch + Validate.

Command sequence:
```powershell
npm run build:frontend
npm run build:backend
npm run build:electron
```
