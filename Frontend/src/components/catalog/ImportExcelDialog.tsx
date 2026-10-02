// Nhập Excel of a catalog: download the template, pick a file, see every row with its problems, choose whether existing
// codes are updated, then send. The backend checks each row like the form and saves all rows or none; its errors are
// shown on the Excel row they came from.
import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';
import { downloadTemplate, readExcel, ReadRow } from './excel';
import type { ExcelColumn, ImportMode, ImportResult } from './catalogTypes';

const PREVIEW_ROWS = 200;

interface ImportExcelDialogProps<TInput> {
  title: string;
  fileName: string;
  sheetName: string;
  columns: ExcelColumn<TInput>[];
  empty: TInput;
  normalize?: (input: TInput) => TInput;
  /** Updating existing codes needs the edit right as well. */
  canUpdate: boolean;
  importMany: (rows: TInput[], mode: ImportMode) => Promise<ImportResult>;
  onClose: () => void;
  onImported: () => void;
}

export function ImportExcelDialog<TInput>({
  title, fileName, sheetName, columns, empty, normalize, canUpdate, importMany, onClose, onImported
}: ImportExcelDialogProps<TInput>) {
  const { t } = useLanguage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReadRow<TInput>[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [serverErrors, setServerErrors] = useState<Map<number, string>>(new Map());
  const [mode, setMode] = useState<ImportMode>('create');
  const [busy, setBusy] = useState(false);

  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    setServerErrors(new Map());
    try {
      const result = await readExcel(picked, columns, empty);
      setFile(picked);
      setRows(result.rows);
      setMissing(result.missingColumns);
    } catch {
      showToast.error(t('catalog.import.unreadable'));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const problemCount = rows.filter(r => r.problems.length > 0).length;
  const canSend = file && rows.length > 0 && missing.length === 0 && problemCount === 0 && !busy;

  const send = async () => {
    setBusy(true);
    try {
      const result = await importMany(rows.map(r => normalize ? normalize(r.input) : r.input), mode);
      if (result.errors.length > 0) {
        setServerErrors(new Map(result.errors.map(e => [rows[e.row - 1]?.excelRow ?? e.row, e.message])));
        showToast.error(t('catalog.import.failed', { n: result.errors.length }));
        return;
      }
      showToast.success(t('catalog.import.done', { created: result.created, updated: result.updated }));
      onImported();
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const statusOf = (row: ReadRow<TInput>) => {
    const messages = [...row.problems, ...(serverErrors.has(row.excelRow) ? [serverErrors.get(row.excelRow)!] : [])];
    return messages.length === 0
      ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{t('catalog.import.rowOk')}</span>
      : <span className="text-rose-600">{messages.join(' · ')}</span>;
  };

  const shown = rows.filter(r => serverErrors.size === 0 || serverErrors.has(r.excelRow) || r.problems.length > 0);
  const visible = (serverErrors.size > 0 ? shown : rows).slice(0, PREVIEW_ROWS);

  return (
    <Modal isOpen onClose={onClose} maxWidth="5xl" title={<><FileSpreadsheet className="h-5 w-5 text-emerald-600" /> {title}</>}>
      <div className="space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={<Upload className="h-3.5 w-3.5" />} disabled={busy} onClick={() => fileInput.current?.click()}>
            {file ? t('catalog.import.otherFile') : t('catalog.import.pickFile')}
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => void downloadTemplate(fileName, sheetName, columns)}>
            {t('catalog.import.template')}
          </Button>
          {file && <span className="text-slate-600 dark:text-slate-300 font-semibold truncate">{file.name}</span>}
          <input ref={fileInput} type="file" accept=".xlsx" className="hidden" onChange={e => void pick(e.target.files?.[0])} />
        </div>

        {!file && <p className="text-slate-500 dark:text-slate-400">{t('catalog.import.intro', { columns: columns.map(c => c.header).join(', ') })}</p>}

        {file && missing.length > 0 && (
          <p className="flex items-center gap-1.5 text-rose-600 font-semibold">
            <AlertTriangle className="h-4 w-4" /> {t('catalog.import.missingColumns', { columns: missing.join(', ') })}
          </p>
        )}

        {file && rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" size="sm">{t('catalog.import.rows', { n: rows.length })}</Badge>
              {problemCount > 0 && <Badge variant="danger" size="sm">{t('catalog.import.rowsWithProblems', { n: problemCount })}</Badge>}
              {serverErrors.size > 0 && <Badge variant="danger" size="sm">{t('catalog.import.rowsRefused', { n: serverErrors.size })}</Badge>}
            </div>
            <div className="max-h-[45vh] overflow-auto border border-slate-200 dark:border-slate-800 rounded-[5px]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-14">{t('catalog.import.row')}</th>
                    {columns.map(c => <th key={c.key} className="px-2 py-1.5 text-left">{c.header}</th>)}
                    <th className="px-2 py-1.5 text-left">{t('catalog.import.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => (
                    <tr key={row.excelRow} className={cn('border-t border-slate-100 dark:border-slate-800 align-top',
                      (row.problems.length > 0 || serverErrors.has(row.excelRow)) && 'bg-rose-50/60 dark:bg-rose-950/20')}>
                      <td className="px-2 py-1 font-mono text-slate-500">{row.excelRow}</td>
                      {columns.map(c => {
                        const value = (row.input as Record<string, unknown>)[c.key];
                        return <td key={c.key} className="px-2 py-1">{typeof value === 'boolean' ? (value ? t('catalog.excel.yes') : t('catalog.excel.no')) : String(value ?? '')}</td>;
                      })}
                      <td className="px-2 py-1">{statusOf(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > visible.length && serverErrors.size === 0 && (
              <p className="text-slate-500">{t('catalog.import.moreRows', { n: rows.length - visible.length })}</p>
            )}
          </>
        )}

        {file && rows.length === 0 && missing.length === 0 && <p className="text-amber-600">{t('catalog.import.noRows')}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="import-mode" checked={mode === 'create'} onChange={() => setMode('create')} />
              {t('catalog.import.modeCreate')}
            </label>
            <label className={cn('inline-flex items-center gap-1.5', canUpdate ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed')}
              title={canUpdate ? undefined : t('catalog.import.noEditRight')}>
              <input type="radio" name="import-mode" disabled={!canUpdate} checked={mode === 'upsert'} onChange={() => setMode('upsert')} />
              {t('catalog.import.modeUpsert')}
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t('catalog.import.cancel')}</Button>
            <Button size="sm" disabled={!canSend} onClick={() => void send()}>
              {busy ? t('catalog.import.sending') : t('catalog.import.send', { n: rows.length })}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
