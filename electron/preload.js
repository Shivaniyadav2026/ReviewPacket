const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('reviewpackets', {
  version: '1.0.0'
});
