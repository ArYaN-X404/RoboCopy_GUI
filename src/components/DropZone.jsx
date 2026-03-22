import { useState } from 'react';
import { ArrowDownTrayIcon, FolderOpenIcon, InboxArrowDownIcon } from '@heroicons/react/24/outline';

const ICONS = {
  source: FolderOpenIcon,
  destination: InboxArrowDownIcon,
};

export default function DropZone({ label, description, value, onDropPath, onBrowse, kind }) {
  const [active, setActive] = useState(false);
  const Icon = kind ? ICONS[kind] : null;
  const displayText = active ? `Drop to set as ${label}` : value || 'Drop a folder here';

  return (
    <div
      className={`crystal-item squircle relative flex min-h-[240px] min-w-0 flex-col justify-between gap-4 p-6 text-center transition ${
        active ? 'drop-magnet' : ''
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setActive(false);
        const file = event.dataTransfer.files?.[0];
        if (!file) return;
        const path = file.path || file.name;
        if (path) onDropPath(path);
      }}
      tabIndex={0}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
          {Icon ? <Icon className="h-5 w-5 text-cyan-200" /> : null}
          <span>{label}</span>
        </div>
        <p className="text-xs text-white/60">{description}</p>
      </div>
      <div className="min-w-0 space-y-4">
        {Icon ? <Icon className="mx-auto h-12 w-12 text-cyan-200/80" /> : null}
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
          <p className="truncate" title={displayText}>
            {displayText}
          </p>
        </div>
        <button type="button" className="glass-btn w-full" onClick={onBrowse}>
          <ArrowDownTrayIcon className="h-4 w-4" />
          Browse
        </button>
      </div>
    </div>
  );
}
