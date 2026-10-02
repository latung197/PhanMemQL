// Picking codes of a backend catalog (GET /api/lookups/{name}) in forms and voucher lines, in two kinds:
// - CatalogLookup (chọn một): type a code + Enter / leave the field (exact code taken, any case; otherwise the search
//   opens with the text), or F2 / search button; the name shows next to the code.
// - CatalogMultiLookup (chọn nhiều): chosen codes as chips (× removes one); type several codes separated by commas +
//   Enter to add them, or F2 / search button to tick rows (the choice is kept while searching other words).
// The search window (both kinds): server search on code and name, paged ("Xem thêm"); ↑ ↓ move, Enter takes (single) or
// ticks (multiple), Space ticks, Esc closes, double click takes. Only code, name and the registered extra columns
// come back, so pickers never expose the whole catalog (which needs the View right of its function).
// A catalog becomes available with one AddLookup line in the backend's DependencyInjection.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Search, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { apiRequest } from '../../services/apiClient';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

export interface LookupItem {
  code: string;
  name: string;
  isActive: boolean;
  extra: Record<string, string | null>;
}
interface LookupPage { items: LookupItem[]; total: number }

export const lookupApi = {
  search: (name: string, q: string, page = 1, pageSize = 20, includeInactive = false) =>
    apiRequest<LookupPage>('GET', `/api/lookups/${encodeURIComponent(name)}?${new URLSearchParams({
      q, page: String(page), pageSize: String(pageSize), includeInactive: String(includeInactive)
    })}`),
  byCodes: (name: string, codes: string[]) =>
    apiRequest<LookupItem[]>('GET', `/api/lookups/${encodeURIComponent(name)}/codes?codes=${encodeURIComponent(codes.join(','))}`)
};

interface CommonProps {
  /** Lookup name registered on the backend (uoms...). */
  lookup: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Extra columns of the search list: key of LookupItem.extra and its title. */
  extraColumns?: { key: string; title: string }[];
  /** Title of the search window. */
  title?: string;
  className?: string;
}

const inputClass = 'bg-white dark:bg-slate-900 border rounded-[5px] focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100';
const fieldId = (lookup: string, label?: string) => `lookup-${lookup}-${label ?? ''}`.replace(/\s+/g, '-');

const FieldLabel: React.FC<{ id: string; label?: string; required?: boolean; extra?: React.ReactNode }> = ({ id, label, required, extra }) =>
  label ? (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="font-semibold text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      {extra}
    </div>
  ) : null;

// ----------------------------------------------------------------------------------------------- chọn một

export interface CatalogLookupProps extends CommonProps {
  value: string;
  onChange: (code: string, item?: LookupItem) => void;
}

