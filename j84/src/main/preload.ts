import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openVault: () => ipcRenderer.invoke('open-vault'),
  getAllNotes: () => ipcRenderer.invoke('get-all-notes'),
  getNote: (title: string) => ipcRenderer.invoke('get-note', title),
  getBacklinks: (title: string) => ipcRenderer.invoke('get-backlinks', title),
  getOutlinks: (noteId: number) => ipcRenderer.invoke('get-outlinks', noteId),
  getGraphData: () => ipcRenderer.invoke('get-graph-data'),
  searchNotes: (query: string) => ipcRenderer.invoke('search-notes', query),
  saveNote: (filePath: string, content: string) => ipcRenderer.invoke('save-note', filePath, content),
  onVaultChanged: (callback: () => void) => {
    ipcRenderer.on('vault-changed', callback);
    return () => ipcRenderer.removeListener('vault-changed', callback);
  },
});
