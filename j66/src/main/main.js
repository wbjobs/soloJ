const { app, BrowserWindow, ipcMain, Menu, Tray, globalShortcut, nativeImage, net } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;
let tray = null;
let isQuitting = false;

function startBackendServer() {
  serverProcess = fork(path.join(__dirname, '../server/server.js'), [], {
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server]: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.openDevTools();

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建笔记',
          accelerator: 'Ctrl+N',
          click: () => {
            showWindowAndSend('create-new-note');
          }
        },
        {
          label: '保存笔记',
          accelerator: 'Ctrl+S',
          click: () => {
            mainWindow.webContents.send('save-note');
          }
        },
        { type: 'separator' },
        {
          label: '同步到云端',
          accelerator: 'Ctrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('sync-to-cloud');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Ctrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, '../renderer/assets/tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('笔记应用');

  updateTrayMenu();

  tray.on('double-click', () => {
    showWindow();
  });
}

async function fetchRecentNotes() {
  return new Promise((resolve) => {
    const request = net.request('http://localhost:3000/api/notes');
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          const notes = JSON.parse(data);
          resolve(notes.slice(0, 10));
        } catch (e) {
          resolve([]);
        }
      });
    });
    request.on('error', () => {
      resolve([]);
    });
    request.end();
  });
}

async function updateTrayMenu() {
  const recentNotes = await fetchRecentNotes();

  const recentNotesItems = recentNotes.map((note) => ({
    label: `${note.title || '无标题'}  (${new Date(note.updatedAt).toLocaleDateString('zh-CN')})`,
    click: () => {
      showWindowAndSend('open-note', note._id);
    }
  }));

  const contextMenu = Menu.buildFromTemplate([
    { label: '📝 新建笔记', click: () => showWindowAndSend('create-new-note') },
    { type: 'separator' },
    { label: '📄 最近编辑', enabled: false },
    ...recentNotesItems,
    { type: 'separator' },
    { label: '📂 显示主窗口', click: () => showWindow() },
    { type: 'separator' },
    {
      label: '❌ 退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
  }
  mainWindow.show();
  mainWindow.focus();
}

function showWindowAndSend(channel, data) {
  showWindow();
  if (data !== undefined) {
    mainWindow.webContents.send(channel, data);
  } else {
    mainWindow.webContents.send(channel);
  }
}

function registerGlobalShortcut() {
  const ret = globalShortcut.register('Ctrl+Shift+N', () => {
    showWindowAndSend('create-new-note');
  });

  if (!ret) {
    console.error('全局快捷键 Ctrl+Shift+N 注册失败');
  }
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();
  createMenu();
  createTray();
  registerGlobalShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  setInterval(() => {
    updateTrayMenu();
  }, 30000);
});

app.on('window-all-closed', () => {
});

app.on('before-quit', () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle('get-api-url', () => {
  return 'http://localhost:3000/api';
});

ipcMain.on('tray-update-recent', () => {
  updateTrayMenu();
});

ipcMain.on('note-saved', () => {
  updateTrayMenu();
});
