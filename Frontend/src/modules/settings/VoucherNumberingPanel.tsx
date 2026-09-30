// Settings › Tham số mặc định › Đánh số chứng từ. One number series per voucher (backend VoucherCatalog);
// counters are kept by the backend per company unit, so only the format is edited here.
import React, { useCallback, useEffect, useState } from 'react';
import { Hash, Save } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ErrorState, LoadingState } from '../../components/common/StateViews';
import { VoucherNumbering, voucherNumberingApi } from '../../services/settingsApi';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import { fieldControlClass } from '../../components/common/FormField';

const TOKENS = ['{PREFIX}', '{DVCS}', '{YYYY}', '{YY}', '{MM}', '{DD}', '{SEQ}'];

export const VoucherNumberingPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [rows, setRows] = useState<VoucherNumbering[]>([]);
  const [drafts, setDrafts] = useState<Record<string, VoucherNumbering>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await voucherNumberingApi.getAll();
      setRows(list);
      setDrafts(Object.fromEntries(list.map(r => [r.voucherType, r])));
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const edit = (type: string, patch: Partial<VoucherNumbering>) =>
    setDrafts(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const changed = (row: VoucherNumbering) => {
    const d = drafts[row.voucherType];
    return d && (d.prefix !== row.prefix || d.pattern !== row.pattern || d.digits !== row.digits);
  };

  const save = async (row: VoucherNumbering) => {
    const d = drafts[row.voucherType];
    setSaving(row.voucherType);
    try {
      const updated = await voucherNumberingApi.update(row.voucherType, { prefix: d.prefix, pattern: d.pattern, digits: d.digits });
      setRows(prev => prev.map(r => r.voucherType === updated.voucherType ? updated : r));
      setDrafts(prev => ({ ...prev, [updated.voucherType]: updated }));
      showToast.success(`Đã lưu cách đánh số ${updated.name}`);
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally {
      setSaving('');
    }
  };

  if (loading) return <LoadingState label="Đang tải cách đánh số chứng từ..." />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <Card className="p-4 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2"><Hash className="h-4 w-4 text-emerald-600" /> Đánh số chứng từ tự động</h3>
        <p className="text-xs text-slate-500">
          Ký hiệu: {TOKENS.map(t => <code key={t} className="mx-0.5 px-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-emerald-600">{t}</code>)}.
          Số thứ tự đếm riêng từng đơn vị cơ sở và bắt đầu lại theo ngày / tháng / năm có trong mẫu.
          Số chỉ được cấp khi lưu chứng từ, nên hai người lập cùng lúc không bị trùng số.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-left">
              <th className="py-2 px-2">Chứng từ</th>
              <th className="py-2 px-2">Tiền tố</th>
              <th className="py-2 px-2">Mẫu số</th>
              <th className="py-2 px-2 text-center">Số chữ số</th>
              <th className="py-2 px-2">Số tiếp theo (hôm nay)</th>
              <th className="py-2 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map(row => {
              const d = drafts[row.voucherType] ?? row;
              return (
                <tr key={row.voucherType}>
                  <td className="py-2 px-2">
                    <div className="font-bold">{row.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{row.voucherType} · {row.function}</div>
                  </td>
                  <td className="py-2 px-2">
                    <input aria-label="Tiền tố" disabled={!canEdit} maxLength={20} value={d.prefix}
                      className={fieldControlClass(false, 'w-24 font-mono uppercase')}
                      onChange={e => edit(row.voucherType, { prefix: e.target.value.toUpperCase().replace(/\s/g, '') })} />
                  </td>
                  <td className="py-2 px-2">
                    <input aria-label="Mẫu số" disabled={!canEdit} maxLength={100} value={d.pattern}
                      className={fieldControlClass(false, 'w-56 font-mono')}
                      onChange={e => edit(row.voucherType, { pattern: e.target.value })} />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input aria-label="Số chữ số" disabled={!canEdit} type="number" min={1} max={10} value={d.digits}
                      className={fieldControlClass(false, 'w-16 text-center font-mono')}
                      onChange={e => edit(row.voucherType, { digits: Number(e.target.value) })} />
                  </td>
                  <td className="py-2 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.nextNumber}</td>
                  <td className="py-2 px-2 text-right">
                    {canEdit && changed(row) && (
                      <Button size="sm" disabled={saving === row.voucherType} onClick={() => void save(row)}
                        icon={<Save className="h-3.5 w-3.5" />}>Lưu</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
