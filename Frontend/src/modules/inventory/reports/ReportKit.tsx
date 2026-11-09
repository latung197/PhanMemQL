// What the five stock reports share: reading the report when the filters change, the frame (toolbar with the filters, the totals, the table
// with loading / error / empty states, Excel and print) and the filters every report has (warehouse, material group, text). The columns
// and totals of each report are in its own view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { CatalogLookup } from '../../../components/catalog/CatalogLookup';
import { useDebounced } from '../../../hooks/useDebounced';
import { getErrorMessage } from '../../../services/apiClient';
import { systemSettingsService } from '../../../services/systemSettingsService';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';
import { printReportTable } from './reportPrint';
import type { ReportFilters } from './api';
import type { SubMenuKey, UserProfile } from '../../../types';

export const filterLabel = 'block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5';
export const filterInput = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium';
export const th = 'px-2 py-2';

export const today = () => new Date().toISOString().split('T')[0];
export const monthStart = () => `${today().slice(0, 8)}01`;

/** Reads a report whenever its filters (the text of them) change; `reload` reads it again. */
export function useReport<T>(read: () => Promise<T>, filterKey: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const readRef = useRef(read);
  readRef.current = read;
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await readRef.current()); }
    catch (e) { setData(null); setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [filterKey, load]);
  return { data, loading, error, reload: load };
}

/** The first rows of a long report; a button shows more (every row is in the Excel file anyway). */
export function useRowLimit<T>(rows: T[], step = 300) {
  const [limit, setLimit] = useState(step);
  useEffect(() => { setLimit(step); }, [rows, step]);
  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const footer = rows.length > limit ? (
    <div className="flex items-center justify-center gap-3 py-2 text-xs text-slate-500">
      <span>Đang hiện {limit.toLocaleString('vi-VN')} / {rows.length.toLocaleString('vi-VN')} dòng</span>
      <Button type="button" size="sm" variant="outline" onClick={() => setLimit(limit + step)} className="text-[11px]">Xem thêm {step} dòng</Button>
      <span className="text-slate-400">(file Excel có đủ mọi dòng)</span>
    </div>
  ) : null;
  return { visible, footer };
}

/** The warehouse, material group and text filters every stock report has. `value` holds them as the strings the API takes. */
export const CommonFilters: React.FC<{ warehouse: string; onWarehouse: (v: string) => void; group: string; onGroup: (v: string) => void; search: string; onSearch: (v: string) => void }> = (p) => (
  <>
    <div><label className={filterLabel}>Kho</label><CatalogLookup lookup="warehouses" value={p.warehouse} onChange={code => p.onWarehouse(code)} /></div>
    <div><label className={filterLabel}>Nhóm vật tư</label><CatalogLookup lookup="materialGroups" value={p.group} onChange={code => p.onGroup(code)} /></div>
    <div className="col-span-2 md:col-span-1">
      <label className={filterLabel}>Tìm vật tư</label>
      <div className="relative">
        <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
        <input type="text" value={p.search} onChange={e => p.onSearch(e.target.value)} placeholder="Mã hoặc tên vật tư..." className={`${filterInput} pl-7`} />
      </div>
    </div>
  </>
);

/** The filter values that reach the API: the text is sent after a short pause, so typing does not read the report for every letter. */
export const useDebouncedSearch = (value: string) => useDebounced(value, 300).trim();

export interface ReportCard { title: string; value: string; tone?: string }

interface ReportFrameProps {
  functionCode: SubMenuKey;
  currentUser?: UserProfile;
  icon: React.ReactNode;
  title: string;
  countLabel: string;
  count: number;
  filters: React.ReactNode;
  activeFilterCount: number;
  onClear: () => void;
  onRefresh: () => void;
  /** The Excel file of this report with the current filters. */
  onExport: () => Promise<void>;
  /** The filters in words for the printed page. */
  filterSummary: string;
  /** false = the user has no VIEW_COST right: a notice says why the value columns are missing. */
  canSeeMoney: boolean;
  cards?: ReportCard[];
  /** Extra buttons in the toolbar, before "In báo cáo". */
  headerActions?: React.ReactNode;
  /** A notice between the toolbar and the cards (a check result, for example). */
  topSlot?: React.ReactNode;
  loading: boolean;
  error: string;
  empty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  children: React.ReactNode;
}

export const ReportFrame: React.FC<ReportFrameProps> = (p) => {
  const [showFilter, setShowFilter] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);
  const perm = getActionPermission(p.currentUser, p.functionCode);

  const handlePrint = () => {
    const html = tableRef.current?.querySelector('table')?.outerHTML;
    if (!html) { showToast.info('Chưa có dữ liệu để in.'); return; }
    const opened = printReportTable({ title: p.title, subtitle: p.filterSummary, tableHtml: html, company: systemSettingsService.getCompanyProfile(), printedBy: p.currentUser?.fullName });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };
  const handleExport = async () => {
    try { await p.onExport(); }
    catch (e) { showToast.error(getErrorMessage(e)); }
  };

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      <CategoryHeaderToolbar
        icon={p.icon}
        title={p.title}
        count={p.count}
        countLabel={p.countLabel}
        showAdvancedFilter={showFilter}
        onToggleAdvancedFilter={() => setShowFilter(!showFilter)}
        activeFilterCount={p.activeFilterCount}
        onRefresh={p.onRefresh}
        onExportExcel={perm.export ? () => void handleExport() : undefined}
        canCreate={false}
        extraActions={(p.headerActions || perm.print) ? (
          <>
            {p.headerActions}
            {perm.print && <Button type="button" variant="outline" size="sm" onClick={handlePrint} icon={<Printer className="h-3.5 w-3.5" />} className="text-xs">In báo cáo</Button>}
          </>
        ) : undefined}
        filterPanelContent={<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 text-xs">{p.filters}</div>}
        onApplyFilter={p.onRefresh}
        onClearFilter={p.onClear}
      />

      {p.topSlot}

      {!p.canSeeMoney && !p.loading && !p.error && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[5px] px-3 py-2">
          Tài khoản của bạn chưa có quyền đặc biệt &quot;Xem giá vốn&quot; của báo cáo này nên các cột giá trị bị ẩn; vẫn xem được số lượng.
        </p>
      )}

      {p.cards && p.cards.length > 0 && !p.loading && !p.error && !p.empty && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
          {p.cards.map(card => (
            <div key={card.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.title}</p>
              <p className={`font-mono font-extrabold text-lg ${card.tone ?? 'text-slate-800 dark:text-slate-100'}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div ref={tableRef} className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        {p.loading ? <LoadingState /> : p.error ? <ErrorState message={p.error} onRetry={p.onRefresh} /> : p.empty ? (
          <EmptyState title={p.emptyTitle} description={p.emptyDescription} />
        ) : p.children}
      </div>
    </div>
  );
};

/** A numeric cell: the number in a monospace font, "—" for a value the user may not see. */
export const num = (value: number | null | undefined, format: (v: number) => string) => (value === null || value === undefined ? '—' : format(value));
export type { ReportFilters };
