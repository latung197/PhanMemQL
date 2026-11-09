// Kho › Định mức tồn kho (inv_stock_norm_cat), on the shared catalog screen. A norm is keyed by material + warehouse ("VT001@KHO1"),
// fixed once saved. The stock report reads the minimum / maximum from here (the material's own limits are the fallback).
import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogLookup, lookupApi } from '../../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition, CatalogFilter } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { stockNormsApi } from './api';
import type { SaveStockNormInput, StockNormRecord } from './types';

const quantity = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: 4 }));
type NumberKey = 'minQuantity' | 'maxQuantity' | 'safetyQuantity' | 'reorderPoint';

export const StockNormCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [warehouseOptions, setWarehouseOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the warehouse filter (read through the lookup).
  useEffect(() => {
    let alive = true;
    void lookupApi.search('warehouses', '', 1, 200, true)
      .then(page => { if (alive) setWarehouseOptions(page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<StockNormRecord, SaveStockNormInput> => {
    const toInput = (row: StockNormRecord): SaveStockNormInput => ({
      materialCode: row.materialCode, warehouseCode: row.warehouseCode, minQuantity: row.minQuantity ?? null, maxQuantity: row.maxQuantity ?? null,
      safetyQuantity: row.safetyQuantity ?? null, reorderPoint: row.reorderPoint ?? null, note: row.note ?? '', isActive: row.isActive
    });
    const qtyColumn = (key: NumberKey) => ({
      key, header: t(`stockNorms.${key}`), align: 'right' as const, width: '130px', sortable: true,
      render: (row: StockNormRecord) => <span className="font-mono">{quantity(row[key])}</span>
    });
    return {
      functionCode: 'inv_stock_norm_cat', api: stockNormsApi,
      keyOf: row => row.code, describe: row => `${row.materialCode} / ${row.warehouseCode}`,
      icon: <ShieldAlert className="h-4 w-4" />,
      texts: {
        title: t('stockNorms.title'), subtitle: t('stockNorms.subtitle'), noun: t('stockNorms.noun'),
        add: t('stockNorms.add'), searchPlaceholder: t('stockNorms.search'),
        addTitle: t('stockNorms.addTitle'), editTitle: row => t('stockNorms.editTitle', { code: `${row.materialCode} / ${row.warehouseCode}` }),
        fileName: 'DinhMucTonKho'
      },
      columns: [
        { key: 'materialCode', header: t('stockNorms.material'), sortable: true,
          render: row => <span><span className="font-mono font-bold">{row.materialCode}</span>{row.materialName ? ` - ${row.materialName}` : ''}</span> },
        { key: 'warehouseCode', header: t('stockNorms.warehouse'), sortable: true,
          render: row => <span><span className="font-mono">{row.warehouseCode}</span>{row.warehouseName ? ` - ${row.warehouseName}` : ''}</span> },
        { key: 'uomCode', header: t('stockNorms.uom'), width: '90px', render: row => row.uomCode ?? '—' },
        qtyColumn('minQuantity'), qtyColumn('maxQuantity'), qtyColumn('safetyQuantity'), qtyColumn('reorderPoint'),
        { key: 'isActive', header: t('stockNorms.status'), align: 'center', width: '140px', sortable: true,
          render: row => row.isActive
            ? <Badge variant="success" size="sm">{t('stockNorms.active')}</Badge>
            : <Badge variant="slate" size="sm">{t('stockNorms.inactive')}</Badge> },
        ...recordStampColumns<StockNormRecord>(t)
      ],
      filters: [{ key: 'warehouseCode', label: t('stockNorms.warehouse'), options: warehouseOptions }] as CatalogFilter<StockNormRecord>[],
      excel: {
        columns: [
          { key: 'materialCode', header: t('stockNorms.material'), required: true, width: 22, example: 'LAP-DELL-XPS15' },
          { key: 'warehouseCode', header: t('stockNorms.warehouse'), required: true, width: 16, example: 'KHO1' },
          { key: 'minQuantity', header: t('stockNorms.minQuantity'), type: 'number', width: 16, example: 10 },
          { key: 'maxQuantity', header: t('stockNorms.maxQuantity'), type: 'number', width: 16, example: 100 },
          { key: 'safetyQuantity', header: t('stockNorms.safetyQuantity'), type: 'number', width: 16, example: 20 },
          { key: 'reorderPoint', header: t('stockNorms.reorderPoint'), type: 'number', width: 18, example: 30 },
          { key: 'note', header: t('stockNorms.note'), width: 40, example: '' },
          { key: 'isActive', header: t('stockNorms.isActive'), type: 'boolean', width: 14, example: true }
        ],
        toRow: row => toInput(row)
      },
      emptyInput: { materialCode: '', warehouseCode: '', minQuantity: null, maxQuantity: null, safetyQuantity: null, reorderPoint: null, note: '', isActive: true },
      toInput,
      normalize: input => ({ ...input, materialCode: input.materialCode.trim().toUpperCase(), warehouseCode: input.warehouseCode.trim().toUpperCase(), note: (input.note ?? '').trim() }),
      renderForm: ({ form, setForm, editing }) => {
        const number = (key: NumberKey) => (
          <TextInput label={t(`stockNorms.${key}`)} type="number" min={0} step="any" className="text-right font-mono"
            value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value === '' ? null : Number(e.target.value) })} />
        );
        return (
          <>
            <div className="space-y-1">
              <CatalogLookup lookup="materials" label={t('stockNorms.material')} required disabled={!!editing}
                value={form.materialCode} onChange={code => setForm({ ...form, materialCode: code })}
                extraColumns={[{ key: 'uomCode', title: t('stockNorms.uom') }]} />
              <CatalogLookup lookup="warehouses" label={t('stockNorms.warehouse')} required disabled={!!editing}
                value={form.warehouseCode} onChange={code => setForm({ ...form, warehouseCode: code })} />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{editing ? t('stockNorms.keyHint') : t('stockNorms.materialHint')}</p>
            </div>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              {number('minQuantity')}{number('maxQuantity')}{number('safetyQuantity')}{number('reorderPoint')}
            </div>
            <TextArea label={t('stockNorms.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            <Checkbox label={t('stockNorms.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
          </>
        );
      },
      formWidth: 'xl'
    };
  }, [t, warehouseOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
