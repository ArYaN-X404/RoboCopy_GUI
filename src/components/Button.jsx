export default function Button({ children, onClick, disabled, variant = 'primary' }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white border border-white/15 shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    ghost:
      'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
  };

  return (
    <button type="button" className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
