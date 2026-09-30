// Settings › Năm tài chính & khóa sổ (sys_fiscal_year). The fiscal year and the data entry start date are
// company settings; month locks belong to the company unit of the session (switch unit to lock another).
import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Lock, Save, Unlock } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TextInput } from '../../components/common/FormField';
import { ErrorState, LoadingState } from '../../components/common/StateViews';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { FiscalYearConfig, systemSettingsService } from '../../services/systemSettingsService';
import { FiscalMonth, fiscalPeriodsApi } from '../../services/settingsApi';
import { getErrorMessage } from '../../services/apiClient';
import { saveWithFeedback, showToast } from '../../utils/toast';
import { formatDateTime } from '../../utils/format';
import { SettingsViewProps } from './settingsTypes';

interface FiscalYearViewProps extends SettingsViewProps {
  /** Company unit of the session, whose months are shown. */
  unitCode: string;
}

export const FiscalYearView: React.FC<FiscalYearViewProps> = ({ canEdit, unitCode }) => {
  const confirm = useConfirm();
  const [config, setConfig] = useState<FiscalYearConfig>(() => systemSettingsService.getFiscalConfig());
  const [year, setYear] = useState(config.fiscalYear);
  const [months, setMonths] = useState<FiscalMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMonths = useCallback(async () => {
    setLoading(true);
    try {
      setMonths(await fiscalPeriodsApi.getYear(year));
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void loadMonths(); }, [loadMonths, unitCode]);

  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    void saveWithFeedback(systemSettingsService.saveFiscalConfig(config),
      () => showToast.success('Đã lưu năm tài chính và ngày bắt đầu nhập liệu'),
      () => setConfig(systemSettingsService.getFiscalConfig()));
  };

  const setLock = async (targets: number[], isLocked: boolean) => {
    if (targets.length > 1 && !(await confirm({
      title: isLocked ? `Khóa sổ ${targets.length} tháng của năm ${year}?` : `Mở khóa ${targets.length} tháng của năm ${year}?`,
      message: isLocked
        ? 'Sau khi khóa, không ai lập, sửa hoặc xóa được chứng từ trong các tháng này.'
        : 'Chứng từ trong các tháng này sẽ lại được lập, sửa và xóa.',
      confirmLabel: isLocked ? 'Khóa sổ' : 'Mở khóa',
      tone: 'warning'
    }))) return;
    try {
      setMonths(await fiscalPeriodsApi.setLock(year, targets, isLocked));
      showToast.success(isLocked ? 'Đã khóa sổ' : 'Đã mở khóa sổ');
    } catch (e) {
      showToast.error(getErrorMessage(e));
    }
  };

  const lockedCount = months.filter(m => m.isLocked).length;

  return (
    <div className="space-y-4">
      <Card className="p-4 border border-slate-200 dark:border-slate-800 rounded-[5px]" title="Năm làm việc">
        <form onSubmit={saveConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <fieldset disabled={!canEdit} className="contents">
            <TextInput label="Năm tài chính" type="number" min={2000} max={2100} required value={config.fiscalYear}
              hint="Năm dùng cho báo cáo và tính giá xuất kho"
              onChange={e => setConfig({ ...config, fiscalYear: Number(e.target.value) })} />
            <TextInput label="Ngày bắt đầu nhập liệu" type="date" required value={config.startDate}
              hint="Không lập được chứng từ trước ngày này"
              onChange={e => setConfig({ ...config, startDate: e.target.value })} />
          </fieldset>
          {canEdit && (
            <div className="pb-5">
              <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>Lưu</Button>
            </div>
          )}
        </form>
      </Card>

      <Card className="p-4 border border-slate-200 dark:border-slate-800 rounded-[5px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Khóa sổ theo tháng — đơn vị {unitCode}</h3>
              <p className="text-xs text-slate-500">
                Đã khóa <strong className="text-rose-600">{lockedCount}/12</strong> tháng. Muốn khóa sổ đơn vị khác, hãy chuyển đơn vị làm việc trên thanh tiêu đề.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" title="Năm trước" onClick={() => setYear(y => y - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" />} />
            <span className="font-extrabold text-sm w-12 text-center">{year}</span>
            <Button variant="outline" size="sm" title="Năm sau" onClick={() => setYear(y => y + 1)} icon={<ChevronRight className="h-3.5 w-3.5" />} />
            {canEdit && (
              <>
                <Button variant="outline" size="sm" icon={<Unlock className="h-3.5 w-3.5 text-emerald-600" />}
                  onClick={() => void setLock(months.filter(m => m.isLocked).map(m => m.month), false)} disabled={lockedCount === 0}>
                  Mở tất cả
                </Button>
                <Button variant="outline" size="sm" icon={<Lock className="h-3.5 w-3.5 text-rose-600" />}
                  onClick={() => void setLock(months.filter(m => !m.isLocked).map(m => m.month), true)} disabled={lockedCount === 12}>
                  Khóa tất cả
                </Button>
              </>
            )}
          </div>
        </div>

        {error ? <ErrorState message={error} onRetry={() => void loadMonths()} />
          : loading ? <LoadingState label="Đang tải kỳ kế toán..." />
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {months.map(m => (
                <div key={m.month} className={`p-3 rounded-[5px] border ${m.isLocked
                  ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold">Tháng {String(m.month).padStart(2, '0')}</span>
                    {canEdit && (
                      <Button variant="ghost" size="sm" title={m.isLocked ? 'Mở khóa tháng này' : 'Khóa sổ tháng này'}
                        onClick={() => void setLock([m.month], !m.isLocked)}
                        icon={m.isLocked ? <Lock className="h-4 w-4 text-rose-600" /> : <Unlock className="h-4 w-4 text-emerald-600" />} />
                    )}
                  </div>
                  <p className={`text-xs font-bold ${m.isLocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {m.isLocked ? 'Đã khóa sổ' : 'Đang mở'}
                  </p>
                  {m.isLocked && m.lockedAt && (
                    <p className="text-[10px] text-slate-500 mt-1">{m.lockedBy ?? 'Hệ thống'} · {formatDateTime(m.lockedAt)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
};
