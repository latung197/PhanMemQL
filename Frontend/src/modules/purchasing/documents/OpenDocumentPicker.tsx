// "Lấy từ chứng từ trước" window shared by the purchase order (from approved purchase requests) and the goods receipt (from approved
// purchase orders): the upper part lists the source documents that still have something left, clicking one shows its lines below,
// where the lines to carry over are ticked and their quantity may be changed (it starts at what is left and cannot pass it).
// A form can take from several documents as long as they share the same "lock key" (warehouse + currency [+ supplier]).
import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ClipboardCheck, Search } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { useNumberFormat } from '../../../context/NumberFormatContext';

export interface PickerLine {
  lineId: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  /** Quantity the source asked / ordered, what is already carried out, and what is left. */
  totalQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  note?: string | null;
  /** Ngày dự kiến nhận của dòng (yyyy-MM-dd), nếu chứng từ nguồn có. */
  dueDate?: string | null;
}

export interface PickerDocument {
  code: string;
  date: string;
  /** Second date (needed / delivery date), shown under the first. */
  dueDate?: string | null;
  /** Texts of the three info columns: main line and small line under it. */
  info: [string, string?][];
  /** Documents sharing a key can go on one form (warehouse + currency...). */
  lockKey: string;
  /** What the user sees when a document does not fit the others picked. */
  searchText: string;
  lines: PickerLine[];
}

export interface PickedLine<TSource> {
  source: TSource;
  line: PickerLine;
  quantity: number;
}

interface Texts {
  title: string;
  help: string;
  searchPlaceholder: string;
  empty: string;
  codeHeader: string;
  infoHeaders: [string, string, string];
  totalHeader: string;
  doneHeader: string;
  confirm: string;
  lockedHint: string;
  sourceName: string;
}

interface Props<TSource> {
  isOpen: boolean;
  onClose: () => void;
  /** Source documents with something left, with the original object so the screen gets it back. */
  documents: { doc: PickerDocument; source: TSource }[];
  /** Quantity of each source line the form already takes (by line id): taken off what is left. */
  taken: Record<number, number>;
  /** Key the form is bound to once it follows a source; empty while it follows none. */
  lockedKey?: string;
  texts: Texts;
  onConfirm: (picked: PickedLine<TSource>[]) => void;
}

