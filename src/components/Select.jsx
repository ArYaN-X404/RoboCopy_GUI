import { ChevronDownIcon } from '@heroicons/react/24/outline';

export default function Select({ label, value, onChange, options }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-white/80">{label}</span>
      <div className="relative">
        <select
          className="glass-input w-full appearance-none pr-10"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
      </div>
    </label>
  );
}
