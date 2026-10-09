// Settings › Tỷ giá (sys_exchange_rates), on the shared catalog screen. One row per currency and day; vouchers use the
// accounting rate of the latest day on or before their date. The key of a row is "USD@2026-10-08" (currency + day).
import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { exchangeRatesApi, type Currency, type ExchangeRateRow, type SaveExchangeRateInput } from '../../services/settingsApi';
import { loadCurrencyOptions } from '../../services/lookupOptions';
import { formatDate } from '../../utils/format';
import type { UserProfile } from '../../types';

const rate = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
const today = () => new Date().toISOString().slice(0, 10);
type RateKey = 'buyRate' | 'sellRate' | 'accountingRate';

export const ExchangeRateCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  useEffect(() => { loadCurrencyOptions().then(setCurrencies).catch(() => setCurrencies([])); }, []);
  const foreign = useMemo(() => currencies.filter(c => !c.isBase && c.isActive), [currencies]);
  const base = currencies.find(c => c.isBase)?.code ?? 'VND';
  const currencyOptions = useMemo(() => foreign.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` })), [foreign]);

  const definition = useMemo((): CatalogDefinition<ExchangeRateRow, SaveExchangeRateInput> => ({
    functionCode: 'sys_exchange_rates', api: exchangeRatesApi,
    keyOf: row => row.code, describe: row => `${row.currencyCode} ${formatDate(row.date)}`,
    icon: <TrendingUp className="h-4 w-4" />,
    texts: {
      title: t('exchangeRates.title'), subtitle: t('exchangeRates.subtitle', { base }), noun: t('exchangeRates.noun'),
      add: t('exchangeRates.add'), searchPlaceholder: t('exchangeRates.search'),
      addTitle: t('exchangeRates.addTitle'), editTitle: row => t('exchangeRates.editTitle', { code: `${row.currencyCode} ${formatDate(row.date)}` }),
      fileName: 'DanhMucTyGia'
    },
    columns: [
      { key: 'date', header: t('exchangeRates.date'), width: '130px', sortable: true, render: row => <span className="font-mono">{formatDate(row.date)}</span> },
      { key: 'currencyCode', header: t('exchangeRates.currency'), width: '110px', sortable: true, render: row => <span className="font-mono font-bold">{row.currencyCode}</span> },
      { key: 'buyRate', header: t('exchangeRates.buyRate'), align: 'right', sortable: true, render: row => <span className="font-mono">{rate(row.buyRate)}</span> },
      { key: 'sellRate', header: t('exchangeRates.sellRate'), align: 'right', sortable: true, render: row => <span className="font-mono">{rate(row.sellRate)}</span> },
      { key: 'accountingRate', header: t('exchangeRates.accountingRate'), align: 'right', sortable: true,
        render: row => <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{rate(row.accountingRate)}</span> },
      { key: 'isActive', header: t('exchangeRates.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('exchangeRates.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('exchangeRates.inactive')}</Badge> },
      ...recordStampColumns<ExchangeRateRow>(t)
    ],
    // The currency filter is a query parameter of the list and the export (currency=USD).
    filters: [{ key: 'currency', label: t('exchangeRates.currency'), options: currencyOptions }],
    excel: {
      columns: [
        { key: 'currencyCode', header: t('exchangeRates.currency'), required: true, width: 14, example: 'USD' },
        { key: 'date', header: t('exchangeRates.date'), required: true, width: 16, example: '2026-10-08' },
        { key: 'buyRate', header: t('exchangeRates.buyRate'), type: 'number', width: 16, example: 25300 },
        { key: 'sellRate', header: t('exchangeRates.sellRate'), type: 'number', width: 16, example: 25500 },
        { key: 'accountingRate', header: t('exchangeRates.accountingRate'), type: 'number', required: true, width: 16, example: 25400 },
        { key: 'isActive', header: t('exchangeRates.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ currencyCode: row.currencyCode, date: row.date, buyRate: row.buyRate, sellRate: row.sellRate,
        accountingRate: row.accountingRate, isActive: row.isActive })
    },
    emptyInput: { currencyCode: foreign[0]?.code ?? '', date: today(), buyRate: 0, sellRate: 0, accountingRate: 0, isActive: true },
    toInput: row => ({ currencyCode: row.currencyCode, date: row.date, buyRate: row.buyRate, sellRate: row.sellRate,
      accountingRate: row.accountingRate, isActive: row.isActive }),
    normalize: input => ({ ...input, currencyCode: input.currencyCode.trim().toUpperCase(), date: String(input.date).trim() }),
    renderForm: ({ form, setForm, editing }) => {
      const number = (key: RateKey, label: string, required = false) => (
        <TextInput label={label} required={required} type="number" min={0} step="any" className="text-right font-mono"
          value={form[key] || ''} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} />
      );
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label={t('exchangeRates.currency')} required disabled={!!editing} value={form.currencyCode}
              options={currencyOptions.length > 0 ? currencyOptions : [{ value: form.currencyCode, label: form.currencyCode || t('exchangeRates.noForeign') }]}
              onChange={e => setForm({ ...form, currencyCode: e.target.value })} />
            <TextInput label={t('exchangeRates.date')} required type="date" disabled={!!editing} value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          {editing && <p className="text-xs text-slate-500 dark:text-slate-400">{t('exchangeRates.keyHint')}</p>}
          <div className="grid grid-cols-3 gap-3">
            {number('buyRate', t('exchangeRates.buyRate'))}
            {number('sellRate', t('exchangeRates.sellRate'))}
            {number('accountingRate', t('exchangeRates.accountingRate'), true)}
          </div>
          <Checkbox label={t('exchangeRates.isActive')} subLabel={t('exchangeRates.isActiveHint')} checked={form.isActive}
            onChange={isActive => setForm({ ...form, isActive })} />
        </>
      );
    }
  }), [t, base, currencyOptions, foreign]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
