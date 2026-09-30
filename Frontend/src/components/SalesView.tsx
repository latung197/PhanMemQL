import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  User, 
  Phone, 
  Calendar,
  Check,
  Play,
  RotateCcw,
  Ban,
  Wallet
} from 'lucide-react';
import { Product, SalesOrder, OrderStatus, OrderItem, Customer } from '../types';

interface SalesViewProps {
  orders: SalesOrder[];
  products: Product[];
  customers: Customer[];
  onAddOrder: (order: Omit<SalesOrder, 'id'>) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({ 
  orders, 
  products, 
  customers, 
  onAddOrder, 
  onUpdateOrderStatus 
}) => {
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tất cả');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for new order
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản' | 'Ví điện tử'>('Chuyển khoản');
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  
  // Auxiliary states for adding current product
  const [currentProductId, setCurrentProductId] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);

  // Filter orders based on search and status
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (o.customerPhone && o.customerPhone.includes(searchTerm)) ||
                          o.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'Tất cả' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Handle adding product item to list
  const handleAddItem = () => {
    if (!currentProductId) return;
    const prod = products.find(p => p.id === currentProductId);
    if (!prod) return;

    // Check if product already exists in item list
    const existingIndex = selectedItems.findIndex(item => item.productId === currentProductId);
    if (existingIndex > -1) {
      const updated = [...selectedItems];
      updated[existingIndex].quantity += currentQuantity;
      setSelectedItems(updated);
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          productId: prod.id,
          productName: prod.name,
          quantity: currentQuantity,
          price: prod.price
        }
      ]);
    }
    // Reset auxiliary values
    setCurrentQuantity(1);
  };

  // Remove individual item from new order list
  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  // Calculate order total
  const orderTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [selectedItems]);

  // Handle submit form
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || selectedItems.length === 0) {
      alert('Vui lòng điền tên khách hàng và thêm ít nhất một sản phẩm!');
      return;
    }

    onAddOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || 'Cá nhân',
      date: new Date().toISOString().split('T')[0],
      items: selectedItems,
      totalAmount: orderTotal,
      status: 'Đang xử lý',
      paymentMethod: paymentMethod
    });

    // Reset and close
    setCustomerName('');
    setCustomerPhone('');
    setSelectedItems([]);
    setShowAddModal(false);
  };

  // Helper format VND
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="space-y-6" id="sales-module-view">
      {/* View Header with Search and Add buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="h-5.5 w-5.5 text-indigo-600" />
            Bán Hàng & CRM (Đơn Hàng)
          </h2>
          <p className="text-xs text-gray-500">Quản lý hóa đơn bán lẻ, khách hàng trung thành và điều phối trạng thái</p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            if (products.length > 0) setCurrentProductId(products[0].id);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer focus:outline-hidden"
          id="btn-add-order-modal-trigger"
        >
          <Plus className="h-4.5 w-4.5" />
          Khai báo đơn hàng mới
        </button>
      </div>

      {/* Grid of Statistics for Sales module */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="sales-stats-row">
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Tổng số đơn hàng</p>
            <h4 className="text-lg font-bold font-mono text-gray-800">{orders.length} đơn</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Đơn hàng hoàn thành</p>
            <h4 className="text-lg font-bold font-mono text-gray-800">{orders.filter(o => o.status === 'Hoàn thành').length} đơn</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0 animate-pulse">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Mã đơn đang chờ xử lý</p>
            <h4 className="text-lg font-bold font-mono text-gray-800">{orders.filter(o => o.status === 'Đang xử lý').length} đơn</h4>
          </div>
        </div>
      </div>

      {/* Search and Advanced Filter Row */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative grow">
          <Search className="absolute left-3 top-3.5 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo Khách hàng, SĐT hoặc Mã đơn hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs outline-hidden"
            id="search-orders-input"
          />
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-xl" id="status-filter-buttons-wrapper">
          <span className="text-xs font-semibold text-gray-400 px-1">Lọc:</span>
          {['Tất cả', 'Hoàn thành', 'Đang xử lý', 'Đã hủy'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-hidden ${
                statusFilter === status 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="orders-list-table">
            <thead>
              <tr className="bg-gray-55 border-b border-gray-100 text-xs font-bold uppercase text-gray-500 tracking-wider">
                <th className="py-4 px-6">Mã Đơn</th>
                <th className="py-4 px-6">Khách Hàng / SĐT</th>
                <th className="py-4 px-6">Ngày Tạo</th>
                <th className="py-4 px-6">Chi Tiết Sản Phẩm</th>
                <th className="py-4 px-6">Tổng Tiền</th>
                <th className="py-4 px-6">Kênh Thanh Toán</th>
                <th className="py-4 px-6">Trạng Thái</th>
                <th className="py-4 px-6 text-right">Điều Phối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Không tìm thấy dữ liệu đơn hàng phù hợp!
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/60 transition-all">
                    <td className="py-4 px-6 font-mono font-bold text-gray-900">{order.id}</td>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-800">{order.customerName}</p>
                      <p className="text-xs text-gray-400">{order.customerPhone || 'N/A'}</p>
                    </td>
                    <td className="py-4 px-6 text-gray-500">{order.date}</td>
                    <td className="py-4 px-6 max-w-xs">
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <p key={idx} className="text-xs text-gray-600 truncate">
                            <span className="font-semibold text-gray-700">{item.quantity}x</span> {item.productName}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-gray-900">{formatVND(order.totalAmount)}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Wallet className="h-3.5 w-3.5 text-gray-400" />
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold leading-none inline-block ${
                        order.status === 'Hoàn thành' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        order.status === 'Đang xử lý' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {order.status === 'Đang xử lý' && (
                        <div className="flex justify-end gap-1.5" id={`operation-actions-${order.id}`}>
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'Hoàn thành')}
                            title="Xác nhận hoàn thành giao dịch"
                            className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100 cursor-pointer focus:outline-hidden"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'Đã hủy')}
                            title="Hủy đơn hàng này"
                            className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100 cursor-pointer focus:outline-hidden"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {order.status !== 'Đang xử lý' && (
                        <span className="text-xs text-gray-400 italic">Lưu trữ hóa đơn</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Order Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="add-order-modal">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-indigo-600" />
                Lập Phiếu Đơn Hàng Mới
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg focus:outline-hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="space-y-4">
              
              {/* Customer info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Tên khách hàng *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A, Công ty XYZ..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Số điện thoại liên hệ</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="09x xxx xxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-slate-50 pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Phương thức thanh toán</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Chuyển khoản', 'Tiền mặt', 'Ví điện tử'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        paymentMethod === method 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Item Builder Panel */}
              <div className="border border-gray-150 p-4 rounded-xl bg-slate-50 space-y-3">
                <span className="text-xs font-bold uppercase text-gray-600 mb-1 block">Chọn sản phẩm bổ sung vào đơn hàng</span>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="grow">
                    <select
                      value={currentProductId}
                      onChange={(e) => setCurrentProductId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                    >
                      <option value="">-- Chọn một sản phẩm từ kho --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                          {p.name} ({formatVND(p.price)}) - Tồn kho: {p.quantity <= 0 ? 'HẾT HÀNG' : `${p.quantity} chiếc`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="w-24 shrink-0">
                    <input
                      type="number"
                      min={1}
                      value={currentQuantity}
                      onChange={(e) => setCurrentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="SL"
                      className="w-full bg-white border border-gray-200 rounded-lg text-xs py-2 text-center outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!currentProductId}
                    className="px-3 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Bổ sung
                  </button>
                </div>

                {/* Added items list */}
                <div className="bg-white border border-gray-100 rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-2">
                  {selectedItems.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-4">Chưa có sản phẩm nào được chọn.</p>
                  ) : (
                    selectedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                        <div>
                          <p className="font-semibold text-gray-800">{item.productName}</p>
                          <p className="text-[10px] text-gray-400">
                            Đơn giá: {formatVND(item.price)} × {item.quantity} chiếc = <strong className="text-gray-700">{formatVND(item.price * item.quantity)}</strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 hover:bg-rose-50 text-rose-500 rounded-md focus:outline-hidden"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Order total show */}
              <div className="flex justify-between items-center border-t border-gray-100 pt-3 text-sm">
                <span className="font-semibold text-gray-600">Tổng phí thanh toán tạm tính:</span>
                <span className="text-lg font-bold font-mono text-indigo-700">{formatVND(orderTotal)}</span>
              </div>

              {/* Submit triggers */}
              <div className="flex justify-end gap-2 text-sm pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-slate-50 text-gray-600 font-semibold focus:outline-hidden"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  disabled={selectedItems.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer focus:outline-hidden"
                >
                  Xác nhận đặt đơn (Chờ xử lý)
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
