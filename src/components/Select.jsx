import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const getColorForValue = (val) => {
  switch (String(val).toLowerCase()) {
    // Copy Modes
    case 'copy': return 'text-emerald-400 font-bold';
    case 'mirror':
    case 'sync': return 'text-rose-400 font-bold';
    case 'update': return 'text-purple-400 font-bold';
    // Verification Modes
    case 'off': return 'text-slate-400 font-bold';
    case 'fast': return 'text-blue-400 font-bold';
    case 'balanced': return 'text-emerald-400 font-bold';
    case 'strict': return 'text-purple-400 font-bold';
    // Presets
    default: 
      if (val && val !== '') return 'text-blue-300 font-bold';
      return 'text-slate-200';
  }
};

const getDotForValue = (val) => {
  switch (String(val).toLowerCase()) {
    case 'copy': return 'bg-emerald-400';
    case 'mirror':
    case 'sync': return 'bg-rose-400';
    case 'update': return 'bg-purple-400';
    case 'off': return 'bg-slate-400';
    case 'fast': return 'bg-blue-400';
    case 'balanced': return 'bg-emerald-400';
    case 'strict': return 'bg-purple-400';
    default: 
      if (val && val !== '') return 'bg-blue-400';
      return 'bg-slate-500';
  }
};

export default function Select({ label, value, onChange, options, icon: Icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="space-y-1.5 flex flex-col justify-end w-full relative" ref={containerRef}>
      {/* Input Label */}
      <span className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {label}
      </span>

      {/* Select Trigger Box */}
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between text-left bg-[#0f1222] border rounded-lg px-3 py-2.5 text-[12.5px] font-medium transition-all ${
            isOpen 
              ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/50' 
              : 'border-[#1e2235] hover:border-blue-500/40 hover:bg-[#13172c]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${getDotForValue(value)}`} />
            <span className={getColorForValue(value)}>
              {selectedOption ? selectedOption.label : 'Select Option'}
            </span>
          </div>
          <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Options Overlay */}
        {isOpen && (
          <div className="absolute top-[calc(100%+6px)] left-0 w-full z-[100] bg-[#0c0f1c] border border-[#232948] rounded-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.65)] py-1 max-h-60 overflow-y-auto scrollbar-thin">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-[12.5px] font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-300 border-l-2 border-blue-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${getDotForValue(option.value)}`} />
                  <span className={isSelected ? getColorForValue(option.value) : 'text-slate-300'}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
