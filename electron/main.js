const { app, BrowserWindow, dialog, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

async function getFolderSize(rootPath) {
  let total = 0;
  const stack = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          total += stat.size;
        } catch {
          // Ignore unreadable files.
        }
      }
    }
  }

  return total;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b1020',
    title: 'RoboCopy Pro',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('robocopy:select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('robocopy:folder-size', async (_event, folderPath) => {
  if (!folderPath) return 0;
  return getFolderSize(folderPath);
});

ipcMain.on('robocopy:ui-progress', (event, value) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (typeof value !== 'number') return;
  window.setProgressBar(value);
});

ipcMain.on('window:minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
});

ipcMain.on('window:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.close();
});

ipcMain.handle('robocopy:run', async (event, payload) => {
  const { args, command } = payload;
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.setProgressBar(0);

  return new Promise((resolve, reject) => {
    try {
      if (window) {
        window.webContents.send('robocopy:log', `Command: robocopy ${args.join(' ')}`);
      }
      const proc = spawn('robocopy', args, { windowsHide: true });

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        lines.forEach((line) => {
          window?.webContents.send('robocopy:log', line);
          const progressMatch = line.match(/(\d+(?:\.\d+)?)%/);
          if (progressMatch) {
            const progress = Number(progressMatch[1]);
            if (!Number.isNaN(progress)) {
              window?.webContents.send('robocopy:progress', progress);
              window?.setProgressBar(Math.min(1, Math.max(0, progress / 100)));
            }
          }
        });
      });

      proc.stderr.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        lines.forEach((line) => window?.webContents.send('robocopy:log', line));
      });

      proc.on('close', (code) => {
        const exitCode = Number.isFinite(code) ? code : 16;
        const codeMap = {
          0: 'No files copied.',
          1: 'Files copied successfully.',
          2: 'Extra files or directories detected.',
          3: 'Copied + extra files detected.',
          5: 'Some files copied, some mismatched.',
          6: 'Extra + mismatched files detected.',
          7: 'Copied + extra + mismatched.',
          8: 'Some files or directories could not be copied.',
          16: 'Serious error.',
        };
        const message = codeMap[exitCode] || 'Robocopy completed with a non-standard exit code.';
        window?.webContents.send('robocopy:log', `Robocopy exit code ${exitCode}: ${message}`);
        window?.webContents.send('robocopy:done', { code: exitCode, message });

        if (window) window.setProgressBar(-1);

        if (exitCode <= 7) {
          if (Notification.isSupported()) {
            new Notification({
              title: 'RoboCopy Pro',
              body: 'Transfer complete.',
            }).show();
          }
          resolve({ code: exitCode, message });
        } else {
          if (Notification.isSupported()) {
            new Notification({
              title: 'RoboCopy Pro',
              body: 'Transfer failed. Check logs for details.',
            }).show();
          }
          window?.webContents.send('robocopy:error', { code: exitCode, command });
          reject(new Error(`Robocopy exited with code ${exitCode}: ${message}`));
        }
      });
    } catch (error) {
      window?.webContents.send('robocopy:error', { message: error.message });
      if (window) window.setProgressBar(-1);
      reject(error);
    }
  });
});
