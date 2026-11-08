// Sản xuất › Danh mục cấu trúc sản phẩm (prod_structure_cat): on the left the products that have a structure (a tree: a component with a structure of its
// own opens in place), on the right the material norms of the selected product. One structure per product; adding, editing and deleting follow the
// rights of the function. Labour and overhead norms are not built yet (only the material norms tab exists).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Network, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Checkbox } from '../../../components/common/Checkbox';
import { useConfirm } from '../../../components/common/ConfirmDialog';
import { TextInput } from '../../../components/common/FormField';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { CatalogLookup } from '../../../components/catalog/CatalogLookup';
import { useLanguage } from '../../../context/LanguageContext';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { getErrorMessage } from '../../../services/apiClient';
import type { UserProfile } from '../../../types';
import { getActionPermission } from '../../../utils/permissions';
import { showToast } from '../../../utils/toast';
import {
  productStructuresApi, type ProductStructure, type ProductStructureListItem, type SaveProductStructureInput, type SaveProductStructureLineInput
} from './api';

const PAGE_SIZE = 50;

const emptyLine = (): SaveProductStructureLineInput => ({ componentMaterialCode: '', quantity: 1, uomCode: '', productionOperationCode: '', scrapPercent: 0, note: '' });

interface Draft { isNew: boolean; input: SaveProductStructureInput }

const toDraft = (structure: ProductStructure): Draft => ({
  isNew: false,
  input: {
    materialCode: structure.materialCode, note: structure.note ?? '', isActive: structure.isActive, version: structure.version,
    lines: structure.lines.map(line => ({
      componentMaterialCode: line.componentMaterialCode, quantity: line.quantity, uomCode: line.uomCode, productionOperationCode: line.productionOperationCode ?? '',
      scrapPercent: line.scrapPercent, note: line.note ?? ''
    }))
  }
});

