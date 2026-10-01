// Settings › Nhật ký thay đổi (sys_audit_log): who changed what, when, in every function (backend sys_audit_log,
// written automatically for [Audited] entities and by hand for permissions, approvals...). Read-only. The filters list
// what is in the log, so a new function appears by itself; its texts are optional (audit.objectType.<type>,
// audit.field.<name>, audit.action.<ACTION>), the raw names are shown otherwise. Field conventions (backend AuditDiff):
// camelCase fields, permission:{function} (granted actions), right:{function}:{code} (special right).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, History, RefreshCw, X } from 'lucide-react';
import { Badge, BadgeVariant } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { DateTimePicker } from '../../components/common/DateTimePicker';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateViews';
import { FUNCTION_REGISTRY, functionLabel } from '../../config/functions';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { auditLogApi, AuditFilters, AuditLogEntry, AuditPage, AuditQuery, permissionCatalogApi, SpecialRightDef } from '../../services/settingsApi';
import { costingMethodLabel, CostingMethod, systemSettingsService } from '../../services/systemSettingsService';
import { SubMenuKey } from '../../types';
import { formatDateTime } from '../../utils/format';
import { cn } from '../../lib/utils';

const ACTION_TONE: Record<string, BadgeVariant> = {
  CREATE: 'success', DELETE: 'danger', PERMISSIONS: 'warning', SYNC: 'warning', RESET_PASSWORD: 'warning',
  CHANGE_PASSWORD: 'warning', APPROVE: 'success', REJECT: 'danger', WITHDRAW: 'warning'
};

const isFunction = (code: string): code is SubMenuKey => code in FUNCTION_REGISTRY;

type Filters = Required<Pick<AuditQuery, 'functionCode' | 'objectType' | 'action' | 'actor' | 'search' | 'from' | 'to'>>;
const NO_FILTERS: Filters = { functionCode: '', objectType: '', action: '', actor: '', search: '', from: '', to: '' };

