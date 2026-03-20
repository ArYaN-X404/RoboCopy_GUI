import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  CommandLineIcon,
  InformationCircleIcon,
  MoonIcon,
  PlayIcon,
  SunIcon,
  XMarkIcon,
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

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
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

  const speedRef = useRef(0);
  const totalBytesRef = useRef(0);
  const copiedBytesRef = useRef(0);
  const sourcePickerRef = useRef(null);
  const destinationPickerRef = useRef(null);
  const runTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

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
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      if (totalBytesRef.current <= 0) return;
      const pct = Math.min(100, Math.round((copiedBytesRef.current / totalBytesRef.current) * 100));
      setProgress(pct);
      if (window?.robocopy?.setProgress) window.robocopy.setProgress(pct / 100);
      const speed = speedRef.current;
      if (speed > 0) {
        setEtaSeconds(Math.max(0, Math.round((totalBytesRef.current - copiedBytesRef.current) / speed)));
      }
    }, 120);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

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
      if (selected) setter(selected);
      return;
    }
    ref.current?.click();
  };

  const handleFolderChange = (event, setter) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const first = files[0];
    const name = first.path || first.webkitRelativePath?.split('/')[0] || first.name;
    if (name) setter(name);
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
  };

  const parseSpeed = (line) => {
    const match = line.match(/Speed\s*:\s*([\d,]+)\s*Bytes\/sec/i);
    if (!match) return;
    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(value)) {
      speedRef.current = value;
      setSpeedBps(value);
    }
  };

  const parseFileSize = (line) => {
    if (!/(New File|Newer|Older|Same)/i.test(line)) return 0;
    const bytesMatch = line.match(/(?:New File|Newer|Older|Same)\s+(\d{1,12})\s/i);
    if (!bytesMatch) return 0;
    const bytes = Number(bytesMatch[1].replace(/,/g, ''));
    return Number.isFinite(bytes) ? bytes : 0;
  };

  const updateProgressFromBytes = (addedBytes) => {
    copiedBytesRef.current += addedBytes;
    setCopiedBytes(copiedBytesRef.current);
  };

  const simulateRun = () => {
    setStatus('running');
    setProgress(0);
    setLoading(true);
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
      return;
    }

    if (window?.robocopy?.run) {
      setStatus('running');
      setProgress(0);
      setLoading(true);
      setLogs([command]);
      setCopiedBytes(0);
      setTotalBytes(0);
      setSpeedBps(0);
      setEtaSeconds(null);
      speedRef.current = 0;
      totalBytesRef.current = 0;
      copiedBytesRef.current = 0;

      if (window?.robocopy?.getFolderSize) {
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
          onProgress: (nextProgress, line) => {
            if (line) {
              parseSpeed(line);
              const addedBytes = parseFileSize(line);
              if (addedBytes > 0) {
                updateProgressFromBytes(addedBytes);
              }
              setLogs((prev) => [...prev, line]);
            }
            if (Number.isFinite(nextProgress) && totalBytesRef.current === 0) {
              setProgress(nextProgress);
              if (window?.robocopy?.setProgress) window.robocopy.setProgress(nextProgress / 100);
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
      }
      return;
    }

    simulateRun();
  };

  const speedText = speedBps > 0 ? `${formatBytes(speedBps)}/s` : '—';

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <span className="glass-pill">Robocopy GUI</span>
          <h1 className="text-3xl font-semibold text-white">RoboCopy Pro</h1>
          <p className="text-sm text-white/60">
            Simple, fast, and safe Robocopy control center.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => setHelpOpen(true)}>
            <InformationCircleIcon className="h-5 w-5" />
            Help
          </Button>
          <Button variant="ghost" onClick={() => setDarkMode((prev) => !prev)}>
            {darkMode ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            {darkMode ? 'Dark' : 'Light'}
          </Button>
          <div className="crystal-item flex items-center gap-2 px-4 py-3 text-xs text-white/60">
            <CommandLineIcon className="h-4 w-4" />
            Ctrl + Enter to run
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Panel title="Folders" description="Drag & drop or browse. Two clean boxes only.">
            <div className="grid gap-4 md:grid-cols-2">
              <DropZone
                label="Source"
                description="Drop the folder you want to copy."
                value={source}
                onDropPath={setSource}
                onBrowse={() => handleFolderPicker(setSource, sourcePickerRef)}
              />
              <DropZone
                label="Destination"
                description="Drop the folder that receives the files."
                value={destination}
                onDropPath={setDestination}
                onBrowse={() => handleFolderPicker(setDestination, destinationPickerRef)}
              />
            </div>
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
          </Panel>

          <Panel title="Transfer Mode" description="Quick intent selection for copy vs move.">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setMove(false)}
                className={`crystal-item p-4 text-left ${!move ? 'border-cyan-400/50' : ''}`}
              >
                <p className="text-sm font-semibold text-white">Copy</p>
                <p className="text-xs text-white/60">Keeps files in the source folder.</p>
              </button>
              <button
                type="button"
                onClick={() => setMove(true)}
                className={`crystal-item p-4 text-left ${move ? 'border-cyan-400/50' : ''}`}
              >
                <p className="text-sm font-semibold text-white">Move</p>
                <p className="text-xs text-white/60">Removes files from source after copying.</p>
              </button>
              <div className="md:col-span-2">
                <Select
                  label="Copy Mode"
                  value={copyMode}
                  onChange={setCopyMode}
                  options={COPY_MODES.map((mode) => ({
                    value: mode.id,
                    label: `${mode.label} — ${mode.description}`,
                  }))}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Essential Options" description="Only the most used and beginner-friendly settings.">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle
                label="High-Speed Mode"
                description="Disables resume + logging, lowers retries, and minimizes output."
                checked={highSpeed}
                onChange={setHighSpeed}
              />
              <Toggle
                label="Mirror Mode"
                description="/MIR makes destination match source (deletes extras)."
                checked={mirror}
                onChange={setMirror}
              />
              <Toggle
                label="Resume Transfers"
                description="/Z resumes if the copy is interrupted (slower)."
                checked={resume}
                onChange={setResume}
              />
              <Toggle
                label="Enable Logging"
                description="/LOG writes a file log (slower on large jobs)."
                checked={logging}
                onChange={setLogging}
              />
              <div className="crystal-item flex flex-col gap-3 p-4">
                <label className="text-sm font-semibold text-white/80">Subfolder Mode</label>
                <div className="grid gap-2">
                  {[
                    { id: 'all', label: 'All subfolders (/E)' },
                    { id: 'non-empty', label: 'Only non-empty (/S)' },
                    { id: 'none', label: 'Top level only' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSubdirMode(option.id)}
                      className={`glass-btn justify-start ${subdirMode === option.id ? 'border-cyan-400/60 text-white' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="crystal-item flex flex-col gap-3 p-4">
                <label className="text-sm font-semibold text-white/80">Threads</label>
                <input
                  type="number"
                  min="1"
                  max="128"
                  className="glass-input"
                  value={threads}
                  onChange={(event) => setThreads(Number(event.target.value))}
                />
                <p className="text-xs text-white/60">Higher values = faster on SSD.</p>
              </div>
              <div className="crystal-item flex flex-col gap-3 p-4">
                <label className="text-sm font-semibold text-white/80">Retry Count</label>
                <input
                  type="number"
                  min="0"
                  className="glass-input"
                  value={retries}
                  onChange={(event) => setRetries(Number(event.target.value))}
                />
                <p className="text-xs text-white/60">More retries = safer but slower.</p>
              </div>
              <div className="crystal-item flex flex-col gap-3 p-4">
                <label className="text-sm font-semibold text-white/80">Wait Between Retries (sec)</label>
                <input
                  type="number"
                  min="0"
                  className="glass-input"
                  value={wait}
                  onChange={(event) => setWait(Number(event.target.value))}
                />
                <p className="text-xs text-white/60">Longer waits reduce speed.</p>
              </div>
              <div className="crystal-item flex flex-col gap-3 p-4 md:col-span-2">
                <label className="text-sm font-semibold text-white/80">Ignore files/folders</label>
                <input
                  className="glass-input"
                  placeholder="node_modules, .git, *.tmp"
                  value={excludeText}
                  onChange={(event) => setExcludeText(event.target.value)}
                />
                <p className="text-xs text-white/60">Use commas. Prefix with file: or dir: if needed.</p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Presets"
            description="Save a clean set of common profiles."
            actions={
              <Button variant="ghost" onClick={handleSavePreset}>
                <ArrowDownTrayIcon className="h-5 w-5" />
                Save Preset
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white/80">Preset Name</span>
                <input
                  className="glass-input w-full"
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Daily backup"
                />
              </label>
              <Select
                label="Load Preset"
                value={selectedPreset}
                onChange={handleLoadPreset}
                options={[
                  { label: 'Select preset', value: '' },
                  ...presets.map((preset) => ({
                    value: preset.name,
                    label: preset.name,
                  })),
                ]}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Run"
            description="Execute Robocopy and watch progress live."
            actions={
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowLogs((prev) => !prev)}>
                  {showLogs ? 'Hide Logs' : 'Show Logs'}
                </Button>
                <Button onClick={handleRun} disabled={loading}>
                  {loading ? <Spinner /> : <PlayIcon className="h-5 w-5" />}
                  {loading ? 'Running...' : 'Run Robocopy'}
                </Button>
              </div>
            }
          >
            <div className="grid gap-4">
              <StatusIndicator status={status} progress={progress} indeterminate={scanning} />
              <div className="crystal-item grid gap-2 p-4 text-xs text-white/60">
                <div className="flex items-center justify-between">
                  <span>Mode</span>
                  <span className="text-white/80">{move ? 'Move' : 'Copy'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Speed</span>
                  <span className="text-white/80">{speedText}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>ETA</span>
                  <span className="text-white/80">{scanning ? 'Scanning…' : formatEta(etaSeconds)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Copied</span>
                  <span className="text-white/80">
                    {formatBytes(copiedBytes)} / {totalBytes ? formatBytes(totalBytes) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Command Preview" description="Live Robocopy command based on your selections.">
            <div className="crystal-item overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/60">
                <span>Command</span>
                <span className="glass-pill">Live</span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 text-sm text-cyan-200/90">
                <code>{command}</code>
              </pre>
            </div>
          </Panel>

          {showLogs ? <ConsoleOutput lines={logs} /> : null}
        </div>
      </div>

      {helpOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setHelpOpen(false)}
          />
          <div className="absolute right-4 top-4 bottom-4 w-full max-w-md">
            <div className="crystal-shell h-full overflow-hidden p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Help Guide</p>
                  <h2 className="text-lg font-semibold text-white">Robocopy Quick Tips</h2>
                </div>
                <button type="button" className="glass-btn" onClick={() => setHelpOpen(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-6 space-y-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100% - 80px)' }}>
                {HELP_ITEMS.map((item) => (
                  <div key={item.title} className="crystal-item p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <span className="glass-pill">{item.flag}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/60">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
