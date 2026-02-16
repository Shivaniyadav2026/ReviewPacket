$ErrorActionPreference = 'Stop'

Write-Host "[1/4] Building backend (PyInstaller)..."
powershell -ExecutionPolicy Bypass -File scripts\build-backend.ps1

Write-Host "[2/4] Building frontend (Angular)..."
Push-Location frontend
npm install
npm run build
Pop-Location

Write-Host "[3/4] Building Electron installer..."
npm install
npm run dist

Write-Host "[4/4] Done. Check dist/ for the installer."
