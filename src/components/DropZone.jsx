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
      className={`crystal-item squircle relative flex min-h-[250px] min-w-0 flex-col justify-between gap-4 p-6 text-center transition duration-300 ${
        active
          ? kind === 'source'
            ? 'border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.15)] scale-[1.01]'
            : 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.15)] scale-[1.01]'
          : 'hover:border-white/15'
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
      {/* Top accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 rounded-t-[28px] ${
          kind === 'source'
            ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
        }`}
      />

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
          {Icon ? (
            <Icon
              className={`h-5 w-5 ${
                kind === 'source' ? 'text-blue-400' : 'text-emerald-400'
              }`}
            />
          ) : null}
          <span>{label}</span>
        </div>
        <p className="text-xs text-white/50">{description}</p>
      </div>

      <div className="min-w-0 space-y-4">
        {Icon ? (
          <Icon
            className={`mx-auto h-12 w-12 transition-transform duration-300 ${
              active ? 'scale-110' : 'scale-100'
            } ${
              kind === 'source'
                ? 'text-blue-400/70 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                : 'text-emerald-400/70 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            }`}
          />
        ) : null}

        <div
          className={`min-w-0 rounded-xl border border-dashed px-3 py-3 text-xs transition duration-200 ${
            active
              ? kind === 'source'
                ? 'border-blue-400/50 bg-blue-500/5 text-blue-200'
                : 'border-emerald-400/50 bg-emerald-500/5 text-emerald-200'
              : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
          }`}
        >
          <p className="truncate font-medium" title={displayText}>
            {displayText}
          </p>
        </div>

        <button
          type="button"
          className={`glass-btn w-full transition duration-150 ${
            kind === 'source'
              ? 'hover:border-blue-400/50 hover:bg-blue-500/10'
              : 'hover:border-emerald-400/50 hover:bg-emerald-500/10'
          }`}
          onClick={onBrowse}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Browse folder
        </button>
      </div>
    </div>
  );
}
