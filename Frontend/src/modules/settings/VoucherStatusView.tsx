// Settings › Trạng thái chứng từ (sys_voucher_status). The statuses of each voucher are fixed by the system (Lập chứng từ → Chờ duyệt →
// Đã duyệt → Đã ghi sổ, or Hủy); each company unit may rename them and switch the approval step off. The right to take a voucher into a
// status is granted per unit in Settings › Người dùng & phân quyền (status rights "ST_*").
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, Save } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Checkbox } from '../../components/common/Checkbox';
import { fieldControlClass, SelectInput } from '../../components/common/FormField';
import { ErrorState, LoadingState } from '../../components/common/StateViews';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { voucherStatusesApi, type VoucherStatusRow } from '../../services/settingsApi';
import { voucherStatusService } from '../../services/voucherStatusService';
import type { CompanyUnit } from '../../types';
import { showToast } from '../../utils/toast';

interface Props {
  canEdit: boolean;
  /** Unit of the session (the one the voucher screens read). */
  unitCode: string;
  companyUnits: CompanyUnit[];
}

type Draft = Pick<VoucherStatusRow, 'name' | 'nameEn' | 'isEnabled'>;

const keyOf = (row: Pick<VoucherStatusRow, 'voucherType' | 'status'>) => `${row.voucherType}:${row.status}`;
const variants = { Draft: 'slate', Pending: 'warning', Approved: 'info', Posted: 'success', Cancelled: 'danger' } as const;

export const VoucherStatusView: React.FC<Props> = ({ canEdit, unitCode, companyUnits }) => {
  const { t } = useLanguage();
  const [unit, setUnit] = useState(unitCode);
  const [rows, setRows] = useState<VoucherStatusRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  const unitOptions = useMemo(() => companyUnits.filter(x => x.isActive !== false)
    .map(x => ({ value: x.code, label: `${x.code} - ${x.localizedName || x.name}` })), [companyUnits]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await voucherStatusesApi.getAll(unit);
      setRows(list);
      setDrafts(Object.fromEntries(list.map(r => [keyOf(r), { name: r.name ?? '', nameEn: r.nameEn ?? '', isEnabled: r.isEnabled }])));
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [unit]);

  useEffect(() => { void load(); }, [load]);

  const edit = (row: VoucherStatusRow, patch: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [keyOf(row)]: { ...prev[keyOf(row)], ...patch } }));

  const changed = (row: VoucherStatusRow) => {
    const d = drafts[keyOf(row)];
    return !!d && ((d.name ?? '') !== (row.name ?? '') || (d.nameEn ?? '') !== (row.nameEn ?? '') || d.isEnabled !== row.isEnabled);
  };

  const save = async (row: VoucherStatusRow) => {
    const d = drafts[keyOf(row)];
    setSaving(keyOf(row));
    try {
      const updated = await voucherStatusesApi.update(unit, row, {
        name: d.name?.trim() || null, nameEn: d.nameEn?.trim() || null, isEnabled: d.isEnabled, version: row.version
      });
      setRows(prev => prev.map(r => keyOf(r) === keyOf(updated) ? updated : r));
      setDrafts(prev => ({ ...prev, [keyOf(updated)]: { name: updated.name ?? '', nameEn: updated.nameEn ?? '', isEnabled: updated.isEnabled } }));
      showToast.success(t('voucherStatus.saved', { voucher: updated.voucherName, status: updated.displayName }));
      // The voucher screens of the session read the unit of the session.
      if (unit === unitCode) void voucherStatusService.load();
    } catch (e) {
      showToast.error(getErrorMessage(e));
      void load();
    } finally {
      setSaving('');
    }
  };

  const vouchers = useMemo(() => {
    const groups = new Map<string, VoucherStatusRow[]>();
    rows.forEach(r => groups.set(r.voucherType, [...(groups.get(r.voucherType) ?? []), r]));
    return [...groups.values()];
  }, [rows]);

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold flex items-center gap-2"><ListChecks className="h-4 w-4 text-brand-600" />{t('voucherStatus.title')}</h2>
            <p className="text-xs text-slate-500 max-w-3xl">{t('voucherStatus.subtitle')}</p>
          </div>
          <div className="w-72 max-w-full">
            <SelectInput aria-label={t('voucherStatus.unit')} value={unit} options={unitOptions}
              onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{t('voucherStatus.rightsHint')}</p>
      </Card>

      {loading ? <LoadingState label={t('voucherStatus.loading')} /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
        vouchers.map(group => (
          <Card key={group[0].voucherType} className="p-4 space-y-2 border border-slate-200 dark:border-slate-800 rounded-[5px]">
            <h3 className="text-sm font-bold">
              {group[0].voucherName} <span className="ml-1 font-mono text-[10px] text-slate-400">{group[0].voucherType} · {group[0].function}</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-left">
                    <th className="py-2 px-2 w-40">{t('voucherStatus.status')}</th>
                    <th className="py-2 px-2">{t('voucherStatus.name')}</th>
                    <th className="py-2 px-2">{t('voucherStatus.nameEn')}</th>
                    <th className="py-2 px-2 w-32 text-center">{t('voucherStatus.inUse')}</th>
                    <th className="py-2 px-2 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {group.map(row => {
                    const d = drafts[keyOf(row)] ?? { name: '', nameEn: '', isEnabled: row.isEnabled };
                    return (
                      <tr key={keyOf(row)}>
                        <td className="py-2 px-2"><Badge variant={variants[row.status]} size="sm">{row.defaultName}</Badge></td>
                        <td className="py-2 px-2">
                          <input aria-label={t('voucherStatus.name')} disabled={!canEdit} maxLength={100} value={d.name ?? ''}
                            placeholder={row.defaultName} className={fieldControlClass(false, 'w-full')}
                            onChange={e => edit(row, { name: e.target.value })} />
                        </td>
                        <td className="py-2 px-2">
                          <input aria-label={t('voucherStatus.nameEn')} disabled={!canEdit} maxLength={100} value={d.nameEn ?? ''}
                            className={fieldControlClass(false, 'w-full')} onChange={e => edit(row, { nameEn: e.target.value })} />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex" title={row.canDisable ? undefined : t('voucherStatus.fixed')}>
                            <Checkbox checked={d.isEnabled} disabled={!canEdit || !row.canDisable} onChange={checked => edit(row, { isEnabled: checked })} />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {canEdit && changed(row) && (
                            <Button size="sm" disabled={saving === keyOf(row)} onClick={() => void save(row)}
                              icon={<Save className="h-3.5 w-3.5" />}>{t('voucherStatus.save')}</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};
