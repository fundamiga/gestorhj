const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let mainWindow;
let nextServerProcess = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServer(url, timeout = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok || res.status < 500) {
          resolve();
          return;
        }
      } catch (_) {
        // ignore while waiting
      }

      if (Date.now() - start > timeout) {
        reject(new Error('Timeout esperando servidor Next.js'));
        return;
      }

      setTimeout(check, 500);
    };

    check();
  });
}

async function startApp() {
  const port = 3000;
  const appUrl = `http://localhost:${port}`;

  if (isDev) {
    createWindow(appUrl);
    return;
  }

  const nextBin = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'next', 'dist', 'bin', 'next');

  nextServerProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: process.resourcesPath,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
    },
    windowsHide: true,
  });

  nextServerProcess.on('error', (err) => {
    console.error('Error iniciando Next:', err);
  });

  try {
    await waitForServer(appUrl, 45000);
    createWindow(appUrl);
  } catch (err) {
    console.error(err);
    app.quit();
  }
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startApp();
  }
});
