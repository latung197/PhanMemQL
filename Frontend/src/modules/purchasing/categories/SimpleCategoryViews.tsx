// Mua hàng › Danh mục điều khoản thanh toán (pur_payment_term_cat) and Danh mục nhóm nhà cung cấp (pur_supplier_group_cat),
// both on the shared catalog screen.
import React, { useMemo } from 'react';
import { CalendarClock, Users } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import type { UserProfile } from '../../../types';
import {
  paymentTermsApi, supplierGroupsApi,
  type PaymentTermRecord, type SavePaymentTermInput, type SaveSupplierGroupInput, type SupplierGroupRecord
} from './api';

export const PaymentTermCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toInput = (row: PaymentTermRecord): SavePaymentTermInput => ({ code: row.code, name: row.name, days: row.days, note: row.note ?? '', isActive: row.isActive });
  const definition = useMemo((): CatalogDefinition<PaymentTermRecord, SavePaymentTermInput> => ({
    functionCode: 'pur_payment_term_cat', codeChange: { lookup: 'paymentTerms' }, api: paymentTermsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <CalendarClock className="h-4 w-4" />,
    texts: {
      title: t('paymentTerms.title'), subtitle: t('paymentTerms.subtitle'), noun: t('paymentTerms.noun'),
      add: t('paymentTerms.add'), searchPlaceholder: t('paymentTerms.search'),
      addTitle: t('paymentTerms.addTitle'), editTitle: row => t('paymentTerms.editTitle', { code: row.code }),
      fileName: 'DanhMucDieuKhoanThanhToan'
    },
    columns: [
      { key: 'code', header: t('paymentTerms.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('paymentTerms.name'), sortable: true },
      { key: 'days', header: t('paymentTerms.days'), align: 'right', width: '130px', sortable: true,
        render: row => row.days === 0 ? t('paymentTerms.atOnce') : <span className="font-mono">{row.days}</span> },
      { key: 'note', header: t('paymentTerms.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('paymentTerms.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('paymentTerms.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('paymentTerms.notInUse')}</Badge> },
      ...recordStampColumns<PaymentTermRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('paymentTerms.code'), required: true, width: 16, example: 'NET30' },
        { key: 'name', header: t('paymentTerms.name'), required: true, width: 30, example: 'Công nợ 30 ngày' },
        { key: 'days', header: t('paymentTerms.days'), type: 'number', width: 16, example: 30 },
        { key: 'note', header: t('paymentTerms.note'), width: 40, example: '' },
        { key: 'isActive', header: t('paymentTerms.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', days: 0, note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), days: Math.trunc(Number(input.days) || 0), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <TextInput label={t('paymentTerms.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
            value={form.code} hint={t('paymentTerms.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <TextInput label={t('paymentTerms.days')} type="number" min={0} max={1000} className="text-right font-mono" value={form.days}
            hint={t('paymentTerms.daysHint')} onChange={e => setForm({ ...form, days: Number(e.target.value) || 0 })} />
        </div>
        <TextInput label={t('paymentTerms.name')} required autoFocus={!!editing} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('paymentTerms.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('paymentTerms.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'lg'
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};

export const SupplierGroupCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toInput = (row: SupplierGroupRecord): SaveSupplierGroupInput => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive });
  const definition = useMemo((): CatalogDefinition<SupplierGroupRecord, SaveSupplierGroupInput> => ({
    functionCode: 'pur_supplier_group_cat', codeChange: { lookup: 'supplierGroups' }, api: supplierGroupsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Users className="h-4 w-4" />,
    texts: {
      title: t('supplierGroups.title'), subtitle: t('supplierGroups.subtitle'), noun: t('supplierGroups.noun'),
      add: t('supplierGroups.add'), searchPlaceholder: t('supplierGroups.search'),
      addTitle: t('supplierGroups.addTitle'), editTitle: row => t('supplierGroups.editTitle', { code: row.code }),
      fileName: 'DanhMucNhomNhaCungCap'
    },
    columns: [
      { key: 'code', header: t('supplierGroups.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('supplierGroups.name'), sortable: true },
      { key: 'note', header: t('supplierGroups.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('supplierGroups.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('supplierGroups.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('supplierGroups.notInUse')}</Badge> },
      ...recordStampColumns<SupplierGroupRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('supplierGroups.code'), required: true, width: 16, example: 'NCC-VT' },
        { key: 'name', header: t('supplierGroups.name'), required: true, width: 30, example: 'Nhà cung cấp vật tư' },
        { key: 'note', header: t('supplierGroups.note'), width: 40, example: '' },
        { key: 'isActive', header: t('supplierGroups.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('supplierGroups.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
          value={form.code} hint={t('supplierGroups.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('supplierGroups.name')} required autoFocus={!!editing} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('supplierGroups.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('supplierGroups.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'lg'
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
