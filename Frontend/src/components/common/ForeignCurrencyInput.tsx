import React, { useState, useEffect } from 'react';
import { useNumberFormat } from '../../context/NumberFormatContext';
import { NumberInput } from './NumberInput';
import { DollarSign, ArrowRightLeft, Coins } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export interface ForeignCurrencyInputProps {
  foreignAmount: number;
  exchangeRate?: number;
  currencyCode?: string;
  onForeignAmountChange: (amount: number) => void;
  onExchangeRateChange?: (rate: number) => void;
  onCurrencyCodeChange?: (code: string) => void;
  onVndAmountChange?: (vndAmount: number) => void;
  disabled?: boolean;
  label?: string;
  showConvertedVnd?: boolean;
}

const COMMON_CURRENCIES = [
  { code: 'USD', name: 'Đô la Mỹ ($)', defaultRate: 25450 },  // i18n-ignore: data
  { code: 'EUR', name: 'Euros (€)', defaultRate: 27800 },
  { code: 'JPY', name: 'Yên Nhật (¥)', defaultRate: 165 },  // i18n-ignore: data
  { code: 'CNY', name: 'Tân Nhân dân tệ (¥)', defaultRate: 3520 },  // i18n-ignore: data
  { code: 'GBP', name: 'Bảng Anh (£)', defaultRate: 32500 },  // i18n-ignore: data
  { code: 'SGD', name: 'Đô la Singapore ($)', defaultRate: 18900 },  // i18n-ignore: data
  { code: 'AUD', name: 'Đô la Úc ($)', defaultRate: 16700 },  // i18n-ignore: data
];

export const ForeignCurrencyInput: React.FC<ForeignCurrencyInputProps> = ({
  foreignAmount,
  exchangeRate,
  currencyCode,
  onForeignAmountChange,
  onExchangeRateChange,
  onCurrencyCodeChange,
  onVndAmountChange,
  disabled = false,
  label: labelProp,
  showConvertedVnd = true
}) => {
  const { t } = useLanguage();
  const label = labelProp ?? t('controls.foreignCurrency.label');
  const { config, formatCurrency, formatForeignCurrency, formatNumber } = useNumberFormat();

  const [activeCurrency, setActiveCurrency] = useState<string>(
    currencyCode || config.defaultForeignCurrency || 'USD'
  );

  const [activeRate, setActiveRate] = useState<number>(
    exchangeRate !== undefined ? exchangeRate : config.defaultExchangeRate || 25450
  );

  useEffect(() => {
    if (currencyCode) setActiveCurrency(currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    if (exchangeRate !== undefined) setActiveRate(exchangeRate);
  }, [exchangeRate]);

  // Total equivalent in local currency
  const convertedVnd = (foreignAmount || 0) * (activeRate || 0);

  useEffect(() => {
    if (onVndAmountChange) {
      onVndAmountChange(convertedVnd);
    }
  }, [convertedVnd]);

  const handleSelectCurrency = (code: string) => {
    setActiveCurrency(code);
    if (onCurrencyCodeChange) onCurrencyCodeChange(code);

    // Auto update rate default if available
    const found = COMMON_CURRENCIES.find(c => c.code === code);
    if (found) {
      setActiveRate(found.defaultRate);
      if (onExchangeRateChange) onExchangeRateChange(found.defaultRate);
    }
  };

  const handleRateChange = (newRate: number) => {
    setActiveRate(newRate);
    if (onExchangeRateChange) onExchangeRateChange(newRate);
  };

  return (
    <div className="space-y-2 w-full bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Header Label */}
      <div className="flex items-center justify-between text-xs">
        <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-amber-500" />
          {label}
        </label>
        <span className="text-[11px] font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
          1 {activeCurrency} = {formatNumber(activeRate, config.exchangeRateDecimals)} {config.currencySymbol}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Currency Code Selector */}
        <div className="sm:col-span-3">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('controls.foreignCurrency.currency')}</label>
          <select
            value={activeCurrency}
            onChange={(e) => handleSelectCurrency(e.target.value)}
            disabled={disabled}
            className="w-full mt-1 py-1.5 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500"
          >
            {COMMON_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Foreign Amount Input */}
        <div className="sm:col-span-5">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('controls.foreignCurrency.amount')}</label>
          <div className="mt-1">
            <NumberInput
              value={foreignAmount}
              onChange={onForeignAmountChange}
              decimals={config.foreignAmountDecimals}
              placeholder="0.00"
              disabled={disabled}
              prefix={activeCurrency}
            />
          </div>
        </div>

        {/* Exchange Rate Input */}
        <div className="sm:col-span-4">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('controls.foreignCurrency.rate')}</label>
          <div className="mt-1">
            <NumberInput
              value={activeRate}
              onChange={handleRateChange}
              decimals={config.exchangeRateDecimals}
              placeholder="25,450"
              disabled={disabled}
              suffix={config.currencySymbol}
            />
          </div>
        </div>
      </div>

      {/* Converted VND Summary Bar */}
      {showConvertedVnd && (
        <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs mt-1">
          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
            <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('controls.foreignCurrency.converted', { symbol: config.currencySymbol })}</span>
          </div>
          <div className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
            {formatCurrency(convertedVnd)}
          </div>
        </div>
      )}
    </div>
  );
};
