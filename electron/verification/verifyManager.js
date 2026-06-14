const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { Worker } = require('worker_threads');
const { scanFiles } = require('./fileScanner');

const MB = 1024 * 1024;
const LARGE_FILE_THRESHOLD = 1024 * MB;
const SAMPLE_SIZE = 32 * MB;
const MTIME_TOLERANCE_MS = 2000;

function getWorkerCount(requested) {
  const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const defaultCount = Math.min(8, Math.max(2, available - 1));
  if (!Number.isFinite(requested) || requested <= 0) return defaultCount;
  return Math.min(16, Math.max(1, Math.floor(requested)));
}

function getRanges(size, mode) {
  if (mode === 'strict' || size <= LARGE_FILE_THRESHOLD) {
    return [{ start: 0, end: Math.max(0, size - 1) }];
  }

  const sampleLength = Math.min(SAMPLE_SIZE, size);
  const candidates = [
    0,
    Math.floor(size * 0.25),
    Math.floor(size * 0.5),
    Math.floor(size * 0.75),
    Math.max(0, size - sampleLength),
  ];

  const ranges = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const start = Math.min(Math.max(0, candidate), Math.max(0, size - sampleLength));
    const end = Math.min(size - 1, start + sampleLength - 1);
    const key = `${start}:${end}`;
    if (end >= start && !seen.has(key)) {
      seen.add(key);
      ranges.push({ start, end });
    }
  }

  return ranges;
}

function getHashBytes(size, mode) {
  return getRanges(size, mode).reduce((total, range) => total + range.end - range.start + 1, 0) * 2;
}

function createSummary({ mode, algorithm, files, totalBytes }) {
  return {
    mode,
    algorithm,
    totalFiles: files.length,
    checkedFiles: 0,
    passedFiles: 0,
    failedFiles: 0,
    totalBytes,
    verifiedBytes: 0,
    failures: [],
    startedAt: Date.now(),
    completedAt: null,
  };
}

function addFailure(summary, result) {
  summary.failedFiles += 1;
  summary.failures.push(result);
}

async function verifyFast({ files, totalBytes, onProgress }) {
  const summary = createSummary({ mode: 'fast', algorithm: 'metadata', files, totalBytes });

  for (const file of files) {
    let result = {
      relativePath: file.relativePath,
      ok: false,
      reason: null,
    };

    try {
      if (file.sourceUnreadable) {
        result.reason = 'Source file could not be read.';
      } else {
        const destinationStat = await fs.stat(file.destinationPath);
        const sizeMatches = destinationStat.size === file.size;
        const timeMatches = Math.abs(destinationStat.mtimeMs - file.mtimeMs) <= MTIME_TOLERANCE_MS;
        result = {
          ...result,
          ok: sizeMatches && timeMatches,
          sourceSize: file.size,
          destinationSize: destinationStat.size,
          reason: sizeMatches && timeMatches ? null : 'Metadata mismatch.',
        };
      }
    } catch {
      result.reason = 'Destination file is missing or unreadable.';
    }

    summary.checkedFiles += 1;
    summary.verifiedBytes += file.size;
    if (result.ok) {
      summary.passedFiles += 1;
    } else {
      addFailure(summary, result);
    }

    onProgress?.({ ...summary, currentFile: file.relativePath });
  }

  summary.completedAt = Date.now();
  return summary;
}

