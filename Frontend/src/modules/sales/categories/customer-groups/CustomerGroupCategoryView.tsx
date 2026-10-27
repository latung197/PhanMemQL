// Bán hàng › Danh mục nhóm khách hàng (sales_customer_group_cat), on the shared catalog screen.
import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { customerGroupsApi } from './api';
import type { CustomerGroupRecord, SaveCustomerGroupInput } from './types';

export const CustomerGroupCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toInput = (row: CustomerGroupRecord): SaveCustomerGroupInput => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive });
  const definition = useMemo((): CatalogDefinition<CustomerGroupRecord, SaveCustomerGroupInput> => ({
    functionCode: 'sales_customer_group_cat', codeChange: { lookup: 'customerGroups' }, api: customerGroupsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Users className="h-4 w-4" />,
    texts: {
      title: t('customerGroups.title'), noun: t('customerGroups.noun'),
      add: t('customerGroups.add'), searchPlaceholder: t('customerGroups.search'),
      addTitle: t('customerGroups.addTitle'), editTitle: row => t('customerGroups.editTitle', { code: row.code }),
      fileName: 'DanhMucNhomKhachHang'
    },
    columns: [
      { key: 'code', header: t('customerGroups.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('customerGroups.name'), sortable: true },
      { key: 'note', header: t('customerGroups.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('customerGroups.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('customerGroups.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('customerGroups.notInUse')}</Badge> },
      ...recordStampColumns<CustomerGroupRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('customerGroups.code'), required: true, width: 16, example: 'KH-DL' },
        { key: 'name', header: t('customerGroups.name'), required: true, width: 30, example: 'Đại lý cấp 1' },
        { key: 'note', header: t('customerGroups.note'), width: 40, example: '' },
        { key: 'isActive', header: t('customerGroups.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('customerGroups.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
          value={form.code} hint={t('customerGroups.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('customerGroups.name')} required autoFocus={!!editing} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('customerGroups.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('customerGroups.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'lg'
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
