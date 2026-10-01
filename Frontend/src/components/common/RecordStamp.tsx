// Who created / last changed a business row (erp_*) and when: the "stamp" every erp_* DTO carries (backend
// RecordStampDto, filled on save). Grids add recordStampColumns(t) (recordStampColumns.tsx); forms show
// <RecordStampLine stamp={...} />. Only components here, so the file hot-reloads.
import React from 'react';
import { formatDateTime } from '../../utils/format';
import { useLanguage } from '../../context/LanguageContext';

export interface RecordStamp {
  /** UTC ISO time. */
  createdAt: string;
  /** Name of the user; null for rows created by scripts. */
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Name over time, for a grid cell. */
export const RecordStampCell: React.FC<{ name: string | null; time: string | null }> = ({ name, time }) => time
  ? <span className="leading-tight"><span className="block text-slate-700 dark:text-slate-200">{name ?? '—'}</span>
      <span className="block font-mono text-[10px] text-slate-400">{formatDateTime(time)}</span></span>
  : <span className="text-slate-400">—</span>;

/** One line for the bottom of a form: "Tạo: An · 01/10/2026 09:15 — Sửa: Bình · 02/10/2026 14:00". */
export const RecordStampLine: React.FC<{ stamp?: RecordStamp }> = ({ stamp }) => {
  const { t } = useLanguage();
  if (!stamp) return null;
  return (
    <p className="text-[11px] text-slate-500 dark:text-slate-400">
      {t('recordStamp.createdLine', { name: stamp.createdBy ?? t('recordStamp.system'), time: formatDateTime(stamp.createdAt) })}
      {stamp.updatedAt && <> — {t('recordStamp.updatedLine', { name: stamp.updatedBy ?? t('recordStamp.system'), time: formatDateTime(stamp.updatedAt) })}</>}
    </p>
  );
};
