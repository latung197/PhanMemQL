// Bán hàng › Danh mục bảng giá bán (sales_price_list_cat): a price list is for one currency, valid from a day to a day and for one
// customer group (empty = every customer). Its lines (price per material and unit, with quantity steps) are the grid of the form: they
// are read from the server when the form of a saved price list opens and sent back with it (undefined = untouched, the server keeps them).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { CatalogLookup, lookupApi } from '../../../../components/catalog/CatalogLookup';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition, CatalogFormProps } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { getErrorMessage } from '../../../../services/apiClient';
import { formatDate } from '../../../../utils/format';
import type { UserProfile } from '../../../../types';
import { priceListsApi } from './api';
import type { PriceListLine, PriceListRecord, SavePriceListInput } from './types';

const day = (value?: string | null) => (value ? value.slice(0, 10) : '');
const emptyLine = (): PriceListLine => ({ materialCode: '', uomCode: '', minQuantity: 0, unitPrice: 0, note: '' });

/** The lines grid of the form. A saved price list loads its lines once when the form opens; a new one starts empty. */
const PriceListLines: React.FC<CatalogFormProps<PriceListRecord, SavePriceListInput>> = ({ form, setForm, editing }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(!!editing);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  // The form held by the screen changes with every keystroke: the loaded lines are put into the latest one.
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    if (!editing) { setForm({ ...formRef.current, lines: [] }); return; }
    let alive = true;
    priceListsApi.getLines(editing.code)
      .then(lines => { if (alive) setForm({ ...formRef.current, lines }); })
      .catch(e => { if (alive) setError(getErrorMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.code]);

  const lines = form.lines ?? [];
  const setLine = (index: number, patch: Partial<PriceListLine>) =>
    setForm({ ...form, lines: lines.map((line, i) => i === index ? { ...line, ...patch } : line) });
  const needle = filter.trim().toLowerCase();
  const shown = lines.map((line, index) => ({ line, index }))
    .filter(({ line }) => !needle || line.materialCode.toLowerCase().includes(needle) || (line.materialName ?? '').toLowerCase().includes(needle));

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('priceLists.linesTitle')} <span className="font-mono text-slate-500">({lines.length})</span></p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('priceLists.linesHint')}</p>
      </div>
      {loading ? <p className="p-4 text-center text-xs text-slate-500">{t('priceLists.loadingLines')}</p>
        : error ? <p className="p-4 text-center text-xs font-semibold text-rose-600">{t('priceLists.linesLoadError')} {error}</p> : (
        <>
          {lines.length > 8 && (
            <TextInput placeholder={t('priceLists.linesFilter')} value={filter} onChange={e => setFilter(e.target.value)} />
          )}
          <div className="max-h-[26vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[640px] table-fixed text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-2 text-left w-[32%]">{t('priceLists.material')}</th>
                  <th className="p-2 text-left w-[20%]">{t('priceLists.uom')}</th>
                  <th className="p-2 text-right w-[12%]">{t('priceLists.minQuantity')}</th>
                  <th className="p-2 text-right w-[14%]">{t('priceLists.unitPrice')}</th>
                  <th className="p-2 text-left">{t('priceLists.lineNote')}</th>
                  <th className="p-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ line, index }) => (
                  <tr key={index} className="border-t border-slate-200 dark:border-slate-700 align-top">
                    <td className="p-1.5">
                      <CatalogLookup lookup="materials" value={line.materialCode}
                        onChange={(code, item) => setLine(index, { materialCode: code, materialName: item?.name ?? '', uomCode: line.materialCode === code ? line.uomCode : '' })} />
                    </td>
                    <td className="p-1.5">
                      {line.materialCode
                        ? <CatalogLookup lookup="materialUoms" params={{ material: line.materialCode }} value={line.uomCode} onChange={code => setLine(index, { uomCode: code })} />
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-1.5"><TextInput type="number" min={0} step="any" className="text-right font-mono" value={line.minQuantity || ''}
                      onChange={e => setLine(index, { minQuantity: e.target.value === '' ? 0 : Number(e.target.value) })} /></td>
                    <td className="p-1.5"><TextInput type="number" min={0} step="any" className="text-right font-mono" value={line.unitPrice || ''}
                      onChange={e => setLine(index, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })} /></td>
                    <td className="p-1.5"><TextInput maxLength={300} value={line.note ?? ''} onChange={e => setLine(index, { note: e.target.value })} /></td>
                    <td className="p-1.5 text-center">
                      <button type="button" title={t('priceLists.removeLine')} onClick={() => setForm({ ...form, lines: lines.filter((_, i) => i !== index) })}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-500">{t('priceLists.noLines')}</td></tr>}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setForm({ ...form, lines: [...lines, emptyLine()] })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 cursor-pointer">
            <Plus className="h-3.5 w-3.5" />{t('priceLists.addLine')}
          </button>
        </>
      )}
    </div>
  );
};

