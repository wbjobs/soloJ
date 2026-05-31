const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')
const { LFSServer } = require('../server/index')
const { addFirewallRule, removeFirewallRule, checkFirewallRule } = require('./firewall')

let mainWindow = null
let tray = null
let lfsServer = null

const DEFAULT_PORT = 3200
const isDev = !app.isPackaged

function getDataDir() {
  return path.join(app.getPath('userData'), 'lfs-data')
}

function createTrayIcon() {
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const cx = x - size / 2
      const cy = y - size / 2
      if (cx * cx + cy * cy < (size / 2) * (size / 2)) {
        canvas[i] = 108
        canvas[i + 1] = 140
        canvas[i + 2] = 255
        canvas[i + 3] = 255
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

async function startServer() {
  const dataDir = getDataDir()
  lfsServer = new LFSServer({
    port: DEFAULT_PORT,
    dataDir
  })
  await lfsServer.start()
  return lfsServer.getPort()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'Git LFS Server',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (e) => {
    if (tray && process.platform === 'darwin') {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => { mainWindow.show() } },
    { type: 'separator' },
    { label: '退出', click: () => { tray = null; app.quit() } }
  ])
  tray.setToolTip('Git LFS Server')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow.show() })
}

app.whenReady().then(async () => {
  const port = await startServer()

  const fwOk = await checkFirewallRule()
  if (!fwOk) {
    await addFirewallRule(port)
  }

  createWindow()
  createTray()

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__LFS_PORT__ = ${port}; window.__LFS_HOST__ = 'localhost';`
    )
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (lfsServer) {
    lfsServer.stop()
  }
  removeFirewallRule().catch(() => {})
})

ipcMain.handle('get-server-info', () => {
  return {
    port: lfsServer ? lfsServer.getPort() : DEFAULT_PORT,
    dataDir: getDataDir()
  }
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})
