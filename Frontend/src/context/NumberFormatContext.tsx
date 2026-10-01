import React, { useCallback, useContext, useState, ReactNode } from 'react';
import { DEFAULT_NUMBER_FORMAT_CONFIG, NumberFormatConfig } from '../services/systemSettingsService';
import { NumberFormatContext, NumberFormatContextType } from './numberFormatContextValue';

// The format is a company setting (systemSettingsService, section numberFormat). App applies it after
// login with applyConfig; the settings screen previews edits with updateConfig and saves them to the backend.
export { DEFAULT_NUMBER_FORMAT_CONFIG };
export type { NumberFormatConfig };

// Older versions kept the format per browser.
try { localStorage.removeItem('erp_number_format_config'); } catch { /* storage unavailable */ }

export const NumberFormatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<NumberFormatConfig>(DEFAULT_NUMBER_FORMAT_CONFIG);

  const applyConfig = useCallback((next: NumberFormatConfig) => setConfig({ ...DEFAULT_NUMBER_FORMAT_CONFIG, ...next }), []);

  const updateConfig = (newConfig: Partial<NumberFormatConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      // Ensure separators aren't identical
      if (updated.thousandSeparator === updated.decimalSeparator) {
        if (updated.decimalSeparator === '.') {
          updated.thousandSeparator = ',';
        } else {
          updated.thousandSeparator = '.';
        }
      }
      return updated;
    });
  };

  const resetConfig = () => {
    setConfig(DEFAULT_NUMBER_FORMAT_CONFIG);
  };

  // Parses string with formatting separators back into clean number
  const parseFormattedNumber = (valStr: string): number => {
    if (!valStr || typeof valStr !== 'string') return 0;
    
    let clean = valStr.trim();
    // Remove thousand separators
    if (config.thousandSeparator) {
      const thousandRegex = new RegExp(`\\${config.thousandSeparator}`, 'g');
      clean = clean.replace(thousandRegex, '');
    }
    
    // Convert decimal separator to standard dot '.'
    if (config.decimalSeparator !== '.') {
      clean = clean.replace(new RegExp(`\\${config.decimalSeparator}`, 'g'), '.');
    }
    
    // Remove non-numeric chars except standard dot and minus
    clean = clean.replace(/[^0-9.-]/g, '');
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Raw number formatter according to active config
  const formatNumber = (val: number | string | undefined | null, decimals?: number): string => {
    if (val === undefined || val === null || val === '') return '0';
    const num = typeof val === 'number' ? val : parseFormattedNumber(String(val));
    if (isNaN(num)) return '0';

    const targetDecimals = decimals !== undefined ? decimals : config.amountDecimals;
    
    // Split integer and decimal parts
    const parts = num.toFixed(targetDecimals).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    // Format integer part with thousand separator
    if (config.thousandSeparator) {
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandSeparator);
    }

    if (targetDecimals > 0 && decimalPart !== undefined) {
      return `${integerPart}${config.decimalSeparator}${decimalPart}`;
    }
    return integerPart;
  };

  // Local currency formatter
  const formatCurrency = (val: number | string | undefined | null, showSymbol = true): string => {
    const formatted = formatNumber(val, config.amountDecimals);
    if (!showSymbol || !config.currencySymbol) return formatted;

    if (config.currencyPosition === 'prefix') {
      return `${config.currencySymbol} ${formatted}`;
    }
    return `${formatted} ${config.currencySymbol}`;
  };

  // Foreign currency formatter
  const formatForeignCurrency = (val: number | string | undefined | null, symbol = 'USD', decimals?: number): string => {
    const targetDec = decimals !== undefined ? decimals : config.foreignAmountDecimals;
    const formatted = formatNumber(val, targetDec);
    return `${symbol} ${formatted}`;
  };

  // Quantity formatter
  const formatQuantity = (val: number | string | undefined | null): string => {
    return formatNumber(val, config.quantityDecimals);
  };

  // Unit Price formatter
  const formatUnitPrice = (val: number | string | undefined | null): string => {
    return formatNumber(val, config.unitPriceDecimals);
  };

  // Percentage formatter
  const formatPercent = (val: number | string | undefined | null): string => {
    const formatted = formatNumber(val, config.percentDecimals);
    return `${formatted}%`;
  };

  return (
    <NumberFormatContext.Provider
      value={{
        config,
        applyConfig,
        updateConfig,
        resetConfig,
        formatNumber,
        formatCurrency,
        formatForeignCurrency,
        formatQuantity,
        formatUnitPrice,
        formatPercent,
        parseFormattedNumber,
      }}
    >
      {children}
    </NumberFormatContext.Provider>
  );
};

export const useNumberFormat = (): NumberFormatContextType => {
  const context = useContext(NumberFormatContext);
  if (!context) {
    throw new Error('useNumberFormat must be used within a NumberFormatProvider');
  }
  return context;
};
