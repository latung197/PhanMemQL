// Kho › Danh mục vị trí lưu kho (inv_location_cat), on the shared catalog screen. A location belongs to one warehouse
// (fixed once saved); its code is unique across the system. See docs/phat-trien/them-danh-muc.md.
import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogLookup, lookupApi } from '../../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition, CatalogFilter } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { locationsApi } from './api';
import type { SaveStorageLocationInput, StorageLocationRecord } from './types';

export const LocationCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [warehouseOptions, setWarehouseOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the warehouse filter (a handful of rows, read through the lookup).
  useEffect(() => {
    let alive = true;
    void lookupApi.search('warehouses', '', 1, 200, true)
      .then(page => { if (alive) setWarehouseOptions(page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<StorageLocationRecord, SaveStorageLocationInput> => ({
    functionCode: 'inv_location_cat', api: locationsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <MapPin className="h-4 w-4" />,
    texts: {
      title: t('locations.title'), subtitle: t('locations.subtitle'), noun: t('locations.noun'),
      add: t('locations.add'), searchPlaceholder: t('locations.search'),
      addTitle: t('locations.addTitle'), editTitle: row => t('locations.editTitle', { code: row.code }),
      fileName: 'DanhMucViTriLuuKho'
    },
    columns: [
      { key: 'code', header: t('locations.code'), width: '170px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('locations.name'), sortable: true },
      { key: 'warehouseName', header: t('locations.warehouse'), sortable: true, render: row => row.warehouseName || row.warehouseCode },
      { key: 'zone', header: t('locations.zone'), sortable: true, render: row => row.zone || '—' },
      { key: 'rack', header: t('locations.rack'), sortable: true, render: row => row.rack || '—' },
      { key: 'shelf', header: t('locations.shelf'), sortable: true, render: row => row.shelf || '—' },
      { key: 'capacity', header: t('locations.capacity'), align: 'right', sortable: true,
        render: row => <span className="font-mono">{row.capacity?.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) ?? '—'}</span> },
      { key: 'isActive', header: t('locations.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('locations.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('locations.inactive')}</Badge> },
      ...recordStampColumns<StorageLocationRecord>(t)
    ],
    filters: [{ key: 'warehouseCode', label: t('locations.warehouse'), options: warehouseOptions }] as CatalogFilter<StorageLocationRecord>[],
    excel: {
      columns: [
        { key: 'code', header: t('locations.code'), required: true, width: 20, example: 'KHO1-A-01' },
        { key: 'name', header: t('locations.name'), required: true, width: 32, example: 'Kệ A - Tầng 1' },
        { key: 'warehouseCode', header: t('locations.warehouse'), required: true, width: 16, example: 'KHO1' },
        { key: 'zone', header: t('locations.zone'), width: 16, example: 'Khu A' },
        { key: 'rack', header: t('locations.rack'), width: 14, example: 'A' },
        { key: 'shelf', header: t('locations.shelf'), width: 14, example: '1' },
        { key: 'capacity', header: t('locations.capacity'), type: 'number', width: 14, example: '' },
        { key: 'note', header: t('locations.note'), width: 40, example: '' },
        { key: 'isActive', header: t('locations.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, warehouseCode: row.warehouseCode, zone: row.zone ?? '', rack: row.rack ?? '',
        shelf: row.shelf ?? '', capacity: row.capacity ?? null, note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', warehouseCode: '', zone: '', rack: '', shelf: '', capacity: null, note: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, warehouseCode: row.warehouseCode, zone: row.zone ?? '', rack: row.rack ?? '',
      shelf: row.shelf ?? '', capacity: row.capacity ?? null, note: row.note ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      warehouseCode: input.warehouseCode.trim().toUpperCase(), zone: (input.zone ?? '').trim(), rack: (input.rack ?? '').trim(),
      shelf: (input.shelf ?? '').trim(), note: (input.note ?? '').trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TextInput label={t('locations.code')} required autoFocus={!editing} disabled={!!editing} maxLength={30}
            value={form.code} hint={t('locations.codeHint')}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <TextInput label={t('locations.name')} required autoFocus={!!editing} maxLength={100}
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <CatalogLookup lookup="warehouses" label={t('locations.warehouse')} required disabled={!!editing}
            value={form.warehouseCode} onChange={code => setForm({ ...form, warehouseCode: code })} />
          {editing && <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('locations.warehouseLocked')}</p>}
        </div>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
          <TextInput label={t('locations.zone')} maxLength={50} value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} />
          <TextInput label={t('locations.rack')} maxLength={50} value={form.rack} onChange={e => setForm({ ...form, rack: e.target.value })} />
          <TextInput label={t('locations.shelf')} maxLength={50} value={form.shelf} onChange={e => setForm({ ...form, shelf: e.target.value })} />
        </div>
        <TextInput label={t('locations.capacity')} type="number" min={0} step="any" className="text-right font-mono"
          value={form.capacity ?? ''} onChange={e => setForm({ ...form, capacity: e.target.value === '' ? null : Number(e.target.value) })} />
        <TextArea label={t('locations.note')} rows={2} maxLength={300} value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('locations.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'xl'
  }), [t, warehouseOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
