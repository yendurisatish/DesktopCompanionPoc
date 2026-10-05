// The only bridge between the sandboxed renderer and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companionHost', {
  getInit: () => ipcRenderer.invoke('get-init'),
  readCharacterFile: (name) => ipcRenderer.invoke('read-character-file', name),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  setPresent: (present) => ipcRenderer.send('set-present', present),
  reportState: (state) => ipcRenderer.send('state', state),
  onCommand: (callback) => ipcRenderer.on('command', (_event, msg) => callback(msg)),
});
