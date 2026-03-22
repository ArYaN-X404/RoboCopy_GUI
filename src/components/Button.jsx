export default function Button({ children, onClick, disabled, variant = 'primary' }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'accent-gradient text-white shadow-card hover:shadow-card-hover hover:-translate-y-0.5 disabled:opacity-60 relative before:absolute before:inset-0 before:rounded-xl before:border before:border-white/20 before:opacity-60 before:pointer-events-none',
    ghost:
      'border border-white/10 bg-white/5 text-white/80 hover:border-cyan-400/60 hover:text-white',
  };

  return (
    <button type="button" className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
