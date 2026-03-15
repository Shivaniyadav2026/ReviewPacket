const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess = null;
let loginWindow = null;
let collaboratorLogFile = null;
let unifiedLogFile = null;
let backendLogDir = null;

const COLLAB_SESSION_PARTITION = 'persist:collaborator';

function initCollaboratorLogs() {
  const localAppData = process.env.LOCALAPPDATA || app.getPath('userData');
  const logsDir = path.join(localAppData, 'ReviewPackets', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  backendLogDir = logsDir;
  collaboratorLogFile = path.join(logsDir, 'collaborator-electron.log');
  unifiedLogFile = path.join(logsDir, 'logs.txt');
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
    if (unifiedLogFile) {
      fs.appendFileSync(unifiedLogFile, line, 'utf8');
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
    windowsHide: true,
    env: {
      ...process.env,
      REVIEWPACKETS_LOG_DIR: backendLogDir || path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'ReviewPackets', 'logs')
    }
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

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function buildJsonApiUrl(baseUrl, jsonApiPath) {
  const base = normalizeBaseUrl(baseUrl);
  const path = String(jsonApiPath || '/services/json/v1').trim();
  if (!path) {
    return `${base}/services/json/v1`;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/')) {
    return `${base}${path}`;
  }
  return `${base}/${path}`;
}

async function postCollaboratorJson(baseUrl, jsonApiPath, payload) {
  const ses = getCollaboratorSession();
  if (typeof ses.fetch !== 'function') {
    return {
      ok: false,
      error: {
        code: 'SESSION_FETCH_UNAVAILABLE',
        message: 'Electron session.fetch is not available in this runtime.'
      }
    };
  }

  const endpoint = buildJsonApiUrl(baseUrl, jsonApiPath);
  writeCollaboratorLog('jsonapi:request', 'POST /services/json/v1', { endpoint, payload });

  try {
    const response = await ses.fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const bodyText = await response.text();
    let body = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch (parseError) {
      body = { raw: bodyText };
    }

    writeCollaboratorLog('jsonapi:response', 'Received API response.', {
      endpoint,
      status: response.status,
      ok: response.ok,
      body
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: `HTTP_${response.status}`,
          message: `Collaborator JSON API failed with HTTP ${response.status}.`,
          details: body
        }
      };
    }

    if (Array.isArray(body) && body.some((item) => item?.error || item?.errors || item?.exception)) {
      return {
        ok: false,
        error: {
          code: 'API_ERROR',
          message: 'Collaborator API returned errors.',
          details: body
        }
      };
    }

    if (body && (body.error || body.exception)) {
      return {
        ok: false,
        error: {
          code: 'API_ERROR',
          message: body.error?.message || body.exception?.message || 'Collaborator API returned an error.',
          details: body
        }
      };
    }

    return { ok: true, data: body };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Failed to call Collaborator JSON API.'
      }
    };
  }
}

function candidateUserRequests(reviewId) {
  const requestId = `${Date.now()}-${reviewId}`;
  return [
    {
      id: requestId,
      command: 'ReviewService.findReviewById',
      args: { reviewId: reviewId }
    },
    {
      id: requestId,
      service: 'ReviewService',
      command: 'findReviewById',
      args: { reviewId: reviewId }
    },
    {
      id: requestId,
      command: 'ReviewService.findReviewById',
      args: { id: reviewId }
    },
    {
      id: requestId,
      service: 'ReviewService',
      command: 'findReviewById',
      args: { id: reviewId }
    }
  ];
}

function extractUserPayload(apiResponse) {
  const body = apiResponse || {};
  if (Array.isArray(body)) {
    for (const item of body) {
      if (item && item.result && typeof item.result === 'object') {
        const result = item.result;
        if (result.reviewId || result.title || result.displayText || result.reviewPhase) {
          return result;
        }
      }
    }
    return body[0]?.result || body[0] || {};
  }
  const result = body.result || body.data || body.response || body;
  if (Array.isArray(result?.users) && result.users.length > 0) {
    return result.users[0];
  }
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  return result;
}

function parseCookieInput(cookieInput) {
  const raw = String(cookieInput || '').trim();
  if (!raw) {
    return null;
  }
  const parts = raw.split(';')[0].split('=');
  if (parts.length < 2) {
    return null;
  }
  const name = parts.shift().trim();
  const value = parts.join('=').trim();
  if (!name || !value) {
    return null;
  }
  return { name, value };
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

ipcMain.handle('collaborator:fetch-review-data', async (_event, payload) => {
  const baseUrl = normalizeBaseUrl(payload?.baseUrl);
  const reviewId = String(payload?.reviewId || '').trim();
  const auth = payload?.auth || {};
  const jsonApiPath = auth?.jsonApiPath;

  if (!baseUrl || !reviewId) {
    const error = {
      code: 'INVALID_INPUT',
      message: 'baseUrl and reviewId are required.'
    };
    writeCollaboratorLog('jsonapi:error', 'Invalid fetch-review-data request.', error);
    return { data: {}, error };
  }

  const cookieInput = auth?.cookie;
  const cookiePair = parseCookieInput(cookieInput);
  if (cookiePair) {
    try {
      await getCollaboratorSession().cookies.set({
        url: baseUrl,
        name: cookiePair.name,
        value: cookiePair.value
      });
      writeCollaboratorLog('jsonapi:auth', 'Manual cookie applied.', {
        name: cookiePair.name
      });
    } catch (error) {
      writeCollaboratorLog('jsonapi:auth', 'Failed to set manual cookie.', {
        error: error.message || 'Unknown error'
      });
    }
  }

  const cookies = await getCollaboratorSession().cookies.get({ url: baseUrl });
  if (!cookies.length) {
    const error = {
      code: 'AUTH_REQUIRED',
      message: 'No Collaborator session cookie found. Please login first.'
    };
    writeCollaboratorLog('jsonapi:error', 'Missing authenticated session.', { baseUrl, reviewId });
    return { data: {}, error };
  }

  const username = String(auth?.username || '').trim();
  const ticket = String(auth?.ticket || '').trim();

  for (const requestPayload of candidateUserRequests(reviewId)) {
    const batch = [];
    if (username && ticket) {
      batch.push({
        command: 'SessionService.authenticate',
        args: { login: username, ticket }
      });
    }
    batch.push(requestPayload);
    const response = await postCollaboratorJson(baseUrl, jsonApiPath, batch);
    if (response.ok) {
      const userData = extractUserPayload(response.data);
      writeCollaboratorLog('jsonapi', 'Fetched review data from Collaborator JSON API.', {
        reviewId,
        keys: Object.keys(userData || {})
      });
      return { data: userData || {}, error: null };
    }
    writeCollaboratorLog('jsonapi:retry', 'JSON API call variant failed, trying next.', {
      reviewId,
      requestPayload,
      error: response.error
    });
  }

  const error = {
    code: 'ALL_JSONAPI_METHODS_FAILED',
    message: 'Unable to fetch data via Collaborator JSON API methods.',
    reviewId
  };
  writeCollaboratorLog('jsonapi:error', 'All JSON API variants failed.', error);
  return { data: {}, error };
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

ipcMain.handle('app:log', async (_event, scope, message, metadata) => {
  writeCollaboratorLog(String(scope || 'ui'), String(message || ''), metadata);
  return { ok: true };
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
