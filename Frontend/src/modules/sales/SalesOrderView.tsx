import React, { useState } from 'react';
import { ShoppingBag, Plus, FileText, CheckCircle, Clock } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { Order, Customer, Product } from '../../types';

interface SalesOrderViewProps {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  onAddOrder: (ord: Order) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
}

export const SalesOrderView: React.FC<SalesOrderViewProps> = ({
  orders,
  customers,
  products,
  onAddOrder,
  onUpdateOrderStatus
}) => {
  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || 'KH001');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === customerId);
    const prod = products.find(p => p.id === productId);
    if (!cust || !prod) return;

    const totalAmount = prod.price * quantity;

    const newOrder: Order = {
      id: `HDB${String(orders.length + 1).padStart(3, '0')}`,
      customerName: cust.name,
      customerCompany: cust.company,
      items: [
        { productId: prod.id, productName: prod.name, quantity, price: prod.price, unitPrice: prod.price }
      ],
      totalAmount,
      status: 'Chờ xử lý',
      paymentMethod: 'Chuyển khoản',
      date: new Date().toISOString().split('T')[0],
      salesperson: 'Trần Thịnh (Admin)'
    };

    onAddOrder(newOrder);
    setShowModal(false);
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Đã hoàn thành':
        return <Badge variant="success">Đã hoàn thành</Badge>;
      case 'Đang giao':
        return <Badge variant="info">Đang vận chuyển</Badge>;
      case 'Đã hủy':
        return <Badge variant="danger">Đã hủy</Badge>;
      default:
        return <Badge variant="warning">Chờ xử lý</Badge>;
    }
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="w-full min-w-full flex-1 flex flex-col min-h-0 space-y-3">
      <div className="shrink-0 w-full min-w-0 flex flex-wrap justify-between items-center gap-3 bg-slate-900 text-white p-3.5 sm:p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-indigo-400" />
            Chứng Từ Bán Hàng (Hóa Đơn & Đơn Đặt Hàng)
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Tạo lập, theo dõi phê duyệt và thực hiện hóa đơn xuất bán hàng hóa</p>
        </div>

        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowModal(true)}>
          Lập Đơn Bán Hàng Mới
        </Button>
      </div>

      <Card className="w-full min-w-0 flex-1 flex flex-col min-h-0">
        <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-[300px] max-h-[calc(100vh-250px)] overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl relative custom-scrollbar w-full min-w-0">
          <table className="w-full min-w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 px-4">Mã Đơn / Ngày</th>
                <th className="py-3 px-4">Khách Hàng / Đơn Vị</th>
                <th className="py-3 px-4">Sản Phẩm Đặt Mua</th>
                <th className="py-3 px-4">Nhân Viên Kinh Doanh</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Tổng Tiền</th>
                <th className="py-3 px-4 text-center">Xử Lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{o.id}</p>
                    <p className="text-[10px] text-slate-400">{o.date}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{o.customerName}</p>
                    <p className="text-[10px] text-slate-400">{o.customerCompany}</p>
                  </td>
                  <td className="py-3 px-4 space-y-1">
                    {o.items.map((it, idx) => (
                      <div key={idx}>• {it.productName} (x{it.quantity})</div>
                    ))}
                  </td>
                  <td className="py-3 px-4">{o.salesperson}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(o.status)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    {formatVND(o.totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {o.status === 'Chờ xử lý' && (
                      <button
                        onClick={() => onUpdateOrderStatus(o.id, 'Đang giao')}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Giao hàng
                      </button>
                    )}
                    {o.status === 'Đang giao' && (
                      <button
                        onClick={() => onUpdateOrderStatus(o.id, 'Đã hoàn thành')}
                        className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Duyệt xong
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Lập Đơn Bán Hàng Mới" maxWidth="3xl">
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300">Khách Hàng Mua Hàng *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-600 dark:text-slate-300">Sản Phẩm Đặt Mua</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - {formatVND(p.price)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600 dark:text-slate-300">Số Lượng Mua</label>
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Hủy</Button>
            <Button type="submit">Xác Nhận Tạo Hóa Đơn</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
