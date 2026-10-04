import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import type { UserProfile } from '../../../../types';
import { apiRequest, getErrorMessage } from '../../../../services/apiClient';
import { showToast } from '../../../../utils/toast';

interface PendingApproval {
  function: string;
  documentId: string;
  level: number;
  requestedBy: { fullName: string };
  requestedAt: string;
}

export function ReceiptApprovalView({ currentUser }: { currentUser?: UserProfile }) {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState<PendingApproval | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const pending = await apiRequest<PendingApproval[]>('GET', '/api/approvals/pending');
      setItems(pending.filter(x => x.function === 'inv_receipt'));
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  useEffect(() => { void load(); }, [currentUser]);

  const approve = async (item: PendingApproval) => {
    setBusy(true);
    try {
      await apiRequest('POST', `/api/approvals/inv_receipt/${encodeURIComponent(item.documentId)}/approve`, { note: null });
      showToast.success(`Đã duyệt phiếu ${item.documentId}.`);
      await load();
    } catch (error) { showToast.error(getErrorMessage(error)); }
    finally { setBusy(false); }
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setBusy(true);
    try {
      await apiRequest('POST', `/api/approvals/inv_receipt/${encodeURIComponent(rejecting.documentId)}/reject`, { note: reason.trim() });
      showToast.success(`Đã từ chối phiếu ${rejecting.documentId}.`);
      setRejecting(null);
      setReason('');
      await load();
    } catch (error) { showToast.error(getErrorMessage(error)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Phê duyệt phiếu nhập kho</h2>
          <p className="text-sm text-slate-500">Các phiếu đang chờ bạn duyệt trong đơn vị hiện tại.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15} /> Làm mới</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-3">Số phiếu</th><th className="p-3">Người lập</th><th className="p-3">Thời điểm gửi</th><th className="p-3">Cấp duyệt</th><th className="p-3 text-right">Thao tác</th></tr></thead>
          <tbody>{items.map(item => <tr key={`${item.documentId}-${item.level}`} className="border-t border-slate-200 dark:border-slate-700">
            <td className="p-3 font-mono font-semibold">{item.documentId}</td>
            <td className="p-3">{item.requestedBy.fullName}</td>
            <td className="p-3">{new Date(item.requestedAt).toLocaleString('vi-VN')}</td>
            <td className="p-3">{item.level}</td>
            <td className="p-3"><div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => void approve(item)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"><CheckCircle2 size={14} /> Duyệt</button>
              <button type="button" disabled={busy} onClick={() => setRejecting(item)} className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1.5 font-semibold text-rose-700 disabled:opacity-50"><XCircle size={14} /> Từ chối</button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Không có phiếu nhập kho chờ duyệt.</p>}
      </div>
      {rejecting && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950">
        <label htmlFor="receipt-reject-reason" className="block text-sm font-semibold">Lý do từ chối phiếu {rejecting.documentId}</label>
        <textarea id="receipt-reject-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900" />
        <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setRejecting(null); setReason(''); }} className="rounded-lg border px-3 py-1.5 text-sm">Hủy</button><button type="button" disabled={busy || !reason.trim()} onClick={() => void reject()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Xác nhận từ chối</button></div>
      </div>}
    </div>
  );
}
