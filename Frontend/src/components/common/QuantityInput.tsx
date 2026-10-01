import React from 'react';
import { useNumberFormat } from '../../context/NumberFormatContext';
import { NumberInput } from './NumberInput';
import { Plus, Minus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  label?: string;
  showStepper?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  dataGridRow?: number;
  dataGridCol?: string;
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  unit = '',
  min = 0,
  max,
  step = 1,
  disabled = false,
  readOnly = false,
  className = '',
  id,
  label,
  showStepper = true,
  onBlur,
  onKeyDown,
  dataGridRow,
  dataGridCol
}) => {
  const { t } = useLanguage();
  const { config } = useNumberFormat();

  const handleDecrement = () => {
    const current = value || 0;
    const next = current - step;
    if (min !== undefined && next < min) {
      onChange(min);
    } else {
      onChange(next);
    }
  };

  const handleIncrement = () => {
    const current = value || 0;
    const next = current + step;
    if (max !== undefined && next > max) {
      onChange(max);
    } else {
      onChange(next);
    }
  };

  return (
    <div className="space-y-1 w-full">
      {label && (
        <label htmlFor={id} className="font-bold text-slate-700 dark:text-slate-300 text-xs block">
          {label}
        </label>
      )}

      <div className="flex items-center gap-1">
        {showStepper && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleDecrement}
            disabled={min !== undefined && (value || 0) <= min}
            className="h-[26px] w-[26px] flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            title={t('controls.quantity.decrease')}
          >
            <Minus className="h-3 w-3" />
          </button>
        )}

        <NumberInput
          id={id}
          value={value}
          onChange={onChange}
          decimals={config.quantityDecimals}
          min={min}
          max={max}
          step={step}
          placeholder="1"
          disabled={disabled}
          readOnly={readOnly}
          className={className}
          suffix={unit || undefined}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          dataGridRow={dataGridRow}
          dataGridCol={dataGridCol}
        />

        {showStepper && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleIncrement}
            disabled={max !== undefined && (value || 0) >= max}
            className="h-[26px] w-[26px] flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            title={t('controls.quantity.increase')}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};
