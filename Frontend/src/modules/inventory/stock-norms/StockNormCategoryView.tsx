import React, { useState, useMemo } from 'react';
import { Plus, ShieldAlert, Search, Edit, Trash2, AlertTriangle, CheckCircle2, Filter, X } from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { showToast } from '../../../utils/toast';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { SearchInput } from '../../../components/common/SearchInput';
import { Pagination } from '../../../components/common/Pagination';
import { LookupField } from '../../../components/common/LookupField';
import { MasterLookupModal } from '../../../components/common/MasterLookupModal';
import { StockNorm, Product, Warehouse, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';

interface StockNormCategoryViewProps {
  stockNorms: StockNorm[];
  products: Product[];
  warehouses: Warehouse[];
  onAddStockNorm?: (norm: StockNorm) => void;
  onUpdateStockNorm?: (id: string, norm: Partial<StockNorm>) => void;
  onDeleteStockNorm?: (id: string) => void;
  currentUser?: UserProfile;
}

export const StockNormCategoryView: React.FC<StockNormCategoryViewProps> = ({
  stockNorms: initialNorms = [],
  products = [],
  warehouses = [],
  onAddStockNorm,
  onUpdateStockNorm,
  onDeleteStockNorm,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_stock_norm_cat');

  const [localNorms, setLocalNorms] = useState<StockNorm[]>(initialNorms);
  const stockNorms = initialNorms.length > 0 ? initialNorms : localNorms;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tất cả');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterCode, setFilterCode] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');

  const filteredNorms = useMemo(() => {
    return stockNorms.filter(n => {
      const matchSearch = !searchTerm || (
        n.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.warehouseName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;
      if (statusFilter !== 'Tất cả' && n.status !== statusFilter) return false;
      if (filterCode && !n.code.toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterMaterial && !n.materialName.toLowerCase().includes(filterMaterial.toLowerCase())) return false;
      if (filterWarehouse !== 'ALL' && n.warehouseName !== filterWarehouse) return false;
      return true;
    });
  }, [stockNorms, searchTerm, statusFilter, filterCode, filterMaterial, filterWarehouse]);

  const activeFilterCount = (statusFilter !== 'Tất cả' ? 1 : 0) + (filterCode ? 1 : 0) + (filterMaterial ? 1 : 0) + (filterWarehouse !== 'ALL' ? 1 : 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNorm, setEditingNorm] = useState<StockNorm | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [materialSku, setMaterialSku] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [minQuantity, setMinQuantity] = useState(5);
  const [maxQuantity, setMaxQuantity] = useState(100);
  const [safetyStock, setSafetyStock] = useState(10);
  const [reorderPoint, setReorderPoint] = useState(8);
  const [status, setStatus] = useState<'Bình thường' | 'Cảnh báo tồn' | 'Thiếu hàng'>('Bình thường');

  // Lookup Modal State
  const [activeLookup, setActiveLookup] = useState<'material' | 'warehouse' | null>(null);

  const totalPages = Math.ceil(filteredNorms.length / pageSize) || 1;
  const paginatedList = filteredNorms.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenAddModal = () => {
    if (!perms.create) {
      alert('Bạn không có quyền THÊM định mức tồn kho!');
      return;
    }
    const defaultProduct = products[0];
    const defaultWh = warehouses[0];

    setCode(`ĐM-${Date.now().toString().slice(-4)}`);
    setMaterialId(defaultProduct?.id || '');
    setMaterialName(defaultProduct?.name || '');
    setMaterialSku(defaultProduct?.sku || '');
    setWarehouseId(defaultWh?.id || '');
    setWarehouseName(defaultWh?.name || '');
    setMinQuantity(5);
    setMaxQuantity(100);
    setSafetyStock(10);
    setReorderPoint(8);
    setStatus('Bình thường');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (n: StockNorm) => {
    if (!perms.edit) {
      alert('Bạn không có quyền CHỈNH SỬA định mức tồn kho!');
      return;
    }
    setEditingNorm(n);
    setCode(n.code);
    setMaterialId(n.materialId);
    setMaterialName(n.materialName);
    setMaterialSku(n.materialSku || '');
    setWarehouseId(n.warehouseId);
    setWarehouseName(n.warehouseName);
    setMinQuantity(n.minQuantity);
    setMaxQuantity(n.maxQuantity);
    setSafetyStock(n.safetyStock);
    setReorderPoint(n.reorderPoint);
    setStatus(n.status);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !materialId || !warehouseId) return;

    if (editingNorm) {
      const updated = {
        code,
        materialId,
        materialName,
        materialSku,
        warehouseId,
        warehouseName,
        minQuantity,
        maxQuantity,
        safetyStock,
        reorderPoint,
        status
      };
      if (onUpdateStockNorm) {
        onUpdateStockNorm(editingNorm.id, updated);
      } else {
        setLocalNorms(prev => prev.map(n => n.id === editingNorm.id ? { ...n, ...updated } : n));
      }
      setEditingNorm(null);
    } else {
      const newNorm: StockNorm = {
        id: `NORM${Date.now().toString().slice(-4)}`,
        code: code.trim().toUpperCase(),
        materialId,
        materialName,
        materialSku,
        warehouseId,
        warehouseName,
        minQuantity,
        maxQuantity,
        safetyStock,
        reorderPoint,
        status
      };
      if (onAddStockNorm) {
        onAddStockNorm(newNorm);
      } else {
        setLocalNorms(prev => [newNorm, ...prev]);
      }
      setShowAddModal(false);
    }
  };

  const handleDelete = (id: string, code: string) => {
    if (!perms.delete) {
      alert('Bạn KHÔNG CÓ QUYỀN XÓA định mức tồn kho!');
      return;
    }
    if (confirm(`Xác nhận xóa định mức tồn kho "${code}"?`)) {
      if (onDeleteStockNorm) {
        onDeleteStockNorm(id);
      } else {
        setLocalNorms(prev => prev.filter(n => n.id !== id));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<ShieldAlert />}
          title="Danh Mục Định Mức Tồn Kho (Min/Max Stock Norms)"
          count={filteredNorms.length}
          countLabel="Định mức"
          subtitle="Khai báo ngưỡng tồn tối thiểu, tối đa, tồn an toàn & điểm đặt hàng cho từng kho hàng"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalNorms([...initialNorms]);
            showToast.info('Đã tải lại danh mục định mức tồn!');
          }}
          onExportExcel={perms.export ? () => showToast.success('Đã xuất Excel danh mục định mức tồn!') : undefined}
          onImportExcel={perms.create ? () => showToast.info('Tính năng nhập Excel đang xử lý!') : undefined}
          addLabel="Thêm Định Mức Tồn"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.create}
          filterPanelContent={
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Định Mức</label>
                <input
                  type="text"
                  placeholder="Mã định mức..."
                  value={filterCode}
                  onChange={(e) => setFilterCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Tên Vật Tư</label>
                <input
                  type="text"
                  placeholder="Tên vật tư..."
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Kho Hàng</label>
                <select
                  value={filterWarehouse}
                  onChange={(e) => setFilterWarehouse(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả kho</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Trạng Thái</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Tất cả">Tất cả trạng thái</option>
                  <option value="Áp dụng">Áp dụng</option>
                  <option value="Ngưng áp dụng">Ngưng áp dụng</option>
                </select>
              </div>
            </div>
          }
          onClearFilter={() => {
            setFilterCode('');
            setFilterMaterial('');
            setFilterWarehouse('ALL');
            setStatusFilter('Tất cả');
            setSearchTerm('');
          }}
        />
      </div>

      {/* Table Card */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="max-w-md w-full">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Tìm kiếm mã định mức, tên vật tư, kho bãi..."
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden"
              >
                <option value="Tất cả">Tất cả</option>
                <option value="Bình thường">Bình thường</option>
                <option value="Cảnh báo tồn">Cảnh báo tồn</option>
                <option value="Thiếu hàng">Thiếu hàng</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Mã Định Mức</th>
                  <th className="p-3">Vật Tư & SKU</th>
                  <th className="p-3">Kho Bãi</th>
                  <th className="p-3 text-center">Tồn Tối Thiểu</th>
                  <th className="p-3 text-center">Mức An Toàn</th>
                  <th className="p-3 text-center">Điểm Đặt Hàng</th>
                  <th className="p-3 text-center">Tồn Tối Đa</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Chưa có định mức tồn kho nào. Bấm nút Thêm để bắt đầu thiết lập.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((n, idx) => (
                    <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {n.code}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{n.materialName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{n.materialSku}</div>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                        {n.warehouseName}
                      </td>
                      <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">
                        {n.minQuantity}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">
                        {n.safetyStock}
                      </td>
                      <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        {n.reorderPoint}
                      </td>
                      <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {n.maxQuantity}
                      </td>
                      <td className="p-3">
                        {n.status === 'Thiếu hàng' ? (
                          <Badge variant="rose" size="sm" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> Thiếu hàng
                          </Badge>
                        ) : n.status === 'Cảnh báo tồn' ? (
                          <Badge variant="amber" size="sm" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> Cảnh báo tồn
                          </Badge>
                        ) : (
                          <Badge variant="emerald" size="sm" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> Bình thường
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {perms.edit && (
                            <button
                              onClick={() => handleOpenEditModal(n)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                              title="Sửa định mức"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {perms.delete && (
                            <button
                              onClick={() => handleDelete(n.id, n.code)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                              title="Xóa định mức"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredNorms.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>

      {/* Modal Add/Edit */}
      <Modal
        isOpen={showAddModal || !!editingNorm}
        onClose={() => { setShowAddModal(false); setEditingNorm(null); }}
        title={editingNorm ? 'Chỉnh Sửa Định Mức Tồn Kho' : 'Khai Báo Định Mức Tồn Kho'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mã Định Mức <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="VD: ĐM-PROD001-KH001..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-mono font-bold"
            />
          </div>

          <LookupField
            label="Vật Tư / Sản Phẩm Cần Khai Báo"
            required
            value={materialName ? `${materialName} (${materialSku})` : ''}
            placeholder="Tra cứu chọn vật tư..."
            onLookupClick={() => setActiveLookup('material')}
          />

          <LookupField
            label="Kho Bãi Áp Dụng"
            required
            value={warehouseName}
            placeholder="Tra cứu chọn kho bãi..."
            onLookupClick={() => setActiveLookup('warehouse')}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tồn Tối Thiểu (Min) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={minQuantity}
                onChange={e => setMinQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mức Tồn An Toàn (Safety Stock)
              </label>
              <input
                type="number"
                min={0}
                required
                value={safetyStock}
                onChange={e => setSafetyStock(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Điểm Đặt Hàng Lại (Reorder Point)
              </label>
              <input
                type="number"
                min={0}
                required
                value={reorderPoint}
                onChange={e => setReorderPoint(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tồn Tối Đa (Max) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                required
                value={maxQuantity}
                onChange={e => setMaxQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Trạng Thái Cảnh Báo
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as 'Bình thường' | 'Cảnh báo tồn' | 'Thiếu hàng')}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
            >
              <option value="Bình thường">Bình thường</option>
              <option value="Cảnh báo tồn">Cảnh báo tồn</option>
              <option value="Thiếu hàng">Thiếu hàng</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingNorm(null); }}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Lưu Định Mức
            </Button>
          </div>
        </form>
      </Modal>

      {/* Master Lookups */}
      {activeLookup === 'material' && (
        <MasterLookupModal
          isOpen={true}
          onClose={() => setActiveLookup(null)}
          title="Tra Cứu & Chọn Vật Tư Cần Khai Báo Định Mức"
          data={products}
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên Vật Tư' },
            { key: 'category', label: 'Loại' },
            { key: 'quantity', label: 'Tồn Hiện Tại' }
          ]}
          searchFields={['sku', 'name', 'category']}
          selectionMode="single"
          selectedIds={materialId ? [materialId] : []}
          onConfirm={(selected) => {
            if (selected[0]) {
              setMaterialId(selected[0].id);
              setMaterialName(selected[0].name);
              setMaterialSku(selected[0].sku);
            }
          }}
        />
      )}

      {activeLookup === 'warehouse' && (
        <MasterLookupModal
          isOpen={true}
          onClose={() => setActiveLookup(null)}
          title="Tra Cứu & Chọn Kho Bãi"
          data={warehouses}
          columns={[
            { key: 'code', label: 'Mã Kho' },
            { key: 'name', label: 'Tên Kho Bãi' },
            { key: 'manager', label: 'Thủ Kho' }
          ]}
          searchFields={['code', 'name', 'manager']}
          selectionMode="single"
          selectedIds={warehouseId ? [warehouseId] : []}
          onConfirm={(selected) => {
            if (selected[0]) {
              setWarehouseId(selected[0].id);
              setWarehouseName(selected[0].name);
            }
          }}
        />
      )}
    </div>
  );
};