export const CatalogLookup: React.FC<CatalogLookupProps> = ({
  lookup, value, onChange, label, required, disabled, placeholder, extraColumns = [], title, className
}) => {
  const { t } = useLanguage();
  const [text, setText] = useState(value);
  const [item, setItem] = useState<LookupItem>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Show the name of a code set from outside (record loaded, form reset).
  useEffect(() => {
    setText(value);
    setNotFound(false);
    if (!value) { setItem(undefined); return; }
    if (item?.code === value) return;
    let alive = true;
    lookupApi.byCodes(lookup, [value]).then(found => { if (alive) setItem(found[0]); }).catch(() => { /* code only */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, lookup]);

  const choose = (chosen: LookupItem | undefined) => {
    setSearchOpen(false);
    setNotFound(false);
    setItem(chosen);
    setText(chosen?.code ?? '');
    onChange(chosen?.code ?? '', chosen);
  };

  /** Typed code: exact match is taken, anything else opens the search with the text. */
  const commit = async () => {
    const typed = text.trim();
    if (typed === (value ?? '')) return;
    if (!typed) { choose(undefined); return; }
    const found = (await lookupApi.byCodes(lookup, [typed]).catch(() => [])).find(x => x.code.toUpperCase() === typed.toUpperCase());
    if (found && found.isActive) choose(found);
    else { setNotFound(true); setSearchOpen(true); }
  };

  const id = fieldId(lookup, label);
  return (
    <div className={cn('space-y-1 text-xs', className)}>
      <FieldLabel id={id} label={label} required={required} />
      <div className="flex items-stretch gap-1.5">
        <div className="relative w-36 shrink-0">
          <input id={id} type="text" value={text} disabled={disabled} required={required} autoComplete="off"
            placeholder={placeholder ?? t('catalog.lookup.placeholder')}
            onChange={e => { setText(e.target.value.toUpperCase()); setNotFound(false); }}
            onBlur={() => { if (!searchOpen) void commit(); }}
            onKeyDown={e => {
              if (e.key === 'F2') { e.preventDefault(); setSearchOpen(true); }
              if (e.key === 'Enter') { e.preventDefault(); void commit(); }
            }}
            className={cn('w-full h-8 pl-2 pr-7 font-mono uppercase', inputClass,
              notFound ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700', disabled && 'opacity-60')} />
          {!disabled && (
            <button type="button" tabIndex={-1} title={t('catalog.lookup.search')} onClick={() => setSearchOpen(true)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600">
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className={cn('grow min-w-0 h-8 px-2 flex items-center rounded-[5px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 truncate',
          item && !item.isActive ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200')}>
          {item ? <span className="truncate">{item.name}{!item.isActive && ` (${t('catalog.lookup.inactive')})`}</span>
            : <span className="text-slate-400 truncate">{notFound ? t('catalog.lookup.notFound') : '—'}</span>}
          {item && !disabled && !required && (
            <button type="button" tabIndex={-1} className="ml-auto p-0.5 text-slate-400 hover:text-rose-500" title={t('catalog.lookup.clear')}
              onClick={() => choose(undefined)}><X className="h-3 w-3" /></button>
          )}
        </div>
      </div>
      {searchOpen && createPortal(
        <LookupDialog lookup={lookup} initial={notFound ? text : ''} title={title ?? label ?? t('catalog.lookup.title')}
          extraColumns={extraColumns} onClose={() => setSearchOpen(false)} onChoose={choose} />,
        document.body
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------------------------- chọn nhiều

export interface CatalogMultiLookupProps extends CommonProps {
  value: string[];
  onChange: (codes: string[], items: LookupItem[]) => void;
  /** At most this many codes (no limit when left out). */
  max?: number;
}

export const CatalogMultiLookup: React.FC<CatalogMultiLookupProps> = ({
  lookup, value, onChange, label, required, disabled, placeholder, extraColumns = [], title, className, max
}) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<Map<string, LookupItem>>(new Map());
  const [text, setText] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Names of codes set from outside (record loaded).
  useEffect(() => {
    const unknown = value.filter(code => !items.has(code));
    if (unknown.length === 0) return;
    let alive = true;
    lookupApi.byCodes(lookup, unknown).then(found => {
      if (alive) setItems(prev => new Map([...prev, ...found.map(x => [x.code, x] as const)]));
    }).catch(() => { /* codes only */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(','), lookup]);

  const emit = (next: LookupItem[]) => {
    const limited = max ? next.slice(0, max) : next;
    setItems(prev => new Map([...prev, ...limited.map(x => [x.code, x] as const)]));
    onChange(limited.map(x => x.code), limited);
  };
  const current = () => value.map(code => items.get(code) ?? { code, name: code, isActive: true, extra: {} });

  /** Typed codes ("KG, CAI THUNG"): the existing active ones are added, the others listed as unknown. */
  const addTyped = async () => {
    const codes = [...new Set(text.split(/[\s,;]+/).map(c => c.trim().toUpperCase()).filter(Boolean))]
      .filter(c => !value.includes(c));
    if (codes.length === 0) { setText(''); return; }
    const found = (await lookupApi.byCodes(lookup, codes).catch(() => [])).filter(x => x.isActive);
    const foundCodes = new Set(found.map(x => x.code.toUpperCase()));
    setMissing(codes.filter(c => !foundCodes.has(c)));
    setText('');
    if (found.length > 0) emit([...current(), ...found]);
  };

  const remove = (code: string) => emit(current().filter(x => x.code !== code));
  const id = fieldId(lookup, label);
  return (
    <div className={cn('space-y-1 text-xs', className)}>
      <FieldLabel id={id} label={label} required={required}
        extra={value.length > 0 && <span className="text-[10px] font-bold text-indigo-600">{t('catalog.lookup.selectedCount', { n: value.length })}</span>} />
      <div className={cn('min-h-8 flex flex-wrap items-center gap-1 px-1.5 py-1', inputClass, 'border-slate-200 dark:border-slate-700', disabled && 'opacity-60')}>
        {current().map(x => (
          <span key={x.code} title={x.name}
            className={cn('inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-[4px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 font-mono font-semibold',
              !x.isActive && 'bg-amber-50 text-amber-700')}>
            {x.code}
            {!disabled && (
              <button type="button" tabIndex={-1} className="text-indigo-400 hover:text-rose-500" title={t('catalog.lookup.remove', { code: x.code })}
                onClick={() => remove(x.code)}><X className="h-3 w-3" /></button>
            )}
          </span>
        ))}
        {!disabled && (
          <input id={id} type="text" value={text} autoComplete="off"
            placeholder={value.length === 0 ? (placeholder ?? t('catalog.lookup.multiPlaceholder')) : ''}
            onChange={e => { setText(e.target.value.toUpperCase()); setMissing([]); }}
            onBlur={() => { if (!searchOpen && text.trim()) void addTyped(); }}
            onKeyDown={e => {
              if (e.key === 'F2') { e.preventDefault(); setSearchOpen(true); }
              if (e.key === 'Enter') { e.preventDefault(); void addTyped(); }
              if (e.key === 'Backspace' && !text && value.length > 0) remove(value[value.length - 1]);
            }}
            className="grow min-w-[90px] h-6 px-1 font-mono uppercase bg-transparent outline-hidden dark:text-slate-100" />
        )}
        {!disabled && (
          <button type="button" tabIndex={-1} title={t('catalog.lookup.search')} onClick={() => setSearchOpen(true)}
            className="ml-auto p-1 text-slate-400 hover:text-indigo-600"><Search className="h-3.5 w-3.5" /></button>
        )}
      </div>
      {missing.length > 0 && <p className="text-[11px] text-rose-600">{t('catalog.lookup.unknownCodes', { codes: missing.join(', ') })}</p>}
      {searchOpen && createPortal(
        <LookupDialog lookup={lookup} initial="" title={title ?? label ?? t('catalog.lookup.title')} extraColumns={extraColumns}
          multiple initialSelection={current()} max={max}
          onClose={() => setSearchOpen(false)}
          onChoose={() => { /* single only */ }}
          onChooseMany={chosen => { setSearchOpen(false); emit(chosen); }} />,
        document.body
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------------------------- search window

const PAGE_SIZE = 20;

function LookupDialog({ lookup, initial, title, extraColumns, onClose, onChoose, multiple = false, initialSelection = [], max, onChooseMany }: {
  lookup: string; initial: string; title: string; extraColumns: { key: string; title: string }[];
  onClose: () => void; onChoose: (item: LookupItem) => void;
  multiple?: boolean; initialSelection?: LookupItem[]; max?: number; onChooseMany?: (items: LookupItem[]) => void;
}) {
  const { t } = useLanguage();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<LookupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  // Multiple: the ticked records in the order they were ticked, kept across searches.
  const [picked, setPicked] = useState<LookupItem[]>(initialSelection);
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async (text: string, page: number) => {
    const ticket = ++request.current;
    setLoading(true);
    try {
      const result = await lookupApi.search(lookup, text, page, PAGE_SIZE);
      if (ticket !== request.current) return;
      setItems(prev => page === 1 ? result.items : [...prev, ...result.items]);
      setTotal(result.total);
      if (page === 1) setActive(0);
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [lookup]);

  // Search as the user types (short pause first).
  useEffect(() => {
    const timer = setTimeout(() => { void load(q.trim(), 1); }, 250);
    return () => clearTimeout(timer);
  }, [q, load]);

  useEffect(() => { input.current?.focus(); }, []);

  const isPicked = (x: LookupItem) => picked.some(p => p.code === x.code);
  const full = !!max && picked.length >= max;
  const toggle = (x: LookupItem) => setPicked(prev => prev.some(p => p.code === x.code)
    ? prev.filter(p => p.code !== x.code)
    : max && prev.length >= max ? prev : [...prev, x]);
  const allShown = items.length > 0 && items.every(isPicked);
  const toggleShown = () => setPicked(prev => allShown
    ? prev.filter(p => !items.some(x => x.code === p.code))
    : [...prev, ...items.filter(x => !prev.some(p => p.code === x.code))].slice(0, max ?? Number.MAX_SAFE_INTEGER));

  const take = (x: LookupItem | undefined) => {
    if (!x) return;
    if (multiple) toggle(x); else onChoose(x);
  };

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); if (multiple && (e.ctrlKey || e.metaKey)) onChooseMany?.(picked); else take(items[active]); }
    if (e.key === ' ' && multiple && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); take(items[active]); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="3xl" title={<><Search className="h-4 w-4 text-indigo-600" /> {title}</>}>
      <div className="space-y-2 text-xs" onKeyDown={keys}>
        <div className="relative">
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder={t('catalog.lookup.searchPlaceholder')}
            className={cn('w-full h-9 pl-8 pr-8 border-slate-200 dark:border-slate-700', inputClass)} />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500 animate-spin" />}
        </div>
        <div className="max-h-[50vh] overflow-auto border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                {multiple && (
                  <th className="px-2 py-1.5 w-8">
                    <input type="checkbox" checked={allShown} onChange={toggleShown} title={t('catalog.lookup.tickShown')} />
                  </th>
                )}
                <th className="px-2 py-1.5 text-left w-32">{t('catalog.lookup.code')}</th>
                <th className="px-2 py-1.5 text-left">{t('catalog.lookup.name')}</th>
                {extraColumns.map(c => <th key={c.key} className="px-2 py-1.5 text-left">{c.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={x.code} onMouseEnter={() => setActive(i)}
                  onClick={() => { setActive(i); if (multiple) toggle(x); }}
                  onDoubleClick={() => { if (!multiple) onChoose(x); }}
                  className={cn('border-t border-slate-100 dark:border-slate-800 cursor-pointer',
                    i === active ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
                  {multiple && (
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={isPicked(x)} disabled={!isPicked(x) && full} readOnly tabIndex={-1} />
                    </td>
                  )}
                  <td className="px-2 py-1.5 font-mono font-bold">{x.code}</td>
                  <td className="px-2 py-1.5">{x.name}</td>
                  {extraColumns.map(c => <td key={c.key} className="px-2 py-1.5">{x.extra[c.key] ?? ''}</td>)}
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={2 + extraColumns.length + (multiple ? 1 : 0)} className="px-2 py-6 text-center text-slate-400">{t('catalog.lookup.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-500">
            {t('catalog.lookup.count', { shown: items.length, total })} · {t(multiple ? 'catalog.lookup.keysMultiple' : 'catalog.lookup.keys')}
          </span>
          <div className="flex items-center gap-2">
            {items.length < total && (
              <Button variant="outline" size="sm" disabled={loading}
                onClick={() => void load(q.trim(), Math.floor(items.length / PAGE_SIZE) + 1)}>{t('catalog.lookup.more')}</Button>
            )}
            {multiple ? (
              <>
                <span className="font-semibold text-indigo-600">
                  {max ? t('catalog.lookup.pickedOf', { n: picked.length, max }) : t('catalog.lookup.picked', { n: picked.length })}
                </span>
                {picked.length > 0 && <Button variant="ghost" size="sm" onClick={() => setPicked([])}>{t('catalog.lookup.clearAll')}</Button>}
                <Button size="sm" onClick={() => onChooseMany?.(picked)}>{t('catalog.lookup.done')}</Button>
              </>
            ) : (
              <Button size="sm" disabled={!items[active]} onClick={() => items[active] && onChoose(items[active])}>{t('catalog.lookup.choose')}</Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
