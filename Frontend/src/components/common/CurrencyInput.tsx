import React from 'react';
import { useNumberFormat } from '../../context/NumberFormatContext';
import { NumberInput } from './NumberInput';

export interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  showQuickButtons?: boolean;
  min?: number;
  max?: number;
  id?: string;
  label?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  disabled = false,
  readOnly = false,
  className = '',
  showQuickButtons = false,
  min = 0,
  max,
  id,
  label
}) => {
  const { config, formatCurrency } = useNumberFormat();

  const handleAddAmount = (addValue: number) => {
    const current = value || 0;
    onChange(current + addValue);
  };

  return (
    <div className="space-y-1 w-full">
      {label && (
        <div className="flex justify-between items-center text-xs">
          <label htmlFor={id} className="font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          <span className="text-[10px] text-slate-400 font-mono">
            {formatCurrency(value)}
          </span>
        </div>
      )}

      <NumberInput
        id={id}
        value={value}
        onChange={onChange}
        decimals={config.amountDecimals}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={className}
        prefix={config.currencyPosition === 'prefix' ? config.currencySymbol : undefined}
        suffix={config.currencyPosition === 'suffix' ? config.currencySymbol : undefined}
      />

      {showQuickButtons && !disabled && !readOnly && (
        <div className="flex items-center gap-1 pt-1 overflow-x-auto">
          <span className="text-[10px] text-slate-400 font-medium shrink-0">Cộng nhanh:</span>
          <button
            type="button"
            onClick={() => handleAddAmount(100000)}
            className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer"
          >
            +100K
          </button>
          <button
            type="button"
            onClick={() => handleAddAmount(1000000)}
            className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer"
          >
            +1M
          </button>
          <button
            type="button"
            onClick={() => handleAddAmount(10000000)}
            className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer"
          >
            +10M
          </button>
          <button
            type="button"
            onClick={() => onChange(0)}
            className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded text-[10px] font-bold transition-colors cursor-pointer ml-auto"
          >
            Xóa
          </button>
        </div>
      )}
    </div>
  );
};
