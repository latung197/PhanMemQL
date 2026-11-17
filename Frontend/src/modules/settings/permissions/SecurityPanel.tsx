// Tab "Bảo mật đăng nhập" of Settings › Người dùng & phân quyền: the system-wide security policy (password rules, failed
// attempts, idle sign-out; an administrator edits, others read) and the login history. Backend: services/securityApi.ts,
// guide docs/he-thong/bao-mat-dang-nhap.md.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge, type BadgeVariant } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { DateTimePicker } from '../../../components/common/DateTimePicker';
import { SearchInput } from '../../../components/common/SearchInput';
import { Pagination } from '../../../components/common/Pagination';
import { SelectInput } from '../../../components/common/FormField';
import { NumberInput } from '../../../components/common/NumberInput';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { useLanguage } from '../../../context/LanguageContext';
import { getErrorMessage } from '../../../services/apiClient';
import {
  LOGIN_RESULTS, securityApi, type LoginHistoryRow, type LoginResult, type SecurityPolicy
} from '../../../services/securityApi';
import { showToast } from '../../../utils/toast';

/** Same as SecurityPolicy.Default / SecurityPolicy.Validated() of the backend (the server checks again). */
const DEFAULT_POLICY: SecurityPolicy = {
  passwordMinLength: 8, passwordRequireLetter: true, passwordRequireDigit: true, passwordRequireUpper: false, passwordRequireSpecial: false,
  passwordExpiryDays: 90, passwordHistory: 3, mustChangeAfterReset: true,
  loginMaxFailures: 5, loginFailureWindowMinutes: 15, loginBlockMinutes: 15, idleTimeoutMinutes: 30
};

type NumberField = { [K in keyof SecurityPolicy]: SecurityPolicy[K] extends number ? K : never }[keyof SecurityPolicy];
type BooleanField = { [K in keyof SecurityPolicy]: SecurityPolicy[K] extends boolean ? K : never }[keyof SecurityPolicy];

const RANGES: Record<NumberField, [number, number]> = {
  passwordMinLength: [6, 64], passwordExpiryDays: [0, 3650], passwordHistory: [0, 24], loginMaxFailures: [0, 100],
  loginFailureWindowMinutes: [1, 1440], loginBlockMinutes: [1, 1440], idleTimeoutMinutes: [0, 1440]
};

const RESULT_VARIANT: Record<LoginResult, BadgeVariant> = {
  SUCCESS: 'success', WRONG_PASSWORD: 'warning', UNKNOWN_USER: 'warning', UNIT_DENIED: 'warning', BLOCKED: 'danger', LOGOUT: 'info', IDLE_TIMEOUT: 'info'
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const cardClass = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs';

export const SecurityPanel: React.FC<{ actorIsAdmin: boolean }> = ({ actorIsAdmin }) => {
  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-3 pr-1">
      <PolicyForm canEdit={actorIsAdmin} />
      <LoginHistory />
    </div>
  );
};

// ───────────────────────────── Policy ─────────────────────────────

