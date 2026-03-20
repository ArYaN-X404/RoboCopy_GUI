const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('robocopy:select-folder'),
});

contextBridge.exposeInMainWorld('robocopy', {
  run: ({ args, command, onProgress }) => {
    const logListener = (_, line) => {
      if (line) onProgress?.(null, line);
    };
    const progressListener = (_, progress) => {
      if (Number.isFinite(progress)) onProgress?.(progress, null);
    };

    ipcRenderer.on('robocopy:log', logListener);
    ipcRenderer.on('robocopy:progress', progressListener);

    return ipcRenderer
      .invoke('robocopy:run', { args, command })
      .finally(() => {
        ipcRenderer.removeListener('robocopy:log', logListener);
        ipcRenderer.removeListener('robocopy:progress', progressListener);
      });
  },
  setProgress: (value) => ipcRenderer.send('robocopy:ui-progress', value),
  getFolderSize: (path) => ipcRenderer.invoke('robocopy:folder-size', path),
});
