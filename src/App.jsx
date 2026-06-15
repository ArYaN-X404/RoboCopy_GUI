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

function SectionHeader({ label, icon: Icon, theme = 'blue' }) {
  const themes = {
    blue: 'si-blue',
    green: 'si-green',
    amber: 'si-amber',
    purple: 'si-purple',
    slate: 'bg-white/5 text-white/40',
  };
  const themeClass = themes[theme] || themes.blue;

  return (
    <div className="sec-head select-none">
      <div className={`sec-icon ${themeClass}`}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="sec-label">{label}</span>
      <div className="sec-line"></div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState('general');
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
    <div className={`h-screen w-screen overflow-hidden flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#0d0f18]' : 'bg-[#0f172a]'} font-sans antialiased text-white/90`}>
      <div className="w-full h-full flex flex-col overflow-hidden bg-slate-950/10">
        
        {/* Custom Header / Titlebar */}
        <div className="border-b border-[#1e2235] bg-[#080a10]/80 backdrop-blur-md sticky top-0 z-50 h-[48px] px-6 flex items-center justify-between flex-shrink-0 relative" style={{ WebkitAppRegion: 'drag' }}>
          
          {/* Bottom Gradient Border Line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 opacity-45" />

          <div className="logo" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="logo-avatar">R</div>
            <div className="logo-name"><b>Robo</b>Copy</div>
            <div className="pro-badge">PRO</div>
          </div>

          {/* Centered System Status Pill */}
          <div className="nav-status-pill" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className={`nsp-dot ${status === 'running' ? 'running' : status === 'verifying' ? 'running' : status === 'completed' ? 'active' : ''}`} />
            <span className="nsp-text">Status: <b>{status.toUpperCase()}</b></span>
            <span className="nsp-divider">|</span>
            <span className="nsp-text">Mode: <b>{move ? 'MOVE' : 'COPY'}</b></span>
            <span className="nsp-divider">|</span>
            <span className="nsp-text">Threads: <b>{threads}</b></span>
          </div>
          
          <div className="tb-right" style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              type="button"
              className="tb-btn tb-btn-help"
              onClick={() => setHelpOpen(true)}
            >
              <InformationCircleIcon className="h-3.5 w-3.5" />
              <span>Help</span>
            </button>
            <button
              type="button"
              className="tb-btn tb-btn-theme"
              onClick={() => setDarkMode((prev) => !prev)}
            >
              {darkMode ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
              <span>{darkMode ? 'Dark' : 'Light'}</span>
            </button>
            
            <div className="win-btns">
              <button
                type="button"
                className="win-btn"
                onClick={() => window?.windowControls?.minimize()}
                aria-label="Minimize"
              >
                <MinusIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="win-btn"
                onClick={() => window?.windowControls?.maximize()}
                aria-label="Maximize"
              >
                <Square2StackIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="win-btn win-btn-close"
                onClick={() => window?.windowControls?.close()}
                aria-label="Close"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] flex-grow min-h-0 overflow-hidden bg-[#0d0f18]">
          
          {/* LEFT COLUMN: Input Control Zone */}
          <div className="p-6 space-y-6 bg-transparent border-r border-[#1a1d2e] overflow-y-auto h-full scrollbar-thin">
            
            {/* Folders Section */}
            <div className="space-y-3">
              <SectionHeader label="Folders" icon={FolderIcon} theme="blue" />
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
            <div className="space-y-3">
              <SectionHeader label="Operation" icon={ArrowPathIcon} theme="green" />
              <div className="op-toggle">
                <button
                  type="button"
                  onClick={() => setMove(false)}
                  className={`op-opt ${!move ? 'active' : ''}`}
                >
                  <div className="op-dot" />
                  <div className="text-left">
                    <p className="op-name">Copy</p>
                    <p className="op-desc">Keeps originals in source</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMove(true)}
                  className={`op-opt ${move ? 'active' : ''}`}
                >
                  <div className="op-dot" />
                  <div className="text-left">
                    <p className="op-name">Move</p>
                    <p className="op-desc">Removes after copying</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Copy Settings */}
            <div className="space-y-3">
              <SectionHeader label="Copy Settings" icon={Cog6ToothIcon} theme="amber" />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Copy Mode"
                  value={copyMode}
                  onChange={setCopyMode}
                  options={COPY_MODES.map((mode) => ({
                    value: mode.id,
                    label: mode.label,
                  }))}
                  icon={FolderIcon}
                />
                <Select
                  label="Verification"
                  value={verificationMode}
                  onChange={setVerificationMode}
                  options={VERIFICATION_MODES.map((mode) => ({
                    value: mode.value,
                    label: mode.value === 'off' ? 'Disabled' : mode.value.charAt(0).toUpperCase() + mode.value.slice(1),
                  }))}
                  icon={ShieldCheckIcon}
                />
              </div>
            </div>

            {/* Options Toggle Grid */}
            <div className="space-y-3">
              <SectionHeader label="Options" icon={BoltIcon} theme="purple" />
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
            <div className="space-y-3">
              <button
                type="button"
                className="adv-btn"
                onClick={() => setAdvancedOpen((prev) => !prev)}
              >
                <CpuChipIcon className="h-4 w-4 text-slate-400" />
                <span>Advanced Settings</span>
                <span className="ml-auto text-slate-400 font-bold">{advancedOpen ? '−' : '+'}</span>
              </button>
              {advancedOpen && (
                <div className="grid gap-3 grid-cols-2 p-1.5 bg-[#0a0c14]/50 rounded-xl border border-[#1e2235]/40 animate-fadeIn">
                  <div className="tog-card flex flex-col items-start gap-1 p-3">
                    <label className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wider">Threads</label>
                    <input
                      type="number"
                      min="1"
                      max="128"
                      className="glass-input py-1 px-2.5 text-xs bg-[#0d0f1a] border border-[#1e2235] rounded-md focus:border-blue-500/50"
                      value={threads}
                      onChange={(event) => setThreads(Number(event.target.value))}
                    />
                    <p className="text-[12px] text-slate-400">Parallel speed threads</p>
                  </div>
                  <div className="tog-card flex flex-col items-start gap-1 p-3">
                    <label className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wider">Retries</label>
                    <input
                      type="number"
                      min="0"
                      className="glass-input py-1 px-2.5 text-xs bg-[#0d0f1a] border border-[#1e2235] rounded-md focus:border-blue-500/50"
                      value={retries}
                      onChange={(event) => setRetries(Number(event.target.value))}
                    />
                    <p className="text-[12px] text-slate-400">Retry count on lock</p>
                  </div>
                  <div className="tog-card flex flex-col items-start gap-1 p-3">
                    <label className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wider">Retry Wait (sec)</label>
                    <input
                      type="number"
                      min="0"
                      className="glass-input py-1 px-2.5 text-xs bg-[#0d0f1a] border border-[#1e2235] rounded-md focus:border-blue-500/50"
                      value={wait}
                      onChange={(event) => setWait(Number(event.target.value))}
                    />
                    <p className="text-[12px] text-slate-400">Retry delay seconds</p>
                  </div>
                  <div className="tog-card flex flex-col items-start gap-1 p-3">
                    <label className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wider">Ignore Filters</label>
                    <input
                      className="glass-input py-1 px-2.5 text-xs bg-[#0d0f1a] border border-[#1e2235] rounded-md focus:border-blue-500/50"
                      placeholder="node_modules, *.tmp"
                      value={excludeText}
                      onChange={(event) => setExcludeText(event.target.value)}
                    />
                    <p className="text-[12px] text-slate-400">Exclude list names</p>
                  </div>
                </div>
              )}
            </div>

            {/* Presets Manager */}
            <div className="folder-card p-4 rounded-xl border border-[#1e2235] bg-[#111420]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  Presets
                </span>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="browse-btn !w-auto text-[10px] px-3 py-1.5 flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ArrowDownTrayIcon className="h-3 w-3" />
                  Save Preset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wider block">Preset Name</label>
                  <input
                    className="glass-input py-1.5 px-2.5 text-xs bg-[#0d0f1a] border border-[#1e2235] rounded-md focus:border-blue-500/50 w-full"
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
                  icon={ArrowDownTrayIcon}
                />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Output & Execution Zone */}
          <div className="p-6 bg-[#080a10] border-l border-[#1a1d2e] flex flex-col justify-between space-y-6 overflow-y-auto h-full scrollbar-thin min-h-0">
            
            {/* Terminal Preview & Output Logs */}
            <div className="flex-grow flex flex-col min-h-[300px]">
              <SectionHeader label="Command Preview & Logs" icon={CommandLineIcon} theme="blue" />
              
              <div className="cmd-box flex flex-col flex-grow">
                {/* Tab Header bar */}
                <div className="cmd-topbar">
                  <div className="cmd-title">
                    <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span>{terminalTab === 'command' ? 'ROBOCOPY.EXE' : 'OUTPUT'}</span>
                  </div>
                  <div className="cmd-tabs">
                    <button
                      type="button"
                      onClick={() => setTerminalTab('command')}
                      className={`ctab ${terminalTab === 'command' ? 'active' : ''}`}
                    >
                      Command
                    </button>
                    <button
                      type="button"
                      onClick={() => setTerminalTab('output')}
                      className={`ctab ${terminalTab === 'output' ? 'active' : ''}`}
                    >
                      Output
                    </button>
                  </div>
                </div>
                
                {/* Terminal Body */}
                <div className="cmd-body flex-grow overflow-y-auto max-h-[360px] min-h-[200px] bg-[#06080e]">
                  {terminalTab === 'command' ? (
                    <div className="leading-relaxed whitespace-pre-wrap break-all">
                      <span className="cmd-prompt">&gt;</span>
                      <span className="cmd-text">robocopy </span>
                      <span className="cmd-arg">
                        "{source || '<source>'}" "{destination || '<dest>'}"{" "}
                      </span>
                      {robocopyArgs
                        .filter((arg) => arg !== source && arg !== destination)
                        .map((arg, idx) => {
                          const isFlag = arg.startsWith('/');
                          return (
                            <span key={idx} className={isFlag ? 'cmd-flag' : 'cmd-arg'}>
                              {arg}{' '}
                            </span>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {logs.length === 0 ? (
                        <div className="cmd-waiting">No output log yet — run a session to see live details</div>
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
              <SectionHeader label="Execution & Progress" icon={PlayIcon} theme="purple" />
              
              <div className="progress-card border border-[#1e2235] space-y-4 bg-[#111420]">
                <div className="prog-header">
                  <div className="prog-title">
                    <CommandLineIcon className="h-4 w-4 text-slate-500" />
                    <span>Current Status</span>
                  </div>
                  <div className={`idle-pill font-bold uppercase tracking-wider text-[9px] ${
                    status === 'completed'
                      ? '!bg-emerald-500/10 !text-emerald-400 border border-emerald-500/20'
                      : status === 'running'
                        ? '!bg-blue-500/10 !text-blue-400 border border-blue-500/20 animate-pulse'
                        : status === 'verifying'
                          ? '!bg-violet-500/10 !text-violet-400 border border-violet-500/20 animate-pulse'
                          : status === 'error'
                            ? '!bg-rose-500/10 !text-rose-400 border border-rose-500/20'
                            : ''
                  }`}>
                    ● {status}
                  </div>
                </div>
                
                <div className="prog-body">
                  <div className="prog-pct">
                    {scanning ? '—' : `${progress}`}
                    <span>%</span>
                  </div>
                  
                  {/* Progress bar track */}
                  <div className="prog-bar-track">
                    {scanning ? (
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500/70" />
                    ) : (
                      <div
                        className={`prog-bar-fill transition-all duration-500 ${
                          status === 'completed'
                            ? '!bg-emerald-500'
                            : status === 'error'
                              ? '!bg-rose-500'
                              : '!bg-blue-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </div>
                  
                  {/* Metadata labels */}
                  <div className="prog-meta-grid">
                    <div className="pmeta">
                      <div className="pmeta-label">Mode</div>
                      <div className="pmeta-val">{move ? 'Move' : 'Copy'}</div>
                    </div>
                    <div className="pmeta">
                      <div className="pmeta-label">Speed</div>
                      <div className="pmeta-val">{speedText}</div>
                    </div>
                    <div className="pmeta">
                      <div className="pmeta-label">ETA</div>
                      <div className="pmeta-val">{etaText}</div>
                    </div>
                    <div className="pmeta">
                      <div className="pmeta-label">Verification</div>
                      <div className="pmeta-val">
                        {verificationSummary?.skipped
                          ? 'Skipped'
                          : verificationSummary
                            ? `${verificationSummary.checkedFiles}/${verificationSummary.totalFiles}`
                            : verificationMode === 'off'
                              ? 'Off'
                              : verificationMode.charAt(0).toUpperCase() + verificationMode.slice(1)}
                      </div>
                    </div>
                  </div>

                  {verificationSummary && !verificationSummary.skipped && verificationSummary.failedFiles > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 text-xs text-rose-300 flex items-center justify-between mb-4">
                      <span>Integrity Failures:</span>
                      <span className="font-bold">{verificationSummary.failedFiles}</span>
                    </div>
                  )}
                  
                  {/* Run Button */}
                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={loading}
                    className="run-btn active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <Spinner />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                    <span>{loading ? 'Executing Robocopy...' : 'Run Robocopy'}</span>
                  </button>
                  
                  <div className="run-footer">
                    <div className="mode-chip">
                      <div className={`chip-dot ${move ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <span>{move ? 'Move mode' : 'Copy mode'}</span>
                    </div>
                    <div className="mode-chip">
                      <div className={`chip-dot ${verificationMode !== 'off' ? 'chip-dot-g' : 'bg-slate-700'}`} />
                      <span>{verificationMode !== 'off' ? 'Verified' : 'Unverified'}</span>
                    </div>
                    <button type="button" className="hide-log-btn hover:text-slate-400">
                      <InformationCircleIcon className="h-3 w-3" />
                      <span>Robocopy Pro</span>
                    </button>
                  </div>
                </div>
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
            <div className="folder-card h-full overflow-hidden p-6 bg-[#0c0f1b]/98 border border-[#1e2235] shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col">
              
              {/* Drawer Header */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2rem] text-blue-400 font-bold">Help Guide</p>
                    <h2 className="text-lg font-bold text-white mt-0.5">Quick Reference</h2>
                  </div>
                  <button 
                    type="button" 
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-slate-800 transition-all" 
                    onClick={() => setHelpOpen(false)}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Tab Selector */}
                <div className="flex bg-[#07090f] border border-[#1e2235] rounded-lg p-0.5 mt-4">
                  <button
                    type="button"
                    onClick={() => setHelpTab('general')}
                    className={`text-[12.5px] flex-1 text-center py-2 rounded-md font-bold transition-all ${
                      helpTab === 'general'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    General Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpTab('verification')}
                    className={`text-[12.5px] flex-1 text-center py-2 rounded-md font-bold transition-all ${
                      helpTab === 'verification'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpTab('flags')}
                    className={`text-[12.5px] flex-1 text-center py-2 rounded-md font-bold transition-all ${
                      helpTab === 'flags'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    CLI & Toggles
                  </button>
                </div>
              </div>

              {/* Scrollable Tab Content */}
              <div className="mt-5 space-y-4 overflow-y-auto pr-1 flex-1 min-h-0 scrollbar-thin">
                {helpTab === 'general' && (
                  <div className="space-y-4">
                    {/* Header Summary */}
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                      <p className="text-[13px] text-blue-200 leading-relaxed font-medium">
                        Configure how files are copied and whether old or extra destination files are updated or removed.
                      </p>
                    </div>

                    {/* Section 1: Transfer Mode */}
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">1. Transfer Actions</h3>
                      <div className="space-y-3">
                        <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-white">Copy (Standard)</span>
                            <span className="text-[10.5px] font-semibold uppercase tracking-wide px-2.5 py-0.75 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">Safe</span>
                          </div>
                          <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                            Transfers files to the destination. Leaves all source files completely untouched. <b>Best for standard backups.</b>
                          </p>
                        </div>

                        <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-white">Move Files</span>
                            <span className="text-[10.5px] font-semibold uppercase tracking-wide px-2.5 py-0.75 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25">Move & Delete</span>
                          </div>
                          <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                            Copies files to destination, verifies integrity, then deletes the original source files. <b>Best for reclaiming drive space.</b>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Sync Mode */}
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">2. Destination Sync Modes</h3>
                      <div className="space-y-3">
                        <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-white">Copy — no deletes</span>
                            <span className="text-[10.5px] font-semibold uppercase tracking-wide px-2.5 py-0.75 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25">Safe Copy</span>
                          </div>
                          <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                            Transfers new and updated files. Files already in the destination that are not in the source are kept safe and untouched.
                          </p>
                        </div>

                        <div className="p-5 rounded-xl bg-[#161b30] border border-rose-500/30 hover:border-rose-500/45 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-rose-200">Mirror destination</span>
                            <span className="text-[10.5px] font-semibold uppercase tracking-wide px-2.5 py-0.75 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/25">Destructive Clone</span>
                          </div>
                          <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                            Forces destination folder to match source exactly. <b>Warning:</b> Any extra files in destination will be permanently deleted!
                          </p>
                        </div>

                        <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-white">Update only</span>
                            <span className="text-[10.5px] font-semibold uppercase tracking-wide px-2.5 py-0.75 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/25">Incremental Update</span>
                          </div>
                          <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                            Only copies files that already exist in destination and are older than source counterparts. Never adds new files.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {helpTab === 'verification' && (
                  <div className="space-y-4">
                    {/* Header Summary */}
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <p className="text-[13px] text-amber-200 leading-relaxed font-semibold">
                        🛡️ Hashing ensures that your copied files are 100% identical to the source with no byte corruption.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Verification Options</h3>

                      {/* Mode 1 */}
                      <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold text-slate-300">Disabled (Off)</span>
                          <div className="flex gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-slate-500/15 text-slate-300 border border-slate-500/20">Safety: None</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Speed: Max</span>
                          </div>
                        </div>
                        <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                          Skips checksum checks entirely. Fast, but provides no integrity checks. Use only for non-critical, local files.
                        </p>
                      </div>

                      {/* Mode 2 */}
                      <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold text-blue-300">Fast Verification</span>
                          <div className="flex gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">Safety: Basic</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Speed: Fast</span>
                          </div>
                        </div>
                        <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                          Compares file size and last-modified dates. Instant check, but cannot detect internal content/byte corruption.
                        </p>
                      </div>

                      {/* Mode 3 */}
                      <div className="p-5 rounded-xl bg-[#161b30] border border-blue-500/40 shadow-[0_4px_20px_rgba(59,130,246,0.08)] hover:border-blue-500/60 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold text-emerald-300 flex items-center gap-1.5">
                            Balanced <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">RECOMMENDED</span>
                          </span>
                          <div className="flex gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">Safety: High</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">Speed: Smart</span>
                          </div>
                        </div>
                        <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                          Checks timestamps/sizes, hashes small files completely, and block-samples large files. <b>Highly recommended</b> for general copies.
                        </p>
                      </div>

                      {/* Mode 4 */}
                      <div className="p-5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold text-purple-300">Strict Verification</span>
                          <div className="flex gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20">Safety: 100%</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.75 rounded bg-rose-500/15 text-rose-300 border border-rose-500/20">Speed: Heavy</span>
                          </div>
                        </div>
                        <p className="text-[13px] text-[#e0f2fe] leading-relaxed">
                          Performs full SHA-256 integrity checks on every single file. Guarantees absolute correctness but increases CPU/disk load.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {helpTab === 'flags' && (
                  <div className="space-y-4">
                    {/* Header Summary */}
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                      <p className="text-[13.5px] text-indigo-200 leading-relaxed font-semibold">
                        RoboCopy Pro maps GUI toggles to native command-line arguments. Reference sheet:
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 px-1">Command-Line Flags</h3>
                      {HELP_ITEMS.map((item) => (
                        <div key={item.title} className="p-5.5 rounded-xl bg-[#161b30] border border-[#232948] hover:border-blue-500/35 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[14.5px] font-bold text-white">{item.title}</span>
                            <span className="text-[11.5px] font-mono font-bold tracking-[0.8px] bg-blue-500/10 text-blue-300 border border-blue-500/25 rounded-md px-3 py-1 flex-shrink-0">{item.flag}</span>
                          </div>
                          <p className="text-[13px] text-[#e0f2fe] leading-relaxed font-normal">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
