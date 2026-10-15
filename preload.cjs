'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'cinema',
  Object.freeze({
    invoke: (action, payload = {}) => ipcRenderer.invoke('cinema:invoke', action, payload)
  })
);
