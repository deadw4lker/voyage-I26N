import { useState } from 'react';
import { cn } from '../../lib/utils';

interface SingleSelectChipsProps {
  options: { value: string; label: string; disabled?: boolean; tag?: string }[];
  defaultValue: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SingleSelectChips({ options, defaultValue, onChange, className }: SingleSelectChipsProps) {
  const [selected, setSelected] = useState(defaultValue);

  const handleSelect = (value: string) => {
    setSelected(value);
    onChange?.(value);
  };

  return (
    <div className={cn('flex gap-1.5 flex-wrap p-1 rounded-lg border border-border bg-[#f8fafc] w-fit', className)} role="group" aria-label="Select option">
      {options.map((option) => (
        <button
          key={option.value}
          disabled={option.disabled}
          className={cn(
            'text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors border border-transparent',
            option.disabled
              ? 'text-ice-faint/60 cursor-not-allowed'
              : selected === option.value
                ? 'bg-white text-ice border-border cursor-pointer'
                : 'text-ice-dim hover:text-ice cursor-pointer'
          )}
          style={selected === option.value ? { boxShadow: '0 1px 2px rgba(16,24,40,.08)' } : undefined}
          onClick={() => handleSelect(option.value)}
          aria-pressed={selected === option.value}
          title={option.tag}
        >
          {option.label}
          {option.tag && (
            <span className="ml-1.5 text-[10px] font-normal text-ice-faint">{option.tag}</span>
          )}
        </button>
      ))}
    </div>
  );
}
