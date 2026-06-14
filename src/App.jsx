import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  CommandLineIcon,
  InformationCircleIcon,
  MinusIcon,
  MoonIcon,
  PlayIcon,
  ShieldCheckIcon,
  Square2StackIcon,
  SunIcon,
  XMarkIcon,
  FolderIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  BoltIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import Button from './components/Button.jsx';
import Panel from './components/Panel.jsx';
import Toggle from './components/Toggle.jsx';
import Select from './components/Select.jsx';
import ConsoleOutput from './components/ConsoleOutput.jsx';
import Spinner from './components/Spinner.jsx';
import StatusIndicator from './components/StatusIndicator.jsx';
import DropZone from './components/DropZone.jsx';
import { buildRobocopyArgs, buildRobocopyCommand, COPY_MODES } from './lib/robocopyCommand.js';

const INITIAL_PRESET = {
  source: '',
  destination: '',
  mirror: false,
  subdirMode: 'all',
  move: false,
  resume: true,
  threads: 8,
  retries: 3,
  wait: 5,
  logging: true,
  highSpeed: false,
  excludeText: '',
  copyMode: 'copy',
  verificationMode: 'balanced',
};

const PRESET_STORAGE_KEY = 'robocopy-gui-presets';

const HELP_ITEMS = [
  { title: 'Resume Transfers', flag: '/Z', desc: 'Restartable mode resumes interrupted copies.' },
  { title: 'Threads', flag: '/MT', desc: 'Runs multiple copy threads in parallel for speed.' },
  { title: 'Mirror Sync', flag: '/MIR', desc: 'Makes destination match source. Extra files are removed.' },
  { title: 'Subfolders', flag: '/E /S', desc: 'Include all subfolders or only non-empty ones.' },
  { title: 'Retries', flag: '/R /W', desc: 'How many times Robocopy retries locked files.' },
  { title: 'Logging', flag: '/LOG', desc: 'Writes a log file for every run.' },
  { title: 'Exclude Filters', flag: '/XD /XF', desc: 'Skip folders or files like node_modules or *.tmp.' },
  { title: 'High Speed', flag: '/NFL /NDL /NP', desc: 'Cuts console output for maximum throughput.' },
];

const VERIFICATION_MODES = [
  { value: 'off', label: 'Off - skip integrity checks' },
  { value: 'fast', label: 'Fast - size and modified time' },
  { value: 'balanced', label: 'Balanced - full small-file hash, sampled large-file hash' },
  { value: 'strict', label: 'Strict - full hash every file' },
];

function loadPresets() {
  const raw = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Calculating…';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function sanitizePath(input) {
  if (!input) return '';
  return input.replace(/^"+|"+$/g, '').replace(/[\\/]+$/, '');
}