const PolicyForm: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { t } = useLanguage();
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError('');
    securityApi.getPolicy().then(setPolicy).catch(e => setError(getErrorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const invalid = useMemo(() => {
    if (!policy) return false;
    return (Object.keys(RANGES) as NumberField[]).some(key => policy[key] < RANGES[key][0] || policy[key] > RANGES[key][1]);
  }, [policy]);

  if (error) return <div className={cardClass}><ErrorState message={error} onRetry={load} /></div>;
  if (!policy) return <div className={cardClass}><LoadingState label={t('security.policy.loading')} /></div>;

  const setNumber = (key: NumberField, value: number) => setPolicy({ ...policy, [key]: Number.isFinite(value) ? Math.trunc(value) : 0 });
  const setFlag = (key: BooleanField, value: boolean) => setPolicy({ ...policy, [key]: value });

  const save = async () => {
    setSaving(true);
    try {
      setPolicy(await securityApi.savePolicy(policy));
      showToast.success(t('security.policy.saved'));
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const number = (key: NumberField, unit?: 'chars' | 'days' | 'minutes') => {
    const [min, max] = RANGES[key];
    const outOfRange = policy[key] < min || policy[key] > max;
    return (
      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t(`security.policy.${key}`)}</label>
        <div className="flex items-center gap-2">
          <NumberInput value={policy[key]} onChange={value => setNumber(key, value)} decimals={0} min={min} max={max}
            disabled={!canEdit} className={`w-28 ${outOfRange ? 'border-rose-400' : ''}`} />
          {unit && <span className="text-xs text-slate-500">{t(`security.unit.${unit}`)}</span>}
        </div>
        <p className={`text-[11px] ${outOfRange ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {outOfRange ? t('security.policy.range', { min, max }) : hint(key, min, max)}
        </p>
      </div>
    );
  };
  const hint = (key: NumberField, min: number, max: number) => {
    const text = t(`security.policy.${key}Hint`, { min, max });
    return text.startsWith('security.') ? '' : text;
  };
  const flag = (key: BooleanField) => (
    <Checkbox checked={policy[key]} onChange={value => setFlag(key, value)} disabled={!canEdit} label={t(`security.policy.${key}`)} />
  );

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{t('security.policy.title')}</h3>
          {!canEdit && <p className="text-[11px] text-amber-700 dark:text-amber-400">{t('security.policy.adminOnly')}</p>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} title={t('security.policy.defaultsHint')}
              onClick={() => setPolicy({ ...DEFAULT_POLICY })}>{t('security.policy.defaults')}</Button>
            <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} disabled={saving || invalid} onClick={() => void save()}>
              {t('security.policy.save')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <fieldset className="space-y-3">
          <legend className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-1">{t('security.policy.groupPassword')}</legend>
          {number('passwordMinLength', 'chars')}
          <div className="space-y-2">
            {flag('passwordRequireLetter')}
            {flag('passwordRequireDigit')}
            {flag('passwordRequireUpper')}
            {flag('passwordRequireSpecial')}
          </div>
          {number('passwordExpiryDays', 'days')}
          {number('passwordHistory')}
          {flag('mustChangeAfterReset')}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-1">{t('security.policy.groupLogin')}</legend>
          {number('loginMaxFailures')}
          {number('loginFailureWindowMinutes', 'minutes')}
          {number('loginBlockMinutes', 'minutes')}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-extrabold uppercase tracking-wide text-slate-500 mb-1">{t('security.policy.groupSession')}</legend>
          {number('idleTimeoutMinutes', 'minutes')}
        </fieldset>
      </div>
    </div>
  );
};

// ───────────────────────────── Login history ─────────────────────────────

const LoginHistory: React.FC = () => {
  const { t } = useLanguage();
  const [rows, setRows] = useState<LoginHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  // Wait for the typing to stop before asking the server.
  const [searchSent, setSearchSent] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearchSent(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    securityApi.loginHistory({ page, pageSize, search: searchSent, result, from, to })
      .then(data => { if (!cancelled) { setRows(data.items); setTotal(data.total); } })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, searchSent, result, from, to, reloadTick]);

  const filtered = !!(search || result || from || to);
  const clear = () => { setSearch(''); setSearchSent(''); setResult(''); setFrom(''); setTo(''); setPage(1); };
  const resultLabel = (value: string) => t(`security.result.${value}`);

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-slate-100">
            <History className="h-4 w-4 text-slate-500" />{t('security.history.title')}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-2xl">{t('security.history.description')}</p>
        </div>
        <Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setReloadTick(n => n + 1)}>
          {t('security.history.reload')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end mb-3">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('security.history.search')}</label>
          <SearchInput value={search} onChange={setSearch} placeholder={t('security.history.searchPlaceholder')} />
        </div>
        <SelectInput label={t('security.history.result')} value={result} onChange={e => { setResult(e.target.value); setPage(1); }}>
          <option value="">{t('security.history.allResults')}</option>
          {LOGIN_RESULTS.map(value => <option key={value} value={value}>{resultLabel(value)}</option>)}
        </SelectInput>
        <DateTimePicker label={t('security.history.from')} value={from} onChange={value => { setFrom(value); setPage(1); }} />
        <DateTimePicker label={t('security.history.to')} value={to} onChange={value => { setTo(value); setPage(1); }} />
        {filtered && <Button variant="ghost" size="sm" onClick={clear}>{t('security.history.clear')}</Button>}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadTick(n => n + 1)} />
      ) : loading && rows.length === 0 ? (
        <LoadingState label={t('security.history.loading')} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('security.history.empty')} />
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold whitespace-nowrap">{t('security.history.col.time')}</th>
                <th className="px-3 py-2 font-bold">{t('security.history.col.user')}</th>
                <th className="px-3 py-2 font-bold">{t('security.history.col.result')}</th>
                <th className="px-3 py-2 font-bold">{t('security.history.col.unit')}</th>
                <th className="px-3 py-2 font-bold">{t('security.history.col.ip')}</th>
                <th className="px-3 py-2 font-bold">{t('security.history.col.device')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${loading ? 'opacity-60' : ''}`}>
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-1.5 whitespace-nowrap">{new Date(row.time).toLocaleString()}</td>
                  <td className="px-3 py-1.5">
                    <span className="font-semibold">{row.userName}</span>
                    {row.fullName && <span className="text-slate-500"> · {row.fullName}</span>}
                  </td>
                  <td className="px-3 py-1.5"><Badge variant={RESULT_VARIANT[row.result] ?? 'info'}>{resultLabel(row.result)}</Badge></td>
                  <td className="px-3 py-1.5">{row.unitCode ?? ''}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{row.ipAddress ?? ''}</td>
                  <td className="px-3 py-1.5 max-w-[320px] truncate" title={row.userAgent ?? undefined}>{row.userAgent ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} pageSize={pageSize} totalItems={total}
        pageSizeOptions={PAGE_SIZE_OPTIONS} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
    </div>
  );
};
