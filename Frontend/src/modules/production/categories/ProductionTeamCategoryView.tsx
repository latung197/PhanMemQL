// Sản xuất › Danh mục tổ sản xuất (prod_team_cat) on the shared catalog screen.
import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import type { UserProfile } from '../../../types';
import { productionTeamsApi, type ProductionTeamRecord, type SaveProductionTeamInput } from './api';

export const ProductionTeamCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toInput = (row: ProductionTeamRecord): SaveProductionTeamInput => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive });
  const definition = useMemo((): CatalogDefinition<ProductionTeamRecord, SaveProductionTeamInput> => ({
    functionCode: 'prod_team_cat', codeChange: { lookup: 'productionTeams' }, api: productionTeamsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Users className="h-4 w-4" />,
    texts: {
      title: t('productionTeams.title'), subtitle: t('productionTeams.subtitle'), noun: t('productionTeams.noun'),
      add: t('productionTeams.add'), searchPlaceholder: t('productionTeams.search'),
      addTitle: t('productionTeams.addTitle'), editTitle: row => t('productionTeams.editTitle', { code: row.code }),
      fileName: 'DanhMucToSanXuat'
    },
    columns: [
      { key: 'code', header: t('productionTeams.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('productionTeams.name'), sortable: true },
      { key: 'note', header: t('productionTeams.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('productionTeams.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('productionTeams.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('productionTeams.notInUse')}</Badge> },
      ...recordStampColumns<ProductionTeamRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('productionTeams.code'), required: true, width: 16, example: 'TBG1' },
        { key: 'name', header: t('productionTeams.name'), required: true, width: 30, example: 'Tổ bao gói' },
        { key: 'note', header: t('productionTeams.note'), width: 40, example: '' },
        { key: 'isActive', header: t('productionTeams.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('productionTeams.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
          value={form.code} hint={t('productionTeams.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('productionTeams.name')} required autoFocus={!!editing} maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('productionTeams.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('productionTeams.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'lg'
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
