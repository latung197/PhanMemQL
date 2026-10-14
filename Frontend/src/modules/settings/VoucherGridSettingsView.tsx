// Settings › Cấu hình lưới chứng từ (sys_voucher_grid). One grid is a tab of a voucher (Chi tiết mặt hàng, NVL...); the administrator
// reorders its columns, retitles them, sets width and decimals, hides the ones that are not required and says how many columns from the
// left stay pinned when the grid scrolls sideways. It applies to the whole system. What a column is (field, type, lookup, required)
// stays in the code; a user's own layout is a later step.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Layers, Save } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Checkbox } from '../../components/common/Checkbox';
import { fieldControlClass, SelectInput } from '../../components/common/FormField';
import { ErrorState, LoadingState } from '../../components/common/StateViews';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { voucherGridService, voucherGridsApi, type VoucherGridColumnRow, type VoucherGridRow } from '../../services/voucherGridService';
import { showToast } from '../../utils/toast';

const MAX_PINNED = 5;
const NUMERIC = ['number', 'quantity', 'currency', 'percentage'];

interface DraftColumn extends VoucherGridColumnRow { widthText: string; decimalsText: string }

const toDraft = (row: VoucherGridRow): DraftColumn[] => row.columns.map(c => ({
  ...c, widthText: c.width == null ? '' : String(c.width), decimalsText: c.decimals == null ? '' : String(c.decimals)
}));

