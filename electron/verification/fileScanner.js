const path = require('path');
const fs = require('fs/promises');

function parseExcludeText(text) {
  if (!text) return { dirs: [], files: [] };
  const parts = String(text)
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const dirs = [];
  const files = [];

  parts.forEach((entry) => {
    const lower = entry.toLowerCase();
    if (lower.startsWith('file:')) {
      files.push(entry.slice(5).trim());
      return;
    }
    if (lower.startsWith('dir:')) {
      dirs.push(entry.slice(4).trim());
      return;
    }
    if (entry.includes('.') || entry.includes('*') || entry.includes('?')) {
      files.push(entry);
    } else {
      dirs.push(entry);
    }
  });

  return { dirs, files };
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
}

function createMatcher(patterns) {
  const matchers = patterns
    .filter(Boolean)
    .map((pattern) => wildcardToRegExp(pattern));
  return (value) => matchers.some((matcher) => matcher.test(value));
}

async function scanFiles({ sourceRoot, destinationRoot, subdirMode, excludeText }) {
  const sourceBase = path.resolve(sourceRoot);
  const destinationBase = path.resolve(destinationRoot);
  const { dirs, files } = parseExcludeText(excludeText);
  const isExcludedDir = createMatcher(dirs);
  const isExcludedFile = createMatcher(files);
  const queue = [''];
  const manifest = [];
  let totalBytes = 0;

  while (queue.length > 0) {
    const relativeDir = queue.pop();
    const currentDir = path.join(sourceBase, relativeDir);
    let entries = [];

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        if (subdirMode !== 'none' && !isExcludedDir(entry.name) && !isExcludedDir(relativePath)) {
          queue.push(relativePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (isExcludedFile(entry.name) || isExcludedFile(relativePath)) continue;

      const sourcePath = path.join(sourceBase, relativePath);
      const destinationPath = path.join(destinationBase, relativePath);

      try {
        const stat = await fs.stat(sourcePath);
        manifest.push({
          relativePath,
          sourcePath,
          destinationPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
        totalBytes += stat.size;
      } catch {
        manifest.push({
          relativePath,
          sourcePath,
          destinationPath,
          size: 0,
          mtimeMs: 0,
          sourceUnreadable: true,
        });
      }
    }
  }

  return { files: manifest, totalBytes };
}

module.exports = {
  scanFiles,
};
