const { app, BrowserWindow, dialog, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const { verifyCopy } = require('./verification/verifyManager');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

async function resolveRobocopyArgs(args) {
  const logDir = path.join(app.getPath('userData'), 'logs');
  const logPath = path.join(logDir, 'robocopy.log');
  let usesLogFile = false;

  const nextArgs = args.map((arg) => {
    if (/^\/LOG(?::|$)/i.test(arg)) {
      usesLogFile = true;
      return `/LOG:${logPath}`;
    }
    return arg;
  });

  if (usesLogFile) {
    await fs.mkdir(logDir, { recursive: true });
  }

  return { args: nextArgs, logPath: usesLogFile ? logPath : null };
}

function parseByteCount(value) {
  const bytes = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(bytes) ? bytes : 0;
}

function createRobocopyMetrics(window) {
  const sampleWindowMs = 5000;
  const emitIntervalMs = 500;
  let copiedBytes = 0;
  let currentFileSize = 0;
  let currentFileCopied = 0;
  let samples = [{ time: Date.now(), bytes: 0 }];
  let lastEmit = 0;
  const heartbeat = setInterval(() => emit(true), 1000);
  heartbeat.unref?.();

  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < emitIntervalMs) return;

    samples = samples.filter((sample) => now - sample.time <= sampleWindowMs);
    if (samples.length === 0) {
      samples.push({ time: now, bytes: copiedBytes });
    }
    const first = samples[0];
    const last = samples[samples.length - 1];
    const elapsedSeconds = first && last ? (last.time - first.time) / 1000 : 0;
    const speedBps = elapsedSeconds > 0 ? Math.max(0, Math.round((last.bytes - first.bytes) / elapsedSeconds)) : 0;

    lastEmit = now;
    window?.webContents.send('robocopy:metrics', {
      copiedBytes,
      speedBps,
    });
  };

  const addCopiedBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return;
    copiedBytes += bytes;
    samples.push({ time: Date.now(), bytes: copiedBytes });
    emit();
  };

  const finishCurrentFile = () => {
    if (currentFileSize <= 0) return;
    addCopiedBytes(Math.max(0, currentFileSize - currentFileCopied));
    currentFileSize = 0;
    currentFileCopied = 0;
  };

  const processLine = (line) => {
    if (/ERROR\s+\d+.*Copying File/i.test(line)) {
      currentFileSize = 0;
      currentFileCopied = 0;
      emit();
      return;
    }

    const copyLineMatch = line.match(/\b(New File|Newer|Older)\s+([\d,]+)\s+/i);
    if (copyLineMatch) {
      finishCurrentFile();
      currentFileSize = parseByteCount(copyLineMatch[2]);
      currentFileCopied = 0;
      emit();
      return;
    }

    const progressMatch = line.match(/(\d+(?:\.\d+)?)%/);
    if (progressMatch && currentFileSize > 0) {
      const percent = Math.min(100, Math.max(0, Number(progressMatch[1])));
      if (!Number.isNaN(percent)) {
        const nextCopied = Math.round(currentFileSize * (percent / 100));
        if (nextCopied > currentFileCopied) {
          addCopiedBytes(nextCopied - currentFileCopied);
          currentFileCopied = nextCopied;
        }
        if (percent >= 100) finishCurrentFile();
      }
    }
  };

  return {
    processLine,
    finish: () => {
      clearInterval(heartbeat);
      finishCurrentFile();
      emit(true);
    },
  };
}

