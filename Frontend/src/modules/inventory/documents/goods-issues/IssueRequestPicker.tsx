// "Lấy từ phiếu yêu cầu" of the goods issue: the screen is split in two. The upper part lists the approved issue requests that still have
// something to issue; clicking one shows its materials in the lower part, where the materials to carry over are ticked and their
// quantity may be changed (it starts at what is left and cannot pass it). Materials already issued in full are not listed; the others
// show what is left, after what this very form already takes. A form can take from several requests, all of the same warehouse and
// currency (the issue has one warehouse and one currency).
import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, ClipboardCheck, Search } from 'lucide-react';
import { Button } from '../../../../components/common/Button';
import { Modal } from '../../../../components/common/Modal';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import type { OpenIssueRequest, OpenIssueRequestLine } from '../issue-requests/api';

export interface PickedRequestLine {
  request: OpenIssueRequest;
  line: OpenIssueRequestLine;
  quantity: number;
}

interface IssueRequestPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Approved requests with something left, as the server counts it without the issue being edited. */
  requests: OpenIssueRequest[];
  /** Quantity of each request line the form already takes (by request line id): taken off what is left. */
  taken: Record<number, number>;
  /** Warehouse and currency the form is bound to once it follows a request; empty while it follows none. */
  lockedWarehouse?: string;
  lockedCurrency?: string;
  onConfirm: (picked: PickedRequestLine[]) => void;
}

