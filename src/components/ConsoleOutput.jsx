export default function ConsoleOutput({ lines }) {
  return (
    <div className="crystal-shell h-52 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-semibold text-white/60">Robocopy Output</span>
        <span className="glass-pill">Live</span>
      </div>
      <div className="h-full overflow-y-auto px-4 py-3 font-mono text-xs text-emerald-200/90">
        {lines.length === 0 ? (
          <p className="text-white/50">Waiting for run...</p>
        ) : (
          lines.map((line, index) => (
            <p key={`${line}-${index}`} className="leading-relaxed">
              {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
