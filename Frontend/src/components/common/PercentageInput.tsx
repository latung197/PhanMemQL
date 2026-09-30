import React from 'react';
import { useNumberFormat } from '../../context/NumberFormatContext';
import { NumberInput } from './NumberInput';

export interface PercentageInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  label?: string;
}

export const PercentageInput: React.FC<PercentageInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  disabled = false,
  readOnly = false,
  className = '',
  id,
  label
}) => {
  const { config } = useNumberFormat();

  return (
    <div className="space-y-1 w-full">
      {label && (
        <label htmlFor={id} className="font-bold text-slate-700 dark:text-slate-300 text-xs block">
          {label}
        </label>
      )}

      <NumberInput
        id={id}
        value={value}
        onChange={onChange}
        decimals={config.percentDecimals}
        min={min}
        max={max}
        placeholder="0.0"
        disabled={disabled}
        readOnly={readOnly}
        className={className}
        suffix="%"
      />
    </div>
  );
};
