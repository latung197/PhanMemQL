// Sản xuất › Danh mục quy trình sản xuất (prod_process_cat) on the shared catalog screen. A process has a header (code, names, issue date,
// end date, the company units it applies to) and an ordered grid of operations (Stt, operation, and the team of the operation).
// The steps travel as one comma separated text (operationCodes), the units too (unitCodes), like the units of a warehouse.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Workflow } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogLookup, CatalogMultiLookup, lookupApi } from '../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import type { UserProfile } from '../../../types';
import { formatDate } from '../../../utils/format';
import { productionProcessesApi, type ProductionProcessRecord, type SaveProductionProcessInput } from './api';

const splitCodes = (text: string): string[] => text.split(/[\s,;]+/).map(code => code.trim().toUpperCase()).filter(Boolean);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface OperationInfo { name: string; teamCode: string }

const emptyInput = (): SaveProductionProcessInput => ({
  code: '', name: '', nameEn: '', effectiveFrom: today(), effectiveTo: null, note: '', isActive: true, unitCodes: '', operationCodes: ''
});

/** The grid of operations of the form. Rows live here (a new row is empty until an operation is picked); the form gets the codes in order. */
const OperationGrid: React.FC<{
  codes: string;
  editing?: ProductionProcessRecord;
  onChange: (codes: string) => void;
}> = ({ codes, editing, onChange }) => {
  const { t } = useLanguage();
  const [rows, setRows] = useState<string[]>(() => { const items = splitCodes(codes); return items.length > 0 ? items : ['']; });
  const [info, setInfo] = useState<Record<string, OperationInfo>>(() => Object.fromEntries(
    (editing?.lines ?? []).map(line => [line.operationCode, { name: line.operationName ?? '', teamCode: line.teamCode ?? '' }])));
  const [teams, setTeams] = useState<Record<string, string>>(() => Object.fromEntries(
    (editing?.lines ?? []).filter(line => line.teamCode).map(line => [line.teamCode as string, line.teamName ?? ''])));

  useEffect(() => {
    let alive = true;
    void lookupApi.search('productionTeams', '', 1, 200, true)
      .then(page => { if (alive) setTeams(prev => ({ ...prev, ...Object.fromEntries(page.items.map(x => [x.code, x.name])) })); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const update = (next: string[]) => { setRows(next); onChange(next.filter(Boolean).join(',')); };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('productionProcesses.operations')}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="w-12 p-2 text-center">{t('productionProcesses.stt')}</th>
              <th className="w-[26%] p-2 text-left">{t('productionProcesses.operationCode')}</th>
              <th className="p-2 text-left">{t('productionProcesses.operationName')}</th>
              <th className="w-28 p-2 text-left">{t('productionProcesses.teamCode')}</th>
              <th className="p-2 text-left">{t('productionProcesses.teamName')}</th>
              <th className="w-28 p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((code, index) => {
              const operation = code ? info[code] : undefined;
              const teamCode = operation?.teamCode ?? '';
              return (
                <tr key={index} className="border-t border-slate-200 align-top dark:border-slate-700">
                  <td className="p-1.5 pt-3 text-center font-mono text-slate-500">{index + 1}</td>
                  <td className="p-1.5">
                    <CatalogLookup lookup="productionOperations" value={code}
                      onChange={(picked, item) => {
                        if (item) setInfo(prev => ({ ...prev, [item.code]: { name: item.name, teamCode: String(item.extra?.teamCode ?? '') } }));
                        update(rows.map((c, i) => i === index ? picked : c));
                      }} />
                  </td>
                  <td className="p-1.5 pt-3">{operation?.name ?? ''}</td>
                  <td className="p-1.5 pt-3 font-mono">{teamCode}</td>
                  <td className="p-1.5 pt-3">{teamCode ? teams[teamCode] ?? '' : ''}</td>
                  <td className="p-1.5">
                    <div className="flex justify-end gap-0.5">
                      <button type="button" title={t('productionProcesses.moveUp')} disabled={index === 0} onClick={() => move(index, -1)}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" title={t('productionProcesses.moveDown')} disabled={index === rows.length - 1} onClick={() => move(index, 1)}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" title={t('productionProcesses.removeOperation')} onClick={() => update(rows.length > 1 ? rows.filter((_, i) => i !== index) : [''])}
                        className="cursor-pointer rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => update([...rows, ''])}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
        <Plus className="h-3.5 w-3.5" />{t('productionProcesses.addOperation')}
      </button>
    </div>
  );
};

export const ProductionProcessCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [unitOptions, setUnitOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the unit filter (a handful of rows, read through the lookup).
  useEffect(() => {
    let alive = true;
    void lookupApi.search('companyUnits', '', 1, 200, true)
      .then(page => { if (alive) setUnitOptions(page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<ProductionProcessRecord, SaveProductionProcessInput> => {
    const toInput = (row: ProductionProcessRecord): SaveProductionProcessInput => ({
      code: row.code, name: row.name, nameEn: row.nameEn ?? '', effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo ?? null,
      note: row.note ?? '', isActive: row.isActive, unitCodes: row.unitCodes.join(','), operationCodes: row.lines.map(line => line.operationCode).join(',')
    });
    return {
      functionCode: 'prod_process_cat', codeChange: { lookup: 'productionProcesses' }, api: productionProcessesApi,
      keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
      icon: <Workflow className="h-4 w-4" />,
      texts: {
        title: t('productionProcesses.title'), subtitle: t('productionProcesses.subtitle'), noun: t('productionProcesses.noun'),
        add: t('productionProcesses.add'), searchPlaceholder: t('productionProcesses.search'),
        addTitle: t('productionProcesses.addTitle'), editTitle: row => t('productionProcesses.editTitle', { code: row.code }),
        fileName: 'DanhMucQuyTrinhSanXuat'
      },
      columns: [
        { key: 'code', header: t('productionProcesses.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
        { key: 'name', header: t('productionProcesses.name'), sortable: true },
        { key: 'effectiveFrom', header: t('productionProcesses.effectiveFrom'), width: '130px', sortable: true, render: row => formatDate(row.effectiveFrom) },
        { key: 'effectiveTo', header: t('productionProcesses.effectiveTo'), width: '130px', sortable: true,
          render: row => row.effectiveTo ? formatDate(row.effectiveTo) : <span className="text-slate-400">{t('productionProcesses.openEnded')}</span> },
        { key: 'operationCount', header: t('productionProcesses.operationCount'), align: 'center', width: '110px',
          render: row => <span className="font-mono">{row.lines.length}</span> },
        { key: 'unitCodes', header: t('productionProcesses.units'), width: '160px', render: row => row.unitCodes.length > 0 ? row.unitCodes.join(', ') : '—' },
        { key: 'isActive', header: t('productionProcesses.status'), align: 'center', width: '130px', sortable: true,
          render: row => row.isActive
            ? <Badge variant="success" size="sm">{t('productionProcesses.inUse')}</Badge>
            : <Badge variant="slate" size="sm">{t('productionProcesses.notInUse')}</Badge> },
        ...recordStampColumns<ProductionProcessRecord>(t)
      ],
      // The unit filter is a query parameter of the list and the export (unit=DVCS01: processes that unit may use, shared ones included).
      filters: [{ key: 'unit', label: t('productionProcesses.filterUnit'), options: unitOptions }],
      searchText: row => `${row.code} ${row.name} ${row.nameEn ?? ''} ${row.lines.map(line => line.operationCode).join(' ')}`,
      excel: {
        columns: [
          { key: 'code', header: t('productionProcesses.code'), required: true, width: 16, example: 'QT001' },
          { key: 'name', header: t('productionProcesses.name'), required: true, width: 40, example: 'Quy trình gia công' },
          { key: 'nameEn', header: t('productionProcesses.nameEn'), width: 30, example: '' },
          { key: 'effectiveFrom', header: t('productionProcesses.effectiveFrom'), required: true, width: 16, example: '2026-01-01' },
          { key: 'effectiveTo', header: t('productionProcesses.effectiveTo'), width: 16, example: '' },
          { key: 'unitCodes', header: t('productionProcesses.unitsExcel'), width: 24, example: 'DVCS01, DVCS02' },
          { key: 'operationCodes', header: t('productionProcesses.operationsExcel'), required: true, width: 40, example: 'MRV, BGBN' },
          { key: 'note', header: t('productionProcesses.note'), width: 40, example: '' },
          { key: 'isActive', header: t('productionProcesses.isActive'), type: 'boolean', width: 14, example: true }
        ],
        toRow: row => ({ ...toInput(row), unitCodes: row.unitCodes.join(', '), operationCodes: row.lines.map(line => line.operationCode).join(', ') })
      },
      emptyInput: emptyInput(),
      toInput,
      normalize: input => ({
        ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), nameEn: input.nameEn.trim(), note: input.note.trim(),
        effectiveTo: input.effectiveTo || null, unitCodes: splitCodes(input.unitCodes ?? '').join(','), operationCodes: splitCodes(input.operationCodes ?? '').join(',')
      }),
      renderForm: ({ form, setForm, editing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <TextInput label={t('productionProcesses.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
              value={form.code} hint={t('productionProcesses.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            <TextInput label={t('productionProcesses.name')} required autoFocus={!!editing} maxLength={200} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <TextInput label={t('productionProcesses.nameEn')} maxLength={200} value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput label={t('productionProcesses.effectiveFrom')} required type="date" value={form.effectiveFrom}
              onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} />
            <TextInput label={t('productionProcesses.effectiveTo')} type="date" min={form.effectiveFrom || undefined} value={form.effectiveTo ?? ''}
              hint={t('productionProcesses.effectiveToHint')} onChange={e => setForm({ ...form, effectiveTo: e.target.value || null })} />
            <div className="space-y-1 sm:col-span-2">
              <CatalogMultiLookup lookup="companyUnits" label={t('productionProcesses.units')} value={splitCodes(form.unitCodes)}
                onChange={codes => setForm({ ...form, unitCodes: codes.join(',') })} />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('productionProcesses.unitsHint')}</p>
            </div>
          </div>
          <OperationGrid codes={form.operationCodes} editing={editing} onChange={operationCodes => setForm({ ...form, operationCodes })} />
          <TextArea label={t('productionProcesses.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <Checkbox label={t('productionProcesses.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
        </div>
      ),
      formWidth: '5xl'
    };
  }, [t, unitOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
