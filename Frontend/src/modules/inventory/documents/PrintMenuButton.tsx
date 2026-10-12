// The print button of a voucher. With the right to see prices it opens a small menu with the two print forms (with prices and
// amounts / without); without that right there is nothing to choose, so it prints the form without prices at once.
import React, { useEffect, useRef, useState } from 'react';
import { FileText, FileX, Printer } from 'lucide-react';

interface PrintMenuButtonProps {
  /** Whether the user may see prices (`VIEW_PRICE`): only then the form with prices is offered. */
  canPrintPrice: boolean;
  onPrint: (withPrice: boolean) => void;
  /** 'icon' for a list row, 'button' for the header of the form. */
  variant?: 'icon' | 'button';
}

export const PrintMenuButton: React.FC<PrintMenuButtonProps> = ({ canPrintPrice, onPrint, variant = 'icon' }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', escape); };
  }, [open]);

  const choose = (withPrice: boolean) => { setOpen(false); onPrint(withPrice); };
  const click = () => (canPrintPrice ? setOpen(value => !value) : onPrint(false));

  return (
    <div ref={box} className="relative inline-block">
      {variant === 'icon' ? (
        <button type="button" onClick={click} aria-haspopup={canPrintPrice} aria-expanded={open}
          className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="In phiếu">
          <Printer className="h-4 w-4" />
        </button>
      ) : (
        <button type="button" onClick={click} aria-haspopup={canPrintPrice} aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-[5px] border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
          <Printer className="h-3.5 w-3.5" />In phiếu
        </button>
      )}
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-60 rounded-[9px] border border-brand-200 bg-white p-1 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button type="button" role="menuitem" onClick={() => choose(true)}
            className="flex w-full items-start gap-2 rounded-[5px] px-2.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-slate-800 cursor-pointer">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span><b className="block text-slate-800 dark:text-slate-100">In có giá và tiền</b>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Đơn giá, thành tiền, tổng bằng chữ. Cho kế toán.</span></span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose(false)}
            className="flex w-full items-start gap-2 rounded-[5px] px-2.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-slate-800 cursor-pointer">
            <FileX className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span><b className="block text-slate-800 dark:text-slate-100">In không có giá</b>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Chỉ số lượng. Cho thủ kho, người giao hàng.</span></span>
          </button>
        </div>
      )}
    </div>
  );
};