export const PriceListCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let alive = true;
    void lookupApi.search('customerGroups', '', 1, 200, true)
      .then(page => { if (alive) setGroupOptions([{ value: 'none', label: t('priceLists.groupGeneral') }, ...page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))]); })
      .catch(() => {});
    void lookupApi.search('currencies', '', 1, 200, true)
      .then(page => { if (alive) setCurrencyOptions(page.items.map(x => ({ value: x.code, label: x.code }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [t]);

  const toInput = (row: PriceListRecord): SavePriceListInput => ({
    code: row.code, name: row.name, currencyCode: row.currencyCode, customerGroupCode: row.customerGroupCode ?? '',
    validFrom: day(row.validFrom), validTo: day(row.validTo) || null, note: row.note ?? '', isActive: row.isActive
  });
  const definition = useMemo((): CatalogDefinition<PriceListRecord, SavePriceListInput> => ({
    functionCode: 'sales_price_list_cat', api: priceListsApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Tags className="h-4 w-4" />,
    texts: {
      title: t('priceLists.title'), noun: t('priceLists.noun'),
      add: t('priceLists.add'), searchPlaceholder: t('priceLists.search'),
      addTitle: t('priceLists.addTitle'), editTitle: row => t('priceLists.editTitle', { code: row.code }),
      fileName: 'DanhMucBangGiaBan'
    },
    columns: [
      { key: 'code', header: t('priceLists.code'), width: '150px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('priceLists.name'), width: '260px', sortable: true },
      { key: 'customerGroupCode', header: t('priceLists.group'), width: '190px', sortable: true, render: row => row.customerGroupName || row.customerGroupCode || t('priceLists.allGroups') },
      { key: 'currencyCode', header: t('priceLists.currency'), width: '90px', align: 'center', sortable: true, render: row => <span className="font-mono">{row.currencyCode}</span> },
      { key: 'validFrom', header: t('priceLists.validity'), width: '190px', sortable: true,
        render: row => <span className="font-mono text-xs">{formatDate(row.validFrom)} → {row.validTo ? formatDate(row.validTo) : t('priceLists.noEnd')}</span> },
      { key: 'lineCount', header: t('priceLists.lineCount'), width: '110px', align: 'right', render: row => <span className="font-mono">{row.lineCount}</span> },
      { key: 'isActive', header: t('priceLists.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('priceLists.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('priceLists.notInUse')}</Badge> },
      ...recordStampColumns<PriceListRecord>(t)
    ],
    filters: [
      { key: 'group', label: t('priceLists.filterGroup'), options: groupOptions },
      { key: 'currency', label: t('priceLists.filterCurrency'), options: currencyOptions }
    ],
    // The Excel file carries the headers only (lines are edited in the form); an import creates or updates headers and keeps the lines.
    excel: {
      columns: [
        { key: 'code', header: t('priceLists.code'), required: true, width: 18, example: 'BG-DL-2026' },
        { key: 'name', header: t('priceLists.name'), required: true, width: 36, example: 'Bảng giá đại lý 2026' },
        { key: 'currencyCode', header: t('priceLists.currency'), required: true, width: 12, example: 'VND' },
        { key: 'customerGroupCode', header: t('priceLists.groupCode'), width: 20 },
        { key: 'validFrom', header: t('priceLists.validFrom'), required: true, width: 18, example: '2026-01-01' },
        { key: 'validTo', header: t('priceLists.validTo'), width: 18, example: '2026-12-31' },
        { key: 'note', header: t('priceLists.note'), width: 36 },
        { key: 'isActive', header: t('priceLists.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', currencyCode: 'VND', customerGroupCode: '', validFrom: new Date().toISOString().slice(0, 10), validTo: null, note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), currencyCode: input.currencyCode.trim().toUpperCase(),
      customerGroupCode: (input.customerGroupCode ?? '').trim().toUpperCase(), validFrom: day(input.validFrom), validTo: day(input.validTo) || null, note: input.note.trim() }),
    renderForm: props => {
      const { form, setForm, editing } = props;
      return (
        <>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
            <TextInput label={t('priceLists.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
              value={form.code} hint={t('priceLists.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            <div className="sm:col-span-2">
              <TextInput label={t('priceLists.name')} required autoFocus={!!editing} maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">
            <CatalogLookup lookup="currencies" label={t('priceLists.currency')} value={form.currencyCode} onChange={code => setForm({ ...form, currencyCode: code })} />
            <TextInput label={t('priceLists.validFrom')} required type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} />
            <TextInput label={t('priceLists.validTo')} type="date" value={form.validTo ?? ''} min={form.validFrom || undefined} hint={t('priceLists.validToHint')}
              onChange={e => setForm({ ...form, validTo: e.target.value || null })} />
            <CatalogLookup lookup="customerGroups" label={t('priceLists.group')} value={form.customerGroupCode} onChange={code => setForm({ ...form, customerGroupCode: code })} />
          </div>
          <p className="-mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('priceLists.groupHint')}</p>
          <TextArea label={t('priceLists.note')} rows={1} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <Checkbox label={t('priceLists.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
          <PriceListLines {...props} />
        </>
      );
    },
    formWidth: '3xl'
  }), [t, groupOptions, currencyOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
