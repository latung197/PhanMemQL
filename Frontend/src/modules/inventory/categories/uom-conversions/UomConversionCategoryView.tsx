// Kho › Quy đổi đơn vị tính. The shared catalog owns CRUD, Excel, permissions, stamps and versions.
import React, { useMemo } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { FormField, SelectInput, TextArea, TextInput } from '../../../../components/common/FormField';
import { NumberInput } from '../../../../components/common/NumberInput';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import type { Product, UserProfile } from '../../../../types';
import { uomConversionsApi } from './api';
import type { SaveUomConversionInput, UomConversionRecord } from './types';

export const UomConversionCategoryView: React.FC<{ currentUser?: UserProfile; products?: Product[] }> = ({ currentUser, products = [] }) => {
  const { t } = useLanguage();
  const { formatNumber } = useNumberFormat();
  const definition = useMemo((): CatalogDefinition<UomConversionRecord, SaveUomConversionInput> => ({
    functionCode: 'inv_uom_conversion_cat', api: uomConversionsApi,
    keyOf: row => row.code, describe: row => row.code, icon: <ArrowRightLeft className="h-4 w-4" />,
    texts: {
      title: t('uomConversions.title'), subtitle: t('uomConversions.subtitle'), noun: t('uomConversions.noun'),
      add: t('uomConversions.add'), searchPlaceholder: t('uomConversions.search'),
      addTitle: t('uomConversions.addTitle'), editTitle: row => t('uomConversions.editTitle', { code: row.code }),
      fileName: 'DanhMucQuyDoiDonViTinh'
    },
    columns: [
      { key: 'code', header: t('uomConversions.code'), width: '155px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'materialCode', header: t('uomConversions.material'), sortable: true,
        render: row => row.materialCode ? `${row.materialCode} - ${row.materialName ?? ''}` : t('uomConversions.global') },
      { key: 'fromUomCode', header: t('uomConversions.fromUom'), width: '155px', sortable: true,
        render: row => `${row.fromUomCode} - ${row.fromUomName}` },
      { key: 'factor', header: t('uomConversions.factor'), width: '115px', align: 'right', sortable: true,
        render: row => {
          const decimals = (row.factor.toFixed(8).split('.')[1] ?? '').replace(/0+$/, '').length;
          return formatNumber(row.factor, decimals);
        } },
      { key: 'toUomCode', header: t('uomConversions.toUom'), width: '155px', sortable: true,
        render: row => `${row.toUomCode} - ${row.toUomName}` },
      { key: 'note', header: t('uomConversions.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('uomConversions.status'), width: '130px', align: 'center',
        render: row => row.isActive ? <Badge variant="success" size="sm">{t('uomConversions.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('uomConversions.inactive')}</Badge> },
      ...recordStampColumns<UomConversionRecord>(t)
    ],
    searchText: row => `${row.code} ${row.materialCode ?? ''} ${row.materialName ?? ''} ${row.fromUomCode} ${row.fromUomName} ${row.toUomCode} ${row.toUomName} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('uomConversions.code'), required: true, width: 22, example: 'THUNG-HOP' },
        { key: 'materialCode', header: t('uomConversions.materialCode'), width: 24, example: '' },
        { key: 'materialName', header: t('uomConversions.materialName'), width: 32, example: '' },
        { key: 'fromUomCode', header: t('uomConversions.fromUom'), required: true, width: 18, example: 'THUNG' },
        { key: 'toUomCode', header: t('uomConversions.toUom'), required: true, width: 18, example: 'HOP' },
        { key: 'factor', header: t('uomConversions.factor'), type: 'number', required: true, width: 18, example: 20 },
        { key: 'note', header: t('uomConversions.note'), width: 35, example: '' },
        { key: 'isActive', header: t('uomConversions.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, materialCode: row.materialCode ?? '', materialName: row.materialName ?? '',
        fromUomCode: row.fromUomCode, toUomCode: row.toUomCode, factor: row.factor, note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', materialCode: '', materialName: '', fromUomCode: '', toUomCode: '', factor: 1, note: '', isActive: true },
    toInput: row => ({ code: row.code, materialCode: row.materialCode ?? '', materialName: row.materialName ?? '',
      fromUomCode: row.fromUomCode, toUomCode: row.toUomCode, factor: row.factor, note: row.note ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), materialCode: input.materialCode.trim().toUpperCase(),
      materialName: input.materialName.trim(), fromUomCode: input.fromUomCode.trim().toUpperCase(),
      toUomCode: input.toUomCode.trim().toUpperCase(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('uomConversions.code')} required maxLength={40} disabled={!!editing} value={form.code}
          hint={t('uomConversions.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <SelectInput label={t('uomConversions.material')} value={form.materialCode}
          placeholder={t('uomConversions.global')} onChange={e => {
            const product = products.find(p => p.sku === e.target.value);
            setForm({ ...form, materialCode: product?.sku ?? '', materialName: product?.name ?? '' });
          }}>
          {products.map(p => <option key={p.id} value={p.sku}>{p.sku} - {p.name}</option>)}
          {form.materialCode && !products.some(p => p.sku === form.materialCode) &&
            <option value={form.materialCode}>{form.materialCode} - {form.materialName}</option>}
        </SelectInput>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CatalogLookup lookup="uoms" label={t('uomConversions.fromUom')} required value={form.fromUomCode}
            onChange={code => setForm({ ...form, fromUomCode: code })}
            extraColumns={[{ key: 'symbol', title: t('uoms.symbol') }]} />
          <CatalogLookup lookup="uoms" label={t('uomConversions.toUom')} required value={form.toUomCode}
            onChange={code => setForm({ ...form, toUomCode: code })}
            extraColumns={[{ key: 'symbol', title: t('uoms.symbol') }]} />
        </div>
        <FormField label={t('uomConversions.factor')} required hint={t('uomConversions.factorHint')}>
          {id => <NumberInput id={id} value={form.factor} onChange={factor => setForm({ ...form, factor })}
            min={0.00000001} decimals={8} />}
        </FormField>
        <TextArea label={t('uomConversions.note')} rows={2} maxLength={300} value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('uomConversions.isActive')} checked={form.isActive}
          onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ), formWidth: 'lg'
  }), [t, products, formatNumber]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
