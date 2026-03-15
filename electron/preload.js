const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reviewpackets', {
  version: '1.0.1',
  log: (scope, message, metadata) => ipcRenderer.invoke('app:log', scope, message, metadata),
  collaborator: {
    openLogin: (loginUrl) => ipcRenderer.invoke('collaborator:open-login', loginUrl),
    fetchReviewData: (baseUrl, reviewId, auth) =>
      ipcRenderer.invoke('collaborator:fetch-review-data', { baseUrl, reviewId, auth }),
    downloadPdfs: (jobs) => ipcRenderer.invoke('collaborator:download-pdfs', jobs),
    hasSession: (baseUrl) => ipcRenderer.invoke('collaborator:has-session', baseUrl)
  }
});
