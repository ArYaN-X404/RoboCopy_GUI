export default function StatusIndicator({ status, progress, indeterminate }) {
  const statusMap = {
    idle: 'Idle',
    running: 'Running',
    completed: 'Completed',
    error: 'Error',
  };

  const colorMap = {
    idle: 'bg-white/20',
    running: 'bg-cyan-400/70',
    completed: 'bg-emerald-400/70',
    error: 'bg-rose-500/70',
  };

  return (
    <div className="crystal-item space-y-3 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-white/80">Status</span>
        <span className="glass-pill">{statusMap[status]}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        {indeterminate ? (
          <div className="h-2 w-1/3 animate-pulse rounded-full bg-cyan-400/70" />
        ) : (
          <div
            className={`h-2 rounded-full transition-all duration-500 ${colorMap[status]}`}
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      <p className="text-xs text-white/60">
        {indeterminate ? 'Calculating transfer size…' : `${progress}% complete`}
      </p>
    </div>
  );
}
