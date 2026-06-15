const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('robocopy:select-folder'),
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});

contextBridge.exposeInMainWorld('robocopy', {
  run: ({
    args,
    command,
    source,
    destination,
    subdirMode,
    excludeText,
    move,
    verificationMode,
    verificationThreads,
    onProgress,
    onMetrics,
    onVerification,
  }) => {
    const logListener = (_, line) => {
      if (line) onProgress?.(null, line);
    };
    const progressListener = (_, progress) => {
      if (Number.isFinite(progress)) onProgress?.(progress, null);
    };
    const metricsListener = (_, metrics) => {
      if (metrics) onMetrics?.(metrics);
    };
    const verificationStartedListener = (_, summary) => {
      onVerification?.({ type: 'started', summary });
    };
    const verificationProgressListener = (_, summary) => {
      onVerification?.({ type: 'progress', summary });
    };
    const verificationDoneListener = (_, summary) => {
      onVerification?.({ type: 'done', summary });
    };
    const verificationErrorListener = (_, error) => {
      onVerification?.({ type: 'error', error });
    };

    ipcRenderer.on('robocopy:log', logListener);
    ipcRenderer.on('robocopy:progress', progressListener);
    ipcRenderer.on('robocopy:metrics', metricsListener);
    ipcRenderer.on('verification:started', verificationStartedListener);
    ipcRenderer.on('verification:progress', verificationProgressListener);
    ipcRenderer.on('verification:done', verificationDoneListener);
    ipcRenderer.on('verification:error', verificationErrorListener);

    return ipcRenderer
      .invoke('robocopy:run', {
        args,
        command,
        source,
        destination,
        subdirMode,
        excludeText,
        move,
        verificationMode,
        verificationThreads,
      })
      .finally(() => {
        ipcRenderer.removeListener('robocopy:log', logListener);
        ipcRenderer.removeListener('robocopy:progress', progressListener);
        ipcRenderer.removeListener('robocopy:metrics', metricsListener);
        ipcRenderer.removeListener('verification:started', verificationStartedListener);
        ipcRenderer.removeListener('verification:progress', verificationProgressListener);
        ipcRenderer.removeListener('verification:done', verificationDoneListener);
        ipcRenderer.removeListener('verification:error', verificationErrorListener);
      });
  },
  setProgress: (value) => ipcRenderer.send('robocopy:ui-progress', value),
  getFolderSize: (path) => ipcRenderer.invoke('robocopy:folder-size', path),
  getInitialPaths: () => ipcRenderer.invoke('robocopy:get-initial-paths'),
  onSetPaths: (callback) => {
    const listener = (_, paths) => callback(paths);
    ipcRenderer.on('robocopy:set-paths', listener);
    return () => ipcRenderer.removeListener('robocopy:set-paths', listener);
  },
});
