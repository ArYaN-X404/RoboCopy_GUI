export default function ConsoleOutput({ lines, highlightedLines }) {
  return (
    <div className="terminal-surface h-64 min-w-0 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-semibold text-white/60">Robocopy Output</span>
        <span className="glass-pill">Live</span>
      </div>
      <div className="terminal-text h-[calc(100%-40px)] overflow-y-auto overflow-x-auto px-4 py-3 text-xs">
        {lines.length === 0 ? (
          <p className="text-white/50">Waiting for run...</p>
        ) : (
          (highlightedLines || lines).map((line, index) => (
            <p
              key={`${line.text || line}-${index}`}
              className={`leading-relaxed whitespace-pre ${line.className || ''}`}
            >
              {line.text || line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
