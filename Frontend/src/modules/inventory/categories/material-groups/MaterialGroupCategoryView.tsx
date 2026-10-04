import React, { useMemo } from 'react';
import { FolderTree } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { materialGroupsApi } from './api';
import type { MaterialGroupRecord, SaveMaterialGroupInput } from './types';

export const MaterialGroupCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const definition = useMemo((): CatalogDefinition<MaterialGroupRecord, SaveMaterialGroupInput> => ({
    functionCode: 'inv_material_group_cat', api: materialGroupsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <FolderTree className="h-4 w-4" />,
    texts: {
      title: t('materialGroups.title'), subtitle: t('materialGroups.subtitle'), noun: t('materialGroups.noun'),
      add: t('materialGroups.add'), searchPlaceholder: t('materialGroups.search'),
      addTitle: t('materialGroups.addTitle'), editTitle: row => t('materialGroups.editTitle', { code: row.code }),
      fileName: 'DanhMucNhomVatTu'
    },
    columns: [
      { key: 'code', header: t('materialGroups.code'), width: '150px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('materialGroups.name'), sortable: true },
      { key: 'note', header: t('materialGroups.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('materialGroups.status'), align: 'center', width: '140px',
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('materialGroups.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('materialGroups.inactive')}</Badge> },
      ...recordStampColumns<MaterialGroupRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('materialGroups.code'), required: true, width: 20, example: 'DIEN-TU' },
        { key: 'name', header: t('materialGroups.name'), required: true, width: 32, example: 'Thiết bị điện tử' },
        { key: 'note', header: t('materialGroups.note'), width: 40, example: '' },
        { key: 'isActive', header: t('materialGroups.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', note: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('materialGroups.code')} required autoFocus={!editing} disabled={!!editing}
          maxLength={20} value={form.code} hint={t('materialGroups.codeHint')}
          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('materialGroups.name')} required autoFocus={!!editing} maxLength={100}
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('materialGroups.note')} rows={2} maxLength={300} value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('materialGroups.isActive')} checked={form.isActive}
          onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
