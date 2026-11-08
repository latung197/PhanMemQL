// Bàn điều hành: the figures of the working unit from GET /api/dashboard (vouchers by status, stock, low stock, projects, what the user has to do,
// recent changes). Nothing here is mock data: the server leaves out every part the user may not view and the money they may not see (VIEW_COST),
// so a missing part just does not render. The unit is the one of the session; to look at another unit, switch unit in the header.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, FilePen, FolderKanban, PackageCheck, PlusCircle, RefreshCw, Warehouse as WarehouseIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateViews';
import { functionLabel, getFunction } from '../../config/functions';
import { useLanguage } from '../../context/LanguageContext';
import { useNumberFormat } from '../../context/NumberFormatContext';
import { getErrorMessage } from '../../services/apiClient';
import { CompanyUnit, ModuleCategoryKey, SubMenuKey, UserProfile } from '../../types';
import { requestOpenDocument } from '../../utils/documentLinks';
import { formatDate, formatDateTime } from '../../utils/format';
import { canView, getActionPermission } from '../../utils/permissions';
import { dashboardApi } from './api';
import type { Dashboard, DashboardRange } from './types';

interface OverviewModuleProps {
  currentUser: UserProfile;
  activeCompanyUnitCode?: string;
  companyUnits: CompanyUnit[];
  onNavigate: (cat: ModuleCategoryKey, subKey: SubMenuKey) => void;
}

