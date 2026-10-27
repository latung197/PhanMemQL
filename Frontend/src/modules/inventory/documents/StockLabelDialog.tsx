// "In tem sản phẩm": the labels of the goods of a voucher (what a receipt brings in), chosen line by line, with the number of labels, the
// size of the label and the kind of code. The last choice of size and code is remembered in this browser.
import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { showToast } from '../../../utils/toast';
import type { GoodsVoucher } from '../../../types';
import { LABEL_SIZES, printStockLabels, type LabelSize, type LabelSymbology } from './stockLabelPrint';

interface StockLabelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: GoodsVoucher | null;
}

const STORAGE_KEY = 's_erp_label_options';

const readSaved = (): { size: LabelSize; symbology: LabelSymbology } => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      size: saved.size in LABEL_SIZES ? saved.size : '50x30',
      symbology: saved.symbology === 'qr' ? 'qr' : 'code128'
    };
  } catch { return { size: '50x30', symbology: 'code128' }; }
};

export const StockLabelDialog: React.FC<StockLabelDialogProps> = ({ isOpen, onClose, voucher }) => {
  const [copies, setCopies] = useState<number[]>([]);
  const [size, setSize] = useState<LabelSize>('50x30');
  const [symbology, setSymbology] = useState<LabelSymbology>('code128');
  const [busy, setBusy] = useState(false);
  const items = voucher?.items ?? [];

  // A fresh voucher starts with one label per line; the size and code are the ones used last.
  useEffect(() => {
    if (!isOpen) return;
    setCopies((voucher?.items ?? []).map(() => 1));
    const saved = readSaved();
    setSize(saved.size);
    setSymbology(saved.symbology);
  }, [isOpen, voucher]);

  const total = copies.reduce((sum, value) => sum + value, 0);

  const handlePrint = async () => {
    if (!voucher || total === 0) { showToast.error('Chọn ít nhất một tem để in (số tem lớn hơn 0).'); return; }
    setBusy(true);
    try {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ size, symbology })); } catch { /* the choice is only a convenience */ }
      const opened = await printStockLabels({
        symbology, size, voucherCode: voucher.code, date: voucher.date,
        lines: items.map((item, index) => ({
          materialCode: item.sku || item.productId || '', materialName: item.productName, unit: item.unit,
          lotNumber: item.lotNumber, position: item.position, copies: copies[index] ?? 0
        })).filter(line => line.copies > 0 && line.materialCode)
      });
      if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
      else onClose();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : 'Không tạo được tem.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs font-medium focus:outline-none focus:border-indigo-500';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`In Tem Sản Phẩm${voucher ? `: [${voucher.code}]` : ''}`} maxWidth="2xl">
      <div className="space-y-3 text-xs">
        <p className="text-slate-500">
          Mỗi tem có mã vạch ghi <strong>mã vật tư, số lô và vị trí</strong> của dòng hàng. Khi kiểm kê, quét tem để điền đúng dòng.
          Đặt số tem theo số thùng hoặc số kiện; số tem 0 là không in dòng đó.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block"><span className="block font-bold text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-0.5">Khổ tem (mm)</span>
            <select value={size} onChange={e => setSize(e.target.value as LabelSize)} className={input}>
              {(Object.keys(LABEL_SIZES) as LabelSize[]).map(key => <option key={key} value={key}>{key.replace('x', ' × ')}</option>)}
            </select></label>
          <label className="block"><span className="block font-bold text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-0.5">Loại mã</span>
            <select value={symbology} onChange={e => setSymbology(e.target.value as LabelSymbology)} className={input}>
              <option value="code128">Mã vạch Code 128 (mọi máy quét đều đọc)</option>
              <option value="qr">Mã QR (camera điện thoại, máy quét 2D)</option>
            </select></label>
          <Button type="button" size="sm" variant="outline" className="text-[11px]"
            onClick={() => setCopies(items.map(item => Math.max(1, Math.ceil(item.quantity || 1))))}>
            Số tem = số lượng nhập
          </Button>
          <Button type="button" size="sm" variant="outline" className="text-[11px]" onClick={() => setCopies(items.map(() => 1))}>Mỗi dòng 1 tem</Button>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr><th className="p-2">Mã VT</th><th className="p-2">Tên vật tư</th><th className="p-2">Số lô</th><th className="p-2">Vị trí</th><th className="p-2 text-right">SL nhập</th><th className="p-2 text-right w-24">Số tem</th></tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.sku || item.productId}</td>
                  <td className="p-2">{item.productName}</td>
                  <td className="p-2 font-mono">{item.lotNumber || '—'}</td>
                  <td className="p-2 font-mono">{item.position || '—'}</td>
                  <td className="p-2 text-right font-mono">{item.quantity} {item.unit}</td>
                  <td className="p-2 text-right">
                    <input type="number" min={0} max={999} value={copies[index] ?? 0}
                      onChange={e => setCopies(prev => prev.map((value, i) => i === index ? Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0))) : value))}
                      className={`${input} w-20 text-right`} />
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Phiếu không có dòng hàng.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-slate-500">Tổng <strong>{total}</strong> tem</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">Đóng</Button>
            <Button type="button" variant="primary" size="sm" disabled={busy || total === 0} onClick={() => void handlePrint()} icon={<Printer className="h-3.5 w-3.5" />}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
              {busy ? 'Đang tạo tem...' : 'In tem'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
