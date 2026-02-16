$ErrorActionPreference = 'Stop'

$python = "C:\Users\Anurag Srivastava\AppData\Local\Programs\Python\Python311\python.exe"
if (Test-Path "backend\.venv\Scripts\python.exe") {
  $python = "backend\.venv\Scripts\python.exe"
}

if (-not (Test-Path $python)) {
  throw "Python not found. Install Python 3.11/3.12 or create backend\.venv first."
}

Write-Host "Using Python: $python"

Push-Location backend

if (-not (Test-Path .venv)) {
  & $python -m venv .venv
}

$venvPython = Resolve-Path .venv\Scripts\python.exe
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install --only-binary=:all: -r requirements.txt
& $venvPython -m pip install pyinstaller
& $venvPython -m PyInstaller --clean --noconfirm reviewpackets.spec

Pop-Location
