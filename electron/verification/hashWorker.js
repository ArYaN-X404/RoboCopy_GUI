const fs = require('fs');
const { parentPort } = require('worker_threads');
const xxhash = require('xxhash-wasm');

const MB = 1024 * 1024;
const LARGE_FILE_THRESHOLD = 1024 * MB;
const SAMPLE_SIZE = 32 * MB;

let xxhashApiPromise = null;

function getHashApi() {
  if (!xxhashApiPromise) xxhashApiPromise = xxhash();
  return xxhashApiPromise;
}

function toHex(value) {
  return value.toString(16).padStart(16, '0');
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

async function hashFile(filePath, ranges) {
  const { create64 } = await getHashApi();
  const hasher = create64();
  let bytesRead = 0;

  for (const range of ranges) {
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        start: range.start,
        end: range.end,
        highWaterMark: 1024 * 1024,
      });

      stream.on('data', (chunk) => {
        bytesRead += chunk.length;
        hasher.update(chunk);
      });
      stream.on('error', reject);
      stream.on('end', resolve);
    });
  }

  return {
    hash: toHex(hasher.digest()),
    bytesRead,
  };
}

async function verifyHashTask(task) {
  const ranges = getRanges(task.size, task.mode);
  const [source, destination] = await Promise.all([
    hashFile(task.sourcePath, ranges),
    hashFile(task.destinationPath, ranges),
  ]);

  return {
    relativePath: task.relativePath,
    ok: source.hash === destination.hash,
    sourceHash: source.hash,
    destinationHash: destination.hash,
    bytesRead: source.bytesRead + destination.bytesRead,
    algorithm: 'xxhash64-wasm',
    sampled: task.mode === 'balanced' && task.size > LARGE_FILE_THRESHOLD,
  };
}

parentPort.on('message', async (message) => {
  if (!message || message.type !== 'verify') return;

  try {
    const result = await verifyHashTask(message.task);
    parentPort.postMessage({ id: message.id, result });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      error: error?.message || 'Hash worker failed.',
      relativePath: message.task?.relativePath,
    });
  }
});
