// Mua hàng › Báo cáo chi phí theo dự án (pur_report_project): per project the budget against what the vouchers of the unit add up to.
//   Đã đặt   = approved purchase orders (committed), Đã nhập = posted goods receipts, Chi phí = posted goods issues to the project
//   (stock consumed, valued at the warehouse average). Revenue is not in the system yet, so this is cost only; profit and loss comes
//   when sales and finance are redone. Click a row to see the vouchers behind it. Money needs the VIEW_COST right of the function.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Search } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { apiRequest, getErrorMessage } from '../../../services/apiClient';
import { useDebounced } from '../../../hooks/useDebounced';
import { formatDate } from '../../../utils/format';
import type { UserProfile } from '../../../types';

interface CostRow {
  code: string;
  name: string;
  status: 'PLANNING' | 'ACTIVE' | 'ONHOLD' | 'DONE' | 'CANCELLED';
  customerName?: string | null;
  managerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget: number | null;
  orderedValue: number | null;
  receivedValue: number | null;
  issuedValue: number | null;
  remaining: number | null;
  usedPercent: number | null;
  requestCount: number;
  orderCount: number;
  receiptCount: number;
  issueCount: number;
}

interface CostVoucher {
  kind: string;
  id: number;
  code: string;
  date: string;
  status: string;
  partner?: string | null;
  value: number | null;
}