function highlightLine(text) {
  if (/\*EXTRA Dir|\*EXTRA File/i.test(text)) {
    return { text, className: 'log-skip' };
  }
  if (/ERROR|Failed|denied|cannot/i.test(text)) {
    return { text, className: 'log-error' };
  }
  if (/\\/i.test(text) && /\s{2,}/.test(text)) {
    return { text, className: 'log-folder' };
  }
  if (/New File|Newer|Older|Same/i.test(text)) {
    return { text, className: 'log-success' };
  }
  return { text, className: '' };
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [source, setSource] = useState(INITIAL_PRESET.source);
  const [destination, setDestination] = useState(INITIAL_PRESET.destination);
  const [mirror, setMirror] = useState(INITIAL_PRESET.mirror);
  const [subdirMode, setSubdirMode] = useState(INITIAL_PRESET.subdirMode);
  const [move, setMove] = useState(INITIAL_PRESET.move);
  const [resume, setResume] = useState(INITIAL_PRESET.resume);
  const [threads, setThreads] = useState(INITIAL_PRESET.threads);
  const [retries, setRetries] = useState(INITIAL_PRESET.retries);
  const [wait, setWait] = useState(INITIAL_PRESET.wait);
  const [logging, setLogging] = useState(INITIAL_PRESET.logging);
  const [highSpeed, setHighSpeed] = useState(INITIAL_PRESET.highSpeed);
  const [excludeText, setExcludeText] = useState(INITIAL_PRESET.excludeText);
  const [copyMode, setCopyMode] = useState(INITIAL_PRESET.copyMode);
  const [verificationMode, setVerificationMode] = useState(INITIAL_PRESET.verificationMode);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState(() => loadPresets());
  const [selectedPreset, setSelectedPreset] = useState('');
  const [totalBytes, setTotalBytes] = useState(0);
  const [copiedBytes, setCopiedBytes] = useState(0);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [verificationSummary, setVerificationSummary] = useState(null);
  const [terminalTab, setTerminalTab] = useState('command');

  const totalBytesRef = useRef(0);
  const copiedBytesRef = useRef(0);
  const runStartedAtRef = useRef(null);
  const sourcePickerRef = useRef(null);
  const destinationPickerRef = useRef(null);
  const runTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (copyMode === 'sync') {
      setMirror(true);
      setSubdirMode('all');
    }
    if (copyMode === 'copy') {
      setMirror(false);
    }
  }, [copyMode]);

  useEffect(() => {
    if (!highSpeed) return;
    setResume(false);
    setLogging(false);
    setRetries(0);
    setWait(0);
    if (threads < 32) setThreads(32);
  }, [highSpeed, resume, logging, retries, wait, threads]);

  useEffect(() => {
    if (!loading) return undefined;
    if (!runStartedAtRef.current) runStartedAtRef.current = Date.now();

    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - runStartedAtRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [loading]);

  const command = useMemo(
    () =>
      buildRobocopyCommand({
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
      }),
    [
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
    ]
  );

  const robocopyArgs = useMemo(
    () =>
      buildRobocopyArgs({
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
      }),
    [
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
    ]
  );

  useEffect(() => {
    const handler = (event) => {
      if (event.target?.closest('input, textarea, select')) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'enter') {
        event.preventDefault();
        handleRun();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSavePreset();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleFolderPicker = async (setter, ref) => {
    if (window?.electron?.selectFolder) {
      const selected = await window.electron.selectFolder();
      if (selected) setter(sanitizePath(selected));
      return;
    }
    ref.current?.click();
  };

  const handleFolderChange = (event, setter) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const first = files[0];
    const name = first.path || first.webkitRelativePath?.split('/')[0] || first.name;
    if (name) setter(sanitizePath(name));
    event.target.value = '';
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const next = presets.filter((preset) => preset.name !== presetName.trim());
    next.push({
      name: presetName.trim(),
      data: {
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
        copyMode,
        verificationMode,
      },
    });
    setPresets(next);
    savePresets(next);
    setSelectedPreset(presetName.trim());
  };

  const handleLoadPreset = (value) => {
    setSelectedPreset(value);
    const preset = presets.find((item) => item.name === value);
    if (!preset) return;
    const data = preset.data || {};
    setSource(data.source ?? '');
    setDestination(data.destination ?? '');
    setMirror(Boolean(data.mirror));
    setSubdirMode(data.subdirMode ?? 'all');
    setMove(Boolean(data.move));
    setResume(Boolean(data.resume));
    setThreads(Number.isFinite(data.threads) ? data.threads : 8);
    setRetries(Number.isFinite(data.retries) ? data.retries : 3);
    setWait(Number.isFinite(data.wait) ? data.wait : 5);
    setLogging(Boolean(data.logging));
    setHighSpeed(Boolean(data.highSpeed));
    setExcludeText(data.excludeText ?? '');
    setCopyMode(data.copyMode ?? 'copy');
    setVerificationMode(data.verificationMode ?? 'balanced');
  };

  const simulateRun = () => {
    setStatus('running');
    setProgress(0);
    setLoading(true);
    setTerminalTab('output');
    setLogs([
      `Starting Robocopy session at ${new Date().toLocaleTimeString()}`,
      command,
    ]);

    let step = 0;
    if (runTimerRef.current) clearInterval(runTimerRef.current);
    runTimerRef.current = setInterval(() => {
      step += 1;
      setProgress(Math.min(100, step * 12));
      setLogs((prev) => [
        ...prev,
        `Copying batch ${step}...`,
        `Files processed: ${step * 42}`,
      ]);
      if (step >= 8) {
        clearInterval(runTimerRef.current);
        setStatus('completed');
        setLoading(false);
        setLogs((prev) => [...prev, 'Completed successfully.']);
      }
    }, 650);
  };

  const handleRun = async () => {
    if (loading) return;
    if (!source || !destination) {
      setStatus('error');
      setProgress(0);
      setLogs(['Please provide both Source and Destination folders.']);
      setTerminalTab('output');
      return;
    }

    setTerminalTab('output');
    if (window?.robocopy?.run) {
      setStatus('running');
      setProgress(0);
      setLoading(true);
      setLogs([
        command,
        highSpeed
          ? 'High-Speed Mode is active. Detailed live speed, ETA, and file tracking are suppressed by Robocopy for maximum throughput.'
          : 'Robocopy started. Live speed is calculated from transfer progress.',
      ]);
      setCopiedBytes(0);
      setTotalBytes(0);
      setSpeedBps(0);
      setEtaSeconds(null);
      setElapsedSeconds(0);
      setVerificationSummary(null);
      runStartedAtRef.current = Date.now();
      totalBytesRef.current = 0;
      copiedBytesRef.current = 0;

      if (!highSpeed && window?.robocopy?.getFolderSize) {
        setScanning(true);
        try {
          const size = await window.robocopy.getFolderSize(source);
          setTotalBytes(size);
          totalBytesRef.current = size;
          setLogs((prev) => [
            ...prev,
            size > 0 ? `Scan complete: ${formatBytes(size)}` : 'Scan complete: size unavailable.',
          ]);
        } catch {
          setTotalBytes(0);
          totalBytesRef.current = 0;
        } finally {
          setScanning(false);
        }
      }

      try {
        await window.robocopy.run({
          command,
          args: robocopyArgs,
          source,
          destination,
          subdirMode,
          excludeText,
          move,
          verificationMode,
          verificationThreads: Math.min(8, Math.max(2, threads)),
          onProgress: (nextProgress, line) => {
            if (line) {
              setLogs((prev) => [...prev, line]);
            }
            if (Number.isFinite(nextProgress) && totalBytesRef.current === 0) {
              setProgress(nextProgress);
              if (window?.robocopy?.setProgress) window.robocopy.setProgress(nextProgress / 100);
            }
          },
          onMetrics: (metrics) => {
            const nextCopiedBytes = Number(metrics?.copiedBytes);
            const nextSpeedBps = Number(metrics?.speedBps);

            if (Number.isFinite(nextCopiedBytes)) {
              copiedBytesRef.current = nextCopiedBytes;
              setCopiedBytes(nextCopiedBytes);
            }

            if (Number.isFinite(nextSpeedBps)) {
              setSpeedBps(nextSpeedBps);
            }

            if (totalBytesRef.current > 0 && Number.isFinite(nextCopiedBytes)) {
              const nextProgress = Math.min(100, Math.round((nextCopiedBytes / totalBytesRef.current) * 100));
              setProgress(nextProgress);
              if (window?.robocopy?.setProgress) window.robocopy.setProgress(nextProgress / 100);

              if (nextSpeedBps > 0) {
                setEtaSeconds(Math.max(0, Math.round((totalBytesRef.current - nextCopiedBytes) / nextSpeedBps)));
              }
            }
          },
          onVerification: (event) => {
            const summary = event?.summary;
            if (event?.type === 'started') {
              setStatus('verifying');
              setProgress(0);
              setVerificationSummary(summary);
              setLogs((prev) => [
                ...prev,
                `Verification started: ${summary.mode} mode, ${summary.totalFiles} files.`,
              ]);
              return;
            }

            if (event?.type === 'progress' && summary) {
              setStatus('verifying');
              setVerificationSummary(summary);
              const nextProgress =
                summary.totalBytes > 0
                  ? Math.min(100, Math.round((summary.verifiedBytes / summary.totalBytes) * 100))
                  : summary.totalFiles > 0
                    ? Math.min(100, Math.round((summary.checkedFiles / summary.totalFiles) * 100))
                    : 100;
              setProgress(nextProgress);
              if (window?.robocopy?.setProgress) window.robocopy.setProgress(nextProgress / 100);
              return;
            }

            if (event?.type === 'done' && summary) {
              setVerificationSummary(summary);
              if (summary.skipped) {
                setLogs((prev) => [...prev, `Verification skipped: ${summary.reason}`]);
              } else {
                setLogs((prev) => [
                  ...prev,
                  `Verification ${summary.failedFiles > 0 ? 'failed' : 'passed'}: ${summary.checkedFiles} checked, ${summary.failedFiles} failed.`,
                ]);
              }
              setProgress(100);
              return;
            }

            if (event?.type === 'error') {
              setLogs((prev) => [...prev, event.error?.message || 'Verification failed.']);
            }
          },
        });
        setProgress(100);
        if (window?.robocopy?.setProgress) window.robocopy.setProgress(1);
        setStatus('completed');
      } catch (error) {
        setStatus('error');
        setLogs((prev) => [...prev, error?.message || 'Run failed.']);
      } finally {
        setLoading(false);
        runStartedAtRef.current = null;
      }
      return;
    }

    simulateRun();
  };

  const highSpeedRunning = highSpeed && loading;
  const speedText = highSpeedRunning ? 'Optimized mode' : speedBps > 0 ? `${formatBytes(speedBps)}/s` : '—';
  const etaText = highSpeedRunning
    ? 'Unavailable in high-speed mode'
    : scanning
      ? 'Scanning...'
      : formatEta(etaSeconds);
  const copiedText = highSpeedRunning
    ? 'Tracking disabled for maximum speed'
    : `${formatBytes(copiedBytes)} / ${totalBytes ? formatBytes(totalBytes) : '—'}`;
  const highlightedLines = useMemo(() => logs.slice(-400).map(highlightLine), [logs]);

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#03050a]' : 'bg-[#0f172a]'} font-sans antialiased text-white/90`}>
      <div className="w-full h-full flex flex-col overflow-hidden bg-slate-950/10">
        
        {/* Custom Header / Titlebar */}
        <div className="border-b border-white/5 bg-black/45 px-6 py-4 flex items-center justify-between" style={{ WebkitAppRegion: 'drag' }}>
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]">
              R
            </div>
            <div>
              <h1 className="text-md font-semibold text-white tracking-tight flex items-center gap-1">
                <span className="font-extrabold text-blue-400">Robo</span>
                <span className="font-light text-slate-200">Copy</span>
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 ml-1 font-semibold">Pro</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              type="button"
              className="glass-btn px-3 py-1.5 text-xs text-white/80 hover:text-white"
              onClick={() => setHelpOpen(true)}
            >
              <InformationCircleIcon className="h-4 w-4" />
              Help
            </button>
            <button
              type="button"
              className="glass-btn px-3 py-1.5 text-xs text-white/80 hover:text-white"
              onClick={() => setDarkMode((prev) => !prev)}
            >
              {darkMode ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
              {darkMode ? 'Dark' : 'Light'}
            </button>
            
            <div className="window-controls flex items-center gap-1.5 ml-2 border border-white/5 bg-white/5 p-1 rounded-xl">
              <button
                type="button"
                className="window-btn flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition"
                onClick={() => window?.windowControls?.minimize()}
                aria-label="Minimize"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="window-btn flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition"
                onClick={() => window?.windowControls?.maximize()}
                aria-label="Maximize"
              >
                <Square2StackIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="window-btn flex h-7 w-7 items-center justify-center rounded-lg hover:bg-rose-500/25 text-white/60 hover:text-rose-200 transition"
                onClick={() => window?.windowControls?.close()}
                aria-label="Close"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] flex-grow min-h-0 overflow-hidden">
          
          {/* LEFT COLUMN: Input Control Zone */}
          <div className="p-6 space-y-5 bg-slate-950/20 border-r border-white/5 overflow-y-auto h-full scrollbar-thin">
            
            {/* Folders Section */}
            <div className="space-y-2.5">
              <div className="section-label">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FolderIcon className="h-3.5 w-3.5" />
                  Folders
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <DropZone
                  kind="source"
                  label="Source"
                  description="Files to copy from"
                  value={source}
                  onDropPath={(value) => setSource(sanitizePath(value))}
                  onBrowse={() => handleFolderPicker(setSource, sourcePickerRef)}
                />
                <DropZone
                  kind="destination"
                  label="Destination"
                  description="Where files land"
                  value={destination}
                  onDropPath={(value) => setDestination(sanitizePath(value))}
                  onBrowse={() => handleFolderPicker(setDestination, destinationPickerRef)}
                />
              </div>
            </div>

            {/* Operation Selector Toggle */}
            <div className="space-y-2">
              <div className="section-label">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  Operation
                </span>
              </div>
              <div className="grid grid-cols-2 bg-slate-950/60 border border-white/5 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMove(false)}
                  className={`py-2 px-3 rounded-lg text-center transition-all ${
                    !move
                      ? 'bg-blue-600/20 border border-blue-500/35 text-blue-200 shadow-sm'
                      : 'text-white/40 hover:text-white/70 border border-transparent'
                  }`}
                >
                  <p className="text-xs font-semibold">Copy</p>
                  <p className="text-[10px] opacity-70">Keeps originals in source</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMove(true)}
                  className={`py-2 px-3 rounded-lg text-center transition-all ${
                    move
                      ? 'bg-blue-600/20 border border-blue-500/35 text-blue-200 shadow-sm'
                      : 'text-white/40 hover:text-white/70 border border-transparent'
                  }`}
                >
                  <p className="text-xs font-semibold">Move</p>
                  <p className="text-[10px] opacity-70">Removes after copying</p>
                </button>
              </div>
            </div>

            {/* Copy Settings */}
            <div className="space-y-2">
              <div className="section-label">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                  Copy Settings
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Copy Mode"
                  value={copyMode}
                  onChange={setCopyMode}
                  options={COPY_MODES.map((mode) => ({
                    value: mode.id,
                    label: mode.label,
                  }))}
                />
                <Select
                  label="Verification"
                  value={verificationMode}
                  onChange={setVerificationMode}
                  options={VERIFICATION_MODES.map((mode) => ({
                    value: mode.value,
                    label: mode.value === 'off' ? 'Disabled' : mode.value.charAt(0).toUpperCase() + mode.value.slice(1),
                  }))}
                />
              </div>
            </div>

            {/* Options Toggle Grid */}
            <div className="space-y-2">
              <div className="section-label">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <BoltIcon className="h-3.5 w-3.5" />
                  Options
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Toggle
                  label="High-Speed Mode"
                  description="Disable logging & resume"
                  checked={highSpeed}
                  onChange={setHighSpeed}
                />
                <Toggle
                  label="Mirror Mode"
                  description="Deletes extra destination files"
                  checked={mirror}
                  onChange={setMirror}
                />
                <Toggle
                  label="Resume Transfers"
                  description="Support paused copies (/Z)"
                  checked={resume}
                  onChange={setResume}
                />
                <Toggle
                  label="Enable Logging"
                  description="Generate file copy log"
                  checked={logging}
                  onChange={setLogging}
                />
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="space-y-2">
              <button
                type="button"
                className="glass-btn w-full justify-between text-xs py-2 px-3 focus-glow hover:bg-white/5 transition"
                onClick={() => setAdvancedOpen((prev) => !prev)}
              >
                <span className="font-semibold flex items-center gap-2">
                  <CpuChipIcon className="h-4 w-4 text-blue-400" />
                  Advanced Settings
                </span>
                <span className="text-white/40 font-bold">{advancedOpen ? '−' : '+'}</span>
              </button>
              {advancedOpen && (
                <div className="grid gap-3 grid-cols-2 p-1.5 bg-black/15 rounded-xl border border-white/5 animate-fadeIn">
                  <div className="crystal-item squircle flex flex-col gap-1 p-3">
                    <label className="text-xs font-semibold text-white/80">Threads</label>
                    <input
                      type="number"
                      min="1"
                      max="128"
                      className="glass-input py-1 px-2.5 text-xs"
                      value={threads}
                      onChange={(event) => setThreads(Number(event.target.value))}
                    />
                    <p className="text-[10px] text-white/40">Parallel speed threads</p>
                  </div>
                  <div className="crystal-item squircle flex flex-col gap-1 p-3">
                    <label className="text-xs font-semibold text-white/80">Retries</label>
                    <input
                      type="number"
                      min="0"
                      className="glass-input py-1 px-2.5 text-xs"
                      value={retries}
                      onChange={(event) => setRetries(Number(event.target.value))}
                    />
                    <p className="text-[10px] text-white/40">Retry count on lock</p>
                  </div>
                  <div className="crystal-item squircle flex flex-col gap-1 p-3">
                    <label className="text-xs font-semibold text-white/80">Retry Wait (sec)</label>
                    <input
                      type="number"
                      min="0"
                      className="glass-input py-1 px-2.5 text-xs"
                      value={wait}
                      onChange={(event) => setWait(Number(event.target.value))}
                    />
                    <p className="text-[10px] text-white/40">Retry delay seconds</p>
                  </div>
                  <div className="crystal-item squircle flex flex-col gap-1 p-3">
                    <label className="text-xs font-semibold text-white/80">Ignore Filters</label>
                    <input
                      className="glass-input py-1 px-2.5 text-xs"
                      placeholder="node_modules, *.tmp"
                      value={excludeText}
                      onChange={(event) => setExcludeText(event.target.value)}
                    />
                    <p className="text-[10px] text-white/40">Exclude list names</p>
                  </div>
                </div>
              )}
            </div>

            {/* Presets Manager */}
            <div className="crystal-shell p-4 rounded-2xl border border-white/5 bg-slate-950/15">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  Presets
                </span>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="glass-btn text-[10px] px-2.5 py-1 flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-40"
                >
                  <ArrowDownTrayIcon className="h-3 w-3" />
                  Save Preset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-white/50 block mb-1">Preset Name</label>
                  <input
                    className="glass-input py-1.5 px-2.5 text-xs"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="e.g. Daily Backup"
                  />
                </div>
                <Select
                  label="Load Preset"
                  value={selectedPreset}
                  onChange={handleLoadPreset}
                  options={[
                    { label: 'Select Preset', value: '' },
                    ...presets.map((preset) => ({
                      value: preset.name,
                      label: preset.name,
                    })),
                  ]}
                />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Output & Execution Zone */}
          <div className="p-6 bg-slate-950/45 border-l border-white/5 flex flex-col justify-between space-y-6 overflow-y-auto h-full scrollbar-thin min-h-0">
            
            {/* Terminal Preview & Output Logs */}
            <div className="flex-grow flex flex-col min-h-[300px]">
              <div className="section-label mb-2">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CommandLineIcon className="h-3.5 w-3.5" />
                  Command Preview & Logs
                </span>
              </div>
              
              <div className="terminal-wrap bg-slate-950/65 border border-white/5 rounded-2xl overflow-hidden flex flex-col flex-grow">
                {/* Tab Header bar */}
                <div className="terminal-header bg-black/40 border-b border-white/5 px-4 py-2 flex items-center justify-between">
                  <div className="terminal-title text-[10px] font-semibold text-white/45 flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span>{terminalTab === 'command' ? 'ROBOCOPY.EXE COMMAND' : 'LIVE OUTPUT LOGS'}</span>
                  </div>
                  <div className="flex bg-slate-900 border border-white/5 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setTerminalTab('command')}
                      className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                        terminalTab === 'command'
                          ? 'bg-blue-600/25 text-blue-200 shadow-sm border border-blue-500/20'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      Command
                    </button>
                    <button
                      type="button"
                      onClick={() => setTerminalTab('output')}
                      className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                        terminalTab === 'output'
                          ? 'bg-blue-600/25 text-blue-200 shadow-sm border border-blue-500/20'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      Output
                    </button>
                  </div>
                </div>
                
                {/* Terminal Body */}
                <div className="terminal-body p-4 font-mono text-xs flex-grow overflow-y-auto max-h-[360px] min-h-[200px] bg-slate-950/40">
                  {terminalTab === 'command' ? (
                    <div className="cmd-line text-blue-400 break-all leading-relaxed">
                      <span className="text-white/20 select-none mr-2">&gt;</span>{command}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {logs.length === 0 ? (
                        <p className="text-white/30 italic text-center py-12">Waiting for Robocopy execution...</p>
                      ) : (
                        highlightedLines.map((line, idx) => (
                          <p key={idx} className={`leading-relaxed whitespace-pre-wrap break-all ${line.className || ''}`}>
                            {line.text}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Run & Progress Dashboard */}
            <div className="space-y-4">
              <div className="section-label">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <PlayIcon className="h-3.5 w-3.5" />
                  Execution & Progress
                </span>
              </div>
              
              <div className="crystal-shell p-5 rounded-2xl border border-white/5 space-y-4 bg-slate-950/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/50">Current Status</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : status === 'running'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                        : status === 'verifying'
                          ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse'
                          : status === 'error'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-white/5 text-white/40 border border-white/5'
                  }`}>
                    ● {status}
                  </span>
                </div>
                
                {/* Thin progress bar */}
                <div className="space-y-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    {scanning ? (
                      <div className="h-1.5 w-1/3 animate-pulse rounded-full bg-blue-500/70" />
                    ) : (
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 bg-gradient-to-r ${
                          status === 'completed'
                            ? 'from-emerald-500 to-teal-400'
                            : status === 'error'
                              ? 'from-rose-500 to-red-400'
                              : 'from-blue-600 via-indigo-600 to-violet-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40 font-medium">
                    <span>{scanning ? 'Scanning directories...' : `${progress}% complete`}</span>
                    <span>{highSpeedRunning ? 'High-Speed metrics hidden' : copiedText}</span>
                  </div>
                </div>
                
                {/* Mode chips / metadata */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-white/60 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-white/40">Mode:</span>
                    <span className="font-semibold text-white/80">{move ? 'Move' : 'Copy'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-white/40">Speed:</span>
                    <span className="font-semibold text-white/80">{speedText}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-white/40">ETA:</span>
                    <span className="font-semibold text-white/80">{etaText}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-white/40">Verification:</span>
                    <span className="font-semibold text-white/80">
                      {verificationSummary?.skipped
                        ? 'Skipped'
                        : verificationSummary
                          ? `${verificationSummary.checkedFiles}/${verificationSummary.totalFiles}`
                          : verificationMode === 'off'
                            ? 'Off'
                            : verificationMode.charAt(0).toUpperCase() + verificationMode.slice(1)}
                    </span>
                  </div>
                </div>

                {verificationSummary && !verificationSummary.skipped && verificationSummary.failedFiles > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-xs text-rose-300 flex items-center justify-between">
                    <span>Integrity Failures:</span>
                    <span className="font-bold">{verificationSummary.failedFiles}</span>
                  </div>
                )}
                
                {/* Big full-width Run Button */}
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-300 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white border border-white/10 shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? (
                    <Spinner />
                  ) : (
                    <PlayIcon className="h-4 w-4" />
                  )}
                  {loading ? 'Executing Robocopy...' : 'Run Robocopy'}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Hidden file pickers */}
      <input
        ref={sourcePickerRef}
        type="file"
        className="hidden"
        webkitdirectory="true"
        directory="true"
        onChange={(event) => handleFolderChange(event, setSource)}
      />
      <input
        ref={destinationPickerRef}
        type="file"
        className="hidden"
        webkitdirectory="true"
        directory="true"
        onChange={(event) => handleFolderChange(event, setDestination)}
      />

      {/* Help Overlay Drawer */}
      {helpOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setHelpOpen(false)}
          />
          <div className="absolute right-4 top-4 bottom-4 w-full max-w-md">
            <div className="crystal-shell squircle h-full overflow-hidden p-6 border border-white/10 bg-slate-950/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2rem] text-blue-400 font-bold">Help Guide</p>
                  <h2 className="text-lg font-semibold text-white">Robocopy Quick Tips</h2>
                </div>
                <button type="button" className="glass-btn px-2.5 py-1.5" onClick={() => setHelpOpen(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-6 space-y-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100% - 80px)' }}>
                {HELP_ITEMS.map((item) => (
                  <div key={item.title} className="crystal-item squircle p-4 border border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <span className="glass-pill text-[10px] px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">{item.flag}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
