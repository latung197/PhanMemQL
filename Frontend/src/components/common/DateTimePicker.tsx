import React from 'react';
import { Calendar, Clock, X } from 'lucide-react';

export interface DateTimePickerProps {
  label?: string;
  type?: 'date' | 'datetime-local' | 'time' | 'month';
  value?: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  showShortcuts?: boolean;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  compact?: boolean;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label,
  type = 'date',
  value = '',
  onChange,
  min,
  max,
  placeholder = 'Chọn thời gian...',
  required = false,
  disabled = false,
  helperText,
  showShortcuts = false,
  className = '',
  inputClassName = '',
  labelClassName = '',
  compact = true
}) => {
  const handleShortcut = (preset: 'today' | 'yesterday' | 'tomorrow' | 'startOfMonth' | 'endOfMonth') => {
    const now = new Date();
    let targetDate = new Date();

    if (preset === 'yesterday') {
      targetDate.setDate(now.getDate() - 1);
    } else if (preset === 'tomorrow') {
      targetDate.setDate(now.getDate() + 1);
    } else if (preset === 'startOfMonth') {
      targetDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'endOfMonth') {
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    if (type === 'date') {
      const isoDate = targetDate.toISOString().split('T')[0];
      onChange(isoDate);
    } else if (type === 'datetime-local') {
      const pad = (n: number) => (n < 10 ? `0${n}` : n);
      const isoDateTime = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(
        targetDate.getDate()
      )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      onChange(isoDateTime);
    } else if (type === 'month') {
      const pad = (n: number) => (n < 10 ? `0${n}` : n);
      const isoMonth = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}`;
      onChange(isoMonth);
    }
  };

  const defaultLabelClass = compact
    ? "block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate"
    : "font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-xs";

  const defaultInputClass = compact
    ? "w-full pl-7 pr-6 py-0.5 h-[26px] bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-[5px] text-[10.5px] font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
    : "w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[5px] text-xs font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all";

  return (
    <div className={`text-xs ${compact ? 'space-y-0.5' : 'space-y-1'} ${className}`}>
      {label && (
        <label className={labelClassName || defaultLabelClass}>
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <div className={`absolute ${compact ? 'left-2' : 'left-3'} text-slate-400 pointer-events-none`}>
          {type === 'time' ? (
            <Clock className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-indigo-500`} />
          ) : (
            <Calendar className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-indigo-500`} />
          )}
        </div>

        <input
          type={type}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClassName || defaultInputClass} ${
            disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`absolute ${compact ? 'right-1.5' : 'right-2.5'} p-0.5 text-slate-400 hover:text-rose-500 rounded-[5px] hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors`}
            title="Xóa thời gian"
          >
            <X className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
          </button>
        )}
      </div>

      {/* Preset shortcuts for quick selection */}
      {showShortcuts && !disabled && type !== 'time' && (
        <div className="flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            onClick={() => handleShortcut('today')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-[5px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => handleShortcut('yesterday')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-[5px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Hôm qua
          </button>
          <button
            type="button"
            onClick={() => handleShortcut('startOfMonth')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-[5px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Đầu tháng
          </button>
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
