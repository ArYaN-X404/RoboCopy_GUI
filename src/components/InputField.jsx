import { FolderOpenIcon } from '@heroicons/react/24/outline';

export default function InputField({
  label,
  value,
  placeholder,
  onChange,
  onBrowse,
  helper,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-white/80">{label}</label>
        {helper ? <span className="text-xs text-white/50">{helper}</span> : null}
      </div>
      <div className="flex gap-3">
        <input
          className="glass-input flex-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button type="button" onClick={onBrowse} className="glass-btn">
          <FolderOpenIcon className="h-5 w-5" />
          Browse
        </button>
      </div>
    </div>
  );
}
