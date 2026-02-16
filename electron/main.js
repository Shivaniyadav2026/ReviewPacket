const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess = null;

function resolveBackendCommand() {
  const packagedExe = path.join(process.resourcesPath, 'backend', 'ReviewPacketsBackend.exe');
  const unpackedExe = path.join(app.getAppPath(), 'backend', 'dist', 'ReviewPacketsBackend.exe');

  if (app.isPackaged && fs.existsSync(packagedExe)) {
    return { command: packagedExe, args: [], cwd: path.dirname(packagedExe) };
  }

  if (fs.existsSync(unpackedExe)) {
    return { command: unpackedExe, args: [], cwd: path.dirname(unpackedExe) };
  }

  return {
    command: 'python',
    args: ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000'],
    cwd: app.getAppPath()
  };
}

function startBackend() {
  const { command, args, cwd } = resolveBackendCommand();

  backendProcess = spawn(command, args, {
    cwd,
    windowsHide: true
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend] ${data}`);
  });

  backendProcess.on('error', (err) => {
    console.error(`[backend] spawn failed for "${command}": ${err.message}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.once('ready-to-show', () => win.show());

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'reviewpackets', 'browser', 'index.html'));
  } else {
    win.loadURL('http://localhost:4200');
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
