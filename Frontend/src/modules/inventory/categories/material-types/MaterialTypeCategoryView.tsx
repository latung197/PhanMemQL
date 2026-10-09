import React, { useEffect, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { loadMaterialTypeOptions } from '../../../../services/lookupOptions';
import type { UserProfile } from '../../../../types';
import { materialTypesApi } from './api';
import type { MaterialTypeRecord, SaveMaterialTypeInput } from './types';

export const MaterialTypeCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  // The values of the group filter are the group texts the types already have (read through the lookup).
  const [groups, setGroups] = useState<string[]>([]);
  useEffect(() => {
    loadMaterialTypeOptions()
      .then(list => setGroups(Array.from(new Set(list.map(x => x.group).filter(Boolean))).sort()))
      .catch(() => setGroups([]));
  }, []);

  const definition = useMemo((): CatalogDefinition<MaterialTypeRecord, SaveMaterialTypeInput> => ({
    functionCode: 'inv_material_type_cat', api: materialTypesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Layers className="h-4 w-4" />,
    texts: {
      title: t('materialTypes.title'), subtitle: t('materialTypes.subtitle'), noun: t('materialTypes.noun'),
      add: t('materialTypes.add'), searchPlaceholder: t('materialTypes.search'),
      addTitle: t('materialTypes.addTitle'), editTitle: row => t('materialTypes.editTitle', { code: row.code }),
      fileName: 'DanhMucLoaiVatTu'
    },
    columns: [
      { key: 'code', header: t('materialTypes.code'), width: '140px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('materialTypes.name'), sortable: true },
      { key: 'groupName', header: t('materialTypes.groupName'), sortable: true, render: row => row.groupName || '—' },
      { key: 'note', header: t('materialTypes.note'), sortable: true, render: row => row.note || '—' },
      { key: 'isActive', header: t('materialTypes.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('materialTypes.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('materialTypes.inactive')}</Badge> },
      ...recordStampColumns<MaterialTypeRecord>(t)
    ],
    // The group filter is a query parameter of the list and the export (group=...).
    filters: [{ key: 'group', label: t('materialTypes.groupName'),
      options: groups.map(g => ({ value: g, label: g })) }],
    excel: {
      columns: [
        { key: 'code', header: t('materialTypes.code'), required: true, width: 20, example: 'NVL' },
        { key: 'name', header: t('materialTypes.name'), required: true, width: 32, example: 'Nguyên vật liệu chính' },
        { key: 'groupName', header: t('materialTypes.groupName'), width: 28, example: 'Vật tư sản xuất' },
        { key: 'note', header: t('materialTypes.note'), width: 40, example: '' },
        { key: 'isActive', header: t('materialTypes.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, groupName: row.groupName ?? '', note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', groupName: '', note: '', isActive: true },
    toInput: row => ({ code: row.code, name: row.name, groupName: row.groupName ?? '', note: row.note ?? '', isActive: row.isActive }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      groupName: input.groupName.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('materialTypes.code')} required autoFocus={!editing} disabled={!!editing}
          maxLength={20} value={form.code} hint={t('materialTypes.codeHint')}
          onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('materialTypes.name')} required autoFocus={!!editing} maxLength={100}
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextInput label={t('materialTypes.groupName')} maxLength={100} value={form.groupName} hint={t('materialTypes.groupHint')}
          onChange={e => setForm({ ...form, groupName: e.target.value })} />
        <TextArea label={t('materialTypes.note')} rows={2} maxLength={300} value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('materialTypes.isActive')} checked={form.isActive}
          onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t, groups]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
