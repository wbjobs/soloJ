import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { NoteDatabase } from './database';
import { VaultWatcher } from './watcher';
import { parseMarkdownFile } from './parser';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let db: NoteDatabase | null = null;
let watcher: VaultWatcher | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function setupIpc(): void {
  ipcMain.handle('open-vault', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择笔记库文件夹',
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const vaultPath = result.filePaths[0];
    await initVault(vaultPath);
    return vaultPath;
  });

  ipcMain.handle('get-all-notes', () => {
    if (!db) return [];
    return db.getAllNotes();
  });

  ipcMain.handle('get-note', (_event, title: string) => {
    if (!db) return null;
    return db.getNoteByTitle(title);
  });

  ipcMain.handle('get-backlinks', (_event, title: string) => {
    if (!db) return [];
    return db.getBacklinks(title);
  });

  ipcMain.handle('get-outlinks', (_event, noteId: number) => {
    if (!db) return [];
    return db.getOutlinks(noteId);
  });

  ipcMain.handle('get-graph-data', () => {
    if (!db) return { nodes: [], edges: [] };
    return db.getGraphData();
  });

  ipcMain.handle('search-notes', (_event, query: string) => {
    if (!db) return [];
    return db.searchNotes(query);
  });

  ipcMain.handle('save-note', (_event, filePath: string, content: string) => {
    if (!watcher) return false;
    const fullPath = path.join((watcher as any).vaultPath || '', filePath);
    try {
      fs.writeFileSync(fullPath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });
}

async function initVault(vaultPath: string): Promise<void> {
  if (watcher) {
    await watcher.stop();
  }
  if (db) {
    db.close();
  }

  const dbPath = path.join(app.getPath('userData'), 'notes.db');
  db = new NoteDatabase(dbPath);
  watcher = new VaultWatcher(db, vaultPath);

  watcher.onChange(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vault-changed');
    }
  });

  await watcher.start();
}

app.whenReady().then(() => {
  createWindow();
  setupIpc();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (watcher) {
    await watcher.stop();
  }
  if (db) {
    db.close();
  }
});
