const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess = null;
let loginWindow = null;
let collaboratorLogFile = null;

const COLLAB_SESSION_PARTITION = 'persist:collaborator';

function initCollaboratorLogs() {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  collaboratorLogFile = path.join(logsDir, 'collaborator-electron.log');
  writeCollaboratorLog('startup', 'Collaborator logging initialized.');
}

function writeCollaboratorLog(scope, message, metadata) {
  try {
    const timestamp = new Date().toISOString();
    let line = `${timestamp} | ${scope} | ${message}`;
    if (metadata !== undefined) {
      line += ` | ${JSON.stringify(metadata)}`;
    }
    line += '\n';

    if (collaboratorLogFile) {
      fs.appendFileSync(collaboratorLogFile, line, 'utf8');
    }
    console.log(`[collaborator] ${line.trim()}`);
  } catch (err) {
    console.error(`[collaborator] log write failed: ${err.message}`);
  }
}

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
  writeCollaboratorLog('backend', 'Starting backend process.', { command, args, cwd });

  backendProcess = spawn(command, args, {
    cwd,
    windowsHide: true
  });

  backendProcess.stdout.on('data', (data) => {
    writeCollaboratorLog('backend:stdout', String(data).trim());
  });

  backendProcess.stderr.on('data', (data) => {
    writeCollaboratorLog('backend:stderr', String(data).trim());
  });

  backendProcess.on('error', (err) => {
    writeCollaboratorLog('backend:error', 'Backend spawn failed.', { error: err.message });
  });

  backendProcess.on('exit', (code, signal) => {
    writeCollaboratorLog('backend:exit', 'Backend process exited.', { code, signal });
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
    writeCollaboratorLog('renderer:error', 'Renderer failed to load.', { code, description, url });
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
    writeCollaboratorLog('login:error', 'Missing login URL.');
    throw new Error('Collaborator login URL is required.');
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    writeCollaboratorLog('login', 'Reused existing login window.');
    return { ok: true };
  }

  loginWindow = createCollaboratorWindow({ show: true });
  loginWindow.on('closed', () => {
    writeCollaboratorLog('login', 'Login window closed.');
    loginWindow = null;
  });

  writeCollaboratorLog('login', 'Opening Collaborator login page.', { url });
  await loginWindow.loadURL(url);
  return { ok: true };
});

ipcMain.handle('collaborator:fetch-html', async (_event, pageUrl) => {
  const url = String(pageUrl || '').trim();
  if (!url) {
    writeCollaboratorLog('fetch:error', 'Missing review URL.');
    throw new Error('Collaborator review URL is required.');
  }

  const win = createCollaboratorWindow();
  writeCollaboratorLog('fetch', 'Fetching review HTML.', { url });

  try {
    await win.loadURL(url);
    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
    writeCollaboratorLog('fetch', 'Fetched review HTML successfully.', { url, htmlLength: html.length });
    return { html };
  } catch (error) {
    writeCollaboratorLog('fetch:error', 'Failed to fetch review HTML.', {
      url,
      error: error.message || 'Unknown error'
    });
    throw error;
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

  writeCollaboratorLog('pdf', 'Starting PDF batch.', { totalJobs: work.length });

  for (const job of work) {
    const reviewId = String(job.reviewId || '').trim();
    const url = String(job.url || '').trim();
    const outputFile = String(job.outputFile || '').trim();

    if (!reviewId || !url || !outputFile) {
      failed.push({ reviewId, error: 'Invalid PDF job payload.' });
      writeCollaboratorLog('pdf:error', 'Invalid PDF job payload.', { reviewId, url, outputFile });
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
      writeCollaboratorLog('pdf', 'PDF generated.', { reviewId, outputFile, size: pdf.length });
    } catch (error) {
      failed.push({ reviewId, error: error.message || 'PDF generation failed.' });
      writeCollaboratorLog('pdf:error', 'PDF generation failed.', {
        reviewId,
        outputFile,
        error: error.message || 'Unknown error'
      });
    } finally {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    }
  }

  writeCollaboratorLog('pdf', 'PDF batch completed.', {
    downloaded: downloaded.length,
    failed: failed.length
  });

  return { downloaded, failed };
});

ipcMain.handle('collaborator:has-session', async (_event, baseUrl) => {
  const url = String(baseUrl || '').trim();
  const cookies = await getCollaboratorSession().cookies.get(url ? { url } : {});
  const authenticated = cookies.length > 0;
  writeCollaboratorLog('session', 'Session check completed.', {
    url,
    authenticated,
    cookieCount: cookies.length
  });
  return { authenticated };
});

app.whenReady().then(() => {
  initCollaboratorLogs();
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  writeCollaboratorLog('shutdown', 'All windows closed.');

  if (backendProcess) {
    backendProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
