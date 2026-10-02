import React, { useState, useMemo } from 'react';
import { Plus, ArrowRightLeft, Search, Edit, Trash2, Filter, X } from 'lucide-react';
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
import { UomConversion, Product, UnitOfMeasure, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';

interface UomConversionCategoryViewProps {
  conversions: UomConversion[];
  products: Product[];
  unitsOfMeasure: UnitOfMeasure[];
  onAddConversion?: (conv: UomConversion) => void;
  onUpdateConversion?: (id: string, conv: Partial<UomConversion>) => void;
  onDeleteConversion?: (id: string) => void;
  currentUser?: UserProfile;
}

export const UomConversionCategoryView: React.FC<UomConversionCategoryViewProps> = ({
  conversions: initialConversions = [],
  products = [],
  unitsOfMeasure = [],
  onAddConversion,
  onUpdateConversion,
  onDeleteConversion,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_uom_conversion_cat');

  const [localConversions, setLocalConversions] = useState<UomConversion[]>(initialConversions);
  const conversions = initialConversions.length > 0 ? initialConversions : localConversions;

  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterCode, setFilterCode] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterFromUnit, setFilterFromUnit] = useState('ALL');
  const [filterToUnit, setFilterToUnit] = useState('ALL');

  const filteredConversions = useMemo(() => {
    return conversions.filter(c => {
      const matchSearch = !searchTerm || (
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.materialName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.fromUnitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.toUnitName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;
      if (filterCode && !c.code.toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterMaterial && !(c.materialName || '').toLowerCase().includes(filterMaterial.toLowerCase())) return false;
      if (filterFromUnit !== 'ALL' && c.fromUnitName !== filterFromUnit) return false;
      if (filterToUnit !== 'ALL' && c.toUnitName !== filterToUnit) return false;
      return true;
    });
  }, [conversions, searchTerm, filterCode, filterMaterial, filterFromUnit, filterToUnit]);

  const activeFilterCount = (filterCode ? 1 : 0) + (filterMaterial ? 1 : 0) + (filterFromUnit !== 'ALL' ? 1 : 0) + (filterToUnit !== 'ALL' ? 1 : 0);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingConv, setEditingConv] = useState<UomConversion | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [fromUnitId, setFromUnitId] = useState('');
  const [fromUnitName, setFromUnitName] = useState('Thùng');
  const [toUnitId, setToUnitId] = useState('');
  const [toUnitName, setToUnitName] = useState('Cái');
  const [conversionFactor, setConversionFactor] = useState(12);
  const [description, setDescription] = useState('');

  // Lookup Modals states
  const [activeLookup, setActiveLookup] = useState<'material' | 'fromUnit' | 'toUnit' | null>(null);

  const totalPages = Math.ceil(filteredConversions.length / pageSize) || 1;
  const paginatedList = filteredConversions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenAddModal = () => {
    if (!perms.create) {
      alert('Bạn không có quyền THÊM quy đổi đơn vị tính!');
      return;
    }
    setCode(`QĐ-${Date.now().toString().slice(-4)}`);
    setMaterialId('');
    setMaterialName('');
    setFromUnitId(unitsOfMeasure[0]?.id || '');
    setFromUnitName(unitsOfMeasure[0]?.name || 'Thùng');
    setToUnitId(unitsOfMeasure[1]?.id || '');
    setToUnitName(unitsOfMeasure[1]?.name || 'Cái');
    setConversionFactor(12);
    setDescription('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (c: UomConversion) => {
    if (!perms.edit) {
      alert('Bạn không có quyền CHỈNH SỬA quy đổi ĐVT!');
      return;
    }
    setEditingConv(c);
    setCode(c.code);
    setMaterialId(c.materialId || '');
    setMaterialName(c.materialName || '');
    setFromUnitId(c.fromUnitId);
    setFromUnitName(c.fromUnitName);
    setToUnitId(c.toUnitId);
    setToUnitName(c.toUnitName);
    setConversionFactor(c.conversionFactor);
    setDescription(c.description || '');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !fromUnitName || !toUnitName) return;

    const autoDesc = description.trim() || `1 ${fromUnitName} = ${conversionFactor} ${toUnitName}`;

    if (editingConv) {
      const updated = {
        code,
        materialId,
        materialName,
        fromUnitId,
        fromUnitName,
        toUnitId,
        toUnitName,
        conversionFactor,
        description: autoDesc
      };
      if (onUpdateConversion) {
        onUpdateConversion(editingConv.id, updated);
      } else {
        setLocalConversions(prev => prev.map(c => c.id === editingConv.id ? { ...c, ...updated } : c));
      }
      setEditingConv(null);
    } else {
      const newConv: UomConversion = {
        id: `UCONV${Date.now().toString().slice(-4)}`,
        code: code.trim().toUpperCase(),
        materialId,
        materialName,
        fromUnitId,
        fromUnitName,
        toUnitId,
        toUnitName,
        conversionFactor,
        description: autoDesc
      };
      if (onAddConversion) {
        onAddConversion(newConv);
      } else {
        setLocalConversions(prev => [newConv, ...prev]);
      }
      setShowAddModal(false);
    }
  };

  const handleDelete = (id: string, code: string) => {
    if (!perms.delete) {
      alert('Bạn KHÔNG CÓ QUYỀN XÓA quy đổi đơn vị tính!');
      return;
    }
    if (confirm(`Xác nhận xóa quy đổi "${code}"?`)) {
      if (onDeleteConversion) {
        onDeleteConversion(id);
      } else {
        setLocalConversions(prev => prev.filter(c => c.id !== id));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<ArrowRightLeft />}
          title="Danh Mục Quy Đổi Đơn Vị Tính (UOM Conversions)"
          count={filteredConversions.length}
          countLabel="Công thức"
          subtitle="Thiết lập tỷ lệ quy đổi giữa đơn vị gốc và đơn vị phụ (VD: 1 Thùng = 24 Hộp = 240 Cái)"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalConversions([...initialConversions]);
            showToast.info('Đã tải lại danh mục quy đổi ĐVT!');
          }}
          onExportExcel={perms.export ? () => showToast.success('Đã xuất Excel quy đổi ĐVT!') : undefined}
          onImportExcel={perms.create ? () => showToast.info('Tính năng nhập Excel đang xử lý!') : undefined}
          addLabel="Thêm Quy Đổi ĐVT"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.create}
          filterPanelContent={
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Quy Đổi</label>
                <input
                  type="text"
                  placeholder="Mã quy đổi..."
                  value={filterCode}
                  onChange={(e) => setFilterCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Tên Vật Tư Liên Kết</label>
                <input
                  type="text"
                  placeholder="Tên vật tư..."
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Đơn Vị Lớn (From)</label>
                <select
                  value={filterFromUnit}
                  onChange={(e) => setFilterFromUnit(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả đơn vị</option>
                  {unitsOfMeasure.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Đơn Vị Nhỏ (To)</label>
                <select
                  value={filterToUnit}
                  onChange={(e) => setFilterToUnit(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả đơn vị</option>
                  {unitsOfMeasure.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          }
          onClearFilter={() => {
            setFilterCode('');
            setFilterMaterial('');
            setFilterFromUnit('ALL');
            setFilterToUnit('ALL');
            setSearchTerm('');
          }}
        />
      </div>

      {/* Table Card */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="max-w-md w-full">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Tìm kiếm theo mã quy đổi, tên vật tư, đơn vị quy đổi..."
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Mã Quy Đổi</th>
                  <th className="p-3">Vật Tư Liên Kết</th>
                  <th className="p-3">Đơn Vị Lớn (From)</th>
                  <th className="p-3 text-center">Tỷ Lệ</th>
                  <th className="p-3">Đơn Vị Nhỏ (To)</th>
                  <th className="p-3">Công Thức Quy Đổi</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Chưa có công thức quy đổi nào. Bấm nút Thêm để bắt đầu khai báo.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                        {c.code}
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {c.materialName || <span className="text-slate-400 italic">Áp dụng chung toàn hệ thống</span>}
                      </td>
                      <td className="p-3">
                        <Badge variant="purple" size="sm">{c.fromUnitName}</Badge>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        1 = {c.conversionFactor}
                      </td>
                      <td className="p-3">
                        <Badge variant="indigo" size="sm">{c.toUnitName}</Badge>
                      </td>
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-300">
                        {c.description}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {perms.edit && (
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                              title="Sửa quy đổi"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {perms.delete && (
                            <button
                              onClick={() => handleDelete(c.id, c.code)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                              title="Xóa quy đổi"
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
            totalItems={filteredConversions.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>

      {/* Modal Add/Edit */}
      <Modal
        isOpen={showAddModal || !!editingConv}
        onClose={() => { setShowAddModal(false); setEditingConv(null); }}
        title={editingConv ? 'Chỉnh Sửa Quy Đổi ĐVT' : 'Thêm Công Thức Quy Đổi ĐVT'}
        maxWidth="3xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mã Quy Đổi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="VD: QĐ-THUNG-CAI..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-mono font-bold"
            />
          </div>

          {/* Lookup Vật Tư */}
          <LookupField
            label="Vật Tư Áp Dụng (Để trống nếu dùng chung)"
            value={materialName}
            placeholder="Tra cứu để chọn vật tư liên kết..."
            onLookupClick={() => setActiveLookup('material')}
            onClear={() => {
              setMaterialId('');
              setMaterialName('');
            }}
            helperText="Tra cứu danh mục vật tư để quy đổi riêng cho 1 sản phẩm cụ thể"
          />

          <div className="grid grid-cols-2 gap-3">
            <LookupField
              label="Đơn Vị Nhập/Xuất (From)"
              required
              value={fromUnitName}
              placeholder="Tra cứu ĐVT..."
              onLookupClick={() => setActiveLookup('fromUnit')}
            />

            <LookupField
              label="Đơn Vị Cơ Sở (To)"
              required
              value={toUnitName}
              placeholder="Tra cứu ĐVT..."
              onLookupClick={() => setActiveLookup('toUnit')}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tỷ Lệ Quy Đổi (1 {fromUnitName || 'Đơn vị lớn'} = ... {toUnitName || 'Đơn vị gốc'}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={0.0001}
              step="any"
              required
              value={conversionFactor}
              onChange={e => setConversionFactor(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi Chú Công Thức
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={`Tự động: 1 ${fromUnitName || 'Thùng'} = ${conversionFactor} ${toUnitName || 'Cái'}`}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingConv(null); }}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Lưu Quy Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Master Lookup Modals */}
      {activeLookup === 'material' && (
        <MasterLookupModal
          isOpen={true}
          onClose={() => setActiveLookup(null)}
          title="Tra Cứu & Chọn Vật Tư"
          data={products}
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên Vật Tư / Sản Phẩm' },
            { key: 'category', label: 'Danh Mục' },
            { key: 'unit', label: 'ĐVT Gốc' }
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

      {(activeLookup === 'fromUnit' || activeLookup === 'toUnit') && (
        <MasterLookupModal
          isOpen={true}
          onClose={() => setActiveLookup(null)}
          title={`Tra Cứu & Chọn Đơn Vị Tính (${activeLookup === 'fromUnit' ? 'Đơn vị lớn' : 'Đơn vị gốc'})`}
          data={unitsOfMeasure}
          columns={[
            { key: 'code', label: 'Mã ĐVT' },
            { key: 'name', label: 'Tên Đơn Vị Tính' },
            { key: 'symbol', label: 'Ký Hiệu' }
          ]}
          searchFields={['code', 'name', 'symbol']}
          selectionMode="single"
          selectedIds={activeLookup === 'fromUnit' ? [fromUnitId] : [toUnitId]}
          onConfirm={(selected) => {
            if (selected[0]) {
              if (activeLookup === 'fromUnit') {
                setFromUnitId(selected[0].id);
                setFromUnitName(selected[0].name);
              } else {
                setToUnitId(selected[0].id);
                setToUnitName(selected[0].name);
              }
            }
          }}
        />
      )}
    </div>
  );
};
