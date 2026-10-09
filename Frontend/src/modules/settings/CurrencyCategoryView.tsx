// Settings › Ngoại tệ (sys_currencies), on the shared catalog screen. One currency is the base (accounting) currency.
import React, { useMemo } from 'react';
import { Check, Coins } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { currenciesApi, type Currency, type CurrencyRow } from '../../services/settingsApi';
import type { UserProfile } from '../../types';

export const CurrencyCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const definition = useMemo((): CatalogDefinition<CurrencyRow, Currency> => ({
    functionCode: 'sys_currencies', api: currenciesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Coins className="h-4 w-4" />,
    texts: {
      title: t('currencies.title'), subtitle: t('currencies.subtitle'), noun: t('currencies.noun'),
      add: t('currencies.add'), searchPlaceholder: t('currencies.search'),
      addTitle: t('currencies.addTitle'), editTitle: row => t('currencies.editTitle', { code: row.code }),
      fileName: 'DanhMucNgoaiTe'
    },
    columns: [
      { key: 'code', header: t('currencies.code'), width: '110px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('currencies.name'), sortable: true },
      { key: 'symbol', header: t('currencies.symbol'), align: 'center', width: '100px', sortable: true },
      { key: 'decimalPlaces', header: t('currencies.decimalPlaces'), align: 'center', width: '150px', sortable: true },
      { key: 'isBase', header: t('currencies.isBase'), align: 'center', width: '160px', sortable: true,
        render: row => row.isBase ? <Badge variant="success" size="sm"><Check className="h-3 w-3" /> {t('currencies.baseBadge')}</Badge> : null },
      { key: 'isActive', header: t('currencies.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('currencies.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('currencies.inactive')}</Badge> },
      ...recordStampColumns<CurrencyRow>(t)
    ],
    excel: {
      columns: [
        { key: 'code', header: t('currencies.code'), required: true, width: 14, example: 'USD' },
        { key: 'name', header: t('currencies.name'), required: true, width: 28, example: 'Đô la Mỹ' },
        { key: 'symbol', header: t('currencies.symbol'), width: 12, example: '$' },
        { key: 'decimalPlaces', header: t('currencies.decimalPlaces'), type: 'number', width: 22, example: 2 },
        { key: 'isBase', header: t('currencies.isBase'), type: 'boolean', width: 20, example: false },
        { key: 'isActive', header: t('currencies.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, symbol: row.symbol, decimalPlaces: row.decimalPlaces, isBase: row.isBase, isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', symbol: '', decimalPlaces: 2, isBase: false, isActive: true },
    toInput: row => ({ code: row.code, name: row.name, symbol: row.symbol, decimalPlaces: row.decimalPlaces, isBase: row.isBase, isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), symbol: (input.symbol ?? '').trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t('currencies.code')} required autoFocus={!editing} disabled={!!editing} maxLength={10}
            className="font-mono uppercase" placeholder="USD" value={form.code} hint={t('currencies.codeHint')}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <TextInput label={t('currencies.symbol')} maxLength={10} placeholder="$" value={form.symbol}
            onChange={e => setForm({ ...form, symbol: e.target.value })} />
        </div>
        <TextInput label={t('currencies.name')} required maxLength={100} value={form.name} autoFocus={!!editing}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <SelectInput label={t('currencies.decimalPlaces')} value={String(form.decimalPlaces)}
          onChange={e => setForm({ ...form, decimalPlaces: Number(e.target.value) })}
          options={[0, 1, 2, 3, 4].map(n => ({ value: String(n), label: t('currencies.digits', { n }) }))} />
        <Checkbox label={t('currencies.isBase')} subLabel={t('currencies.isBaseHint')}
          checked={form.isBase} disabled={editing?.isBase} onChange={isBase => setForm({ ...form, isBase })} />
        <Checkbox label={t('currencies.isActive')} checked={form.isActive || form.isBase} disabled={form.isBase}
          onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
