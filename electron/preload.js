const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reviewpackets', {
  version: '1.0.1',
  collaborator: {
    openLogin: (loginUrl) => ipcRenderer.invoke('collaborator:open-login', loginUrl),
    fetchHtml: (pageUrl) => ipcRenderer.invoke('collaborator:fetch-html', pageUrl),
    downloadPdfs: (jobs) => ipcRenderer.invoke('collaborator:download-pdfs', jobs),
    hasSession: (baseUrl) => ipcRenderer.invoke('collaborator:has-session', baseUrl)
  }
});
