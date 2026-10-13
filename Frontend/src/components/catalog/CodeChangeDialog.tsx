// Đổi mã / gộp mã of a catalog record: shows what uses the code (rows per table, read from the server), then renames the code or
// merges it into another one. The server does the work in one transaction (every column that holds the code changes together).
import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TextInput } from '../common/FormField';
import { LoadingState } from '../common/StateViews';
import { CatalogLookup } from './CatalogLookup';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import type { CodeChangePreview, CodeChangeApi } from './catalogTypes';

export type CodeChangeMode = 'rename' | 'merge';

interface Props {
  mode: CodeChangeMode;
  /** The record: its code and a text naming it. */
  code: string;
  label: string;
  /** Row version the screen loaded (rename checks it: someone may have changed the record meanwhile). */
  version?: number;
  noun: string;
  /** Lookup name to pick the code to merge into. */
  lookup: string;
  api: CodeChangeApi;
  onClose: () => void;
  onDone: () => void;
}

export const CodeChangeDialog: React.FC<Props> = ({ mode, code, label, version, noun, lookup, api, onClose, onDone }) => {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<CodeChangePreview>();
  const [error, setError] = useState('');
  const [newCode, setNewCode] = useState('');
  const [into, setInto] = useState('');
  const [intoName, setIntoName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setPreview(undefined);
    setError('');
    api.preview(code, mode === 'merge' && into ? into : undefined)
      .then(result => { if (alive) setPreview(result); })
      .catch(e => { if (alive) setError(getErrorMessage(e)); });
    return () => { alive = false; };
  }, [api, code, mode, into]);

  const cleanCode = newCode.trim().toUpperCase().replace(/\s/g, '');
  const valid = mode === 'rename' ? cleanCode.length > 0 && cleanCode !== code : into.length > 0 && into !== code;

  const run = async () => {
    setBusy(true);
    try {
      if (mode === 'rename') {
        await api.rename(code, cleanCode, version);
        showToast.success(t('catalog.codeChange.renamed', { old: code, next: cleanCode, n: preview?.total ?? 0 }));
      } else {
        await api.merge(code, into);
        showToast.success(t('catalog.codeChange.merged', { old: code, target: into, n: preview?.total ?? 0 }));
      }
      onDone();
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="lg"
      title={mode === 'rename' ? t('catalog.codeChange.renameTitle', { noun, code }) : t('catalog.codeChange.mergeTitle', { noun, code })}>
      <div className="space-y-3 text-xs">
        <p className="text-slate-600 dark:text-slate-300"><span className="font-mono font-bold">{label}</span></p>

        {mode === 'rename' ? (
          <TextInput label={t('catalog.codeChange.newCode')} required autoFocus className="font-mono uppercase" value={newCode}
            hint={t('catalog.codeChange.newCodeHint')} onChange={e => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))} />
        ) : (
          <div>
            <CatalogLookup lookup={lookup} label={t('catalog.codeChange.target')} required value={into}
              onChange={(value, item) => { setInto(value); setIntoName(item?.name ?? ''); }} />
            {into && intoName && <p className="mt-1 text-slate-500">{t('catalog.codeChange.targetIs', { code: into, name: intoName })}</p>}
          </div>
        )}

        <div className="rounded-[5px] border border-slate-200 dark:border-slate-800">
          <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 font-bold">{t('catalog.codeChange.usageTitle')}</div>
          {error ? <p className="px-3 py-2 text-rose-600">{error}</p> : !preview ? <LoadingState /> : preview.usages.length === 0 ? (
            <p className="px-3 py-2 text-slate-500">{t('catalog.codeChange.noUsage')}</p>
          ) : (
            <table className="w-full">
              <tbody>
                {preview.usages.map(usage => (
                  <tr key={usage.table} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                    <td className="px-3 py-1">{usage.tableName}</td>
                    <td className="px-3 py-1 text-right font-mono font-bold">{usage.count}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-800/50"><td className="px-3 py-1 font-bold">{t('catalog.codeChange.total')}</td>
                  <td className="px-3 py-1 text-right font-mono font-bold">{preview.total}</td></tr>
              </tbody>
            </table>
          )}
        </div>

        <p className="flex items-start gap-1.5 rounded-[5px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{mode === 'rename' ? t('catalog.codeChange.renameWarning') : t('catalog.codeChange.mergeWarning', { code })}</span>
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('catalog.cancel')}</Button>
          <Button type="button" size="sm" disabled={!valid || busy || !preview} onClick={() => void run()}>
            {busy ? t('catalog.saving') : mode === 'rename' ? t('catalog.codeChange.doRename') : t('catalog.codeChange.doMerge')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