async function createHashTasks(files, mode, summary, onProgress) {
  const tasks = [];

  for (const file of files) {
    if (file.sourceUnreadable) {
      summary.checkedFiles += 1;
      addFailure(summary, {
        relativePath: file.relativePath,
        ok: false,
        reason: 'Source file could not be read.',
      });
      onProgress?.({ ...summary, currentFile: file.relativePath });
      continue;
    }

    try {
      const destinationStat = await fs.stat(file.destinationPath);
      if (destinationStat.size !== file.size) {
        summary.checkedFiles += 1;
        addFailure(summary, {
          relativePath: file.relativePath,
          ok: false,
          reason: 'Size mismatch.',
          sourceSize: file.size,
          destinationSize: destinationStat.size,
        });
        onProgress?.({ ...summary, currentFile: file.relativePath });
        continue;
      }

      tasks.push({
        relativePath: file.relativePath,
        sourcePath: file.sourcePath,
        destinationPath: file.destinationPath,
        size: file.size,
        mode,
        hashBytes: getHashBytes(file.size, mode),
      });
    } catch {
      summary.checkedFiles += 1;
      addFailure(summary, {
        relativePath: file.relativePath,
        ok: false,
        reason: 'Destination file is missing or unreadable.',
      });
      onProgress?.({ ...summary, currentFile: file.relativePath });
    }
  }

  return tasks;
}

async function runWorkerPool({ tasks, workerCount, summary, onProgress }) {
  if (tasks.length === 0) return;

  const workerPath = path.join(__dirname, 'hashWorker.js');
  const workers = Array.from({ length: Math.min(workerCount, tasks.length) }, () => new Worker(workerPath));
  const pending = [...tasks];
  let nextId = 1;
  let completed = 0;

  await new Promise((resolve) => {
    const assign = (worker) => {
      const task = pending.shift();
      if (!task) {
        if (completed >= tasks.length) resolve();
        return;
      }

      const id = nextId;
      nextId += 1;
      worker.currentTask = task;
      worker.postMessage({ type: 'verify', id, task });
    };

    workers.forEach((worker) => {
      worker.on('message', (message) => {
        const task = worker.currentTask;
        completed += 1;
        summary.checkedFiles += 1;
        summary.verifiedBytes += task?.hashBytes || 0;

        if (message.error) {
          addFailure(summary, {
            relativePath: message.relativePath || task?.relativePath,
            ok: false,
            reason: message.error,
          });
        } else if (message.result?.ok) {
          summary.passedFiles += 1;
        } else {
          addFailure(summary, {
            ...message.result,
            reason: 'Hash mismatch.',
          });
        }

        onProgress?.({ ...summary, currentFile: task?.relativePath });
        assign(worker);
      });

      worker.on('error', (error) => {
        const task = worker.currentTask;
        completed += 1;
        summary.checkedFiles += 1;
        addFailure(summary, {
          relativePath: task?.relativePath,
          ok: false,
          reason: error?.message || 'Worker failed.',
        });
        onProgress?.({ ...summary, currentFile: task?.relativePath });
        assign(worker);
      });

      assign(worker);
    });
  });

  await Promise.allSettled(workers.map((worker) => worker.terminate()));
}

async function verifyCopy(options) {
  const mode = options.mode || 'off';
  if (mode === 'off') {
    return {
      mode,
      algorithm: 'none',
      skipped: true,
      reason: 'Verification disabled.',
    };
  }

  if (options.move) {
    return {
      mode,
      algorithm: 'none',
      skipped: true,
      reason: 'Post-copy verification is unavailable for move jobs because source files may be deleted.',
    };
  }

  const { files, totalBytes } = await scanFiles(options);
  options.onStarted?.({
    mode,
    totalFiles: files.length,
    totalBytes,
  });

  if (mode === 'fast') {
    return verifyFast({ files, totalBytes, onProgress: options.onProgress });
  }

  const summary = createSummary({
    mode,
    algorithm: 'xxhash64-wasm',
    files,
    totalBytes: files.reduce((total, file) => total + getHashBytes(file.size, mode), 0),
  });

  const tasks = await createHashTasks(files, mode, summary, options.onProgress);
  await runWorkerPool({
    tasks,
    workerCount: getWorkerCount(options.workerCount),
    summary,
    onProgress: options.onProgress,
  });

  summary.completedAt = Date.now();
  return summary;
}

module.exports = {
  verifyCopy,
};
