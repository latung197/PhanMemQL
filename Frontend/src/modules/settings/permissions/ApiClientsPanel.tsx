// Settings › Người dùng & Phân quyền › Khóa API: machines (robots, other systems) that call the API with a key. Super administrator only.
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Modal } from '../../../components/common/Modal';
import { SelectInput, TextInput } from '../../../components/common/FormField';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { useConfirm } from '../../../components/common/ConfirmDialog';
import { apiClientsApi, ApiClient, CreateApiClientInput } from '../../../services/settingsApi';
import { getErrorMessage } from '../../../services/apiClient';
import { showToast } from '../../../utils/toast';
import { CompanyUnit, RoleDefinition } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

interface ApiClientsPanelProps {
  roles: RoleDefinition[];
  companyUnits: CompanyUnit[];
}

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');
/** A date typed in the form (yyyy-mm-dd) as the end of that day in UTC. */
const endOfDay = (date: string) => (date ? new Date(`${date}T23:59:59Z`).toISOString() : null);

const emptyForm = (unit: string): CreateApiClientInput & { expiresDate: string } =>
  ({ code: '', name: '', roleId: '', unitCode: unit, allowedIps: '', expiresDate: '', note: '' });

export const ApiClientsPanel: React.FC<ApiClientsPanelProps> = ({ roles, companyUnits }) => {
  const confirm = useConfirm();
  const { t } = useLanguage();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [shownKey, setShownKey] = useState<{ client: ApiClient; apiKey: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setClients(await apiClientsApi.getAll());
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (client: ApiClient) => {
    try {
      await apiClientsApi.update(client.code, {
        name: client.name, allowedIps: client.allowedIps, expiresAt: client.expiresAt, note: client.note, isActive: !client.isActive
      });
      showToast.success(t(client.isActive ? 'apiKeys.switchedOff' : 'apiKeys.switchedOn', { code: client.code }));
      await load();
    } catch (e) { showToast.error(getErrorMessage(e)); }
  };

  const rotate = async (client: ApiClient) => {
    if (!await confirm({ title: t('apiKeys.rotateTitle'), message: t('apiKeys.rotateMessage', { code: client.code }), confirmLabel: t('apiKeys.rotate'), tone: 'danger' })) return;
    try {
      setShownKey(await apiClientsApi.rotateKey(client.code));
      await load();
    } catch (e) { showToast.error(getErrorMessage(e)); }
  };

  const remove = async (client: ApiClient) => {
    if (!await confirm({ title: t('apiKeys.deleteTitle'), message: t('apiKeys.deleteMessage', { code: client.code }), confirmLabel: t('common.delete'), tone: 'danger' })) return;
    try {
      await apiClientsApi.remove(client.code);
      showToast.success(t('apiKeys.deleted', { code: client.code }));
      await load();
    } catch (e) { showToast.error(getErrorMessage(e)); }
  };

  if (loading) return <LoadingState label={t('apiKeys.loading')} />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><KeyRound className="h-4 w-4 text-brand-600" /> {t('apiKeys.title')}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{t('apiKeys.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>{t('users.reload')}</Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('apiKeys.add')}</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {clients.length === 0 ? (
          <EmptyState icon={<KeyRound className="h-8 w-8" />} title={t('apiKeys.empty')} description={t('apiKeys.emptyHint')} />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                {['code', 'account', 'unit', 'key', 'ips', 'expires', 'lastUsed', 'status'].map(c => <th key={c} className="px-3 py-2 font-semibold">{t(`apiKeys.col.${c}`)}</th>)}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clients.map(c => (
                <tr key={c.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2"><div className="font-mono font-semibold">{c.code}</div><div className="text-slate-500">{c.name}</div></td>
                  <td className="px-3 py-2 font-mono">{c.userName}</td>
                  <td className="px-3 py-2">{c.unitCode}</td>
                  <td className="px-3 py-2 font-mono">serp_{c.keyPrefix}_…</td>
                  <td className="max-w-[180px] truncate px-3 py-2" title={c.allowedIps ?? ''}>{c.allowedIps || t('apiKeys.anyAddress')}</td>
                  <td className="px-3 py-2">{c.expiresAt ? dateTime(c.expiresAt) : t('apiKeys.never')}</td>
                  <td className="px-3 py-2">{c.lastUsedAt ? <>{dateTime(c.lastUsedAt)}<div className="font-mono text-slate-500">{c.lastUsedIp}</div></> : t('apiKeys.neverUsed')}</td>
                  <td className="px-3 py-2">
                    {!c.isActive ? <Badge variant="slate">{t('apiKeys.off')}</Badge>
                      : c.expiresAt && new Date(c.expiresAt) < new Date() ? <Badge variant="danger">{t('apiKeys.expired')}</Badge>
                        : <Badge variant="success">{t('apiKeys.on')}</Badge>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" icon={<Power className="h-4 w-4" />} title={t(c.isActive ? 'apiKeys.switchOff' : 'apiKeys.switchOn')} onClick={() => void toggle(c)} />
                    <Button variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} title={t('apiKeys.rotate')} onClick={() => void rotate(c)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-rose-600" />} title={t('common.delete')} onClick={() => void remove(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CreateClientModal roles={roles} companyUnits={companyUnits} onClose={() => setCreating(false)}
          onCreated={(result) => { setCreating(false); setShownKey(result); void load(); }} />
      )}
      {shownKey && <KeyShownModal result={shownKey} onClose={() => setShownKey(null)} />}
    </div>
  );
};

const CreateClientModal: React.FC<{
  roles: RoleDefinition[];
  companyUnits: CompanyUnit[];
  onClose: () => void;
  onCreated: (result: { client: ApiClient; apiKey: string }) => void;
}> = ({ roles, companyUnits, onClose, onCreated }) => {
  const { t } = useLanguage();
  const units = companyUnits.filter(u => u.status === 'Hoạt động');  // i18n-ignore: stored status
  const [form, setForm] = useState(() => emptyForm(units[0]?.code ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { expiresDate, ...rest } = form;
      onCreated(await apiClientsApi.create({ ...rest, code: form.code.trim().toUpperCase(), allowedIps: form.allowedIps?.trim() || null,
        expiresAt: endOfDay(expiresDate), note: form.note?.trim() || null }));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="lg" title={<><KeyRound className="h-5 w-5 text-brand-600" /> {t('apiKeys.createTitle')}</>}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextInput label={t('apiKeys.form.code')} required autoFocus maxLength={30} className="font-mono uppercase" value={form.code}
            onChange={(e) => set('code', e.target.value)} hint={t('apiKeys.form.codeHint')} />
          <TextInput label={t('apiKeys.form.name')} required maxLength={200} value={form.name} onChange={(e) => set('name', e.target.value)} />
          <SelectInput label={t('apiKeys.form.role')} required value={form.roleId} placeholder={t('apiKeys.form.pickRole')} onChange={(e) => set('roleId', e.target.value)}
            options={roles.filter(r => r.code !== 'ADMIN').map(r => ({ value: r.id, label: `${r.code} - ${r.name}` }))} hint={t('apiKeys.form.roleHint')} />
          <SelectInput label={t('apiKeys.form.unit')} required value={form.unitCode} onChange={(e) => set('unitCode', e.target.value)}
            options={units.map(u => ({ value: u.code, label: `${u.code} - ${u.shortName || u.name}` }))} hint={t('apiKeys.form.unitHint')} />
        </div>
        <TextInput label={t('apiKeys.form.ips')} maxLength={500} placeholder="10.0.0.5, 192.168.1.0/24" value={form.allowedIps ?? ''}
          onChange={(e) => set('allowedIps', e.target.value)} hint={t('apiKeys.form.ipsHint')} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextInput label={t('apiKeys.form.expires')} type="date" value={form.expiresDate} onChange={(e) => set('expiresDate', e.target.value)} hint={t('apiKeys.form.expiresHint')} />
          <TextInput label={t('apiKeys.form.note')} maxLength={300} value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} />
        </div>
        <p className="rounded bg-brand-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t('apiKeys.form.scopeNote')}</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={saving || !form.code.trim() || !form.name.trim() || !form.roleId || !form.unitCode}>{t('apiKeys.create')}</Button>
        </div>
      </form>
    </Modal>
  );
};

/** The only place the key is ever shown. */
const KeyShownModal: React.FC<{ result: { client: ApiClient; apiKey: string }; onClose: () => void }> = ({ result, onClose }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
    } catch { showToast.error(t('apiKeys.copyFailed')); }
  };
  return (
    <Modal isOpen onClose={onClose} maxWidth="lg" title={<><KeyRound className="h-5 w-5 text-brand-600" /> {t('apiKeys.keyTitle', { code: result.client.code })}</>}>
      <div className="space-y-3">
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">{t('apiKeys.keyOnce')}</p>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 select-all break-all rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-800">{result.apiKey}</code>
          <Button variant="outline" icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} onClick={() => void copy()}>{t(copied ? 'apiKeys.copied' : 'apiKeys.copy')}</Button>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t('apiKeys.howToUse')}</p>
          <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-[11px] leading-relaxed text-slate-100">{`POST /api/inventory/transfer-issues
X-Api-Key: ${result.apiKey}
Idempotency-Key: <a unique id of the command>
Content-Type: application/json`}</pre>
        </div>
        <div className="flex justify-end"><Button onClick={onClose}>{t('apiKeys.keySaved')}</Button></div>
      </div>
    </Modal>
  );
};