const url = '/api/purchasing/project-cost';
const STATUS_TEXT: Record<CostRow['status'], string> = { PLANNING: 'Lập kế hoạch', ACTIVE: 'Đang thực hiện', ONHOLD: 'Tạm dừng', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy' };
const STATUS_VARIANT: Record<CostRow['status'], BadgeVariant> = { PLANNING: 'info', ACTIVE: 'success', ONHOLD: 'warning', DONE: 'slate', CANCELLED: 'danger' };
const KIND_TEXT: Record<string, string> = {
  pur_request: 'Yêu cầu mua hàng', pur_order: 'Đơn mua hàng', inv_receipt: 'Phiếu nhập kho', inv_issue: 'Phiếu xuất kho', inv_issue_request: 'Yêu cầu xuất kho'
};
const VOUCHER_STATUS_TEXT: Record<string, string> = { Draft: 'Lập chứng từ', Pending: 'Chờ duyệt', Approved: 'Đã phê duyệt', Posted: 'Chuyển sổ kho', Cancelled: 'Hủy' };

const filterLabel = 'block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5';
const filterInput = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium';

export const ProjectCostReportView: React.FC<{ currentUser?: UserProfile }> = () => {
  const { formatNumber } = useNumberFormat();
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilter, setShowFilter] = useState(true);
  const [detail, setDetail] = useState<CostRow | null>(null);
  const [vouchers, setVouchers] = useState<CostVoucher[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const debouncedSearch = useDebounced(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (status) params.set('projectStatus', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const text = params.toString();
      setRows(await apiRequest<CostRow[]>('GET', `${url}${text ? `?${text}` : ''}`));
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [debouncedSearch, status, from, to]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (row: CostRow) => {
    setDetail(row);
    setVouchers([]);
    setDetailError('');
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const text = params.toString();
      setVouchers(await apiRequest<CostVoucher[]>('GET', `${url}/${encodeURIComponent(row.code)}/vouchers${text ? `?${text}` : ''}`));
    } catch (e) { setDetailError(getErrorMessage(e)); }
    finally { setDetailLoading(false); }
  };

  const canSeeMoney = rows.length === 0 || rows[0].budget !== null;
  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatNumber(value));
  const totals = useMemo(() => rows.reduce((acc, row) => ({
    budget: acc.budget + (row.budget ?? 0), ordered: acc.ordered + (row.orderedValue ?? 0),
    received: acc.received + (row.receivedValue ?? 0), issued: acc.issued + (row.issuedValue ?? 0)
  }), { budget: 0, ordered: 0, received: 0, issued: 0 }), [rows]);

  const cards: { title: string; value: number; tone: string }[] = [
    { title: 'Ngân sách', value: totals.budget, tone: 'text-slate-800 dark:text-slate-100' },
    { title: 'Đã đặt mua (đơn đã duyệt)', value: totals.ordered, tone: 'text-amber-600 dark:text-amber-400' },
    { title: 'Đã nhập kho', value: totals.received, tone: 'text-sky-600 dark:text-sky-400' },
    { title: 'Chi phí thực tế (xuất kho)', value: totals.issued, tone: 'text-rose-600 dark:text-rose-400' }
  ];

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      <CategoryHeaderToolbar
        icon={<Briefcase className="h-6 w-6 text-amber-400" />}
        title="Báo Cáo Chi Phí Theo Dự Án"
        subtitle="Ngân sách so với giá trị đặt mua, nhập kho và xuất kho của từng dự án (giá trị quy ra tiền hạch toán)"
        count={rows.length}
        countLabel="Dự Án"
        showAdvancedFilter={showFilter}
        onToggleAdvancedFilter={() => setShowFilter(!showFilter)}
        activeFilterCount={[search.trim(), status, from, to].filter(Boolean).length}
        onRefresh={() => { void load(); }}
        canCreate={false}
        filterPanelContent={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="col-span-2 md:col-span-1">
              <label className={filterLabel}>Tìm dự án</label>
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã, tên, khách hàng, người quản lý..." className={`${filterInput} pl-7`} />
              </div>
            </div>
            <div>
              <label className={filterLabel}>Trạng thái dự án</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả --</option>
                {(Object.keys(STATUS_TEXT) as CostRow['status'][]).map(key => <option key={key} value={key}>{STATUS_TEXT[key]}</option>)}
              </select>
            </div>
            <div><label className={filterLabel}>Chứng từ từ ngày</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Đến ngày</label><input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className={filterInput} /></div>
          </div>
        }
        onApplyFilter={() => { void load(); }}
        onClearFilter={() => { setSearch(''); setStatus(''); setFrom(''); setTo(''); }}
      />

      {!canSeeMoney && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[5px] px-3 py-2">
          Tài khoản của bạn chưa có quyền đặc biệt &quot;Xem giá vốn&quot; của báo cáo này nên các cột giá trị bị ẩn; vẫn xem được số chứng từ.
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
          <EmptyState title="Chưa có dự án nào" description="Khai báo dự án ở Mua hàng › Danh mục dự án, rồi chọn dự án trên các chứng từ." />
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
              <tr>
                <th className="px-2 py-2">Dự án</th><th className="px-2 py-2">Khách hàng / quản lý</th><th className="px-2 py-2 text-center">Trạng thái</th>
                <th className="px-2 py-2 text-right">Ngân sách</th><th className="px-2 py-2 text-right">Đã đặt mua</th><th className="px-2 py-2 text-right">Đã nhập kho</th>
                <th className="px-2 py-2 text-right">Chi phí thực tế</th><th className="px-2 py-2 text-right">Còn lại</th><th className="px-2 py-2 text-right w-36">% ngân sách</th>
                <th className="px-2 py-2 text-center">Chứng từ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const over = row.remaining !== null && row.remaining < 0;
                const percent = row.usedPercent ?? 0;
                return (
                  <tr key={row.code} onClick={() => void openDetail(row)} className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-1.5"><div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.code}</div><div className="font-semibold">{row.name}</div></td>
                    <td className="px-2 py-1.5"><div>{row.customerName || '—'}</div><div className="text-[10px] text-slate-500">{row.managerName || ''}</div></td>
                    <td className="px-2 py-1.5 text-center"><Badge variant={STATUS_VARIANT[row.status]} size="sm">{STATUS_TEXT[row.status]}</Badge></td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(row.budget)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-amber-700 dark:text-amber-400">{money(row.orderedValue)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-sky-700 dark:text-sky-400">{money(row.receivedValue)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-700 dark:text-rose-400">{money(row.issuedValue)}</td>
                    <td className={`px-2 py-1.5 text-right font-mono font-bold ${over ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{money(row.remaining)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {row.usedPercent === null ? (row.budget === null ? '—' : <span className="text-slate-400">Chưa đặt ngân sách</span>) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full ${percent > 100 ? 'bg-rose-500' : percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                          </div>
                          <span className={`font-mono font-bold w-12 text-right ${percent > 100 ? 'text-rose-600' : ''}`}>{percent}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center text-[10px] text-slate-500">
                      YC {row.requestCount} · Đơn {row.orderCount} · Nhập {row.receiptCount} · Xuất {row.issueCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} maxWidth="5xl"
        title={detail ? <span className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-amber-500" />Chứng từ của dự án {detail.code} - {detail.name}</span> : ''}>
        <div className="space-y-3">
          {detail && canSeeMoney && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Ngân sách <strong className="font-mono">{money(detail.budget)}</strong> · Chi phí thực tế <strong className="font-mono text-rose-600">{money(detail.issuedValue)}</strong> ·
              Còn lại <strong className="font-mono">{money(detail.remaining)}</strong>
              {(from || to) && <span className="ml-2 text-slate-400">(chứng từ {from ? `từ ${formatDate(from)}` : ''} {to ? `đến ${formatDate(to)}` : ''})</span>}
            </p>
          )}
          <div className="max-h-[60vh] overflow-auto border border-slate-200 dark:border-slate-800 rounded-[5px]">
            {detailLoading ? <LoadingState /> : detailError ? <ErrorState message={detailError} /> : vouchers.length === 0 ? (
              <EmptyState title="Dự án chưa có chứng từ nào" />
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                  <tr><th className="px-2 py-1.5">Loại chứng từ</th><th className="px-2 py-1.5">Số chứng từ</th><th className="px-2 py-1.5">Ngày</th>
                    <th className="px-2 py-1.5">Đối tác</th><th className="px-2 py-1.5 text-center">Trạng thái</th><th className="px-2 py-1.5 text-right">Giá trị</th></tr>
                </thead>
                <tbody>
                  {vouchers.map(v => (
                    <tr key={`${v.kind}-${v.id}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5">{KIND_TEXT[v.kind] ?? v.kind}</td>
                      <td className="px-2 py-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.code}</td>
                      <td className="px-2 py-1.5">{formatDate(v.date)}</td>
                      <td className="px-2 py-1.5">{v.partner || '—'}</td>
                      <td className="px-2 py-1.5 text-center">{VOUCHER_STATUS_TEXT[v.status] ?? v.status}</td>
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
