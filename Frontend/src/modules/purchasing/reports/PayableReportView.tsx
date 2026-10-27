// Mua hàng › Báo cáo công nợ phải trả (pur_report_payable): per supplier what the approved purchase invoices of the unit add up to, split into
// not yet due and overdue, the overdue part by age past the due date. No payment is booked yet, so the debt is the whole of the invoices
// (payments will take away from it once the payment vouchers are tied to invoices). Click a row to see the invoices behind it.
// Money needs the VIEW_COST right of the function.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Search } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { apiRequest, getErrorMessage } from '../../../services/apiClient';
import { useDebounced } from '../../../hooks/useDebounced';
import { formatDate } from '../../../utils/format';
import type { UserProfile } from '../../../types';

interface PayableRow {
  supplierCode: string;
  supplierName: string;
  invoiceCount: number;
  overdueCount: number;
  oldestDueDate?: string | null;
  total: number | null;
  notDue: number | null;
  overdue: number | null;
  over1To30: number | null;
  over31To60: number | null;
  over61To90: number | null;
  over90: number | null;
}

interface PayableInvoice {
  id: number;
  code: string;
  date: string;
  invoiceNo: string;
  invoiceSeries?: string | null;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  currencyCode: string;
  value: number | null;
}

const url = '/api/purchasing/payables';
const today = () => new Date().toISOString().split('T')[0];

const filterLabel = 'block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5';
const filterInput = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium';

