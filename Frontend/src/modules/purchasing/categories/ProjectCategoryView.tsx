// Mua hàng › Danh mục dự án (pur_project_cat), on the shared catalog screen. A project is the dimension purchasing and stock vouchers
// point to, so that cost can be added up per project (report Chi phí theo dự án).
import React, { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { SelectInput, TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogLookup } from '../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { formatDate } from '../../../utils/format';
import type { UserProfile } from '../../../types';
import { projectsApi, type ProjectRecord, type ProjectStatus, type SaveProjectInput } from './api';

const STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ONHOLD', 'DONE', 'CANCELLED'];
const STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = { PLANNING: 'info', ACTIVE: 'success', ONHOLD: 'warning', DONE: 'slate', CANCELLED: 'danger' };
const day = (value: string | null | undefined) => (value ? String(value).trim().slice(0, 10) : null);

export const ProjectCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const { formatNumber } = useNumberFormat();
  const statusOptions = useMemo(() => STATUSES.map(value => ({ value, label: t(`projects.status.${value}`) })), [t]);
  const toInput = (row: ProjectRecord): SaveProjectInput => ({
    code: row.code, name: row.name, departmentCode: row.departmentCode ?? '', customerName: row.customerName ?? '', managerName: row.managerName ?? '',
    startDate: day(row.startDate), endDate: day(row.endDate), budget: row.budget, status: row.status, note: row.note ?? '', isActive: row.isActive
  });

  const definition = useMemo((): CatalogDefinition<ProjectRecord, SaveProjectInput> => ({
    functionCode: 'pur_project_cat', codeChange: { lookup: 'projects' }, api: projectsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Briefcase className="h-4 w-4" />,
    texts: {
      title: t('projects.title'), subtitle: t('projects.subtitle'), noun: t('projects.noun'),
      add: t('projects.add'), searchPlaceholder: t('projects.search'),
      addTitle: t('projects.addTitle'), editTitle: row => t('projects.editTitle', { code: row.code }),
      fileName: 'DanhMucDuAn'
    },
    columns: [
      { key: 'code', header: t('projects.code'), width: '130px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('projects.name'), sortable: true },
      { key: 'customerName', header: t('projects.customer'), sortable: true, render: row => row.customerName || '—' },
      { key: 'managerName', header: t('projects.manager'), sortable: true, render: row => row.managerName || '—' },
      { key: 'departmentCode', header: t('projects.department'), width: '150px', sortable: true, render: row => row.departmentName || row.departmentCode || '—' },
      { key: 'startDate', header: t('projects.startDate'), width: '110px', sortable: true, render: row => row.startDate ? formatDate(row.startDate) : '—' },
      { key: 'endDate', header: t('projects.endDate'), width: '110px', sortable: true, render: row => row.endDate ? formatDate(row.endDate) : '—' },
      { key: 'budget', header: t('projects.budget'), align: 'right', width: '150px', sortable: true,
        render: row => <span className="font-mono">{formatNumber(row.budget)}</span> },
      { key: 'projectStatus', header: t('projects.statusField'), align: 'center', width: '140px', sortable: true,
        render: row => <Badge variant={STATUS_VARIANT[row.status]} size="sm">{t(`projects.status.${row.status}`)}</Badge> },
      { key: 'isActive', header: t('projects.active'), align: 'center', width: '120px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('projects.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('projects.notInUse')}</Badge> },
      ...recordStampColumns<ProjectRecord>(t)
    ],
    // The status filter is a query parameter of the list and the export (projectStatus=ACTIVE).
    filters: [{ key: 'projectStatus', label: t('projects.statusField'), options: statusOptions }],
    searchText: row => `${row.code} ${row.name} ${row.customerName ?? ''} ${row.managerName ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('projects.code'), required: true, width: 18, example: 'DA-2026-01' },
        { key: 'name', header: t('projects.name'), required: true, width: 36, example: 'Dự án lắp đặt hệ thống' },
        { key: 'departmentCode', header: t('projects.departmentCode'), width: 16, example: '' },
        { key: 'customerName', header: t('projects.customer'), width: 30, example: '' },
        { key: 'managerName', header: t('projects.manager'), width: 24, example: '' },
        { key: 'startDate', header: t('projects.startDate'), width: 16, example: '2026-10-01' },
        { key: 'endDate', header: t('projects.endDate'), width: 16, example: '2027-03-31' },
        { key: 'budget', header: t('projects.budget'), type: 'number', width: 18, example: 500000000 },
        { key: 'status', header: t('projects.statusField'), width: 16, example: 'ACTIVE' },
        { key: 'note', header: t('projects.note'), width: 40, example: '' },
        { key: 'isActive', header: t('projects.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', departmentCode: '', customerName: '', managerName: '', startDate: null, endDate: null, budget: 0, status: 'ACTIVE', note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), departmentCode: (input.departmentCode ?? '').trim().toUpperCase(),
      customerName: input.customerName.trim(), managerName: input.managerName.trim(), startDate: day(input.startDate), endDate: day(input.endDate),
      budget: Number(input.budget) || 0, status: ((input.status || 'ACTIVE').toString().trim().toUpperCase()) as ProjectStatus, note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <TextInput label={t('projects.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
            value={form.code} hint={t('projects.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <TextInput label={t('projects.name')} required autoFocus={!!editing} maxLength={200} value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <TextInput label={t('projects.customer')} maxLength={200} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
          <TextInput label={t('projects.manager')} maxLength={100} value={form.managerName} onChange={e => setForm({ ...form, managerName: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          <CatalogLookup lookup="departments" label={t('projects.department')} value={form.departmentCode}
            onChange={code => setForm({ ...form, departmentCode: code })} />
          <SelectInput label={t('projects.statusField')} required value={form.status} options={statusOptions} hint={t('projects.statusHint')}
            onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })} />
        </div>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
          <TextInput label={t('projects.startDate')} type="date" value={form.startDate ?? ''} onChange={e => setForm({ ...form, startDate: e.target.value || null })} />
          <TextInput label={t('projects.endDate')} type="date" value={form.endDate ?? ''} min={form.startDate ?? undefined}
            onChange={e => setForm({ ...form, endDate: e.target.value || null })} />
          <TextInput label={t('projects.budget')} type="number" min={0} step="any" className="text-right font-mono" value={form.budget}
            hint={t('projects.budgetHint')} onChange={e => setForm({ ...form, budget: Number(e.target.value) || 0 })} />
        </div>
        <TextArea label={t('projects.note')} rows={2} maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('projects.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: '2xl'
  }), [t, statusOptions, formatNumber]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
