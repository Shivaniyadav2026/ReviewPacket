const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess = null;
let loginWindow = null;
const COLLAB_SESSION_PARTITION = 'persist:collaborator';

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

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[renderer] failed to load ${url}: ${code} ${description}`);
  });

  win.once('ready-to-show', () => win.show());

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'reviewpackets', 'browser', 'index.html'));
  } else {
    win.loadURL('http://localhost:4200');
  }
}

function getCollaboratorSession() {
  return session.fromPartition(COLLAB_SESSION_PARTITION);
}

function createCollaboratorWindow(options = {}) {
  return new BrowserWindow({
    width: options.width || 1280,
    height: options.height || 860,
    show: options.show || false,
    webPreferences: {
      partition: COLLAB_SESSION_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
}

ipcMain.handle('collaborator:open-login', async (_event, loginUrl) => {
  const url = String(loginUrl || '').trim();
  if (!url) {
    throw new Error('Collaborator login URL is required.');
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return { ok: true };
  }

  loginWindow = createCollaboratorWindow({ show: true });
  loginWindow.on('closed', () => {
    loginWindow = null;
  });

  await loginWindow.loadURL(url);
  return { ok: true };
});

ipcMain.handle('collaborator:fetch-html', async (_event, pageUrl) => {
  const url = String(pageUrl || '').trim();
  if (!url) {
    throw new Error('Collaborator review URL is required.');
  }

  const win = createCollaboratorWindow();
  try {
    await win.loadURL(url);
    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
    return { html };
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
});

ipcMain.handle('collaborator:download-pdfs', async (_event, jobs) => {
  const work = Array.isArray(jobs) ? jobs : [];
  const downloaded = [];
  const failed = [];

  for (const job of work) {
    const reviewId = String(job.reviewId || '').trim();
    const url = String(job.url || '').trim();
    const outputFile = String(job.outputFile || '').trim();

    if (!reviewId || !url || !outputFile) {
      failed.push({ reviewId, error: 'Invalid PDF job payload.' });
      continue;
    }

    const win = createCollaboratorWindow();
    try {
      await win.loadURL(url);
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true
      });
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, pdf);
      downloaded.push({ reviewId, outputFile });
    } catch (error) {
      failed.push({ reviewId, error: error.message || 'PDF generation failed.' });
    } finally {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    }
  }

  return { downloaded, failed };
});

ipcMain.handle('collaborator:has-session', async (_event, baseUrl) => {
  const url = String(baseUrl || '').trim();
  const cookies = await getCollaboratorSession().cookies.get(url ? { url } : {});
  return { authenticated: cookies.length > 0 };
});

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
