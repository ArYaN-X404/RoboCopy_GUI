import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function DropZone({ label, description, value, onDropPath, onBrowse }) {
  const [active, setActive] = useState(false);

  return (
    <div
      className={`crystal-item relative flex h-full min-h-[150px] flex-col justify-between gap-3 p-4 transition ${
        active ? 'border-cyan-400/60 shadow-card-hover' : ''
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
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/60">{description}</p>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 break-all">
          {value || 'Drop a folder here'}
        </div>
        <button type="button" className="glass-btn w-full" onClick={onBrowse}>
          <ArrowDownTrayIcon className="h-4 w-4" />
          Browse
        </button>
      </div>
    </div>
  );
}
