import React, { useState } from 'react';
import { Calendar, Lock, Unlock, Save, Shield, Clock, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { showToast, saveWithFeedback } from '../../utils/toast';
import { systemSettingsService, FiscalYearConfig, MonthLockState, DEFAULT_FISCAL_CONFIG } from '../../services/systemSettingsService';

interface FiscalYearViewProps {
  /** Recorded as "lockedBy" when a month is locked. */
  currentUsername?: string;
}

export const FiscalYearView: React.FC<FiscalYearViewProps> = ({ currentUsername = 'admin' }) => {
  const [config, setConfig] = useState<FiscalYearConfig>(() => systemSettingsService.getFiscalConfig());

  // Shows the change at once and restores the saved values if the backend rejects it.
  const persist = (newConfig: FiscalYearConfig, onSaved: () => void) => {
    setConfig(newConfig);
    void saveWithFeedback(systemSettingsService.saveFiscalConfig(newConfig), onSaved,
      () => setConfig(systemSettingsService.getFiscalConfig()));
  };

  const handleToggleMonth = (index: number) => {
    const updatedMonths = [...config.months];
    const item = { ...updatedMonths[index] };
    item.isLocked = !item.isLocked;
    const monthLabel = `${item.month < 10 ? '0' + item.month : item.month}/${item.year}`;
    if (item.isLocked) {
      item.lockedBy = currentUsername;
      item.lockedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    } else {
      item.lockedBy = undefined;
      item.lockedAt = undefined;
    }
    updatedMonths[index] = item;
    persist({ ...config, months: updatedMonths }, () => item.isLocked
      ? showToast.success(`Đã khóa sổ dữ liệu Tháng ${monthLabel}`)
      : showToast.warning(`Đã mở khóa sổ dữ liệu Tháng ${monthLabel}`));
  };

  const handleLockAll = () => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const updatedMonths = config.months.map(m => ({
      ...m,
      isLocked: true,
      lockedBy: currentUsername,
      lockedAt: nowStr
    }));
    persist({ ...config, months: updatedMonths },
      () => showToast.success('Đã khóa toàn bộ 12 tháng của năm tài chính!'));
  };

  const handleUnlockAll = () => {
    const updatedMonths = config.months.map(m => ({
      ...m,
      isLocked: false,
      lockedBy: undefined,
      lockedAt: undefined
    }));
    persist({ ...config, months: updatedMonths },
      () => showToast.warning('Đã mở khóa tất cả các tháng trong năm tài chính!'));
  };

  const handleSaveMainConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    persist(config, () => showToast.success('Đã lưu thiết lập năm tài chính & ngày khóa sổ hệ thống!'));
  };

  const handleReset = () => {
    persist({ ...DEFAULT_FISCAL_CONFIG }, () => showToast.info('Đã khôi phục thiết lập kỳ hạch toán ban đầu'));
  };

  const lockedCount = config.months.filter(m => m.isLocked).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-[5px] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[5px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Khai Báo Năm Làm Việc & Khóa Sổ Dữ Liệu
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                sys_fiscal_year
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thiết lập năm tài chính bắt đầu, ngày khởi tạo dữ liệu kho & kiểm soát phân quyền khóa sổ dữ liệu từng tháng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="flex items-center gap-1.5 rounded-[5px]">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Mặc Định</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleSaveMainConfig()} className="flex items-center gap-1.5 rounded-[5px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            <Save className="h-3.5 w-3.5" />
            <span>Lưu Thiết Lập</span>
          </Button>
        </div>
      </div>

      {/* Basic Setup Form */}
      <form onSubmit={handleSaveMainConfig} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <Clock className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Năm Bắt Đầu Làm Việc
            </h3>
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1">
              Năm Tài Chính Hạch Toán (Fiscal Year)
            </label>
            <input
              type="number"
              value={config.fiscalYear}
              onChange={(e) => setConfig({ ...config, fiscalYear: Number(e.target.value) })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Căn cứ xác định kỳ lập báo cáo Nhập-Xuất-Tồn, kết chuyển chi phí và tính giá xuất kho.
            </p>
          </div>
        </Card>

        <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <Calendar className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ngày Bắt Đầu Nhập Liệu
            </h3>
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1">
              Ngày Khởi Tạo Dữ Liệu Ban Đầu
            </label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Hệ thống sẽ từ chối tạo mới các phiếu nhập, xuất, thu chi phát sinh trước ngày khởi tạo này.
            </p>
          </div>
        </Card>

        <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <Lock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ngày Khóa Sổ Toàn Hệ Thống
            </h3>
          </div>
          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1">
              Ngày Khóa Dữ Liệu Cố Định
            </label>
            <input
              type="date"
              value={config.lockDate}
              onChange={(e) => setConfig({ ...config, lockDate: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Toàn bộ chứng từ có ngày lập &lt;= ngày này sẽ bị khóa, không thể sửa đổi hoặc xóa bỏ.
            </p>
          </div>
        </Card>
      </form>

      {/* Monthly Lock Table */}
      <Card className="p-5 border border-slate-200 dark:border-slate-800 rounded-[5px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Bảng Trạng Thái Khóa Sổ Dữ Liệu Từng Kỳ Tháng ({config.fiscalYear})
              </h3>
              <p className="text-xs text-slate-500">
                Đã khóa: <strong className="text-rose-600">{lockedCount}/12 tháng</strong> — Nhấp vào biểu tượng Khóa để bật/tắt quyền chỉnh sửa dữ liệu kỳ kế toán
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleUnlockAll} className="text-xs rounded-[5px]">
              <Unlock className="h-3.5 w-3.5 mr-1 text-emerald-600" />
              Mở Khóa Tất Cả
            </Button>
            <Button variant="outline" size="sm" onClick={handleLockAll} className="text-xs rounded-[5px]">
              <Lock className="h-3.5 w-3.5 mr-1 text-rose-600" />
              Khóa Tất Cả
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {config.months.map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-[5px] border transition-all ${
                item.isLocked
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    Tháng {item.month < 10 ? `0${item.month}` : item.month}/{item.year}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleMonth(idx)}
                  className={`p-1.5 rounded-[5px] border transition-colors cursor-pointer ${
                    item.isLocked
                      ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200 border-rose-300 dark:border-rose-700 hover:bg-rose-200'
                      : 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200'
                  }`}
                  title={item.isLocked ? 'Nhấp để Mở khóa sổ tháng này' : 'Nhấp để Khóa sổ tháng này'}
                >
                  {item.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-2 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-slate-500">Trạng thái:</span>
                  {item.isLocked ? (
                    <span className="text-rose-600 dark:text-rose-400 font-bold">Đã Khóa Sổ</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Đang Mở Nhập Liệu</span>
                  )}
                </div>
                {item.isLocked && (
                  <div className="text-[10px] text-slate-400 border-t border-rose-100 dark:border-rose-900/40 pt-1">
                    Khóa lúc: {item.lockedAt || 'Hệ thống'} ({item.lockedBy || 'admin'})
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
