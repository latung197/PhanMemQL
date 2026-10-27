// Bàn điều hành: a few basic numbers read from the backend (what is waiting for the user's approval, the vouchers of this month) and
// shortcuts to the functions the user may open. Every figure is read with the user's own rights: a number the user may not see shows "—".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, PackageMinus, PackagePlus, RefreshCw, ShieldCheck, ShoppingBag } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { FUNCTION_REGISTRY } from '../../config/functions';
import { apiRequest, getErrorMessage } from '../../services/apiClient';
import { canView } from '../../utils/permissions';
import { requestOpenDocument } from '../../utils/documentLinks';
import { showToast } from '../../utils/toast';
import type { ModuleCategoryKey, SubMenuKey, UserProfile } from '../../types';

interface OverviewModuleProps {
  currentUser?: UserProfile | null;
  activeCompanyUnitCode?: string;
  onNavigate: (cat: ModuleCategoryKey, subKey: SubMenuKey) => void;
  onSelectCompanyUnit?: (code: string) => void;
}

interface PendingApproval {
  function: SubMenuKey;
  documentId: string;
  level: number;
  requestedBy: { fullName: string };
  requestedAt: string;
}

/** The vouchers counted for this month: the function and the list endpoint (a page of one row gives the total). */
const MONTH_COUNTS: { fn: SubMenuKey; url: string }[] = [
  { fn: 'inv_receipt', url: '/api/inventory/goods-receipts' },
  { fn: 'inv_issue', url: '/api/inventory/goods-issues' },
  { fn: 'sales_orders', url: '/api/sales/sales-orders' }
];

/** What the user is most likely to open next. */
const SHORTCUTS: SubMenuKey[] = ['inv_receipt', 'inv_issue', 'inv_audit_count', 'pur_order', 'sales_orders', 'inv_report_stock'];

const monthStart = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

export const OverviewModule: React.FC<OverviewModuleProps> = ({ currentUser, activeCompanyUnitCode, onNavigate }) => {
  const [pending, setPending] = useState<PendingApproval[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<SubMenuKey, number | null>>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [approvals, ...totals] = await Promise.all([
        apiRequest<PendingApproval[]>('GET', '/api/approvals/pending').catch(() => null),
        ...MONTH_COUNTS.map(item => canView(currentUser ?? null, item.fn)
          ? apiRequest<{ total: number }>('GET', `${item.url}?page=1&pageSize=1&from=${monthStart()}`).then(page => page.total).catch(() => null)
          : Promise.resolve(null))
      ]);
      setPending(approvals);
      setCounts(Object.fromEntries(MONTH_COUNTS.map((item, index) => [item.fn, totals[index]])));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { void load(); }, [load, activeCompanyUnitCode]);

  const shortcuts = useMemo(() => SHORTCUTS.filter(fn => canView(currentUser ?? null, fn)), [currentUser]);
  const show = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value.toLocaleString('vi-VN'));
  const open = (fn: SubMenuKey) => onNavigate(FUNCTION_REGISTRY[fn].category, fn);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">Tổng quan</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Xin chào, <strong>{currentUser?.fullName ?? ''}</strong>{activeCompanyUnitCode ? <> · Đơn vị <strong>{activeCompanyUnitCode}</strong></> : null}
            {' · '}{new Date().toLocaleDateString('vi-VN')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading} icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}>
          Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard title="Chờ tôi duyệt" value={show(pending?.length)} subtitle="Phiếu đang chờ bạn phê duyệt" icon={<ShieldCheck className="h-5 w-5" />} colorTheme="amber" />
        <StatCard title="Phiếu nhập kho" value={show(counts.inv_receipt)} subtitle="Lập trong tháng này" icon={<PackagePlus className="h-5 w-5" />} colorTheme="emerald" />
        <StatCard title="Phiếu xuất kho" value={show(counts.inv_issue)} subtitle="Lập trong tháng này" icon={<PackageMinus className="h-5 w-5" />} colorTheme="rose" />
        <StatCard title="Đơn bán hàng" value={show(counts.sales_orders)} subtitle="Lập trong tháng này" icon={<ShoppingBag className="h-5 w-5" />} colorTheme="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 p-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-2 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-indigo-500" />Phiếu chờ tôi duyệt
          </h3>
          {pending === null ? (
            <p className="text-xs text-slate-400 py-6 text-center">Không đọc được danh sách phiếu chờ duyệt.</p>
          ) : pending.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Không có phiếu nào đang chờ bạn duyệt.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pending.slice(0, 8).map(item => {
                const def = FUNCTION_REGISTRY[item.function];
                return (
                  <button key={`${item.function}-${item.documentId}-${item.level}`} type="button"
                    onClick={() => { if (!def) return; onNavigate(def.category, item.function); requestOpenDocument(item.function, item.documentId); }}
                    className="w-full flex items-center justify-between gap-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg px-2 cursor-pointer">
                    <span className="min-w-0">
                      <span className="block font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">{item.documentId}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{def?.label ?? item.function} · gửi bởi {item.requestedBy.fullName}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">cấp {item.level} · {new Date(item.requestedAt).toLocaleDateString('vi-VN')}</span>
                  </button>
                );
              })}
              {pending.length > 8 && <p className="text-[11px] text-slate-400 pt-2 px-2">và {pending.length - 8} phiếu khác, xem ở các màn Phê duyệt.</p>}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-2">Lối tắt</h3>
          {shortcuts.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Tài khoản chưa được cấp quyền vào chức năng nào.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {shortcuts.map(fn => (
                <button key={fn} type="button" onClick={() => open(fn)}
                  className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 cursor-pointer">
                  {FUNCTION_REGISTRY[fn].label}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
