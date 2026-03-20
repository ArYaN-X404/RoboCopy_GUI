export default function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="crystal-item flex items-start justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-semibold text-white/90">{label}</p>
        {description ? <p className="text-xs text-white/60">{description}</p> : null}
      </div>
      <span
        className={`relative mt-1 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
          checked ? 'bg-cyan-400/70' : 'bg-white/10'
        }`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </span>
    </label>
  );
}