function createRobocopyStreamHandler({ window, metrics, streamName }) {
  let pending = '';

  return {
    push(data) {
      const text = pending + data.toString();
      const parts = text.replace(/\r/g, '\n').split('\n');
      pending = parts.pop() || '';

      parts
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          if (streamName === 'stdout') metrics.processLine(line);
          const isProgressOnly = /^\d+(?:\.\d+)?%$/.test(line);
          if (!isProgressOnly) {
            window?.webContents.send('robocopy:log', line);
          }

          const progressMatch = line.match(/(\d+(?:\.\d+)?)%/);
          if (progressMatch) {
            const progress = Number(progressMatch[1]);
            if (!Number.isNaN(progress)) {
              window?.webContents.send('robocopy:progress', progress);
              window?.setProgressBar(Math.min(1, Math.max(0, progress / 100)));
            }
          }
        });
    },
    flush() {
      const line = pending.trim();
      pending = '';
      if (!line) return;
      window?.webContents.send('robocopy:log', line);
      if (streamName === 'stdout') metrics.processLine(line);
    },
  };
}

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
  const { command } = payload;
  const { args, logPath } = await resolveRobocopyArgs(payload.args || []);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.setProgressBar(0);

  return new Promise((resolve, reject) => {
    try {
      if (window) {
        window.webContents.send('robocopy:log', `Command: robocopy ${args.join(' ')}`);
        if (logPath) {
          window.webContents.send('robocopy:log', `Log file: ${logPath}`);
        }
      }
      const proc = spawn('robocopy', args, { windowsHide: true });
      const metrics = createRobocopyMetrics(window);
      const stdoutHandler = createRobocopyStreamHandler({ window, metrics, streamName: 'stdout' });
      const stderrHandler = createRobocopyStreamHandler({ window, metrics, streamName: 'stderr' });

      proc.stdout.on('data', (data) => {
        stdoutHandler.push(data);
      });

      proc.stderr.on('data', (data) => {
        stderrHandler.push(data);
      });

      proc.on('close', async (code) => {
        stdoutHandler.flush();
        stderrHandler.flush();
        metrics.finish();
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

        if (exitCode <= 7) {
          const verificationMode = payload.verificationMode || 'off';
          let verification = null;

          try {
            verification = await verifyCopy({
              mode: verificationMode,
              sourceRoot: payload.source,
              destinationRoot: payload.destination,
              subdirMode: payload.subdirMode,
              excludeText: payload.excludeText,
              move: payload.move,
              workerCount: payload.verificationThreads,
              onStarted: (summary) => {
                window?.webContents.send('verification:started', summary);
                if (summary.mode !== 'off') {
                  window?.webContents.send('robocopy:log', `Verification started (${summary.mode}).`);
                }
              },
              onProgress: (summary) => {
                window?.webContents.send('verification:progress', summary);
              },
            });

            window?.webContents.send('verification:done', verification);
            if (verification?.skipped) {
              window?.webContents.send('robocopy:log', `Verification skipped: ${verification.reason}`);
            } else if (verification?.failedFiles > 0) {
              window?.webContents.send(
                'robocopy:log',
                `Verification failed: ${verification.failedFiles} of ${verification.totalFiles} files did not match.`
              );
              window?.webContents.send('robocopy:error', {
                code: exitCode,
                command,
                verification,
              });
              if (window) window.setProgressBar(-1);
              reject(new Error(`Verification failed: ${verification.failedFiles} mismatched file(s).`));
              return;
            } else if (!verification?.skipped) {
              window?.webContents.send('robocopy:log', `Verification passed: ${verification.checkedFiles} files checked.`);
            }
          } catch (error) {
            window?.webContents.send('verification:error', { message: error.message });
            window?.webContents.send('robocopy:error', { message: error.message, command });
            if (window) window.setProgressBar(-1);
            reject(error);
            return;
          }

          window?.webContents.send('robocopy:done', { code: exitCode, message, verification });
          if (window) window.setProgressBar(-1);

          if (Notification.isSupported()) {
            new Notification({
              title: 'RoboCopy Pro',
              body: verification?.failedFiles > 0 ? 'Transfer complete, verification failed.' : 'Transfer verified.',
            }).show();
          }
          resolve({ code: exitCode, message, verification });
        } else {
          if (Notification.isSupported()) {
            new Notification({
              title: 'RoboCopy Pro',
              body: 'Transfer failed. Check logs for details.',
            }).show();
          }
          if (window) window.setProgressBar(-1);
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
