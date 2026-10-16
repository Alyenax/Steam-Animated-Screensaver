'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'screensaver',
  Object.freeze({
    invoke: (action, payload = {}) => ipcRenderer.invoke('screensaver:invoke', action, payload)
  })
);
