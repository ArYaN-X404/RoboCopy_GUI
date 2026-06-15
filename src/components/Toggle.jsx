export default function Toggle({ label, description, checked, onChange }) {
  return (
    <div
      className={`tog-card cursor-pointer select-none ${checked ? 'on' : ''}`}
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
      <div className="tog-info">
        <div className="tog-name">{label}</div>
        {description ? <div className="tog-desc">{description}</div> : null}
      </div>
      <div className={`sw ${checked ? 'on' : ''}`}>
        <div className="sw-thumb" />
      </div>
    </div>
  );
}