export const ProductStructureView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const { formatQuantity } = useNumberFormat();
  const confirm = useConfirm();
  const perms = currentUser ? getActionPermission(currentUser, 'prod_structure_cat') : { view: true, create: false, edit: false, delete: false };

  // ---- list (left)
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'exact' | 'parent'>('exact');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductStructureListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // The structures opened in the tree (code → structure), so a node can show its components without another call.
  const [opened, setOpened] = useState<Record<string, ProductStructure>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ---- detail (right)
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<ProductStructure | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await productStructuresApi.list({ page, pageSize: PAGE_SIZE, search, mode });
      setItems(result.items);
      setTotal(result.total);
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, mode]);

  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (code: string, show = true) => {
    try {
      const structure = await productStructuresApi.get(code);
      if (show) setDetail(structure);
      setOpened(prev => ({ ...prev, [code]: structure }));
      return structure;
    } catch (e) {
      showToast.error(getErrorMessage(e));
      return null;
    }
  }, []);

  const guardDiscard = async (): Promise<boolean> => {
    if (!draft) return true;
    return confirm({ title: t('productStructures.discardTitle'), message: t('productStructures.discardMessage'), tone: 'warning' });
  };

  const select = async (code: string) => {
    if (code === selected && !draft) return;
    if (!(await guardDiscard())) return;
    setDraft(null);
    setSelected(code);
    await loadDetail(code);
  };

  const toggle = async (code: string) => {
    const next = new Set(expanded);
    if (next.has(code)) { next.delete(code); setExpanded(next); return; }
    next.add(code);
    setExpanded(next);
    if (!opened[code]) await loadDetail(code, false);
  };

  const submitSearch = () => { setPage(1); setSearch(text.trim()); };

  // ---- editing
  const startAdd = async () => {
    if (!(await guardDiscard())) return;
    setSelected('');
    setDetail(null);
    setDraft({ isNew: true, input: { materialCode: '', note: '', isActive: true, lines: [emptyLine()] } });
  };

  const startEdit = () => {
    if (!detail) return;
    setNames(prev => ({
      ...prev,
      ...Object.fromEntries(detail.lines.filter(l => l.componentMaterialName).map(l => [l.componentMaterialCode, l.componentMaterialName as string])),
      ...Object.fromEntries(detail.lines.filter(l => l.productionOperationCode && l.productionOperationName).map(l => [`op:${l.productionOperationCode}`, l.productionOperationName as string]))
    }));
    setDraft(toDraft(detail));
  };

  const cancelEdit = async () => { if (await guardDiscard()) setDraft(null); };

  const setInput = (patch: Partial<SaveProductStructureInput>) => setDraft(prev => prev ? { ...prev, input: { ...prev.input, ...patch } } : prev);
  const setLine = (index: number, patch: Partial<SaveProductStructureLineInput>) =>
    setInput({ lines: (draft?.input.lines ?? []).map((line, i) => i === index ? { ...line, ...patch } : line) });
  const moveLine = (index: number, delta: number) => {
    const lines = [...(draft?.input.lines ?? [])];
    const target = index + delta;
    if (target < 0 || target >= lines.length) return;
    [lines[index], lines[target]] = [lines[target], lines[index]];
    setInput({ lines });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const input: SaveProductStructureInput = {
        ...draft.input, materialCode: draft.input.materialCode.trim().toUpperCase(),
        lines: draft.input.lines.filter(line => line.componentMaterialCode.trim() !== '')
          .map(line => ({ ...line, componentMaterialCode: line.componentMaterialCode.trim().toUpperCase(), uomCode: line.uomCode.trim().toUpperCase(),
            productionOperationCode: line.productionOperationCode.trim().toUpperCase(), note: line.note.trim() }))
      };
      const saved = draft.isNew ? await productStructuresApi.create(input) : await productStructuresApi.update(input.materialCode, input);
      showToast.success(t('productStructures.saved', { code: saved.materialCode }));
      setDraft(null);
      setSelected(saved.materialCode);
      setDetail(saved);
      setOpened(prev => ({ ...prev, [saved.materialCode]: saved }));
      await loadList();
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!detail) return;
    const ok = await confirm({ title: t('productStructures.deleteTitle', { code: detail.materialCode }), message: t('productStructures.deleteMessage'), tone: 'danger' });
    if (!ok) return;
    try {
      await productStructuresApi.remove(detail.materialCode);
      showToast.success(t('productStructures.deleted', { code: detail.materialCode }));
      setOpened(prev => { const { [detail.materialCode]: _removed, ...rest } = prev; return rest; });
      setDetail(null);
      setSelected('');
      await loadList();
    } catch (e) {
      showToast.error(getErrorMessage(e));
    }
  };

  const nameOf = (code: string, fallback?: string | null) => names[code] ?? fallback ?? '';

  // ---- tree
  const renderNode = (code: string, name: string, hasChildren: boolean, depth: number, key: string): React.ReactNode => {
    const open = expanded.has(code);
    const structure = opened[code];
    const children = structure ? structure.lines.filter(line => line.hasStructure) : [];
    const isSelected = selected === code && !draft?.isNew;
    return (
      <li key={key}>
        <div className={`flex items-center gap-1 rounded-md py-1 pr-2 text-xs ${isSelected ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} style={{ paddingLeft: 4 + depth * 16 }}>
          {hasChildren
            ? <button type="button" aria-label={open ? t('productStructures.collapse') : t('productStructures.expand')} onClick={() => void toggle(code)}
                className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            : <span className="h-5 w-5 shrink-0" />}
          <button type="button" onClick={() => void select(code)} className="min-w-0 flex-1 cursor-pointer truncate text-left" title={`${code} - ${name}`}>
            <span className={`${depth === 0 ? 'font-bold' : ''} text-slate-800 dark:text-slate-200`}>{name || code}</span>
            <span className="ml-1.5 font-mono text-[10px] text-slate-400">{code}</span>
          </button>
        </div>
        {open && hasChildren && (
          <ul>{!structure ? <li className="py-1 text-[11px] text-slate-400" style={{ paddingLeft: 24 + depth * 16 }}>{t('productStructures.loading')}</li>
            : children.map((line, i) => renderNode(line.componentMaterialCode, line.componentMaterialName ?? '', true, depth + 1, `${code}-${line.lineNo}-${i}`))}</ul>
        )}
      </li>
    );
  };

  const view = draft?.input;
  const rows = useMemo(() => draft ? null : detail?.lines ?? [], [draft, detail]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      {/* ---- left: search and tree */}
      <Card className="flex min-h-[32rem] flex-col" title={<h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100"><Network className="h-4 w-4" />{t('productStructures.title')}</h3>}
        subtitle={t('productStructures.subtitle')}>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); submitSearch(); }}>
          <TextInput value={text} placeholder={t('productStructures.search')} onChange={e => setText(e.target.value)} className="flex-1" />
          <Button type="submit" size="sm" variant="secondary" icon={<Search className="h-4 w-4" />}>{t('productStructures.searchButton')}</Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {(['exact', 'parent'] as const).map(value => (
            <label key={value} className="inline-flex cursor-pointer items-center gap-1.5" title={value === 'parent' ? t('productStructures.modeParentHint') : undefined}>
              <input type="radio" name="structure-mode" checked={mode === value} onChange={() => { setMode(value); setPage(1); }} />
              {t(value === 'exact' ? 'productStructures.modeExact' : 'productStructures.modeParent')}
            </label>
          ))}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          {loading && items.length === 0 ? <LoadingState label={t('productStructures.loading')} />
            : error ? <ErrorState message={error} onRetry={() => void loadList()} />
            : items.length === 0 ? <EmptyState title={t('productStructures.empty')} />
            : <ul>{items.map(item => renderNode(item.materialCode, item.materialName, item.hasChildren, 0, item.materialCode))}</ul>}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span>{t('productStructures.page', { page, pages })} · {total}</span>
          <Button type="button" variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      </Card>

      {/* ---- right: the structure of the selected product */}
      <Card className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {perms.create && <Button type="button" size="sm" icon={<Plus className="h-4 w-4" />} disabled={!!draft} onClick={() => void startAdd()}>{t('productStructures.add')}</Button>}
          {perms.edit && <Button type="button" size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} disabled={!detail || !!draft} onClick={startEdit}>{t('productStructures.edit')}</Button>}
          {perms.delete && <Button type="button" size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} disabled={!detail || !!draft} onClick={() => void remove()}>{t('productStructures.delete')}</Button>}
          {draft && <Button type="button" size="sm" icon={<Save className="h-4 w-4" />} disabled={saving} onClick={() => void save()}>{t('productStructures.save')}</Button>}
          {draft && <Button type="button" size="sm" variant="secondary" icon={<X className="h-4 w-4" />} disabled={saving} onClick={() => void cancelEdit()}>{t('productStructures.cancel')}</Button>}
          {!draft && selected && <Button type="button" size="sm" variant="ghost" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void loadDetail(selected)}>{t('productStructures.reload')}</Button>}
        </div>

        {!draft && !detail && <EmptyState title={t('productStructures.pick')} icon={<Network className="h-5 w-5" />} />}

        {(draft || detail) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_120px]">
              {draft?.isNew
                ? <CatalogLookup lookup="materials" label={t('productStructures.pickProduct')} required value={view?.materialCode ?? ''}
                    onChange={(code, item) => { setInput({ materialCode: code }); if (item) setNames(prev => ({ ...prev, [item.code]: item.name })); }} />
                : <TextInput label={t('productStructures.product')} readOnly value={(draft?.input.materialCode ?? detail?.materialCode) ?? ''} className="font-mono" />}
              <TextInput label={t('productStructures.materialName')} readOnly value={draft?.isNew ? nameOf(view?.materialCode ?? '') : detail?.materialName ?? ''} />
              <TextInput label={t('productStructures.uom')} readOnly value={draft?.isNew ? '' : detail?.uomCode ?? ''} />
            </div>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <TextInput label={t('productStructures.note')} maxLength={300} readOnly={!draft} value={draft ? view?.note ?? '' : detail?.note ?? ''}
                onChange={e => setInput({ note: e.target.value })} />
              <div className="pt-6">
                <Checkbox label={t('productStructures.isActive')} checked={draft ? !!view?.isActive : !!detail?.isActive} disabled={!draft}
                  onChange={isActive => setInput({ isActive })} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between border-b border-slate-200 pb-1 dark:border-slate-700">
                <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{t('productStructures.tabMaterials')}</span>
                <span className="text-[11px] text-slate-400">{t('productStructures.otherTabs')}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left dark:bg-slate-800">
                    <tr>
                      <th className="w-10 p-2 text-center">{t('productStructures.stt')}</th>
                      <th className="w-[17%] p-2">{t('productStructures.materialCode')}</th>
                      <th className="p-2">{t('productStructures.materialName')}</th>
                      <th className="w-[10%] p-2">{t('productStructures.uom')}</th>
                      <th className="w-[15%] p-2">{t('productStructures.operationCode')}</th>
                      <th className="p-2">{t('productStructures.operationName')}</th>
                      <th className="w-[11%] p-2 text-right">{t('productStructures.quantity')}</th>
                      <th className="w-[9%] p-2 text-right">{t('productStructures.scrap')}</th>
                      <th className="p-2">{t('productStructures.lineNote')}</th>
                      {draft && <th className="w-24 p-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {draft && view && view.lines.map((line, index) => (
                      <tr key={index} className="border-t border-slate-200 align-top dark:border-slate-700">
                        <td className="p-1.5 pt-3 text-center font-mono text-slate-500">{index + 1}</td>
                        <td className="p-1.5">
                          <CatalogLookup lookup="materials" value={line.componentMaterialCode}
                            onChange={(code, item) => {
                              if (item) setNames(prev => ({ ...prev, [item.code]: item.name }));
                              setLine(index, { componentMaterialCode: code, uomCode: item ? String(item.extra?.uomCode ?? '') : '' });
                            }} />
                        </td>
                        <td className="p-1.5 pt-3">{nameOf(line.componentMaterialCode)}</td>
                        <td className="p-1.5">
                          <CatalogLookup lookup="materialUoms" params={{ material: line.componentMaterialCode }} value={line.uomCode}
                            disabled={!line.componentMaterialCode} onChange={code => setLine(index, { uomCode: code })} />
                        </td>
                        <td className="p-1.5">
                          <CatalogLookup lookup="productionOperations" value={line.productionOperationCode}
                            onChange={(code, item) => { if (item) setNames(prev => ({ ...prev, [`op:${item.code}`]: item.name })); setLine(index, { productionOperationCode: code }); }} />
                        </td>
                        <td className="p-1.5 pt-3">{line.productionOperationCode ? nameOf(`op:${line.productionOperationCode}`) : ''}</td>
                        <td className="p-1.5"><TextInput type="number" min={0} step="any" className="text-right font-mono" value={line.quantity || ''}
                          onChange={e => setLine(index, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })} /></td>
                        <td className="p-1.5"><TextInput type="number" min={0} max={99.9999} step="any" className="text-right font-mono" value={line.scrapPercent || ''}
                          onChange={e => setLine(index, { scrapPercent: e.target.value === '' ? 0 : Number(e.target.value) })} /></td>
                        <td className="p-1.5"><TextInput maxLength={300} value={line.note} onChange={e => setLine(index, { note: e.target.value })} /></td>
                        <td className="p-1.5">
                          <div className="flex justify-end gap-0.5">
                            <button type="button" title={t('productStructures.moveUp')} disabled={index === 0} onClick={() => moveLine(index, -1)}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" title={t('productStructures.moveDown')} disabled={index === view.lines.length - 1} onClick={() => moveLine(index, 1)}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" title={t('productStructures.removeLine')} onClick={() => setInput({ lines: view.lines.length > 1 ? view.lines.filter((_, i) => i !== index) : [emptyLine()] })}
                              className="cursor-pointer rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!draft && rows && rows.map(line => (
                      <tr key={line.lineNo} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="p-2 text-center font-mono text-slate-500">{line.lineNo}</td>
                        <td className="p-2 font-mono">{line.componentMaterialCode}</td>
                        <td className="p-2">
                          {line.hasStructure
                            ? <button type="button" className="cursor-pointer text-left font-semibold text-brand-700 hover:underline dark:text-brand-300" title={t('productStructures.hasStructure')}
                                onClick={() => void select(line.componentMaterialCode)}>{line.componentMaterialName ?? line.componentMaterialCode}</button>
                            : line.componentMaterialName ?? ''}
                        </td>
                        <td className="p-2">{line.uomCode}</td>
                        <td className="p-2 font-mono">{line.productionOperationCode ?? ''}</td>
                        <td className="p-2">{line.productionOperationName ?? ''}</td>
                        <td className="p-2 text-right font-mono tabular-nums">{formatQuantity(line.quantity)}</td>
                        <td className="p-2 text-right font-mono tabular-nums">{line.scrapPercent ? line.scrapPercent : ''}</td>
                        <td className="p-2">{line.note ?? ''}</td>
                      </tr>
                    ))}
                    {!draft && rows && rows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-slate-500">{t('productStructures.noLines')}</td></tr>}
                  </tbody>
                </table>
              </div>
              {draft && (
                <button type="button" onClick={() => setInput({ lines: [...(view?.lines ?? []), emptyLine()] })}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                  <Plus className="h-3.5 w-3.5" />{t('productStructures.addLine')}
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
