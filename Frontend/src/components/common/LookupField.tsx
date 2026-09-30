import React from 'react';
import { Search, X, Check } from 'lucide-react';

export interface LookupFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  selectedCount?: number;
  onLookupClick: () => void;
  onClear?: () => void;
  helperText?: string;
  className?: string;
}

export const LookupField: React.FC<LookupFieldProps> = ({
  label,
  value,
  placeholder = 'Bấm Tra cứu để chọn...',
  required = false,
  disabled = false,
  selectedCount = 0,
  onLookupClick,
  onClear,
  helperText,
  className = ''
}) => {
  return (
    <div className={`space-y-1 text-xs ${className}`}>
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        {selectedCount > 1 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {selectedCount} lựa chọn
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          type="text"
          readOnly
          value={value || ''}
          placeholder={placeholder}
          onClick={disabled ? undefined : onLookupClick}
          className={`w-full pr-20 pl-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[5px] text-xs cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 ${
            disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'hover:border-indigo-400'
          }`}
        />

        <div className="absolute right-1 flex items-center gap-1">
          {value && onClear && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Xóa lựa chọn"
              className="p-1 text-slate-400 hover:text-rose-500 rounded-[5px] hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={onLookupClick}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-[5px] text-[11px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Search className="h-3 w-3" />
            <span>Tra cứu</span>
          </button>
        </div>
      </div>

      {helperText && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