const RANGES: DashboardRange[] = ['week', 'month', 'quarter', 'year'];
/** Vouchers that never post: their "posted" column is not applicable. */
const NON_POSTING: SubMenuKey[] = ['pur_request', 'pur_order', 'inv_issue_request', 'inv_transfer_order'];
/** Vouchers a user may start from the dashboard when they hold the "create" right. */
const SHORTCUTS: SubMenuKey[] = ['inv_receipt', 'inv_issue', 'inv_transfer_order', 'pur_request', 'pur_order'];
const REFRESH_MS = 3 * 60 * 1000;

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string; tone?: 'brand' | 'amber' | 'rose' | 'emerald'; onClick?: () => void }> =
  ({ icon, label, value, hint, tone = 'brand', onClick }) => {
    const toneClass = { brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
      rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' }[tone];
    const Tag = onClick ? 'button' : 'div';
    return (
      <Tag type={onClick ? 'button' : undefined} onClick={onClick}
        className={`min-w-0 rounded-[9px] border border-slate-200/80 bg-white p-4 text-left shadow-xs dark:border-slate-800 dark:bg-slate-900 ${onClick ? 'transition-colors hover:border-brand-300 dark:hover:border-brand-700' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 truncate font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
          </div>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
        </div>
      </Tag>
    );
  };

export const OverviewModule: React.FC<OverviewModuleProps> = ({ currentUser, activeCompanyUnitCode, companyUnits, onNavigate }) => {
  const { t, language } = useLanguage();
  const { formatNumber, formatQuantity } = useNumberFormat();
  const [range, setRange] = useState<DashboardRange>('month');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await dashboardApi.get(range));
      setError('');
    } catch (e) {
      if (!silent) setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  // Reload when the period or the working unit changes; keep fresh while the screen stays open.
  useEffect(() => { void load(); }, [load, activeCompanyUnitCode]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const unit = companyUnits.find(u => u.code === (data?.unitCode ?? activeCompanyUnitCode));
  const unitName = unit ? `${unit.code} - ${unit.localizedName ?? unit.name}` : (data?.unitCode ?? activeCompanyUnitCode ?? '');

  const money = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${formatNumber(value / 1e9, 2)} ${t('dashboard.billion')}`;
    if (abs >= 1e6) return `${formatNumber(value / 1e6, 1)} ${t('dashboard.million')}`;
    return formatNumber(value, 0);
  };
  const label = (fn: string) => functionLabel(fn as SubMenuKey);
  const open = (fn: SubMenuKey, documentId?: string) => {
    if (!canView(currentUser, fn)) return;
    onNavigate(getFunction(fn).category, fn);
    if (documentId) requestOpenDocument(fn, documentId);
  };

  const shortcuts = useMemo(() => SHORTCUTS.filter(fn => getActionPermission(currentUser, fn).create), [currentUser]);
  const trend = useMemo(() => {
    if (!data?.stock) return { rows: [], hasValue: false };
    const hasValue = data.stock.trend.every(m => m.receiptValue !== null);
    return {
      hasValue,
      rows: data.stock.trend.map(m => ({
        month: m.month.slice(5) + '/' + m.month.slice(2, 4),
        receipt: hasValue ? Math.round((m.receiptValue ?? 0) / 1e6) : m.receiptCount,
        issue: hasValue ? Math.round((m.issueValue ?? 0) / 1e6) : m.issueCount
      }))
    };
  }, [data]);

  if (loading && !data) return <LoadingState label={t('dashboard.loading')} />;
  if (error && !data) return <ErrorState title={t('dashboard.error')} message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const { stock, projects, todo, activity, vouchers } = data;
  const nothingToShow = !stock && !projects && !activity && vouchers.length === 0 && shortcuts.length === 0
    && todo.pendingApprovalCount === 0 && todo.draftCount === 0;
  const voucherRows = vouchers.filter(v => v.draft + v.pending + v.approved + v.posted + v.cancelled > 0);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[9px] border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('dashboard.title')}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-brand-600 dark:text-brand-400">{unitName}</span>
            <span aria-hidden="true"> · </span>{t('dashboard.period', { from: formatDate(data.from), to: formatDate(data.to) })}
            <span aria-hidden="true"> · </span>{t('dashboard.updatedAt', { time: new Date(data.generatedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN') })}
          </p>
          <p className="mt-1 max-w-3xl text-[11px] text-slate-400">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[7px] border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800" role="group">
            {RANGES.map(key => (
              <button key={key} type="button" onClick={() => setRange(key)} aria-pressed={range === key}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-bold transition-colors ${range === key ? 'bg-white text-brand-700 shadow-xs dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                {t(`dashboard.range.${key}`)}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} onClick={() => void load()}>
            {t('dashboard.refresh')}
          </Button>
        </div>
      </div>

      {nothingToShow && <EmptyState title={t('dashboard.noRights')} />}

      {shortcuts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('dashboard.shortcuts')}</span>
          {shortcuts.map(fn => (
            <Button key={fn} type="button" variant="secondary" size="sm" icon={<PlusCircle className="h-4 w-4" />} onClick={() => open(fn)}>{label(fn)}</Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stock && (
          <Kpi icon={<PackageCheck className="h-5 w-5" />} label={t('dashboard.kpi.stockValue')}
            value={stock.totalValue !== null ? money(stock.totalValue) : formatNumber(stock.itemCount, 0)}
            hint={t('dashboard.kpi.stockItems', { n: formatNumber(stock.itemCount, 0) })} onClick={() => open('inv_report_stock')} />
        )}
        {stock && (
          <Kpi icon={<AlertTriangle className="h-5 w-5" />} label={t('dashboard.kpi.lowStock')} value={formatNumber(stock.lowStockCount, 0)}
            tone={stock.lowStockCount > 0 ? 'amber' : 'emerald'} hint={stock.lowStockCount > 0 ? t('dashboard.kpi.lowStockHint') : t('dashboard.kpi.lowStockOk')} />
        )}
        <Kpi icon={<ClipboardCheck className="h-5 w-5" />} label={t('dashboard.kpi.toApprove')} value={formatNumber(todo.pendingApprovalCount, 0)}
          tone={todo.pendingApprovalCount > 0 ? 'rose' : 'emerald'} hint={t('dashboard.kpi.toApproveHint')} />
        <Kpi icon={<FilePen className="h-5 w-5" />} label={t('dashboard.kpi.drafts')} value={formatNumber(todo.draftCount, 0)} hint={t('dashboard.kpi.draftsHint')} />
        {projects && (
          <Kpi icon={<FolderKanban className="h-5 w-5" />} label={t('dashboard.kpi.projects')} value={formatNumber(projects.activeCount, 0)}
            hint={projects.budget !== null && projects.spent !== null ? t('dashboard.kpi.projectsUsed', { spent: money(projects.spent), budget: money(projects.budget) }) : t('dashboard.kpi.projectsNoCost')}
            onClick={() => open('pur_report_project')} />
        )}
      </div>

      {stock && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2" title={t('dashboard.trend.title')}
            subtitle={`${t('dashboard.trend.hint')} · ${trend.hasValue ? t('dashboard.trend.valueHint') : t('dashboard.trend.countHint')}`}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => formatNumber(value, 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receipt" name={t('dashboard.trend.receipt')} fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="issue" name={t('dashboard.trend.issue')} fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={t('dashboard.warehouses.title')}>
            {stock.warehouses.length === 0 ? <EmptyState title={t('dashboard.warehouses.empty')} icon={<WarehouseIcon className="h-5 w-5" />} /> : (
              <ul className="space-y-3">
                {stock.warehouses.map(w => {
                  const total = stock.totalValue ?? 0;
                  const share = w.value !== null && total > 0 ? Math.round((w.value / total) * 100) : null;
                  return (
                    <li key={w.code}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-200">{w.name}</span>
                        <span className="shrink-0 font-mono tabular-nums text-slate-700 dark:text-slate-300">{w.value !== null ? money(w.value) : t('dashboard.warehouses.items', { n: w.itemCount })}</span>
                      </div>
                      {share !== null && <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${share}%` }} /></div>}
                      <p className="mt-0.5 text-[11px] text-slate-400">{w.code} · {t('dashboard.warehouses.items', { n: w.itemCount })}{share !== null ? ` · ${share}%` : ''}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {vouchers.length > 0 && (
          <Card className="xl:col-span-2" title={t('dashboard.vouchers.title')} subtitle={t('dashboard.vouchers.hint')}>
            {voucherRows.length === 0 ? <EmptyState title={t('dashboard.vouchers.empty')} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="py-1.5 pr-2 font-bold">{t('dashboard.vouchers.function')}</th>
                      {(['draft', 'pending', 'approved', 'posted', 'cancelled'] as const).map(k => <th key={k} className="px-2 py-1.5 text-right font-bold">{t(`dashboard.vouchers.${k}`)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {voucherRows.map(v => {
                      const cell = (value: number, na = false) => <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${value === 0 || na ? 'text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>{na ? '–' : value}</td>;
                      return (
                        <tr key={v.function} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                          <td className="py-1.5 pr-2">
                            <button type="button" onClick={() => open(v.function)} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">{label(v.function)}</button>
                          </td>
                          {cell(v.draft)}{cell(v.pending)}{cell(v.approved)}{cell(v.posted, NON_POSTING.includes(v.function))}{cell(v.cancelled)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card title={t('dashboard.todo.title')}>
          {todo.pendingApprovalCount === 0 && todo.draftCount === 0 ? <EmptyState title={t('dashboard.todo.empty')} /> : (
            <div className="space-y-3">
              {todo.pendingApprovalCount > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('dashboard.todo.approvals')} ({todo.pendingApprovalCount})</p>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {todo.pendingApprovals.map(a => (
                      <li key={`${a.function}-${a.documentId}`} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-200">{a.title || a.documentId}</p>
                          <p className="truncate text-[11px] text-slate-400">{label(a.function)} · {a.requestedBy.fullName} · {formatDateTime(a.requestedAt)}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => open(a.function, a.documentId)}>{t('dashboard.todo.open')}</Button>
                      </li>
                    ))}
                  </ul>
                  {todo.pendingApprovalCount > todo.pendingApprovals.length && (
                    <p className="mt-1 text-[11px] text-slate-400">{t('dashboard.todo.moreApprovals', { n: todo.pendingApprovalCount - todo.pendingApprovals.length })}</p>
                  )}
                </div>
              )}
              {todo.draftCount > 0 && <p className="text-xs text-slate-600 dark:text-slate-300">{t('dashboard.kpi.drafts')}: <span className="font-mono font-bold">{todo.draftCount}</span></p>}
            </div>
          )}
        </Card>
      </div>

      {(stock || projects || activity) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {stock && (
            <Card title={t('dashboard.lowStock.title')}>
              {stock.lowStock.length === 0 ? <EmptyState title={t('dashboard.lowStock.empty')} /> : (
                <>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stock.lowStock.map(m => (
                      <li key={m.materialCode} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-200">{m.materialName}</p>
                          <p className="text-[11px] text-slate-400">{m.materialCode}</p>
                        </div>
                        <span className={`shrink-0 font-mono tabular-nums ${m.quantity <= 0 ? 'font-bold text-rose-600' : 'text-amber-600 dark:text-amber-400'}`}>
                          {formatQuantity(m.quantity)} / {formatQuantity(m.minStock)} {m.uomCode}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {stock.lowStockCount > stock.lowStock.length && <p className="mt-1 text-[11px] text-slate-400">{t('dashboard.lowStock.more', { n: stock.lowStockCount - stock.lowStock.length })}</p>}
                </>
              )}
            </Card>
          )}

          {projects && (
            <Card title={t('dashboard.projects.title')}>
              {projects.top.length === 0 ? <EmptyState title={t('dashboard.projects.empty')} /> : (
                <ul className="space-y-3">
                  {projects.top.map(p => (
                    <li key={p.code}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-200">{p.code} · {p.name}</span>
                        {p.usedPercent !== null && <span className={`shrink-0 font-mono tabular-nums ${p.usedPercent > 100 ? 'font-bold text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>{formatNumber(p.usedPercent, 1)}%</span>}
                      </div>
                      {p.usedPercent !== null && (
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className={`h-1.5 rounded-full ${p.usedPercent > 100 ? 'bg-rose-500' : p.usedPercent > 80 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, p.usedPercent)}%` }} />
                        </div>
                      )}
                      {p.budget !== null && p.issuedValue !== null && <p className="mt-0.5 text-[11px] text-slate-400">{t('dashboard.projects.spent')} {money(p.issuedValue)} / {t('dashboard.projects.budget')} {money(p.budget)}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {activity && (
            <Card title={t('dashboard.activity.title')} subtitle={t('dashboard.activity.hint')}>
              {activity.length === 0 ? <EmptyState title={t('dashboard.activity.empty')} /> : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activity.map((a, i) => (
                    <li key={i} className="py-1.5 text-xs">
                      <p className="text-slate-800 dark:text-slate-200">
                        <span className="font-semibold">{a.actorName || t('dashboard.activity.system')}</span>{' '}
                        {t(`audit.action.${a.action}`)} <span className="text-slate-500">{label(a.function)}</span>{a.label ? <> · <span className="font-mono">{a.label}</span></> : null}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDateTime(a.time.endsWith('Z') ? a.time : `${a.time}Z`)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
