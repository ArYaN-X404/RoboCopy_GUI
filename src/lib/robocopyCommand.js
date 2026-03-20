export const COPY_MODES = [
  { id: 'copy', label: 'Copy', description: 'Standard copy without deletes.' },
  { id: 'sync', label: 'Sync', description: 'Mirror source and destination.' },
  { id: 'custom', label: 'Custom', description: 'Use the toggles below.' },
];

function parseExcludeText(text) {
  if (!text) return { dirs: [], files: [] };
  const parts = text
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
    if (entry.includes('.')) {
      files.push(entry);
    } else {
      dirs.push(entry);
    }
  });

  return { dirs, files };
}

export function buildRobocopyArgs({
  source,
  destination,
  mirror,
  subdirMode,
  move,
  resume,
  threads,
  retries,
  wait,
  logging,
  highSpeed,
  excludeText,
}) {
  const args = [];

  if (source) args.push(source);
  if (destination) args.push(destination);

  if (mirror) args.push('/MIR');
  if (subdirMode === 'all') args.push('/E');
  if (subdirMode === 'non-empty') args.push('/S');
  if (move) args.push('/MOVE');
  if (resume && !highSpeed) args.push('/Z');
  args.push('/BYTES');
  if (Number.isFinite(threads) && threads > 0) args.push(`/MT:${threads}`);
  if (Number.isFinite(retries)) args.push(`/R:${retries}`);
  if (Number.isFinite(wait)) args.push(`/W:${wait}`);
  if (logging && !highSpeed) args.push('/LOG:robocopy.log', '/TEE');

  if (highSpeed) {
    args.push('/NFL', '/NDL', '/NP');
  }

  const { dirs, files } = parseExcludeText(excludeText);
  if (dirs.length > 0) args.push('/XD', ...dirs);
  if (files.length > 0) args.push('/XF', ...files);

  return args;
}

export function buildRobocopyCommand(options) {
  const safeSource = options.source ? `"${options.source}"` : '"<source>"';
  const safeDestination = options.destination ? `"${options.destination}"` : '"<destination>"';
  const args = buildRobocopyArgs(options);
  const flags = args.slice(2);

  return ['robocopy', safeSource, safeDestination, ...flags].join(' ');
}