export const VoucherGridSettingsView: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { t } = useLanguage();
  const [grids, setGrids] = useState<VoucherGridRow[]>([]);
  const [code, setCode] = useState('');
  const [columns, setColumns] = useState<DraftColumn[]>([]);
  const [pinCount, setPinCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const grid = useMemo(() => grids.find(g => g.code === code), [grids, code]);

  const select = useCallback((row: VoucherGridRow) => {
    setCode(row.code);
    setColumns(toDraft(row));
    setPinCount(row.pinCount);
  }, []);

  const load = useCallback(async (keep?: string) => {
    setLoading(true);
    try {
      const list = await voucherGridsApi.getAll();
      setGrids(list);
      const current = list.find(g => g.code === (keep ?? code)) ?? list[0];
      if (current) select(current);
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [select]);

  useEffect(() => { void load(); }, [load]);

  const options = useMemo(() => grids.map(g => ({ value: g.code, label: `${g.voucherName} › ${g.tabKey === 'items' ? t('voucherGrid.tabItems') : t('voucherGrid.tabMaterials')} (${g.code})` })), [grids, t]);
  const visibleCount = columns.filter(c => c.visible).length;
  const dirty = !!grid && (pinCount !== grid.pinCount || JSON.stringify(toDraft(grid)) !== JSON.stringify(columns));

  const patch = (index: number, change: Partial<DraftColumn>) => setColumns(prev => prev.map((c, i) => i === index ? { ...c, ...change } : c));
  const move = (index: number, delta: number) => setColumns(prev => {
    const target = index + delta;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    if (!grid) return;
    setSaving(true);
    try {
      const saved = await voucherGridsApi.update(grid.code, {
        pinCount: Math.min(pinCount, visibleCount),
        version: grid.version,
        columns: columns.map(c => ({
          field: c.field, header: c.header.trim(), headerEn: c.headerEn?.trim() || null,
          width: c.widthText.trim() === '' ? null : Number(c.widthText), minWidth: c.minWidth ?? null,
          decimals: NUMERIC.includes(c.type) && c.decimalsText.trim() !== '' ? Number(c.decimalsText) : null, visible: c.visible
        }))
      });
      showToast.success(t('voucherGrid.saved', { name: grid.voucherName }));
      setGrids(prev => prev.map(g => g.code === saved.code ? saved : g));
      select(saved);
      void voucherGridService.load();
    } catch (e) {
      showToast.error(getErrorMessage(e));
      await load(grid.code);
    } finally {
      setSaving(false);
    }
  };

  if (loading && grids.length === 0) return <LoadingState label={t('voucherGrid.loading')} />;
  if (error && grids.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Layers className="h-5 w-5" />{t('voucherGrid.title')}</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{t('voucherGrid.subtitle')}</p>
        </div>
        {canEdit && <Button type="button" size="sm" icon={<Save className="h-4 w-4" />} disabled={saving || !dirty || !grid} onClick={() => void save()}>
          {saving ? t('voucherGrid.saving') : t('voucherGrid.save')}
        </Button>}
      </div>

      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <SelectInput label={t('voucherGrid.grid')} value={code} options={options}
            onChange={e => { const row = grids.find(g => g.code === e.target.value); if (row) select(row); }} />
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('voucherGrid.pin')}</label>
            <input type="number" min={0} max={Math.min(MAX_PINNED, visibleCount)} value={pinCount} disabled={!canEdit}
              onChange={e => setPinCount(Math.max(0, Math.min(MAX_PINNED, Number(e.target.value) || 0)))}
              className={`${fieldControlClass(false, 'h-8 px-2 py-0')} mt-1 w-24 text-right font-mono`} />
            <p className="mt-1 text-[11px] text-slate-500">{t('voucherGrid.pinHint', { n: MAX_PINNED })}</p>
          </div>
        </div>

        <div className="overflow-auto rounded-[5px] border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="w-10 px-2 py-1.5">#</th>
                <th className="w-24 px-2 py-1.5">{t('voucherGrid.order')}</th>
                <th className="px-2 py-1.5">{t('voucherGrid.field')}</th>
                <th className="px-2 py-1.5">{t('voucherGrid.header')}</th>
                <th className="px-2 py-1.5">{t('voucherGrid.headerEn')}</th>
                <th className="w-24 px-2 py-1.5 text-right">{t('voucherGrid.width')}</th>
                <th className="w-24 px-2 py-1.5 text-right">{t('voucherGrid.decimals')}</th>
                <th className="w-28 px-2 py-1.5 text-center">{t('voucherGrid.visible')}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column, index) => {
                const visibleIndex = columns.slice(0, index + 1).filter(c => c.visible).length;
                const pinned = column.visible && visibleIndex <= pinCount;
                return (
                  <tr key={column.field} className={`border-t border-slate-100 dark:border-slate-800 ${column.visible ? '' : 'opacity-50'} ${pinned ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}>
                    <td className="px-2 py-1 text-slate-400">{index + 1}{pinned ? ' 📌' : ''}</td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" disabled={!canEdit || index === 0} title={t('voucherGrid.up')} onClick={() => move(index, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
                        <Button type="button" variant="ghost" size="sm" disabled={!canEdit || index === columns.length - 1} title={t('voucherGrid.down')} onClick={() => move(index, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="font-mono font-bold">{column.field}</div>
                      <div className="text-[10px] text-slate-500">{column.type}{column.required ? ` · ${t('voucherGrid.required')}` : ''}{column.readOnly ? ` · ${t('voucherGrid.readOnly')}` : ''}</div>
                    </td>
                    <td className="px-2 py-1"><input value={column.header} disabled={!canEdit} maxLength={200} onChange={e => patch(index, { header: e.target.value })} className={fieldControlClass(!column.header.trim(), 'h-7 px-2 py-0')} /></td>
                    <td className="px-2 py-1"><input value={column.headerEn ?? ''} disabled={!canEdit} maxLength={200} onChange={e => patch(index, { headerEn: e.target.value })} className={fieldControlClass(false, 'h-7 px-2 py-0')} /></td>
                    <td className="px-2 py-1"><input type="number" min={40} max={800} value={column.widthText} disabled={!canEdit} onChange={e => patch(index, { widthText: e.target.value })} className={`${fieldControlClass(false, 'h-7 px-2 py-0')} text-right font-mono`} /></td>
                    <td className="px-2 py-1">
                      {NUMERIC.includes(column.type)
                        ? <input type="number" min={0} max={6} value={column.decimalsText} disabled={!canEdit} onChange={e => patch(index, { decimalsText: e.target.value })} className={`${fieldControlClass(false, 'h-7 px-2 py-0')} text-right font-mono`} />
                        : <span className="block text-center text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <Checkbox checked={column.visible} disabled={!canEdit || column.locked} onChange={visible => patch(index, { visible })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">{t('voucherGrid.note')}</p>
      </Card>
    </div>
  );
};
