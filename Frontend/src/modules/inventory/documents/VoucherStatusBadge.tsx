// The status pill of the voucher lists and forms, shared by every voucher. The text is the name the company unit gave the status
// (Settings › Trạng thái chứng từ). `label` is the status as the voucher screens keep it (the Vietnamese label of the API mapping).
import React from 'react';
import { AlertOctagon, CheckCircle2, Clock, FileText, ShieldCheck } from 'lucide-react';
import { useVoucherStatuses } from '../../../services/voucherStatusService';
import type { DocumentStatus } from '../../../utils/documentPolicy';

const STATUS_OF_LABEL: Record<string, DocumentStatus> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Chuyển sổ kho': 'Posted', 'Hủy': 'Cancelled'
};

const FALLBACK_TEXT: Record<DocumentStatus, string> = {
  Draft: 'Lập Chứng Từ', Pending: 'Chờ Duyệt', Approved: 'Đã Phê Duyệt', Posted: 'Chuyển Sổ Kho', Cancelled: 'Đã Hủy'
};

const LOOK: Record<DocumentStatus, { cls: string; icon: React.ReactNode }> = {
  Draft: { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700', icon: <FileText className="h-3.5 w-3.5 text-slate-500" /> },
  Pending: { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse', icon: <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> },
  Approved: { cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800', icon: <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> },
  Posted: { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> },
  Cancelled: { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800', icon: <AlertOctagon className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> }
};

export const VoucherStatusBadge: React.FC<{ voucherType: string; label?: string }> = ({ voucherType, label }) => {
  const statuses = useVoucherStatuses();
  const text = label || 'Chờ duyệt';
  const status = STATUS_OF_LABEL[text];
  if (!status) {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{text}</span>;
  }
  const look = LOOK[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${look.cls}`}>
      {look.icon}
      {statuses.name(voucherType, status, FALLBACK_TEXT[status])}
    </span>
  );
};
