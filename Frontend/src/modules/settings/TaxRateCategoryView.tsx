// Settings › Mã thuế (sys_tax_rates), on the shared catalog screen: VAT and import duty codes that materials and vouchers pick.
import React, { useMemo } from 'react';
import { Percent } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { SelectInput, TextArea, TextInput } from '../../components/common/FormField';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { taxRatesApi, type SaveTaxRateInput, type TaxRateRow } from '../../services/settingsApi';
import type { UserProfile } from '../../types';

const TAX_TYPES = ['VAT', 'IMPORT', 'OTHER'] as const;
const percent = (n: number) => `${n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}%`;

export const TaxRateCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const typeOptions = useMemo(() => TAX_TYPES.map(value => ({ value, label: t(`taxRates.type.${value}`) })), [t]);
  const toInput = (row: TaxRateRow): SaveTaxRateInput => ({
    code: row.code, name: row.name, taxType: row.taxType, rate: row.rate, isExempt: row.isExempt,
    note: row.note ?? '', isActive: row.isActive
  });

  const definition = useMemo((): CatalogDefinition<TaxRateRow, SaveTaxRateInput> => ({
    functionCode: 'sys_tax_rates', api: taxRatesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Percent className="h-4 w-4" />,
    texts: {
      title: t('taxRates.title'), subtitle: t('taxRates.subtitle'), noun: t('taxRates.noun'),
      add: t('taxRates.add'), searchPlaceholder: t('taxRates.search'),
      addTitle: t('taxRates.addTitle'), editTitle: row => t('taxRates.editTitle', { code: row.code }),
      fileName: 'DanhMucMaThue'
    },
    columns: [
      { key: 'code', header: t('taxRates.code'), width: '120px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('taxRates.name'), sortable: true },
      { key: 'taxType', header: t('taxRates.taxType'), width: '170px', sortable: true, render: row => t(`taxRates.type.${row.taxType}`) },
      { key: 'rate', header: t('taxRates.rate'), align: 'right', width: '120px', sortable: true,
        render: row => row.isExempt
          ? <Badge variant="slate" size="sm">{t('taxRates.exemptBadge')}</Badge>
          : <span className="font-mono">{percent(row.rate)}</span> },
      { key: 'note', header: t('taxRates.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('taxRates.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('taxRates.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('taxRates.inactive')}</Badge> },
      ...recordStampColumns<TaxRateRow>(t)
    ],
    // The type filter is a query parameter of the list and the export (type=VAT).
    filters: [{ key: 'type', label: t('taxRates.taxType'), options: typeOptions }],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('taxRates.code'), required: true, width: 16, example: 'VAT10' },
        { key: 'name', header: t('taxRates.name'), required: true, width: 28, example: 'VAT 10%' },
        { key: 'taxType', header: t('taxRates.taxType'), required: true, width: 18, example: 'VAT' },
        { key: 'rate', header: t('taxRates.rate'), type: 'number', width: 14, example: 10 },
        { key: 'isExempt', header: t('taxRates.isExempt'), type: 'boolean', width: 16, example: false },
        { key: 'note', header: t('taxRates.note'), width: 36, example: '' },
        { key: 'isActive', header: t('taxRates.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', taxType: 'VAT', rate: 0, isExempt: false, note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      taxType: input.taxType.trim().toUpperCase(), note: input.note.trim(), rate: input.isExempt ? 0 : input.rate }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t('taxRates.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20}
            className="font-mono uppercase" value={form.code} hint={t('taxRates.codeHint')}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <SelectInput label={t('taxRates.taxType')} required value={form.taxType} options={typeOptions}
            onChange={e => setForm({ ...form, taxType: e.target.value })} />
        </div>
        <TextInput label={t('taxRates.name')} required autoFocus={!!editing} maxLength={100} value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextInput label={t('taxRates.rate')} type="number" min={0} max={100} step="any" className="text-right font-mono"
          disabled={form.isExempt} value={form.isExempt ? 0 : form.rate}
          onChange={e => setForm({ ...form, rate: Number(e.target.value) })} />
        <Checkbox label={t('taxRates.isExempt')} subLabel={t('taxRates.isExemptHint')} checked={form.isExempt}
          onChange={isExempt => setForm({ ...form, isExempt, rate: isExempt ? 0 : form.rate })} />
        <TextArea label={t('taxRates.note')} rows={2} maxLength={300} value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('taxRates.isActive')} checked={form.isActive}
          onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t, typeOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
