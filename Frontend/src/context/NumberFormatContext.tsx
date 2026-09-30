import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface NumberFormatConfig {
  thousandSeparator: ',' | '.' | ' ' | '';
  decimalSeparator: '.' | ',';
  currencySymbol: string;
  currencyPosition: 'prefix' | 'suffix';
  amountDecimals: number;
  foreignAmountDecimals: number;
  exchangeRateDecimals: number;
  quantityDecimals: number;
  unitPriceDecimals: number;
  percentDecimals: number;
  defaultForeignCurrency: string;
  defaultExchangeRate: number;
}

export const DEFAULT_NUMBER_FORMAT_CONFIG: NumberFormatConfig = {
  thousandSeparator: ',',
  decimalSeparator: '.',
  currencySymbol: 'VNĐ',
  currencyPosition: 'suffix',
  amountDecimals: 0,
  foreignAmountDecimals: 2,
  exchangeRateDecimals: 2,
  quantityDecimals: 0,
  unitPriceDecimals: 0,
  percentDecimals: 2,
  defaultForeignCurrency: 'USD',
  defaultExchangeRate: 25450,
};

const STORAGE_KEY = 'erp_number_format_config';

interface NumberFormatContextType {
  config: NumberFormatConfig;
  updateConfig: (newConfig: Partial<NumberFormatConfig>) => void;
  resetConfig: () => void;
  formatNumber: (val: number | string | undefined | null, decimals?: number) => string;
  formatCurrency: (val: number | string | undefined | null, showSymbol?: boolean) => string;
  formatForeignCurrency: (val: number | string | undefined | null, symbol?: string, decimals?: number) => string;
  formatQuantity: (val: number | string | undefined | null) => string;
  formatUnitPrice: (val: number | string | undefined | null) => string;
  formatPercent: (val: number | string | undefined | null) => string;
  parseFormattedNumber: (valStr: string) => number;
}

const NumberFormatContext = createContext<NumberFormatContextType | undefined>(undefined);

export const NumberFormatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<NumberFormatConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_NUMBER_FORMAT_CONFIG, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_NUMBER_FORMAT_CONFIG;
      }
    }
    return DEFAULT_NUMBER_FORMAT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

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