/** The value after the user stopped typing for a moment (text filters reload the list). */
const useDebounced = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const AuditLogView: React.FC = () => {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const actor = useDebounced(filters.actor);
  const search = useDebounced(filters.search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [result, setResult] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [rightDefs, setRightDefs] = useState<SpecialRightDef[]>([]);
  const [choices, setChoices] = useState<AuditFilters>({ functions: [], objectTypes: [], actions: [] });

  useEffect(() => {
    permissionCatalogApi.get().then(c => setRightDefs(c.specialRights)).catch(() => { /* right codes shown instead */ });
    auditLogApi.filters().then(setChoices).catch(() => { /* filters stay empty; the list still loads */ });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await auditLogApi.query({ ...filters, actor, search, page, pageSize }));
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // Text filters reload through their debounced value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.functionCode, filters.objectType, filters.action, filters.from, filters.to, actor, search, page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  /** Text of a key, or undefined when nobody translated it. */
  const known = (key: string, params?: Record<string, string | number>) => {
    const text = t(key, params);
    return text === key ? undefined : text;
  };

  /** Name of a kind of record; documents are logged under their function code. */
  const objectTypeLabel = (type: string) => known(`audit.objectType.${type}`) ?? (isFunction(type) ? functionLabel(type) : type);
  const actionLabel = (action: string) => known(`audit.action.${action}`) ?? action;
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

  const functionOptions = useMemo(() => choices.functions
    .map(key => ({ value: key, label: isFunction(key) ? functionLabel(key) : key })).sort(byLabel), [choices.functions]);
  const objectTypeOptions = choices.objectTypes.map(type => ({ value: type, label: objectTypeLabel(type) })).sort(byLabel);
  const actionOptions = choices.actions.map(action => ({ value: action, label: actionLabel(action) })).sort(byLabel);

  const labelOf = (field: string): string => {
    if (field.startsWith('permission:')) return t('audit.permissionOf', { name: functionLabel(field.slice(11) as SubMenuKey) });
    if (field.startsWith('right:')) {
      const key = field.slice(6);
      const cut = key.indexOf(':');
      return `${functionLabel(key.slice(0, cut) as SubMenuKey)} › ${rightDefs.find(d => d.key === key)?.name ?? key.slice(cut + 1)}`;
    }
    return known(`audit.field.${field}`) ?? field;
  };

  const valueOf = (field: string, value: string | null): string => {
    if (value === null) return '—';
    if (field.startsWith('permission:')) return value.split(',').map(a => t(`permissions.actionShort.${a}`)).join(', ');
    if (value === 'true') return t('audit.yes');
    if (value === 'false') return t('audit.no');
    switch (field) {
      case 'function': return isFunction(value) ? functionLabel(value) : value;
      case 'costingMethod': return costingMethodLabel(value as CostingMethod);
      case 'requesterType': return known(`approvalRules.requester.${value}`) ?? value;
      case 'approverType': return t(value === 'ROLE' ? 'approvalRules.form.approverRole' : 'approvalRules.form.approverUser');
      case 'minAmount': return `${new Intl.NumberFormat('vi-VN').format(Number(value))} ${systemSettingsService.getNumberFormat().currencySymbol}`;
      default: return value;
    }
  };

  const noteOf = (entry: AuditLogEntry) => entry.note
    ? known(`audit.note.${entry.objectType}.${entry.action}`, { note: entry.note }) ?? t('audit.note.default', { note: entry.note })
    : null;

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-col gap-2 min-h-0">
      {/* Header */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-200/80 dark:border-indigo-800/80 shrink-0">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">{t('audit.title')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('audit.description')}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px] shrink-0" disabled={loading}
          icon={<RefreshCw className="h-3.5 w-3.5 text-indigo-500" />} onClick={() => void load()}>
          {t('audit.reload')}
        </Button>
      </div>

      {/* Filters */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2 items-end">
        <SelectInput label={t('audit.filter.function')} value={filters.functionCode} placeholder={t('audit.filter.allFunctions')}
          onChange={(e) => setFilter('functionCode', e.target.value as SubMenuKey | '')} options={functionOptions} />
        <SelectInput label={t('audit.filter.objectType')} value={filters.objectType} placeholder={t('audit.filter.all')}
          onChange={(e) => setFilter('objectType', e.target.value)}
          options={objectTypeOptions} />
        <SelectInput label={t('audit.filter.action')} value={filters.action} placeholder={t('audit.filter.all')}
          onChange={(e) => setFilter('action', e.target.value)}
          options={actionOptions} />
        <TextInput label={t('audit.filter.actor')} value={filters.actor} placeholder={t('audit.filter.actorPlaceholder')}
          onChange={(e) => setFilter('actor', e.target.value)} />
        <TextInput label={t('audit.filter.search')} value={filters.search} placeholder={t('audit.filter.searchPlaceholder')}
          onChange={(e) => setFilter('search', e.target.value)} />
        <DateTimePicker label={t('audit.filter.from')} value={filters.from} max={filters.to || undefined} onChange={(v) => setFilter('from', v)} />
        <div className="flex items-end gap-1.5">
          <DateTimePicker label={t('audit.filter.to')} className="grow" value={filters.to} min={filters.from || undefined}
            onChange={(v) => setFilter('to', v)} />
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 px-2" title={t('audit.filter.clear')} aria-label={t('audit.filter.clear')}
              onClick={() => { setFilters(NO_FILTERS); setPage(1); }} icon={<X className="h-3.5 w-3.5" />} />
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs min-h-0 overflow-hidden flex flex-col">
        {error && items.length === 0 ? <ErrorState message={error} onRetry={() => void load()} />
          : loading && !result ? <LoadingState label={t('audit.loading')} />
          : items.length === 0 ? <EmptyState title={t('audit.empty')} description={hasFilters ? t('audit.emptyFiltered') : t('audit.emptyHint')} />
          : (
            <div className={cn('overflow-auto max-h-[calc(100vh-330px)]', loading && 'opacity-60')}>
              <table className="w-full min-w-[900px] text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="w-8" />
                    <th className="px-2 py-2 text-left w-36">{t('audit.col.time')}</th>
                    <th className="px-2 py-2 text-left">{t('audit.col.actor')}</th>
                    <th className="px-2 py-2 text-left w-48">{t('audit.col.function')}</th>
                    <th className="px-2 py-2 text-left">{t('audit.col.object')}</th>
                    <th className="px-2 py-2 text-left w-36">{t('audit.col.action')}</th>
                    <th className="px-2 py-2 text-left">{t('audit.col.changes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(entry => {
                    const isOpen = open.has(entry.id);
                    const note = noteOf(entry);
                    return (
                      <React.Fragment key={entry.id}>
                        <tr className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer align-top"
                          onClick={() => toggle(entry.id)}>
                          <td className="pl-2 py-1.5 text-slate-400">
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDateTime(entry.time)}</td>
                          <td className="px-2 py-1.5">
                            {entry.actorName
                              ? <><span className="font-semibold text-slate-800 dark:text-slate-100">{entry.actorName}</span>
                                  {entry.actorUsername && <span className="block text-[10px] text-slate-400">@{entry.actorUsername}{entry.unitCode && ` · ${entry.unitCode}`}</span>}</>
                              : <span className="text-slate-400">{t('audit.system')}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">{isFunction(entry.functionCode) ? functionLabel(entry.functionCode) : entry.functionCode}</td>
                          <td className="px-2 py-1.5">
                            <span className="text-slate-800 dark:text-slate-100">{entry.objectLabel ?? entry.objectId}</span>
                            <span className="block text-[10px] text-slate-400">{objectTypeLabel(entry.objectType)}</span>
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge variant={ACTION_TONE[entry.action] ?? 'info'} size="sm">{actionLabel(entry.action)}</Badge>
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {entry.changes.length > 0
                              ? <span className="line-clamp-2">{entry.changes.slice(0, 3).map(c => labelOf(c.field)).join(', ')}
                                  {entry.changes.length > 3 && ` ${t('audit.more', { n: entry.changes.length - 3 })}`}</span>
                              : <span className="text-slate-400">{note ?? '—'}</span>}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                            <td />
                            <td colSpan={6} className="px-2 py-2 space-y-1.5">
                              {note && <p className="text-[11px] text-slate-600 dark:text-slate-300">{note}</p>}
                              {entry.changes.length > 0 && (
                                <table className="w-full max-w-4xl text-[11px] border border-slate-200 dark:border-slate-700 rounded-[5px]">
                                  <thead className="bg-white dark:bg-slate-900 text-slate-500">
                                    <tr>
                                      <th className="px-2 py-1 text-left w-[40%]">{t('audit.col.field')}</th>
                                      <th className="px-2 py-1 text-left">{t('audit.col.before')}</th>
                                      <th className="w-4" />
                                      <th className="px-2 py-1 text-left">{t('audit.col.after')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entry.changes.map(change => (
                                      <tr key={change.field} className="border-t border-slate-100 dark:border-slate-800 align-top">
                                        <td className="px-2 py-1 text-slate-700 dark:text-slate-200">{labelOf(change.field)}</td>
                                        <td className="px-2 py-1 text-slate-400 break-words">{valueOf(change.field, change.before)}</td>
                                        <td className="py-1"><ArrowRight className="h-3 w-3 text-slate-400" /></td>
                                        <td className="px-2 py-1 font-medium text-slate-800 dark:text-slate-100 break-words">{valueOf(change.field, change.after)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              <p className="text-[10px] text-slate-400">
                                {t('audit.source', { unit: entry.unitCode ?? '—', ip: entry.ipAddress ?? '—', id: entry.objectId })}
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        {total > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800">
            <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} pageSize={pageSize} totalItems={total}
              onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} pageSizeOptions={[20, 50, 100, 200]} />
          </div>
        )}
      </div>
    </div>
  );
};
