// Tài chính › Hệ thống tài khoản kế toán (fin_account_cat), on the shared catalog screen. The chart has several levels: the list is sorted by
// the code (a child's code starts with its parent's), so it reads as a tree, with the name indented by level.
import React, { useMemo } from 'react';
import { ListTree } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { SelectInput, TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogLookup } from '../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import type { UserProfile } from '../../../types';
import { accountsApi } from './api';
import { ACCOUNT_NATURES, ACCOUNT_TYPES, type AccountRecord, type AccountType, type SaveAccountInput } from './types';

export const AccountCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const typeOptions = useMemo(() => ACCOUNT_TYPES.map(value => ({ value, label: t(`accounts.type.${value}`) })), [t]);
  const natureOptions = useMemo(() => ACCOUNT_NATURES.map(value => ({ value, label: t(`accounts.natureValue.${value}`) })), [t]);
  const levelOptions = useMemo(() => [1, 2, 3, 4].map(n => ({ value: String(n), label: t('accounts.levelValue', { n }) })), [t]);
  const toInput = (row: AccountRecord): SaveAccountInput => ({
    code: row.code, name: row.name, nameEn: row.nameEn ?? '', parentAccountCode: row.parentAccountCode ?? '',
    accountType: row.accountType, nature: row.nature, note: row.note ?? '', isActive: row.isActive
  });

  const definition = useMemo((): CatalogDefinition<AccountRecord, SaveAccountInput> => ({
    functionCode: 'fin_account_cat', api: accountsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <ListTree className="h-4 w-4" />,
    texts: {
      title: t('accounts.title'), noun: t('accounts.noun'),
      add: t('accounts.add'), searchPlaceholder: t('accounts.search'),
      addTitle: t('accounts.addTitle'), editTitle: row => t('accounts.editTitle', { code: row.code }),
      fileName: 'HeThongTaiKhoanKeToan'
    },
    columns: [
      { key: 'code', header: t('accounts.code'), width: '100px', sortable: true,
        render: row => <span className={`font-mono ${row.hasChildren ? 'font-extrabold' : 'font-semibold'}`}>{row.code}</span> },
      { key: 'name', header: t('accounts.name'), width: '380px', sortable: true,
        render: row => (
          <div style={{ paddingLeft: `${(row.level - 1) * 16}px` }} className={row.hasChildren ? 'font-bold' : ''}>
            <div>{row.name}</div>
            {row.nameEn ? <div className="text-[11px] font-normal text-slate-400">{row.nameEn}</div> : null}
          </div>
        ) },
      { key: 'accountType', header: t('accounts.accountType'), width: '150px', sortable: true, render: row => t(`accounts.type.${row.accountType}`) },
      { key: 'nature', header: t('accounts.nature'), width: '120px', sortable: true, render: row => t(`accounts.natureValue.${row.nature}`) },
      { key: 'level', header: t('accounts.level'), width: '70px', align: 'center', sortable: true, render: row => row.level },
      { key: 'posting', header: t('accounts.posting'), width: '110px', align: 'center',
        render: row => row.hasChildren ? <Badge variant="slate" size="sm">{t('accounts.groupOnly')}</Badge> : <Badge variant="info" size="sm">{t('accounts.postable')}</Badge> },
      { key: 'isActive', header: t('accounts.status'), width: '130px', align: 'center', sortable: true,
        render: row => row.isActive ? <Badge variant="success" size="sm">{t('accounts.active')}</Badge> : <Badge variant="slate" size="sm">{t('accounts.inactive')}</Badge> },
      ...recordStampColumns<AccountRecord>(t)
    ],
    // Query parameters of the list and the export: level=2, type=ASSET, postable=true.
    filters: [
      { key: 'level', label: t('accounts.level'), options: levelOptions },
      { key: 'type', label: t('accounts.accountType'), options: typeOptions },
      { key: 'postable', label: t('accounts.postableFilter'), options: [{ value: 'true', label: t('accounts.postableOnly') }] }
    ],
    searchText: row => `${row.code} ${row.name} ${row.nameEn ?? ''} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('accounts.code'), required: true, width: 14, example: '13311' },
        { key: 'name', header: t('accounts.name'), required: true, width: 40, example: 'Thuế GTGT được khấu trừ' },
        { key: 'nameEn', header: t('accounts.nameEn'), width: 36, example: '' },
        { key: 'parentAccountCode', header: t('accounts.parent'), width: 16, example: '1331' },
        { key: 'accountType', header: t('accounts.accountType'), required: true, width: 18, example: 'ASSET' },
        { key: 'nature', header: t('accounts.nature'), required: true, width: 14, example: 'DEBIT' },
        { key: 'note', header: t('accounts.note'), width: 36, example: '' },
        { key: 'isActive', header: t('accounts.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', nameEn: '', parentAccountCode: '', accountType: 'ASSET', nature: 'DEBIT', note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), nameEn: input.nameEn.trim(),
      parentAccountCode: input.parentAccountCode.trim().toUpperCase(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t('accounts.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20}
            className="font-mono" value={form.code} hint={t('accounts.codeHint')}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          {/* The parent is fixed once the account is saved; choosing one copies its type and nature. */}
          <div className="space-y-1">
            <CatalogLookup lookup="accounts" label={t('accounts.parent')} value={form.parentAccountCode} disabled={!!editing}
              onChange={(code, item) => setForm({
                ...form, parentAccountCode: code,
                accountType: (item?.extra?.accountType as AccountType | undefined) ?? form.accountType,
                nature: (item?.extra?.nature as SaveAccountInput['nature'] | undefined) ?? form.nature
              })} />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('accounts.parentHint')}</p>
          </div>
        </div>
        <TextInput label={t('accounts.name')} required autoFocus={!!editing} maxLength={200} value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextInput label={t('accounts.nameEn')} maxLength={200} value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <SelectInput label={t('accounts.accountType')} required value={form.accountType} options={typeOptions}
            onChange={e => setForm({ ...form, accountType: e.target.value as AccountType })} />
          <SelectInput label={t('accounts.nature')} required value={form.nature} options={natureOptions}
            onChange={e => setForm({ ...form, nature: e.target.value as SaveAccountInput['nature'] })} />
        </div>
        <TextArea label={t('accounts.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('accounts.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ), formWidth: 'lg'
  }), [t, typeOptions, natureOptions, levelOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
