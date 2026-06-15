export default function StatusIndicator({
  status,
  progress,
  indeterminate,
  indeterminateLabel = 'Calculating transfer size...',
}) {
  const statusMap = {
    idle: 'Idle',
    running: 'Running',
    verifying: 'Verifying',
    completed: 'Completed',
    error: 'Error',
  };

  return (
    <div className="crystal-item space-y-3 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-white/80">Status</span>
        <span className="glass-pill">{statusMap[status]}</span>
      </div>
      <div className="h-[9px] w-full overflow-hidden rounded-full bg-[#0d0f1a] border border-white/5">
        {indeterminate ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400/70" />
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'completed'
                ? 'bg-emerald-500'
                : status === 'error'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-[length:200%_100%] animate-progressShimmer'
            }`}
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      <p className="text-xs text-white/60">
        {status === 'idle' ? (
          <span className="text-cyan-400 font-semibold">Ready to Run</span>
        ) : indeterminate ? (
          indeterminateLabel
        ) : (
          `${progress}% complete`
        )}
      </p>
    </div>
  );
}
