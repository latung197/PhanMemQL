import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { suppliersApi } from './api';
import type { SaveSupplierInput, SupplierRecord } from './types';

export const SupplierCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const definition = useMemo((): CatalogDefinition<SupplierRecord, SaveSupplierInput> => ({
    functionCode: 'inv_supplier_cat', api: suppliersApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Building2 className="h-4 w-4" />,
    texts: {
      title: t('suppliers.title'), subtitle: t('suppliers.subtitle'), noun: t('suppliers.noun'),
      add: t('suppliers.add'), searchPlaceholder: t('suppliers.search'),
      addTitle: t('suppliers.addTitle'), editTitle: row => t('suppliers.editTitle', { code: row.code }),
      fileName: 'DanhMucNhaCungCap'
    },
    columns: [
      { key: 'code', header: t('suppliers.code'), width: '145px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('suppliers.name'), sortable: true },
      { key: 'taxCode', header: t('suppliers.taxCode'), sortable: true, render: row => row.taxCode || '—' },
      { key: 'phone', header: t('suppliers.phone'), render: row => row.phone || '—' },
      { key: 'address', header: t('suppliers.address'), render: row => row.address || '—' },
      { key: 'isActive', header: t('suppliers.status'), align: 'center', width: '130px',
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('suppliers.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('suppliers.inactive')}</Badge> },
      ...recordStampColumns<SupplierRecord>(t)
    ],
    excel: {
      columns: [
        { key: 'code', header: t('suppliers.code'), required: true, width: 20, example: 'NCC-001' },
        { key: 'name', header: t('suppliers.name'), required: true, width: 35, example: 'Công ty TNHH Minh Anh' },
        { key: 'taxCode', header: t('suppliers.taxCode'), width: 20 },
        { key: 'phone', header: t('suppliers.phone'), width: 20 },
        { key: 'address', header: t('suppliers.address'), width: 42 },
        { key: 'note', header: t('suppliers.note'), width: 40 },
        { key: 'isActive', header: t('suppliers.isActive'), type: 'boolean', width: 16, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, taxCode: row.taxCode ?? '', phone: row.phone ?? '',
        address: row.address ?? '', note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', taxCode: '', phone: '', address: '', note: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, taxCode: row.taxCode ?? '', phone: row.phone ?? '',
      address: row.address ?? '', note: row.note ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      taxCode: input.taxCode.trim(), phone: input.phone.trim(), address: input.address.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => <>
      <TextInput label={t('suppliers.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20}
        value={form.code} hint={t('suppliers.codeHint')}
        onChange={event => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, '') })} />
      <TextInput label={t('suppliers.name')} required autoFocus={!!editing} maxLength={200}
        value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label={t('suppliers.taxCode')} maxLength={30} value={form.taxCode}
          onChange={event => setForm({ ...form, taxCode: event.target.value })} />
        <TextInput label={t('suppliers.phone')} maxLength={30} value={form.phone}
          onChange={event => setForm({ ...form, phone: event.target.value })} />
      </div>
      <TextInput label={t('suppliers.address')} maxLength={300} value={form.address}
        onChange={event => setForm({ ...form, address: event.target.value })} />
      <TextArea label={t('suppliers.note')} rows={2} maxLength={300} value={form.note}
        onChange={event => setForm({ ...form, note: event.target.value })} />
      <Checkbox label={t('suppliers.isActive')} checked={form.isActive}
        onChange={isActive => setForm({ ...form, isActive })} />
    </>
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
