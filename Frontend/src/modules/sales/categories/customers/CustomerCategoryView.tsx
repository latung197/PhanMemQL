// Bán hàng › Danh mục khách hàng (sales_customers), on the shared catalog screen: code, name, tax code, contact, group,
// default payment term and credit limit. Other screens pick a customer with the lookup "customers".
import React, { useEffect, useMemo, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { CatalogLookup, lookupApi } from '../../../../components/catalog/CatalogLookup';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import type { UserProfile } from '../../../../types';
import { customersApi } from './api';
import type { CustomerRecord, SaveCustomerInput } from './types';

export const CustomerCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const { formatNumber } = useNumberFormat();
  // Choices of the group filter (a handful of rows, read through the lookup).
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    void lookupApi.search('customerGroups', '', 1, 200, true)
      .then(page => { if (alive) setGroupOptions(page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const toInput = (row: CustomerRecord): SaveCustomerInput => ({
    code: row.code, name: row.name, taxCode: row.taxCode ?? '', phone: row.phone ?? '', email: row.email ?? '', contactName: row.contactName ?? '',
    address: row.address ?? '', customerGroupCode: row.customerGroupCode ?? '', paymentTermCode: row.paymentTermCode ?? '',
    creditLimit: row.creditLimit, note: row.note ?? '', isActive: row.isActive
  });
  const definition = useMemo((): CatalogDefinition<CustomerRecord, SaveCustomerInput> => ({
    functionCode: 'sales_customers', codeChange: { lookup: 'customers' }, api: customersApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <UserCheck className="h-4 w-4" />,
    texts: {
      title: t('customers.title'), noun: t('customers.noun'),
      add: t('customers.add'), searchPlaceholder: t('customers.search'),
      addTitle: t('customers.addTitle'), editTitle: row => t('customers.editTitle', { code: row.code }),
      fileName: 'DanhMucKhachHang'
    },
    columns: [
      { key: 'code', header: t('customers.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('customers.name'), width: '240px', sortable: true },
      { key: 'taxCode', header: t('customers.taxCode'), sortable: true, render: row => row.taxCode || '—' },
      { key: 'customerGroupCode', header: t('customers.group'), render: row => row.customerGroupName || row.customerGroupCode || '—' },
      { key: 'contactName', header: t('customers.contactName'), render: row => <div><div>{row.contactName || '—'}</div><div className="text-[10px] text-slate-500">{row.phone || row.email || ''}</div></div> },
      { key: 'paymentTermCode', header: t('customers.paymentTerm'), render: row => row.paymentTermName || row.paymentTermCode || '—' },
      { key: 'creditLimit', header: t('customers.creditLimit'), align: 'right', sortable: true,
        render: row => row.creditLimit > 0 ? <span className="font-mono">{formatNumber(row.creditLimit)}</span> : <span className="text-slate-400">{t('customers.unlimited')}</span> },
      { key: 'isActive', header: t('customers.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('customers.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('customers.inactive')}</Badge> },
      ...recordStampColumns<CustomerRecord>(t)
    ],
    filters: [{ key: 'group', label: t('customers.group'), options: groupOptions }],
    excel: {
      columns: [
        { key: 'code', header: t('customers.code'), required: true, width: 18, example: 'KH001' },
        { key: 'name', header: t('customers.name'), required: true, width: 36, example: 'Công ty TNHH Bình Minh' },
        { key: 'taxCode', header: t('customers.taxCode'), width: 18 },
        { key: 'phone', header: t('customers.phone'), width: 18 },
        { key: 'email', header: t('customers.email'), width: 28 },
        { key: 'contactName', header: t('customers.contactName'), width: 24 },
        { key: 'address', header: t('customers.address'), width: 40 },
        { key: 'customerGroupCode', header: t('customers.groupCode'), width: 20 },
        { key: 'paymentTermCode', header: t('customers.paymentTermCode'), width: 22 },
        { key: 'creditLimit', header: t('customers.creditLimit'), type: 'number', width: 18, example: 0 },
        { key: 'note', header: t('customers.note'), width: 36 },
        { key: 'isActive', header: t('customers.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', taxCode: '', phone: '', email: '', contactName: '', address: '', customerGroupCode: '', paymentTermCode: '', creditLimit: 0, note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), taxCode: input.taxCode.trim(), phone: input.phone.trim(),
      email: input.email.trim(), contactName: input.contactName.trim(), address: input.address.trim(),
      customerGroupCode: (input.customerGroupCode ?? '').trim().toUpperCase(), paymentTermCode: (input.paymentTermCode ?? '').trim().toUpperCase(),
      creditLimit: Number(input.creditLimit) || 0, note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <TextInput label={t('customers.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
            value={form.code} hint={t('customers.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <TextInput label={t('customers.taxCode')} maxLength={30} value={form.taxCode} onChange={e => setForm({ ...form, taxCode: e.target.value })} />
        </div>
        <TextInput label={t('customers.name')} required autoFocus={!!editing} maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
          <TextInput label={t('customers.contactName')} maxLength={100} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
          <TextInput label={t('customers.phone')} maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <TextInput label={t('customers.email')} type="email" maxLength={100} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <TextInput label={t('customers.address')} maxLength={300} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
          <CatalogLookup lookup="customerGroups" label={t('customers.group')} value={form.customerGroupCode} onChange={code => setForm({ ...form, customerGroupCode: code })} />
          <CatalogLookup lookup="paymentTerms" label={t('customers.paymentTerm')} value={form.paymentTermCode} onChange={code => setForm({ ...form, paymentTermCode: code })} />
          <TextInput label={t('customers.creditLimit')} type="number" min={0} step="any" className="text-right font-mono" value={form.creditLimit || ''}
            hint={t('customers.creditLimitHint')} onChange={e => setForm({ ...form, creditLimit: e.target.value === '' ? 0 : Number(e.target.value) })} />
        </div>
        <TextArea label={t('customers.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('customers.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: '2xl'
  }), [t, groupOptions, formatNumber]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
