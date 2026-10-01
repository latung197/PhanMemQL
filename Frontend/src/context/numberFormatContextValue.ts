import { createContext } from 'react';
import type { NumberFormatConfig } from '../services/systemSettingsService';

// The context object lives alone in this file (type-only imports) so it keeps its identity when the dev server
// hot-reloads NumberFormatContext.tsx; otherwise the provider and useNumberFormat could end up with two different
// context objects and the app would throw "useNumberFormat must be used within a NumberFormatProvider".

export interface NumberFormatContextType {
  config: NumberFormatConfig;
  /** Replaces the whole format (values loaded from the backend). */
  applyConfig: (config: NumberFormatConfig) => void;
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

export const NumberFormatContext = createContext<NumberFormatContextType | undefined>(undefined);
