import React, { useState, useMemo } from 'react';
import { Plus, Boxes, Search, Edit, Trash2, Calendar, AlertTriangle, CheckCircle2, Filter, X } from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { showToast } from '../../../../utils/toast';
import { Card } from '../../../../components/common/Card';
import { Button } from '../../../../components/common/Button';
import { Modal } from '../../../../components/common/Modal';
import { Badge } from '../../../../components/common/Badge';
import { SearchInput } from '../../../../components/common/SearchInput';
import { Pagination } from '../../../../components/common/Pagination';
import { LookupField } from '../../../../components/common/LookupField';
import { MasterLookupModal } from '../../../../components/common/MasterLookupModal';
import { MaterialLot, Product, UserProfile } from '../../../../types';
import { getActionPermission } from '../../../../mock/initialRoles';

interface LotCategoryViewProps {
  lots: MaterialLot[];
  products: Product[];
  onAddLot?: (lot: MaterialLot) => void;
  onUpdateLot?: (id: string, lot: Partial<MaterialLot>) => void;
  onDeleteLot?: (id: string) => void;
  currentUser?: UserProfile;
}

export const LotCategoryView: React.FC<LotCategoryViewProps> = ({
  lots: initialLots = [],
  products = [],
  onAddLot,
  onUpdateLot,
  onDeleteLot,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_lot_cat');

  const [localLots, setLocalLots] = useState<MaterialLot[]>(initialLots);
  const lots = initialLots.length > 0 ? initialLots : localLots;

  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('Tất cả');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterLotNumber, setFilterLotNumber] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  const filteredLots = useMemo(() => {
    return lots.filter(l => {
      const matchSearch = !searchTerm || (
        l.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;
      if (qualityFilter !== 'Tất cả' && l.qualityStatus !== qualityFilter) return false;
      if (filterLotNumber && !l.lotNumber.toLowerCase().includes(filterLotNumber.toLowerCase())) return false;
      if (filterMaterial && !l.materialName.toLowerCase().includes(filterMaterial.toLowerCase())) return false;
      if (filterSupplier && !(l.supplierName || '').toLowerCase().includes(filterSupplier.toLowerCase())) return false;
      return true;
    });
  }, [lots, searchTerm, qualityFilter, filterLotNumber, filterMaterial, filterSupplier]);

  const activeFilterCount = (qualityFilter !== 'Tất cả' ? 1 : 0) + (filterLotNumber ? 1 : 0) + (filterMaterial ? 1 : 0) + (filterSupplier ? 1 : 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLot, setEditingLot] = useState<MaterialLot | null>(null);

  // Form states
  const [lotNumber, setLotNumber] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [mfgDate, setMfgDate] = useState('2026-05-01');
  const [expDate, setExpDate] = useState('2028-05-01');
  const [initialQuantity, setInitialQuantity] = useState(50);
  const [currentQuantity, setCurrentQuantity] = useState(50);
  const [qualityStatus, setQualityStatus] = useState<'Đạt chuẩn' | 'Cần kiểm định' | 'Cảnh báo hạn' | 'Hết hạn'>('Đạt chuẩn');
  const [supplierName, setSupplierName] = useState('');

  // Lookup Modal State
  const [showMaterialLookup, setShowMaterialLookup] = useState(false);

  const totalPages = Math.ceil(filteredLots.length / pageSize) || 1;
  const paginatedList = filteredLots.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenAddModal = () => {
    if (!perms.create) {
      alert('Bạn không có quyền THÊM lô hàng mới!');
      return;
    }
    const defaultP = products[0];
    setLotNumber(`LÔ-2026-${Date.now().toString().slice(-4)}`);
    setMaterialId(defaultP?.id || '');
    setMaterialName(defaultP?.name || '');
    setMfgDate('2026-05-01');
    setExpDate('2028-05-01');
    setInitialQuantity(50);
    setCurrentQuantity(50);
    setQualityStatus('Đạt chuẩn');
    setSupplierName('Dell Vietnam Co., Ltd');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (l: MaterialLot) => {
    if (!perms.edit) {
      alert('Bạn không có quyền CHỈNH SỬA lô hàng!');
      return;
    }
    setEditingLot(l);
    setLotNumber(l.lotNumber);
    setMaterialId(l.materialId);
    setMaterialName(l.materialName);
    setMfgDate(l.mfgDate);
    setExpDate(l.expDate);
    setInitialQuantity(l.initialQuantity);
    setCurrentQuantity(l.currentQuantity);
    setQualityStatus(l.qualityStatus);
    setSupplierName(l.supplierName || '');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotNumber.trim() || !materialId) return;

    if (editingLot) {
      const updated = {
        lotNumber,
        materialId,
        materialName,
        mfgDate,
        expDate,
        initialQuantity,
        currentQuantity,
        qualityStatus,
        supplierName
      };
      if (onUpdateLot) {
        onUpdateLot(editingLot.id, updated);
      } else {
        setLocalLots(prev => prev.map(l => l.id === editingLot.id ? { ...l, ...updated } : l));
      }
      setEditingLot(null);
    } else {
      const newLot: MaterialLot = {
        id: `LOT${Date.now().toString().slice(-4)}`,
        lotNumber: lotNumber.trim().toUpperCase(),
        materialId,
        materialName,
        mfgDate,
        expDate,
        initialQuantity,
        currentQuantity,
        qualityStatus,
        supplierName
      };
      if (onAddLot) {
        onAddLot(newLot);
      } else {
        setLocalLots(prev => [newLot, ...prev]);
      }
      setShowAddModal(false);
    }
  };

  const handleDelete = (id: string, num: string) => {
    if (!perms.delete) {
      alert('Bạn KHÔNG CÓ QUYỀN XÓA lô hàng!');
      return;
    }
    if (confirm(`Xác nhận xóa lô hàng "${num}"?`)) {
      if (onDeleteLot) {
        onDeleteLot(id);
      } else {
        setLocalLots(prev => prev.filter(l => l.id !== id));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<Boxes />}
          title="Danh Mục Lô & Hạn Sử Dụng (Material Batches & Lots)"
          count={filteredLots.length}
          countLabel="Lô hàng"
          subtitle="Theo dõi số lô sản xuất, ngày sản xuất, hạn dùng (Exp Date) & kiểm định chất lượng"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalLots([...initialLots]);
            showToast.info('Đã tải lại danh mục lô & hạn sử dụng!');
          }}
          onExportExcel={perms.export ? () => showToast.success('Đã xuất Excel danh mục lô hàng!') : undefined}
          onImportExcel={perms.create ? () => showToast.info('Tính năng nhập Excel đang xử lý!') : undefined}
          addLabel="Khai Báo Lô Hàng"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.create}
          filterPanelContent={
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Số Lô Hàng</label>
                <input
                  type="text"
                  placeholder="Số lô..."
                  value={filterLotNumber}
                  onChange={(e) => setFilterLotNumber(e.target.value)}
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
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Nhà Cung Cấp</label>
                <input
                  type="text"
                  placeholder="Nhà cung cấp..."
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Chất Lượng / Trạng Thái</label>
                <select
                  value={qualityFilter}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Tất cả">Tất cả chất lượng</option>
                  <option value="Đạt chuẩn">Đạt chuẩn</option>
                  <option value="Cần kiểm định">Cần kiểm định</option>
                  <option value="Cảnh báo hạn">Cảnh báo hạn</option>
                  <option value="Hết hạn">Hết hạn</option>
                </select>
              </div>
            </div>
          }
          onClearFilter={() => {
            setFilterLotNumber('');
            setFilterMaterial('');
            setFilterSupplier('');
            setQualityFilter('Tất cả');
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
                placeholder="Tìm kiếm số lô, tên vật tư, nhà cung cấp..."
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Chất lượng:</span>
              <select
                value={qualityFilter}
                onChange={(e) => {
                  setQualityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden"
              >
                <option value="Tất cả">Tất cả</option>
                <option value="Đạt chuẩn">Đạt chuẩn</option>
                <option value="Cần kiểm định">Cần kiểm định</option>
                <option value="Cảnh báo hạn">Cảnh báo hạn</option>
                <option value="Hết hạn">Hết hạn</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Số Lô Hàng</th>
                  <th className="p-3">Vật Tư Liên Kết</th>
                  <th className="p-3">Ngày Sản Xuất</th>
                  <th className="p-3">Hạn Sử Dụng (Exp)</th>
                  <th className="p-3 text-center">SL Ban Đầu</th>
                  <th className="p-3 text-center">SL Tồn Hiện Tại</th>
                  <th className="p-3">Nhà Cung Cấp</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Chưa có lô hàng nào. Bấm nút Thêm để bắt đầu khai báo.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {l.lotNumber}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {l.materialName}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {l.mfgDate}
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {l.expDate}
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {l.initialQuantity}
                      </td>
                      <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        {l.currentQuantity}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {l.supplierName || '—'}
                      </td>
                      <td className="p-3">
                        {l.qualityStatus === 'Đạt chuẩn' ? (
                          <Badge variant="emerald" size="sm" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> Đạt chuẩn
                          </Badge>
                        ) : l.qualityStatus === 'Cảnh báo hạn' ? (
                          <Badge variant="amber" size="sm" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> Cảnh báo hạn
                          </Badge>
                        ) : (
                          <Badge variant="rose" size="sm" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" /> {l.qualityStatus}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {perms.edit && (
                            <button
                              onClick={() => handleOpenEditModal(l)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                              title="Sửa lô hàng"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {perms.delete && (
                            <button
                              onClick={() => handleDelete(l.id, l.lotNumber)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                              title="Xóa lô hàng"
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
            totalItems={filteredLots.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>

      {/* Modal Add/Edit */}
      <Modal
        isOpen={showAddModal || !!editingLot}
        onClose={() => { setShowAddModal(false); setEditingLot(null); }}
        title={editingLot ? 'Chỉnh Sửa Lô Hàng' : 'Khai Báo Số Lô & Hạn Sử Dụng'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Số Lô Hàng (Lot / Batch No.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lotNumber}
                onChange={e => setLotNumber(e.target.value)}
                placeholder="VD: LÔ-2026-05A..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nhà Cung Cấp / Hãng SX
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="VD: Dell Vietnam, LG Electronics..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
              />
            </div>
          </div>

          <LookupField
            label="Vật Tư / Sản Phẩm Lô Hàng"
            required
            value={materialName}
            placeholder="Tra cứu chọn vật tư..."
            onLookupClick={() => setShowMaterialLookup(true)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày Sản Xuất (Mfg Date)
              </label>
              <input
                type="date"
                required
                value={mfgDate}
                onChange={e => setMfgDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hạn Sử Dụng (Exp Date) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={expDate}
                onChange={e => setExpDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Số Lượng Nhập Ban Đầu
              </label>
              <input
                type="number"
                min={1}
                required
                value={initialQuantity}
                onChange={e => setInitialQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Số Lượng Tồn Hiện Tại
              </label>
              <input
                type="number"
                min={0}
                required
                value={currentQuantity}
                onChange={e => setCurrentQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Trạng Thái Chất Lượng
            </label>
            <select
              value={qualityStatus}
              onChange={e => setQualityStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
            >
              <option value="Đạt chuẩn">Đạt chuẩn</option>
              <option value="Cần kiểm định">Cần kiểm định</option>
              <option value="Cảnh báo hạn">Cảnh báo hạn</option>
              <option value="Hết hạn">Hết hạn</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingLot(null); }}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Lưu Lô Hàng
            </Button>
          </div>
        </form>
      </Modal>

      {/* Material Lookup */}
      {showMaterialLookup && (
        <MasterLookupModal
          isOpen={true}
          onClose={() => setShowMaterialLookup(false)}
          title="Tra Cứu & Chọn Vật Tư Lô Hàng"
          data={products}
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên Vật Tư' },
            { key: 'unit', label: 'ĐVT' }
          ]}
          searchFields={['sku', 'name', 'category']}
          selectionMode="single"
          selectedIds={materialId ? [materialId] : []}
          onConfirm={(selected) => {
            if (selected[0]) {
              setMaterialId(selected[0].id);
              setMaterialName(selected[0].name);
            }
          }}
        />
      )}
    </div>
  );
};
