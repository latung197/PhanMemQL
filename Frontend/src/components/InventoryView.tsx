import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  MapPin, 
  PlusCircle, 
  MinusCircle, 
  X,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Product } from '../types';

interface InventoryViewProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onAdjustStock: (productId: string, newQty: number) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ 
  products, 
  onAddProduct, 
  onAdjustStock 
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [statusFilter, setStatusFilter] = useState<'Tất cả' | 'Sắp hết hàng' | 'Đủ hàng' | 'Hết hàng'>('Tất cả');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Thiết bị điện tử');
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(100000);
  const [minThreshold, setMinThreshold] = useState(5);
  const [position, setPosition] = useState('');

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ['Tất cả', ...Array.from(list)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'Tất cả' || p.category === categoryFilter;
      
      let matchStatus = true;
      if (statusFilter === 'Sắp hết hàng') {
        matchStatus = p.quantity > 0 && p.quantity <= p.minThreshold;
      } else if (statusFilter === 'Đủ hàng') {
        matchStatus = p.quantity > p.minThreshold;
      } else if (statusFilter === 'Hết hàng') {
        matchStatus = p.quantity === 0;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) {
      alert('Vui lòng điền tên sản phẩm và mã SKU!');
      return;
    }

    onAddProduct({
      name: name.trim(),
      sku: sku.toUpperCase().trim(),
      category,
      quantity,
      price,
      minThreshold,
      position: position.trim() || 'Khu A'
    });

    // Reset fields & close
    setName('');
    setSku('');
    setCategory('Thiết bị điện tử');
    setQuantity(10);
    setPrice(100000);
    setMinThreshold(5);
    setPosition('');
    setShowAddModal(false);
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="space-y-6" id="inventory-module-view">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-5.5 w-5.5 text-amber-500" />
            Khử Kho & Quản Lý Tồn Kho
          </h2>
          <p className="text-xs text-gray-500">Giám sát mức điều độ, nhập kho mã vạch SKU và cảnh báo an toàn dự trữ hàng</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer focus:outline-hidden"
          id="btn-add-product-modal-trigger"
        >
          <Plus className="h-4.5 w-4.5" />
          Khai báo mã hàng mới
        </button>
      </div>

      {/* Statistical Mini Metric Boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="inventory-stats-row">
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Tổng số dòng SKU</p>
          <h4 className="text-xl font-bold font-mono text-gray-800 mt-1">{products.length} mã</h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-400 font-semibold text-rose-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Hết hàng
          </p>
          <h4 className="text-xl font-bold font-mono text-rose-600 mt-1">
            {products.filter(p => p.quantity === 0).length} mã
          </h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-400 font-semibold text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Sắp hết hàng
          </p>
          <h4 className="text-xl font-bold font-mono text-amber-600 mt-1">
            {products.filter(p => p.quantity > 0 && p.quantity <= p.minThreshold).length} mã
          </h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-400 font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Cơ số đủ dùng
          </p>
          <h4 className="text-xl font-bold font-mono text-emerald-600 mt-1">
            {products.filter(p => p.quantity > p.minThreshold).length} mã
          </h4>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 gap-4 flex flex-col md:flex-row shadow-xs">
        {/* Search input */}
        <div className="relative grow">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo Tên sản phẩm, Mã SKU vạch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
            id="search-products-input"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap gap-2.5">
          {/* Category */}
          <div className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg bg-white">
            <span className="text-[10px] uppercase font-bold text-gray-400">Ngành:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="font-semibold text-xs text-gray-700 outline-none pr-1 cursor-pointer"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status limits */}
          <div className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg bg-white">
            <span className="text-[10px] uppercase font-bold text-gray-400">Tình trạng:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="font-semibold text-xs text-gray-700 outline-none pr-1 cursor-pointer"
            >
              <option value="Tất cả">Tất cả hạn tồn</option>
              <option value="Sắp hết hàng">Sắp hết hàng</option>
              <option value="Đủ hàng">Đủ hàng an toàn</option>
              <option value="Hết hàng">Hết hàng</option>
            </select>
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="products-list-table">
            <thead>
              <tr className="bg-gray-55 border-b border-gray-100 text-xs font-bold uppercase text-gray-500 tracking-wider">
                <th className="py-4 px-6">Mã hàng / SKU</th>
                <th className="py-4 px-6">Tên Mặt Hàng</th>
                <th className="py-4 px-6">Phân Loại Ngành</th>
                <th className="py-4 px-6">Đơn Giá Sỉ</th>
                <th className="py-4 px-6">Vị Trí Kho</th>
                <th className="py-4 px-6">Cơ Số Tồn Kho</th>
                <th className="py-4 px-6">Định Mức Cảnh Báo</th>
                <th className="py-4 px-6 text-right">Hiệu Chỉnh Tồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Không có sản phẩm nào khớp với tìm kiếm!
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.quantity === 0;
                  const isLowStock = p.quantity > 0 && p.quantity <= p.minThreshold;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-all">
                      <td className="py-4 px-6">
                        <span className="font-mono text-gray-800 font-bold block">{p.id}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-mono">{p.sku}</span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-gray-900">{p.name}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                          {p.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold font-mono text-gray-900">{formatVND(p.price)}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-slate-50 px-2 py-1 border border-gray-100 rounded-md">
                          <MapPin className="h-3.5 w-3.5 text-amber-500" />
                          {p.position}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-semibold text-base ${
                            isOutOfStock ? 'text-rose-600 font-bold' : 
                            isLowStock ? 'text-amber-600 font-bold' :
                            'text-emerald-700'
                          }`}>
                            {p.quantity} Unit
                          </span>
                          
                          {/* Stock status indicator badge */}
                          {isOutOfStock && (
                            <span className="bg-rose-50 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-sm border border-rose-100 font-semibold uppercase tracking-wide">Cạn kho</span>
                          )}
                          {isLowStock && (
                            <span className="bg-amber-50 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-sm border border-amber-100 font-semibold uppercase tracking-wide animate-pulse">Cảnh báo</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-gray-400">≤ {p.minThreshold} Unit</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end items-center gap-2" id={`qty-adjuster-${p.id}`}>
                          <button
                            onClick={() => onAdjustStock(p.id, Math.max(0, p.quantity - 1))}
                            title="Bớt 1 mặt hàng"
                            className="p-1 px-1.5 text-gray-500 hover:text-amber-500 hover:bg-slate-100 rounded-sm cursor-pointer border border-gray-150 focus:outline-hidden"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => onAdjustStock(p.id, p.quantity + 1)}
                            title="Cộng thêm 1 mặt hàng (Nhập bù)"
                            className="p-1 px-1.5 text-gray-500 hover:text-emerald-600 hover:bg-slate-100 rounded-sm cursor-pointer border border-gray-150 focus:outline-hidden"
                          >
                            +1
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="add-product-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-amber-500" />
                Đăng ký Mã Hàng Mới
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg focus:outline-hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Product name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Tên Sản Phẩm *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: USB hub Orico 4 ports, Ghế gaming..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2.5 px-3 focus:ring-1 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* SKU & Category fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Mã SKU (Vạch) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Mã: MON-DE-S3"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 focus:ring-1 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Ngành hàng</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-2.5 outline-none cursor-pointer text-gray-700"
                  >
                    <option value="Thiết bị điện tử">Thiết bị điện tử</option>
                    <option value="Phụ kiện máy tính">Phụ kiện máy tính</option>
                    <option value="Nội thất văn phòng">Nội thất văn phòng</option>
                    <option value="Thiết bị âm thanh">Thiết bị âm thanh</option>
                    <option value="Thiết bị VP khác">Thiết bị VP khác</option>
                  </select>
                </div>
              </div>

              {/* Price & quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Đơn giá thị trường *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Số lượng ban đầu *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
              </div>

              {/* Alert threshold & warehouse location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Đặt ngưỡng cảnh báo</label>
                  <input
                    type="number"
                    min={1}
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Vị trí kho lữu trữ</label>
                  <input
                    type="text"
                    placeholder="Kệ A-01, Khu B-Gốc..."
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
              </div>

              {/* Submit triggers */}
              <div className="flex justify-end gap-2 text-xs pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-slate-50 text-gray-600 font-semibold focus:outline-hidden"
                >
                  Đóng lại
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold shadow-xs transition-all cursor-pointer focus:outline-hidden"
                >
                  Xác nhận lưu kho
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
