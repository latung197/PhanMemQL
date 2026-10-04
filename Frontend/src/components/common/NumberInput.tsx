import React, { useState, useEffect, useRef } from 'react';
import { useNumberFormat } from '../../context/NumberFormatContext';

export interface NumberInputProps {
  value: number | string | undefined | null;
  onChange: (value: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  allowNegative?: boolean;
  autoSelectOnFocus?: boolean;
  id?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  dataGridRow?: number;
  dataGridCol?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  decimals,
  min,
  max,
  step,
  placeholder = '0',
  disabled = false,
  readOnly = false,
  className = '',
  prefix,
  suffix,
  allowNegative = false,
  autoSelectOnFocus = true,
  id,
  onBlur,
  onKeyDown,
  dataGridRow,
  dataGridCol
}) => {
  const { config, formatNumber, parseFormattedNumber } = useNumberFormat();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>('');

  const activeDecimals = decimals !== undefined ? decimals : config.amountDecimals;

  // Format value whenever value or focus state changes
  useEffect(() => {
    if (isFocused) {
      // When focused, show raw numbers with decimal separator for easy typing
      if (value === undefined || value === null || value === '') {
        setDisplayValue('');
      } else {
        const numVal = typeof value === 'number' ? value : parseFormattedNumber(String(value));
        if (isNaN(numVal)) {
          setDisplayValue('');
        } else {
          // Replace dot with active decimal separator if needed
          const raw = numVal.toString();
          let strVal = activeDecimals > 0
            ? (raw.includes('e') ? numVal.toFixed(activeDecimals) : raw)
            : Math.round(numVal).toString();
          if (config.decimalSeparator !== '.' && strVal.includes('.')) {
            strVal = strVal.replace('.', config.decimalSeparator);
          }
          setDisplayValue(strVal);
        }
      }
    } else {
      // When blurred, display fully formatted number
      if (value === undefined || value === null || value === '') {
        setDisplayValue('');
      } else {
        setDisplayValue(formatNumber(value, activeDecimals));
      }
    }
  }, [value, isFocused, activeDecimals, config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);

    // Sanitize input text according to separators
    let clean = raw;
    if (config.thousandSeparator) {
      clean = clean.split(config.thousandSeparator).join('');
    }
    if (config.decimalSeparator !== '.') {
      clean = clean.split(config.decimalSeparator).join('.');
    }

    if (!allowNegative) {
      clean = clean.replace(/-/g, '');
    }

    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) {
      let constrained = parsed;
      if (min !== undefined && constrained < min) constrained = min;
      if (max !== undefined && constrained > max) constrained = max;
      onChange(constrained);
    } else {
      onChange(0);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (autoSelectOnFocus) {
      e.target.select();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Apply final min/max bounds if necessary
    const parsed = parseFormattedNumber(displayValue);
    let finalVal = parsed;
    if (min !== undefined && finalVal < min) finalVal = min;
    if (max !== undefined && finalVal > max) finalVal = max;
    onChange(finalVal);
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div className={`relative flex items-center h-[26px] w-full rounded-[5px] bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-[10.5px] shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}>
      {prefix && (
        <span className="pl-2 pr-1 text-slate-500 dark:text-slate-400 font-bold shrink-0 select-none">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode={activeDecimals > 0 ? 'decimal' : 'numeric'}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        data-grid-row={dataGridRow}
        data-grid-col={dataGridCol}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`w-full h-full py-0.5 px-1.5 bg-transparent text-slate-800 dark:text-slate-100 font-mono font-bold text-right focus:outline-none text-[10.5px] ${className}`}
      />
      {suffix && (
        <span className="pr-2 pl-1 text-slate-500 dark:text-slate-400 font-semibold text-[10px] shrink-0 select-none">
          {suffix}
        </span>
      )}
    </div>
  );
};
