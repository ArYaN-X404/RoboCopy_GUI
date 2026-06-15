import { useState } from 'react';
import { ArrowDownTrayIcon, FolderOpenIcon, InboxArrowDownIcon } from '@heroicons/react/24/outline';

const ICONS = {
  source: FolderOpenIcon,
  destination: InboxArrowDownIcon,
};

export default function DropZone({ label, description, value, onDropPath, onBrowse, kind }) {
  const [active, setActive] = useState(false);
  const Icon = kind ? ICONS[kind] : null;
  const displayText = active ? `Drop to set as ${label}` : value || 'Drop or browse a folder…';

  return (
    <div
      className={`folder-card flex flex-col justify-between min-h-[220px] transition duration-300 ${
        active
          ? kind === 'source'
            ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.01]'
            : 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] scale-[1.01]'
          : ''
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
      <div className={`fc-accent ${kind === 'source' ? 'fca-blue' : 'fca-green'}`} />

      <div>
        {/* Header section with Icon, Title and Subtitle */}
        <div className="fc-header">
          <div className={`fc-iconbg ${kind === 'source' ? 'fci-blue' : 'fci-green'}`}>
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          </div>
          <div>
            <div className="fc-title">{label}</div>
            <div className="fc-sub">{description}</div>
          </div>
        </div>

        {/* Path container */}
        <div className="fc-path" onClick={onBrowse}>
          {Icon ? (
            <Icon className={`h-4 w-4 flex-shrink-0 ${kind === 'source' ? 'text-blue-500/60' : 'text-emerald-500/60'}`} />
          ) : null}
          <div className={`fc-path-text truncate ${value ? 'text-slate-300 not-italic font-medium' : ''}`}>
            {displayText}
          </div>
        </div>
      </div>

      {/* Browse Button */}
      <button type="button" className="browse-btn" onClick={onBrowse}>
        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
        <span>Browse folder</span>
      </button>
    </div>
  );
}
