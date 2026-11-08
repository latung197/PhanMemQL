// Sản xuất › Danh mục công đoạn sản xuất (prod_operation_cat) on the shared catalog screen: code, name, second name, the team that
// carries the operation out, "machine required on the production report" and "heavy work".
import React, { useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogLookup, lookupApi } from '../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import type { UserProfile } from '../../../types';
import { productionOperationsApi, type ProductionOperationRecord, type SaveProductionOperationInput } from './api';

const emptyInput: SaveProductionOperationInput = {
  code: '', name: '', nameEn: '', productionTeamCode: '', requireMachine: false, isHeavy: false, note: '', isActive: true
};

export const ProductionOperationCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [teamOptions, setTeamOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the team filter (a handful of rows, read through the lookup).
  useEffect(() => {
    let alive = true;
    void lookupApi.search('productionTeams', '', 1, 200, true)
      .then(page => { if (alive) setTeamOptions(page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<ProductionOperationRecord, SaveProductionOperationInput> => {
    const toInput = (row: ProductionOperationRecord): SaveProductionOperationInput => ({
      code: row.code, name: row.name, nameEn: row.nameEn ?? '', productionTeamCode: row.productionTeamCode ?? '',
      requireMachine: row.requireMachine, isHeavy: row.isHeavy, note: row.note ?? '', isActive: row.isActive
    });
    const flag = (on: boolean) => on ? <Badge variant="info" size="sm">✓</Badge> : <span className="text-slate-300">—</span>;
    return {
      functionCode: 'prod_operation_cat', codeChange: { lookup: 'productionOperations' }, api: productionOperationsApi,
      keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
      icon: <Wrench className="h-4 w-4" />,
      texts: {
        title: t('productionOperations.title'), subtitle: t('productionOperations.subtitle'), noun: t('productionOperations.noun'),
        add: t('productionOperations.add'), searchPlaceholder: t('productionOperations.search'),
        addTitle: t('productionOperations.addTitle'), editTitle: row => t('productionOperations.editTitle', { code: row.code }),
        fileName: 'DanhMucCongDoanSanXuat'
      },
      columns: [
        { key: 'code', header: t('productionOperations.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
        { key: 'name', header: t('productionOperations.name'), sortable: true },
        { key: 'nameEn', header: t('productionOperations.nameEn'), sortable: true, render: row => row.nameEn || '—' },
        { key: 'productionTeamCode', header: t('productionOperations.team'), width: '220px', sortable: true,
          render: row => row.productionTeamCode ? `${row.productionTeamName ?? row.productionTeamCode}` : '—' },
        { key: 'requireMachine', header: t('productionOperations.machineShort'), align: 'center', width: '110px', sortable: true, render: row => flag(row.requireMachine) },
        { key: 'isHeavy', header: t('productionOperations.heavyShort'), align: 'center', width: '110px', sortable: true, render: row => flag(row.isHeavy) },
        { key: 'isActive', header: t('productionOperations.status'), align: 'center', width: '130px', sortable: true,
          render: row => row.isActive
            ? <Badge variant="success" size="sm">{t('productionOperations.inUse')}</Badge>
            : <Badge variant="slate" size="sm">{t('productionOperations.notInUse')}</Badge> },
        ...recordStampColumns<ProductionOperationRecord>(t)
      ],
      // The team filter is a query parameter of the list and the export (team=TBG1).
      filters: [{ key: 'team', label: t('productionOperations.filterTeam'), options: teamOptions }],
      searchText: row => `${row.code} ${row.name} ${row.nameEn ?? ''} ${row.productionTeamName ?? ''}`,
      excel: {
        columns: [
          { key: 'code', header: t('productionOperations.code'), required: true, width: 16, example: 'BGBN' },
          { key: 'name', header: t('productionOperations.name'), required: true, width: 36, example: 'Bao gói Baxna' },
          { key: 'nameEn', header: t('productionOperations.nameEn'), width: 30, example: '' },
          { key: 'productionTeamCode', header: t('productionOperations.team'), width: 16, example: 'TBG1' },
          { key: 'requireMachine', header: t('productionOperations.requireMachine'), type: 'boolean', width: 18, example: false },
          { key: 'isHeavy', header: t('productionOperations.isHeavy'), type: 'boolean', width: 14, example: false },
          { key: 'note', header: t('productionOperations.note'), width: 40, example: '' },
          { key: 'isActive', header: t('productionOperations.isActive'), type: 'boolean', width: 14, example: true }
        ],
        toRow: toInput
      },
      emptyInput,
      toInput,
      normalize: input => ({
        ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), nameEn: input.nameEn.trim(),
        productionTeamCode: input.productionTeamCode.trim().toUpperCase(), note: input.note.trim()
      }),
      renderForm: ({ form, setForm, editing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <TextInput label={t('productionOperations.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
              value={form.code} hint={t('productionOperations.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            <TextInput label={t('productionOperations.name')} required autoFocus={!!editing} maxLength={200} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <TextInput label={t('productionOperations.nameEn')} maxLength={200} value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
            <CatalogLookup lookup="productionTeams" label={t('productionOperations.team')} value={form.productionTeamCode}
              onChange={code => setForm({ ...form, productionTeamCode: code })} />
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30 sm:grid-cols-2">
            <Checkbox label={t('productionOperations.requireMachine')} checked={form.requireMachine} onChange={requireMachine => setForm({ ...form, requireMachine })} />
            <Checkbox label={t('productionOperations.isHeavy')} checked={form.isHeavy} onChange={isHeavy => setForm({ ...form, isHeavy })} />
          </div>
          <TextArea label={t('productionOperations.note')} rows={3} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <Checkbox label={t('productionOperations.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
        </div>
      ),
      formWidth: '3xl'
    };
  }, [t, teamOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
