import React from 'react';
import { FileSpreadsheet, ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';
import { Card } from '../../../../components/common/Card';
import { Product, GoodsVoucher } from '../../../../types';

interface NXTReportViewProps {
  products: Product[];
  vouchers: GoodsVoucher[];
}

export const NXTReportView: React.FC<NXTReportViewProps> = ({ products, vouchers }) => {
  // Aggregate NXT numbers per product
  const nxtTableData = products.map(p => {
    // Total in
    let sumIn = 0;
    // Total out
    let sumOut = 0;

    vouchers.forEach(v => {
      v.items.forEach(it => {
        if (it.productName === p.name) {
          if (v.type === 'Nhập kho') sumIn += it.quantity;
          if (v.type === 'Xuất kho') sumOut += it.quantity;
        }
      });
    });

    const beginningStock = Math.max(0, p.quantity - sumIn + sumOut);
    const endingStock = p.quantity;

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      beginningStock,
      sumIn,
      sumOut,
      endingStock,
      costPrice: p.costPrice || p.price * 0.75,
      endingValue: endingStock * (p.costPrice || p.price * 0.75)
    };
  });

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Báo Cáo Tổng Hợp Nhập - Xuất - Tồn (NXT)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bảng cân đối chi tiết tồn đầu kỳ, số nhập trong kỳ, số xuất trong kỳ và tồn cuối kỳ</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Mã SKU / Vật Tư</th>
                <th className="py-3.5 px-4 text-center">ĐVT</th>
                <th className="py-3.5 px-4 text-right">Tồn Đầu Kỳ</th>
                <th className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400">Nhập Trong Kỳ</th>
                <th className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400">Xuất Trong Kỳ</th>
                <th className="py-3.5 px-4 text-right font-extrabold text-indigo-600 dark:text-indigo-400">Tồn Cuối Kỳ</th>
                <th className="py-3.5 px-4 text-right">Giá Trị Tồn Cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300 font-mono">
              {nxtTableData.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-sans">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{row.name}</p>
                    <span className="text-[10px] text-slate-400">{row.sku}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans">{row.unit}</td>
                  <td className="py-3 px-4 text-right font-bold">{row.beginningStock}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">+{row.sumIn}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">-{row.sumOut}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-slate-100 bg-indigo-50/30 dark:bg-indigo-950/20">{row.endingStock}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatVND(row.endingValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
