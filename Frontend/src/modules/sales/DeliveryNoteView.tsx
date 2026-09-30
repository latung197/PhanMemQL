import React from 'react';
import { Truck, CheckCircle2, Clock, FileText } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Order } from '../../types';

interface DeliveryNoteViewProps {
  orders: Order[];
}

export const DeliveryNoteView: React.FC<DeliveryNoteViewProps> = ({ orders }) => {
  const deliveryOrders = orders.filter(o => o.status === 'Đang giao' || o.status === 'Đã hoàn thành');

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="w-full min-w-full flex-1 flex flex-col min-h-0 space-y-3">
      <div className="shrink-0 w-full min-w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Phiếu Giao Hàng & Vận Chuyển Đơn Bán
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Danh sách các vận đơn kèm phiếu xuất kho đã và đang bàn giao cho đơn vị vận chuyển</p>
      </div>

      <Card className="w-full min-w-full flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-[300px] max-h-[calc(100vh-250px)] overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl relative custom-scrollbar w-full min-w-full">
          <table className="w-full min-w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 px-4">Mã Vận Đơn</th>
                <th className="py-3 px-4">Khách Hàng Nhận</th>
                <th className="py-3 px-4">Mặt Hàng Vận Chuyển</th>
                <th className="py-3 px-4 text-center">Trạng Thái Vận Chuyển</th>
                <th className="py-3 px-4 text-right">Giá Trị Đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {deliveryOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    DEL-{o.id}
                  </td>
                  <td className="py-3 px-4 font-bold">{o.customerName}</td>
                  <td className="py-3 px-4">
                    {o.items.map((it, i) => (
                      <span key={i}>• {it.productName} (x{it.quantity})</span>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {o.status === 'Đã hoàn thành' ? (
                      <Badge variant="success">Đã bàn giao khách</Badge>
                    ) : (
                      <Badge variant="warning">Đang đi đường</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold">{formatVND(o.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </Card>
    </div>
  );
};
