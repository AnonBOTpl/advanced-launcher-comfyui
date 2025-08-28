// preload.js - Bezpieczny mostek między main a renderer z obsługą przeglądarki
const { contextBridge, ipcRenderer } = require('electron');

// Expose API do renderer procesu
contextBridge.exposeInMainWorld('electronAPI', {
  // Konfiguracja
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Ścieżka ComfyUI
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  validatePath: (path) => ipcRenderer.invoke('validate-path', path),
  
  // ComfyUI
  startComfyUI: (config) => ipcRenderer.invoke('start-comfyui', config),
  stopComfyUI: () => ipcRenderer.invoke('stop-comfyui'),
  isComfyUIRunning: () => ipcRenderer.invoke('is-comfyui-running'),
  installDependencies: (config) => ipcRenderer.invoke('install-dependencies', config),
  
  // NEW - Browser controls
  openComfyUIBrowser: (config) => ipcRenderer.invoke('open-comfyui-browser', config),
  closeComfyUIBrowser: () => ipcRenderer.invoke('close-comfyui-browser'),
  isBrowserOpen: () => ipcRenderer.invoke('is-browser-open'),
  
  // Dialogi
  showError: (title, message) => ipcRenderer.invoke('show-error', title, message),
  showInfo: (title, message) => ipcRenderer.invoke('show-info', title, message),
  
  // Event listenery
  onComfyUIOutput: (callback) => {
    ipcRenderer.on('comfyui-output', (event, data) => callback(data));
  },
  
  onComfyUIExit: (callback) => {
    ipcRenderer.on('comfyui-exit', (event, code) => callback(code));
  },
  
  onInstallOutput: (callback) => {
    ipcRenderer.on('install-output', (event, data) => callback(data));
  },

  onPathSelected: (callback) => {
    ipcRenderer.on('path-selected', (event, path) => callback(path));
  },

  // Process state events
  onComfyUIStarted: (callback) => {
    ipcRenderer.on('comfyui-started', () => callback());
  },

  onComfyUIStopped: (callback) => {
    ipcRenderer.on('comfyui-stopped', () => callback());
  },

  // NEW - Browser events
  onComfyUIBrowserClosed: (callback) => {
    ipcRenderer.on('comfyui-browser-closed', () => callback());
  },
  
  // Cleanup listenery
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