const fold = (text?: string | null) => (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

interface Pick { on: boolean; quantity: string }

export const IssueRequestPicker: React.FC<IssueRequestPickerProps> = ({ isOpen, onClose, requests, taken, lockedWarehouse, lockedCurrency, onConfirm }) => {
  const { formatQuantity } = useNumberFormat();
  const [search, setSearch] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [picks, setPicks] = useState<Record<number, Pick>>({});

  // What is left of a line once the quantity this form already takes is taken off; lines issued in full, and requests with none left, are dropped.
  const available = useMemo(() => requests.map(request => ({
    ...request,
    lines: request.lines.map(line => ({ ...line, remainingQuantity: line.remainingQuantity - (taken[line.lineId] ?? 0) }))
      .filter(line => line.remainingQuantity > 0)
  })).filter(request => request.lines.length > 0), [requests, taken]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setPicks({});
    setActiveCode(available[0]?.code ?? '');
    // Reset only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const requestOfLine = useMemo(() => {
    const map = new Map<number, OpenIssueRequest>();
    available.forEach(request => request.lines.forEach(line => map.set(line.lineId, request)));
    return map;
  }, [available]);

  const pickedLines = Object.entries(picks).filter(([, pick]) => pick.on).map(([id]) => Number(id)).filter(id => requestOfLine.has(id));
  // The warehouse and the currency everything picked must share: those of the form, else those of the first request picked.
  const anchor = lockedWarehouse ? { warehouse: lockedWarehouse, currency: lockedCurrency ?? '' }
    : pickedLines.length > 0 ? { warehouse: requestOfLine.get(pickedLines[0])!.warehouseCode, currency: requestOfLine.get(pickedLines[0])!.currencyCode } : null;
  const compatible = (request: OpenIssueRequest) => !anchor || (request.warehouseCode === anchor.warehouse && (!anchor.currency || request.currencyCode === anchor.currency));

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    if (!q) return available;
    return available.filter(request => fold([request.code, request.departmentName, request.requesterName, request.customerName, request.warehouseName, request.voucherType,
      ...request.lines.flatMap(line => [line.materialCode, line.materialName])].join(' ')).includes(q));
  }, [available, search]);

  const active = available.find(request => request.code === activeCode);
  const activeOk = active ? compatible(active) : false;

  const quantityOf = (lineId: number) => Number(picks[lineId]?.quantity);
  const invalid = (line: OpenIssueRequestLine) => {
    const quantity = quantityOf(line.lineId);
    return !(quantity > 0) || quantity > line.remainingQuantity;
  };
  const anyInvalid = pickedLines.some(id => {
    const line = requestOfLine.get(id)!.lines.find(l => l.lineId === id)!;
    return invalid(line);
  });

  const toggle = (line: OpenIssueRequestLine, on: boolean) => setPicks(prev => ({
    ...prev, [line.lineId]: { on, quantity: prev[line.lineId]?.quantity || String(line.remainingQuantity) }
  }));
  const toggleAll = (on: boolean) => active && setPicks(prev => {
    const next = { ...prev };
    active.lines.forEach(line => { next[line.lineId] = { on, quantity: prev[line.lineId]?.quantity || String(line.remainingQuantity) }; });
    return next;
  });
  const setQuantity = (line: OpenIssueRequestLine, quantity: string) => setPicks(prev => ({ ...prev, [line.lineId]: { on: true, quantity } }));

  const countFor = (request: OpenIssueRequest) => request.lines.filter(line => picks[line.lineId]?.on).length;
  const activeAll = !!active && active.lines.every(line => picks[line.lineId]?.on);
  const activeSome = !!active && active.lines.some(line => picks[line.lineId]?.on);
  const requestsPicked = new Set(pickedLines.map(id => requestOfLine.get(id)!.code)).size;

  const confirm = () => {
    const result: PickedRequestLine[] = pickedLines.map(id => {
      const request = requestOfLine.get(id)!;
      return { request, line: request.lines.find(line => line.lineId === id)!, quantity: quantityOf(id) };
    });
    onConfirm(result);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="7xl"
      title={<span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-amber-500" />Lấy Vật Tư Từ Phiếu Yêu Cầu Xuất Kho</span>}>
      <div className="flex flex-col gap-3 h-[72vh] min-h-0">
        <p className="text-xs text-slate-500 shrink-0">
          Chọn một phiếu yêu cầu ở danh sách phía trên, rồi tích các vật tư cần lấy ở bảng phía dưới (đổi số lượng nếu chỉ xuất một phần). Có thể lấy từ
          nhiều phiếu, miễn là cùng kho và cùng loại tiền. Vật tư đã xuất đủ không hiện; vật tư còn thì hiện số lượng còn lại.
        </p>

        {/* Upper part: the requests */}
        <div className="flex flex-col min-h-0 basis-2/5 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm số phiếu, bộ phận, người yêu cầu, khách hàng, vật tư..."
              className="flex-1 bg-transparent text-xs outline-hidden" />
            <span className="text-[11px] text-slate-500 whitespace-nowrap">{filtered.length} phiếu còn hàng</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                <tr>
                  <th className="px-2 py-1.5">Số phiếu yêu cầu</th><th className="px-2 py-1.5">Ngày / cần hàng</th>
                  <th className="px-2 py-1.5">Bộ phận / người yêu cầu</th><th className="px-2 py-1.5">Khách hàng</th>
                  <th className="px-2 py-1.5">Kho / mục đích</th><th className="px-2 py-1.5 text-center">Vật tư còn</th><th className="px-2 py-1.5 text-center">Đã chọn</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">Không có phiếu yêu cầu nào còn hàng chưa xuất.</td></tr>}
                {filtered.map(request => {
                  const ok = compatible(request);
                  return (
                    <tr key={request.code} onClick={() => setActiveCode(request.code)}
                      title={ok ? undefined : 'Khác kho hoặc loại tiền với các vật tư đã chọn: không lấy chung một phiếu xuất được'}
                      className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer ${request.code === activeCode ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'} ${ok ? '' : 'opacity-50'}`}>
                      <td className="px-2 py-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{request.code}</td>
                      <td className="px-2 py-1.5"><div>{request.date}</div>{request.requiredDate && <div className="text-[10px] font-semibold text-amber-600">Cần: {request.requiredDate}</div>}</td>
                      <td className="px-2 py-1.5"><div className="font-semibold">{request.departmentName || '—'}</div><div className="text-[10px] text-slate-500">{request.requesterName || ''}</div></td>
                      <td className="px-2 py-1.5">{request.customerName || '—'}</td>
                      <td className="px-2 py-1.5"><div>{request.warehouseName}</div><div className="text-[10px] text-slate-500">{request.voucherType}{request.currencyCode !== 'VND' ? ` · ${request.currencyCode}` : ''}</div></td>
                      <td className="px-2 py-1.5 text-center font-bold">{request.lines.length}</td>
                      <td className="px-2 py-1.5 text-center">{countFor(request) > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">{countFor(request)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lower part: the materials of the request clicked */}
        <div className="flex flex-col min-h-0 basis-3/5 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 text-xs font-bold shrink-0 flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
            {active ? <>Vật tư của phiếu <span className="font-mono text-indigo-600 dark:text-indigo-400">{active.code}</span></> : 'Chọn một phiếu yêu cầu ở trên để xem vật tư'}
            {active && !activeOk && <span className="font-normal text-amber-600">— khác kho hoặc loại tiền với các vật tư đã chọn, không tích được</span>}
          </div>
          <div className="overflow-auto flex-1">
            {active && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                  <tr>
                    <th className="px-2 py-1.5 w-8">
                      <input type="checkbox" aria-label="Chọn tất cả vật tư của phiếu" disabled={!activeOk} checked={activeAll}
                        ref={el => { if (el) el.indeterminate = activeSome && !activeAll; }} onChange={e => toggleAll(e.target.checked)} />
                    </th>
                    <th className="px-2 py-1.5">Mã VT</th><th className="px-2 py-1.5">Tên vật tư</th><th className="px-2 py-1.5 text-center">ĐVT</th>
                    <th className="px-2 py-1.5 text-right">SL yêu cầu</th><th className="px-2 py-1.5 text-right">Đã xuất</th>
                    <th className="px-2 py-1.5 text-right">Còn lại</th><th className="px-2 py-1.5 text-right w-32">SL lấy sang</th><th className="px-2 py-1.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lines.map(line => {
                    const pick = picks[line.lineId];
                    const bad = pick?.on && invalid(line);
                    return (
                      <tr key={line.lineId} className={`border-t border-slate-100 dark:border-slate-800 ${pick?.on ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                        <td className="px-2 py-1.5"><input type="checkbox" disabled={!activeOk} checked={!!pick?.on} onChange={e => toggle(line, e.target.checked)} /></td>
                        <td className="px-2 py-1.5 font-mono font-bold">{line.materialCode}</td>
                        <td className="px-2 py-1.5">{line.materialName}</td>
                        <td className="px-2 py-1.5 text-center">{line.uomCode}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{formatQuantity(line.requestedQuantity)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-500">{formatQuantity(line.requestedQuantity - line.remainingQuantity)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatQuantity(line.remainingQuantity)}</td>
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
            Đã chọn <strong>{pickedLines.length}</strong> vật tư từ <strong>{requestsPicked}</strong> phiếu yêu cầu
            {anyInvalid && <span className="ml-2 text-rose-600 font-semibold">Có số lượng không hợp lệ.</span>}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Đóng</Button>
            <Button type="button" size="sm" disabled={pickedLines.length === 0 || anyInvalid} onClick={confirm}>Lấy {pickedLines.length || ''} vật tư sang phiếu xuất</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
