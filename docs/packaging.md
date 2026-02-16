# Packaging Instructions

## 1. Build Backend (PyInstaller)
Use Python 3.11 or 3.12 on the build machine (pandas wheels required).
```
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install pyinstaller
pyinstaller --clean --noconfirm reviewpackets.spec
```

## 2. Build Frontend (Angular)
```
cd frontend
npm install
npm run build
```

## 3. Build Electron Installer
```
cd ..
npm install
npm run dist
```

## Output
Installer will be in `dist/` as an `.exe` (NSIS).
