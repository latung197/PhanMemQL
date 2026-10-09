// Kho › Danh mục kho (inv_warehouse_cat), on the shared catalog screen. A warehouse has a type and the company units
// that may use it (several; none = shared by every unit). See docs/them-danh-muc.md.
import React, { useEffect, useMemo, useState } from 'react';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { CatalogLookup, CatalogMultiLookup, lookupApi } from '../../../../components/catalog/CatalogLookup';
import { TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition, CatalogFilter } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { warehousesApi } from './api';
import type { WarehouseRecord, SaveWarehouseInput } from './types';

const splitCodes = (text: string): string[] => text.split(/[\s,;]+/).map(code => code.trim().toUpperCase()).filter(Boolean);

export const WarehouseCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [typeOptions, setTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [unitOptions, setUnitOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the two filters: the warehouse types and the company units (a handful of rows each).
  useEffect(() => {
    let alive = true;
    const toOptions = (items: { code: string; name: string }[]) => items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }));
    void lookupApi.search('warehouseTypes', '', 1, 200, true).then(page => { if (alive) setTypeOptions(toOptions(page.items)); }).catch(() => {});
    void lookupApi.search('companyUnits', '', 1, 200, true).then(page => { if (alive) setUnitOptions(toOptions(page.items)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<WarehouseRecord, SaveWarehouseInput> => ({
    functionCode: 'inv_warehouse_cat', api: warehousesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <WarehouseIcon className="h-4 w-4" />,
    texts: {
      title: t('warehouses.title'), subtitle: t('warehouses.subtitle'), noun: t('warehouses.noun'),
      add: t('warehouses.add'), searchPlaceholder: t('warehouses.search'),
      addTitle: t('warehouses.addTitle'), editTitle: row => t('warehouses.editTitle', { code: row.code }),
      fileName: 'DanhMucKho'
    },
    columns: [
      { key: 'code', header: t('warehouses.code'), width: '150px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('warehouses.name'), sortable: true },
      { key: 'units', header: t('warehouses.units'),
        render: row => row.unitCodes.length === 0
          ? <Badge variant="slate" size="sm">{t('warehouses.shared')}</Badge>
          : <span className="font-mono text-[11px]">{row.unitCodes.join(', ')}</span> },
      { key: 'warehouseTypeName', header: t('warehouses.type'), sortable: true,
        render: row => row.warehouseTypeName || row.warehouseTypeCode || '—' },
      { key: 'address', header: t('warehouses.address'), sortable: true, render: row => row.address || '—' },
      { key: 'manager', header: t('warehouses.manager'), sortable: true, render: row => row.manager || '—' },
      { key: 'capacity', header: t('warehouses.capacity'), sortable: true, render: row => row.capacity || '—' },
      { key: 'isActive', header: t('warehouses.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('warehouses.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('warehouses.inactive')}</Badge> },
      ...recordStampColumns<WarehouseRecord>(t)
    ],
    filters: [
      { key: 'warehouseTypeCode', label: t('warehouses.type'), options: typeOptions },
      { key: 'unitCode', label: t('warehouses.filterUnit'), options: unitOptions }
    ] as CatalogFilter<WarehouseRecord>[],
    excel: {
      columns: [
        { key: 'code', header: t('warehouses.code'), required: true, width: 20, example: 'KH-HCM-01' },
        { key: 'name', header: t('warehouses.name'), required: true, width: 32, example: 'Kho Tổng TP. Hồ Chí Minh' },
        { key: 'unitCodes', header: t('warehouses.units'), width: 30, example: 'DVCS01, DVCS02' },
        { key: 'warehouseTypeCode', header: t('warehouses.typeCode'), width: 22, example: '' },
        { key: 'address', header: t('warehouses.address'), width: 40, example: '' },
        { key: 'manager', header: t('warehouses.manager'), width: 28, example: '' },
        { key: 'capacity', header: t('warehouses.capacity'), width: 20, example: '' },
        { key: 'isActive', header: t('warehouses.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, unitCodes: row.unitCodes.join(', '), warehouseTypeCode: row.warehouseTypeCode ?? '',
        address: row.address ?? '', manager: row.manager ?? '', capacity: row.capacity ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', unitCodes: '', warehouseTypeCode: '', address: '', manager: '', capacity: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, unitCodes: row.unitCodes.join(','), warehouseTypeCode: row.warehouseTypeCode ?? '',
      address: row.address ?? '', manager: row.manager ?? '', capacity: row.capacity ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      unitCodes: splitCodes(input.unitCodes ?? '').join(','),
      warehouseTypeCode: (input.warehouseTypeCode ?? '').trim().toUpperCase(),
      address: input.address.trim(), manager: input.manager.trim(), capacity: input.capacity.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('warehouses.code')} required autoFocus={!editing} disabled={!!editing}
          maxLength={20} value={form.code} hint={t('warehouses.codeHint')}
          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('warehouses.name')} required autoFocus={!!editing} maxLength={100}
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <div className="space-y-1">
          <CatalogMultiLookup lookup="companyUnits" label={t('warehouses.units')} value={splitCodes(form.unitCodes)}
            onChange={codes => setForm({ ...form, unitCodes: codes.join(',') })} />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('warehouses.unitsHint')}</p>
        </div>
        <CatalogLookup lookup="warehouseTypes" label={t('warehouses.type')}
          value={form.warehouseTypeCode} onChange={code => setForm({ ...form, warehouseTypeCode: code })} />
        <TextInput label={t('warehouses.address')} maxLength={300} value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })} />
        <TextInput label={t('warehouses.manager')} maxLength={100} value={form.manager}
          onChange={e => setForm({ ...form, manager: e.target.value })} />
        <TextInput label={t('warehouses.capacity')} maxLength={100} value={form.capacity}
          onChange={e => setForm({ ...form, capacity: e.target.value })} />
        <Checkbox label={t('warehouses.isActive')} checked={form.isActive}
          onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t, typeOptions, unitOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
