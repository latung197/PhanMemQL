// Settings › Danh mục phòng ban (sys_departments), on the shared catalog screen: the view only declares columns,
// form and Excel columns (see docs/them-danh-muc.md).
import React, { useMemo } from 'react';
import { Network } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { TextArea, TextInput } from '../../components/common/FormField';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { departmentsApi, type DepartmentRow, type SaveDepartmentInput } from '../../services/settingsApi';
import type { UserProfile } from '../../types';

export const DepartmentCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const definition = useMemo((): CatalogDefinition<DepartmentRow, SaveDepartmentInput> => ({
    functionCode: 'sys_departments', api: departmentsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Network className="h-4 w-4" />,
    texts: {
      title: t('departments.title'), subtitle: t('departments.subtitle'), noun: t('departments.noun'),
      add: t('departments.add'), searchPlaceholder: t('departments.search'),
      addTitle: t('departments.addTitle'), editTitle: row => t('departments.editTitle', { code: row.code }),
      fileName: 'DanhMucPhongBan'
    },
    columns: [
      { key: 'code', header: t('departments.code'), width: '130px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('departments.name'), sortable: true },
      { key: 'userCount', header: t('departments.userCount'), align: 'center', width: '130px' },
      { key: 'note', header: t('departments.note'), sortable: true, render: row => row.note || '—' },
      { key: 'isActive', header: t('departments.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('departments.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('departments.inactive')}</Badge> },
      ...recordStampColumns<DepartmentRow>(t)
    ],
    excel: {
      columns: [
        { key: 'code', header: t('departments.code'), required: true, width: 18, example: 'PB-KT' },
        { key: 'name', header: t('departments.name'), required: true, width: 32, example: 'Phòng Kế toán' },
        { key: 'note', header: t('departments.note'), width: 40, example: '' },
        { key: 'isActive', header: t('departments.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', note: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), note: (input.note ?? '').trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('departments.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20}
          className="font-mono uppercase" value={form.code} hint={t('departments.codeHint')}
          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('departments.name')} required maxLength={100} value={form.name} autoFocus={!!editing}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('departments.note')} rows={2} maxLength={300} value={form.note ?? ''}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('departments.isActive')} subLabel={t('departments.isActiveHint')}
          checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
