// "Cột" button of a list: show / hide and reorder columns (widths: drag the header edge), back to the default;
// administrators also set the company default. Everything is saved per user by useGridLayout.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Columns3 } from 'lucide-react';
import { Button } from '../common/Button';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import type { GridLayoutControl } from './useGridLayout';

export function ColumnChooser<T>({ layout, isAdmin }: { layout: GridLayoutControl<T>; isAdmin: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const run = (action: () => Promise<void>) => () => { action().catch(e => showToast.error(getErrorMessage(e))); };

  return (
    <div className="relative" ref={box}>
      <Button variant="outline" size="sm" className="h-8 px-2.5 text-[11px]" icon={<Columns3 className="h-3.5 w-3.5" />}
        onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {t('catalog.layout.button')}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[7px] shadow-xl p-2 text-xs">
          <p className="px-1 pb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {t(`catalog.layout.source.${layout.source}`)} · {t('catalog.layout.hint')}
          </p>
          <ul className="max-h-72 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
            {layout.choices.map((c, i) => (
              <li key={c.key} className="flex items-center gap-1.5 py-1 px-1">
                <label className="flex items-center gap-2 grow min-w-0 cursor-pointer">
                  <input type="checkbox" checked={c.visible} onChange={e => layout.setVisible(c.key, e.target.checked)} />
                  <span className={c.visible ? 'truncate text-slate-800 dark:text-slate-100' : 'truncate text-slate-400'}>{c.title}</span>
                </label>
                <button type="button" className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30" disabled={i === 0}
                  title={t('catalog.layout.up')} onClick={() => layout.move(c.key, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30" disabled={i === layout.choices.length - 1}
                  title={t('catalog.layout.down')} onClick={() => layout.move(c.key, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 pt-2 mt-1 border-t border-slate-200 dark:border-slate-800">
            {layout.source === 'user' && (
              <Button variant="ghost" size="sm" className="justify-start" onClick={run(layout.resetMine)}>
                {t(layout.hasCompany ? 'catalog.layout.resetToCompany' : 'catalog.layout.resetToDefault')}
              </Button>
            )}
            {isAdmin && (
              <>
                <Button variant="ghost" size="sm" className="justify-start" onClick={run(layout.saveAsCompany)}>
                  {t('catalog.layout.saveCompany')}
                </Button>
                {layout.hasCompany && (
                  <Button variant="ghost" size="sm" className="justify-start text-rose-600" onClick={run(layout.resetCompany)}>
                    {t('catalog.layout.removeCompany')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
