import React, { useMemo } from 'react';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';
import { TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { warehousesApi } from './api';
import type { WarehouseRecord, SaveWarehouseInput } from './types';

export const WarehouseCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
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
      { key: 'warehouseTypeName', header: t('warehouses.type'), sortable: true,
        render: row => row.warehouseTypeName || row.warehouseTypeCode || '—' },
      { key: 'address', header: t('warehouses.address'), render: row => row.address || '—' },
      { key: 'manager', header: t('warehouses.manager'), render: row => row.manager || '—' },
      { key: 'capacity', header: t('warehouses.capacity'), render: row => row.capacity || '—' },
      { key: 'isActive', header: t('warehouses.status'), align: 'center', width: '140px',
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('warehouses.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('warehouses.inactive')}</Badge> },
      ...recordStampColumns<WarehouseRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.warehouseTypeCode ?? ''} ${row.warehouseTypeName ?? ''} ${row.address ?? ''} ${row.manager ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('warehouses.code'), required: true, width: 20, example: 'KH-HCM-01' },
        { key: 'name', header: t('warehouses.name'), required: true, width: 32, example: 'Kho Tổng TP. Hồ Chí Minh' },
        { key: 'warehouseTypeCode', header: t('warehouses.typeCode'), width: 22, example: '' },
        { key: 'address', header: t('warehouses.address'), width: 40, example: '' },
        { key: 'manager', header: t('warehouses.manager'), width: 28, example: '' },
        { key: 'capacity', header: t('warehouses.capacity'), width: 20, example: '' },
        { key: 'isActive', header: t('warehouses.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, warehouseTypeCode: row.warehouseTypeCode ?? '', address: row.address ?? '',
        manager: row.manager ?? '', capacity: row.capacity ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', warehouseTypeCode: '', address: '', manager: '', capacity: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, warehouseTypeCode: row.warehouseTypeCode ?? '', address: row.address ?? '',
      manager: row.manager ?? '', capacity: row.capacity ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      warehouseTypeCode: (input.warehouseTypeCode ?? '').trim().toUpperCase(),
      address: input.address.trim(), manager: input.manager.trim(), capacity: input.capacity.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('warehouses.code')} required autoFocus={!editing} disabled={!!editing}
          maxLength={20} value={form.code} hint={t('warehouses.codeHint')}
          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('warehouses.name')} required autoFocus={!!editing} maxLength={100}
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
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
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
