import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps {
  label?: React.ReactNode;
  subLabel?: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  badge?: string;
  className?: string;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  subLabel,
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  required = false,
  badge,
  className = '',
  id
}) => {
  const checkboxId = id || `chk-${Math.random().toString(36).substring(2, 9)}`;

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={`inline-flex items-start gap-2.5 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <div className="relative flex items-center justify-center mt-0.5 shrink-0">
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          onClick={handleClick}
          className={`w-4 h-4 rounded border transition-all duration-150 flex items-center justify-center ${
            checked || indeterminate
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-500'
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {indeterminate ? (
            <Minus className="w-3 h-3 stroke-[3]" />
          ) : checked ? (
            <Check className="w-3 h-3 stroke-[3]" />
          ) : null}
        </div>
      </div>

      {(label || subLabel) && (
        <div onClick={handleClick} className="flex-1">
          <label htmlFor={checkboxId} className={`text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <span>{label}</span>
            {required && <span className="text-rose-500 font-bold">*</span>}
            {badge && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-300">
                {badge}
              </span>
            )}
          </label>
          {subLabel && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subLabel}</p>
          )}
        </div>
      )}
    </div>
  );
};