const fold = (text?: string | null) => (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

interface Pick { on: boolean; quantity: string }

export function OpenDocumentPicker<TSource>({ isOpen, onClose, documents, taken, lockedKey, texts, onConfirm }: Props<TSource>) {
  const { formatQuantity } = useNumberFormat();
  const [search, setSearch] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [picks, setPicks] = useState<Record<number, Pick>>({});

  // What is left of a line once the quantity this form already takes is taken off; lines done in full, and documents with none left, are dropped.
  const available = useMemo(() => documents.map(entry => ({
    ...entry,
    doc: {
      ...entry.doc,
      lines: entry.doc.lines.map(line => ({ ...line, remainingQuantity: line.remainingQuantity - (taken[line.lineId] ?? 0) }))
        .filter(line => line.remainingQuantity > 0)
    }
  })).filter(entry => entry.doc.lines.length > 0), [documents, taken]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setPicks({});
    setActiveCode(available[0]?.doc.code ?? '');
    // Reset only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const entryOfLine = useMemo(() => {
    const map = new Map<number, (typeof available)[number]>();
    available.forEach(entry => entry.doc.lines.forEach(line => map.set(line.lineId, entry)));
    return map;
  }, [available]);

  const pickedLines = Object.entries(picks).filter(([, pick]) => pick.on).map(([id]) => Number(id)).filter(id => entryOfLine.has(id));
  const anchor = lockedKey || (pickedLines.length > 0 ? entryOfLine.get(pickedLines[0])!.doc.lockKey : '');
  const compatible = (doc: PickerDocument) => !anchor || doc.lockKey === anchor;

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    if (!q) return available;
    return available.filter(entry => fold(entry.doc.searchText).includes(q));
  }, [available, search]);

  const active = available.find(entry => entry.doc.code === activeCode);
  const activeOk = active ? compatible(active.doc) : false;

  const quantityOf = (lineId: number) => Number(picks[lineId]?.quantity);
  const invalid = (line: PickerLine) => {
    const quantity = quantityOf(line.lineId);
    return !(quantity > 0) || quantity > line.remainingQuantity;
  };
  const anyInvalid = pickedLines.some(id => invalid(entryOfLine.get(id)!.doc.lines.find(l => l.lineId === id)!));

  const toggle = (line: PickerLine, on: boolean) => setPicks(prev => ({
    ...prev, [line.lineId]: { on, quantity: prev[line.lineId]?.quantity || String(line.remainingQuantity) }
  }));
  const toggleAll = (on: boolean) => active && setPicks(prev => {
    const next = { ...prev };
    active.doc.lines.forEach(line => { next[line.lineId] = { on, quantity: prev[line.lineId]?.quantity || String(line.remainingQuantity) }; });
    return next;
  });
  const setQuantity = (line: PickerLine, quantity: string) => setPicks(prev => ({ ...prev, [line.lineId]: { on: true, quantity } }));

  const countFor = (doc: PickerDocument) => doc.lines.filter(line => picks[line.lineId]?.on).length;
  const activeAll = !!active && active.doc.lines.every(line => picks[line.lineId]?.on);
  const activeSome = !!active && active.doc.lines.some(line => picks[line.lineId]?.on);
  const sourcesPicked = new Set(pickedLines.map(id => entryOfLine.get(id)!.doc.code)).size;

  const confirm = () => onConfirm(pickedLines.map(id => {
    const entry = entryOfLine.get(id)!;
    return { source: entry.source, line: entry.doc.lines.find(line => line.lineId === id)!, quantity: quantityOf(id) };
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="7xl"
      title={<span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-amber-500" />{texts.title}</span>}>
      <div className="flex flex-col gap-3 h-[72vh] min-h-0">
        <p className="text-xs text-slate-500 shrink-0">{texts.help}</p>

        {/* Upper part: the source documents */}
        <div className="flex flex-col min-h-0 basis-2/5 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={texts.searchPlaceholder}
              className="flex-1 bg-transparent text-xs outline-hidden" />
            <span className="text-[11px] text-slate-500 whitespace-nowrap">{filtered.length}</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                <tr>
                  <th className="px-2 py-1.5">{texts.codeHeader}</th><th className="px-2 py-1.5">Ngày</th>
                  {texts.infoHeaders.map(header => <th key={header} className="px-2 py-1.5">{header}</th>)}
                  <th className="px-2 py-1.5 text-center">Dòng còn</th><th className="px-2 py-1.5 text-center">Đã chọn</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">{texts.empty}</td></tr>}
                {filtered.map(({ doc }) => {
                  const ok = compatible(doc);
                  return (
                    <tr key={doc.code} onClick={() => setActiveCode(doc.code)} title={ok ? undefined : texts.lockedHint}
                      className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer ${doc.code === activeCode ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'} ${ok ? '' : 'opacity-50'}`}>
                      <td className="px-2 py-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{doc.code}</td>
                      <td className="px-2 py-1.5"><div>{doc.date}</div>{doc.dueDate && <div className="text-[10px] font-semibold text-amber-600">{doc.dueDate}</div>}</td>
                      {doc.info.map(([main, sub], index) => (
                        <td key={index} className="px-2 py-1.5"><div className={index === 0 ? 'font-semibold' : ''}>{main || '—'}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-bold">{doc.lines.length}</td>
                      <td className="px-2 py-1.5 text-center">{countFor(doc) > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">{countFor(doc)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lower part: the lines of the document clicked */}
        <div className="flex flex-col min-h-0 basis-3/5 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 text-xs font-bold shrink-0 flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
            {active ? <>Vật tư của {texts.sourceName} <span className="font-mono text-indigo-600 dark:text-indigo-400">{active.doc.code}</span></> : `Chọn một ${texts.sourceName} ở trên để xem vật tư`}
            {active && !activeOk && <span className="font-normal text-amber-600">— {texts.lockedHint}</span>}
          </div>
          <div className="overflow-auto flex-1">
            {active && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                  <tr>
                    <th className="px-2 py-1.5 w-8">
                      <input type="checkbox" aria-label="Chọn tất cả vật tư" disabled={!activeOk} checked={activeAll}
                        ref={el => { if (el) el.indeterminate = activeSome && !activeAll; }} onChange={e => toggleAll(e.target.checked)} />
                    </th>
                    <th className="px-2 py-1.5">Mã VT</th><th className="px-2 py-1.5">Tên vật tư</th><th className="px-2 py-1.5 text-center">ĐVT</th>
                    <th className="px-2 py-1.5 text-right">{texts.totalHeader}</th><th className="px-2 py-1.5 text-right">{texts.doneHeader}</th>
                    <th className="px-2 py-1.5 text-right">Còn lại</th><th className="px-2 py-1.5 text-center">Dự kiến nhận</th><th className="px-2 py-1.5 text-right w-32">SL lấy sang</th><th className="px-2 py-1.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {active.doc.lines.map(line => {
                    const pick = picks[line.lineId];
                    const bad = pick?.on && invalid(line);
                    return (
                      <tr key={line.lineId} className={`border-t border-slate-100 dark:border-slate-800 ${pick?.on ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                        <td className="px-2 py-1.5"><input type="checkbox" disabled={!activeOk} checked={!!pick?.on} onChange={e => toggle(line, e.target.checked)} /></td>
                        <td className="px-2 py-1.5 font-mono font-bold">{line.materialCode}</td>
                        <td className="px-2 py-1.5">{line.materialName}</td>
                        <td className="px-2 py-1.5 text-center">{line.uomCode}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{formatQuantity(line.totalQuantity)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-500">{formatQuantity(line.totalQuantity - line.remainingQuantity)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatQuantity(line.remainingQuantity)}</td>
                        <td className={`px-2 py-1.5 text-center font-mono ${line.dueDate && line.dueDate < new Date().toISOString().slice(0, 10) ? 'font-bold text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}
                          title={line.dueDate && line.dueDate < new Date().toISOString().slice(0, 10) ? 'Đã quá ngày dự kiến nhận mà còn thiếu hàng' : undefined}>{line.dueDate ? line.dueDate.slice(0, 10) : '—'}</td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" min={0} max={line.remainingQuantity} step="any" disabled={!activeOk} value={pick?.quantity ?? ''}
                            placeholder={String(line.remainingQuantity)} onChange={e => setQuantity(line, e.target.value)}
                            title={bad ? `Số lượng phải lớn hơn 0 và không quá ${formatQuantity(line.remainingQuantity)}` : undefined}
                            className={`w-28 text-right font-mono rounded-[5px] border px-1.5 py-0.5 bg-white dark:bg-slate-900 ${bad ? 'border-rose-500 text-rose-600' : 'border-slate-300 dark:border-slate-700'}`} />
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">{line.note || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Đã chọn <strong>{pickedLines.length}</strong> vật tư từ <strong>{sourcesPicked}</strong> {texts.sourceName}
            {anyInvalid && <span className="ml-2 text-rose-600 font-semibold">Có số lượng không hợp lệ.</span>}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Đóng</Button>
            <Button type="button" size="sm" disabled={pickedLines.length === 0 || anyInvalid} onClick={confirm}>{texts.confirm.replace('{n}', String(pickedLines.length || ''))}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