export const PayableReportView: React.FC<{ currentUser?: UserProfile }> = () => {
  const { formatNumber } = useNumberFormat();
  const [rows, setRows] = useState<PayableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [from, setFrom] = useState('');
  const [showFilter, setShowFilter] = useState(true);
  const [detail, setDetail] = useState<PayableRow | null>(null);
  const [invoices, setInvoices] = useState<PayableInvoice[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const debouncedSearch = useDebounced(search, 300);

  const dateQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (asOf) params.set('asOf', asOf);
    if (from) params.set('from', from);
    return params;
  }, [asOf, from]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = dateQuery();
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const text = params.toString();
      setRows(await apiRequest<PayableRow[]>('GET', `${url}${text ? `?${text}` : ''}`));
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [debouncedSearch, dateQuery]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (row: PayableRow) => {
    setDetail(row);
    setInvoices([]);
    setDetailError('');
    setDetailLoading(true);
    try {
      const text = dateQuery().toString();
      setInvoices(await apiRequest<PayableInvoice[]>('GET', `${url}/${encodeURIComponent(row.supplierCode)}/invoices${text ? `?${text}` : ''}`));
    } catch (e) { setDetailError(getErrorMessage(e)); }
    finally { setDetailLoading(false); }
  };

  const canSeeMoney = rows.length === 0 || rows[0].total !== null;
  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatNumber(value));
  const totals = useMemo(() => rows.reduce((acc, row) => ({
    total: acc.total + (row.total ?? 0), notDue: acc.notDue + (row.notDue ?? 0), overdue: acc.overdue + (row.overdue ?? 0), over90: acc.over90 + (row.over90 ?? 0)
  }), { total: 0, notDue: 0, overdue: 0, over90: 0 }), [rows]);

  const cards: { title: string; value: number; tone: string }[] = [
    { title: 'Tổng phải trả', value: totals.total, tone: 'text-slate-800 dark:text-slate-100' },
    { title: 'Chưa đến hạn', value: totals.notDue, tone: 'text-emerald-600 dark:text-emerald-400' },
    { title: 'Đã quá hạn', value: totals.overdue, tone: 'text-rose-600 dark:text-rose-400' },
    { title: 'Quá hạn trên 90 ngày', value: totals.over90, tone: 'text-rose-700 dark:text-rose-400' }
  ];

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      <CategoryHeaderToolbar
        icon={<Wallet className="h-6 w-6 text-amber-400" />}
        title="Báo Cáo Công Nợ Phải Trả"
        count={rows.length}
        countLabel="Nhà Cung Cấp"
        showAdvancedFilter={showFilter}
        onToggleAdvancedFilter={() => setShowFilter(!showFilter)}
        activeFilterCount={[search.trim(), from, asOf !== today() ? asOf : ''].filter(Boolean).length}
        onRefresh={() => { void load(); }}
        canCreate={false}
        filterPanelContent={
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="col-span-2 md:col-span-1">
              <label className={filterLabel}>Tìm nhà cung cấp</label>
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã hoặc tên nhà cung cấp..." className={`${filterInput} pl-7`} />
              </div>
            </div>
            <div><label className={filterLabel}>Tính đến ngày</label><input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Hóa đơn từ ngày</label><input type="date" value={from} max={asOf || undefined} onChange={e => setFrom(e.target.value)} className={filterInput} /></div>
          </div>
        }
        onApplyFilter={() => { void load(); }}
        onClearFilter={() => { setSearch(''); setAsOf(today()); setFrom(''); }}
      />

      {!canSeeMoney && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[5px] px-3 py-2">
          Tài khoản của bạn chưa có quyền đặc biệt &quot;Xem giá vốn&quot; của báo cáo này nên các cột giá trị bị ẩn; vẫn xem được số hóa đơn.
        </p>
      )}

      {canSeeMoney && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
          {cards.map(card => (
            <div key={card.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.title}</p>
              <p className={`font-mono font-extrabold text-lg ${card.tone}`}>{formatNumber(card.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : rows.length === 0 ? (
          <EmptyState title="Chưa có công nợ phải trả" description="Công nợ tính từ các hóa đơn mua hàng đã duyệt (Mua hàng › Hóa đơn mua hàng)." />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
              <tr>
                <th className="px-2 py-2">Nhà cung cấp</th><th className="px-2 py-2 text-center">Số hóa đơn</th>
                <th className="px-2 py-2 text-right">Tổng phải trả</th><th className="px-2 py-2 text-right">Chưa đến hạn</th><th className="px-2 py-2 text-right">Đã quá hạn</th>
                <th className="px-2 py-2 text-right">1-30 ngày</th><th className="px-2 py-2 text-right">31-60 ngày</th><th className="px-2 py-2 text-right">61-90 ngày</th>
                <th className="px-2 py-2 text-right">Trên 90 ngày</th><th className="px-2 py-2 text-center">Hạn sớm nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const late = row.oldestDueDate && row.oldestDueDate < asOf && row.overdueCount > 0;
                return (
                  <tr key={row.supplierCode} onClick={() => void openDetail(row)} className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-1.5"><div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.supplierCode}</div><div className="font-semibold">{row.supplierName}</div></td>
                    <td className="px-2 py-1.5 text-center font-mono">{row.invoiceCount}{row.overdueCount > 0 && <span className="text-rose-600 font-bold"> ({row.overdueCount} quá hạn)</span>}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-extrabold">{money(row.total)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700 dark:text-emerald-400">{money(row.notDue)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-700 dark:text-rose-400">{money(row.overdue)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(row.over1To30)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(row.over31To60)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(row.over61To90)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-700 dark:text-rose-400">{money(row.over90)}</td>
                    <td className={`px-2 py-1.5 text-center font-mono ${late ? 'text-rose-600 font-bold' : ''}`}>{row.oldestDueDate ? formatDate(row.oldestDueDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} maxWidth="5xl"
        title={detail ? <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-amber-500" />Hóa đơn của {detail.supplierCode} - {detail.supplierName}</span> : ''}>
        <div className="space-y-3">
          {detail && canSeeMoney && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tổng phải trả <strong className="font-mono">{money(detail.total)}</strong> · Quá hạn <strong className="font-mono text-rose-600">{money(detail.overdue)}</strong>
              <span className="ml-2 text-slate-400">(tính đến {formatDate(asOf)})</span>
            </p>
          )}
          <div className="max-h-[60vh] overflow-auto border border-slate-200 dark:border-slate-800 rounded-[5px]">
            {detailLoading ? <LoadingState /> : detailError ? <ErrorState message={detailError} /> : invoices.length === 0 ? (
              <EmptyState title="Nhà cung cấp chưa có hóa đơn nào" />
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                  <tr><th className="px-2 py-1.5">Số chứng từ</th><th className="px-2 py-1.5">Ngày CT</th><th className="px-2 py-1.5">Hóa đơn NCC</th><th className="px-2 py-1.5">Ngày hóa đơn</th>
                    <th className="px-2 py-1.5">Hạn thanh toán</th><th className="px-2 py-1.5 text-center">Quá hạn</th><th className="px-2 py-1.5 text-right">Giá trị (VNĐ)</th></tr>
                </thead>
                <tbody>
                  {invoices.map(v => (
                    <tr key={v.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.code}</td>
                      <td className="px-2 py-1.5">{formatDate(v.date)}</td>
                      <td className="px-2 py-1.5 font-mono">{v.invoiceNo}{v.invoiceSeries ? ` · ${v.invoiceSeries}` : ''}</td>
                      <td className="px-2 py-1.5">{formatDate(v.invoiceDate)}</td>
                      <td className={`px-2 py-1.5 font-mono ${v.daysOverdue > 0 ? 'text-rose-600 font-bold' : ''}`}>{formatDate(v.dueDate)}</td>
                      <td className={`px-2 py-1.5 text-center font-mono ${v.daysOverdue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{v.daysOverdue > 0 ? `${v.daysOverdue} ngày` : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{money(v.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => setDetail(null)}>Đóng</Button></div>
        </div>
      </Modal>
    </div>
  );
};
