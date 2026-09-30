import React, { useState, useMemo } from 'react';
import { Plus, MapPin, Search, Edit, Trash2, Warehouse as WarehouseIcon, CheckCircle2, Filter, X } from 'lucide-react';
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
import { StorageLocation, Warehouse, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';

interface LocationCategoryViewProps {
  storageLocations: StorageLocation[];
  warehouses: Warehouse[];
  onAddLocation?: (loc: StorageLocation) => void;
  onUpdateLocation?: (id: string, loc: Partial<StorageLocation>) => void;
  onDeleteLocation?: (id: string) => void;
  currentUser?: UserProfile;
}

export const LocationCategoryView: React.FC<LocationCategoryViewProps> = ({
  storageLocations: initialLocations = [],
  warehouses = [],
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_location_cat');

  const [localLocations, setLocalLocations] = useState<StorageLocation[]>(initialLocations);
  const storageLocations = initialLocations.length > 0 ? initialLocations : localLocations;

  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('Tất cả');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterCode, setFilterCode] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');

  const filteredLocations = useMemo(() => {
    return storageLocations.filter(loc => {
      const matchSearch = !searchTerm || (
        loc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.warehouseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.zone.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;
      if (zoneFilter !== 'Tất cả' && loc.zone !== zoneFilter) return false;
      if (filterCode && !loc.code.toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterName && !loc.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterWarehouse !== 'ALL' && loc.warehouseName !== filterWarehouse) return false;
      return true;
    });
  }, [storageLocations, searchTerm, zoneFilter, filterCode, filterName, filterWarehouse]);

  const activeFilterCount = (zoneFilter !== 'Tất cả' ? 1 : 0) + (filterCode ? 1 : 0) + (filterName ? 1 : 0) + (filterWarehouse !== 'ALL' ? 1 : 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<StorageLocation | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [zone, setZone] = useState('Khu A');
  const [rack, setRack] = useState('A1');
  const [shelf, setShelf] = useState('Tầng 1');
  const [capacity, setCapacity] = useState(100);
  const [currentOccupancy, setCurrentOccupancy] = useState(0);
  const [status, setStatus] = useState<'Còn chỗ' | 'Đầy' | 'Bảo trì'>('Còn chỗ');

  // Lookup Modal State
  const [showWarehouseLookup, setShowWarehouseLookup] = useState(false);

  const zonesList = ['Tất cả', ...Array.from(new Set(storageLocations.map(l => l.zone)))];

  const totalPages = Math.ceil(filteredLocations.length / pageSize) || 1;
  const paginatedList = filteredLocations.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenAddModal = () => {
    if (!perms.createEdit) {
      alert('Bạn không có quyền THÊM vị trí kho!');
      return;
    }
    const defaultWh = warehouses[0];
    setCode(`VT-A${Date.now().toString().slice(-3)}`);
    setName('Kệ A1 - Tầng 1 (Cửa vào)');
    setWarehouseId(defaultWh?.id || '');
    setWarehouseName(defaultWh?.name || '');
    setZone('Khu A');
    setRack('A1');
    setShelf('Tầng 1');
    setCapacity(100);
    setCurrentOccupancy(0);
    setStatus('Còn chỗ');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (l: StorageLocation) => {
    if (!perms.createEdit) {
      alert('Bạn không có quyền CHỈNH SỬA vị trí kho!');
      return;
    }
    setEditingLoc(l);
    setCode(l.code);
    setName(l.name);
    setWarehouseId(l.warehouseId);
    setWarehouseName(l.warehouseName);
    setZone(l.zone);
    setRack(l.rack);
    setShelf(l.shelf);
    setCapacity(l.capacity);
    setCurrentOccupancy(l.currentOccupancy);
    setStatus(l.status);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !warehouseId) return;

    if (editingLoc) {
      const updated = {
        code,
        name,
        warehouseId,
        warehouseName,
        zone,
        rack,
        shelf,
        capacity,
        currentOccupancy,
        status
      };
      if (onUpdateLocation) {
        onUpdateLocation(editingLoc.id, updated);
      } else {
        setLocalLocations(prev => prev.map(l => l.id === editingLoc.id ? { ...l, ...updated } : l));
      }
      setEditingLoc(null);
    } else {
      const newLoc: StorageLocation = {
        id: `LOC${Date.now().toString().slice(-4)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        warehouseId,
        warehouseName,
        zone,
        rack,
        shelf,
        capacity,
        currentOccupancy,
        status
      };
      if (onAddLocation) {
        onAddLocation(newLoc);
      } else {
        setLocalLocations(prev => [newLoc, ...prev]);
      }
      setShowAddModal(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!perms.delete) {
      alert('Bạn KHÔNG CÓ QUYỀN XÓA vị trí kho!');
      return;
    }
    if (confirm(`Xác nhận xóa vị trí "${name}"?`)) {
      if (onDeleteLocation) {
        onDeleteLocation(id);
      } else {
        setLocalLocations(prev => prev.filter(l => l.id !== id));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<MapPin />}
          title="Danh Mục Vị Trí Kho (Bin & Shelf Storage Locations)"
          count={filteredLocations.length}
          countLabel="Vị trí kho"
          subtitle="Quản lý chi tiết từng Phân Khu, Dãy, Kệ, Tầng, Hộc lưu trữ hàng hóa trong kho bãi"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalLocations([...initialLocations]);
            showToast.info('Đã tải lại danh mục vị trí kho!');
          }}
          onExportExcel={() => showToast.success('Đã xuất Excel vị trí kho!')}
          onImportExcel={() => showToast.info('Tính năng nhập Excel đang xử lý!')}
          addLabel="Thêm Vị Trí Kho"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.createEdit}
          filterPanelContent={
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Vị Trí Kho</label>
                <input
                  type="text"
                  placeholder="Mã vị trí..."
                  value={filterCode}
                  onChange={(e) => setFilterCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Tên Kệ / Vị Trí</label>
                <input
                  type="text"
                  placeholder="Tên kệ..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Kho Bãi</label>
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
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Phân Khu (Zone)</label>
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  {zonesList.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>
          }
          onClearFilter={() => {
            setFilterCode('');
            setFilterName('');
            setFilterWarehouse('ALL');
            setZoneFilter('Tất cả');
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
                placeholder="Tìm kiếm mã vị trí, tên kệ, kho bãi, phân khu..."
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Phân khu:</span>
              <select
                value={zoneFilter}
                onChange={(e) => {
                  setZoneFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden"
              >
                {zonesList.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">STT</th>
                  <th className="p-3">Mã Vị Trí</th>
                  <th className="p-3">Tên Kệ / Hộc Chứa</th>
                  <th className="p-3">Kho Bãi</th>
                  <th className="p-3">Phân Khu / Dãy / Tầng</th>
                  <th className="p-3 text-center">Sức Chứa Tối Đa</th>
                  <th className="p-3 text-center">Đang Tồn Chứa</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Chưa có vị trí kho nào. Bấm nút Thêm để bắt đầu khai báo.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((l, idx) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {l.code}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {l.name}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                        {l.warehouseName}
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300">
                          {l.zone} • Dãy {l.rack} • {l.shelf}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-400">
                        {l.capacity}
                      </td>
                      <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        {l.currentOccupancy}
                      </td>
                      <td className="p-3">
                        {l.status === 'Còn chỗ' ? (
                          <Badge variant="emerald" size="sm" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> Còn chỗ
                          </Badge>
                        ) : l.status === 'Đầy' ? (
                          <Badge variant="amber" size="sm" className="flex items-center gap-1 w-fit">
                            Đầy
                          </Badge>
                        ) : (
                          <Badge variant="secondary" size="sm" className="flex items-center gap-1 w-fit">
                            Bảo trì
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {perms.createEdit && (
                            <button
                              onClick={() => handleOpenEditModal(l)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg transition-colors cursor-pointer"
                              title="Sửa vị trí"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {perms.delete && (
                            <button
                              onClick={() => handleDelete(l.id, l.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                              title="Xóa vị trí"
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
            totalItems={filteredLocations.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>

      {/* Modal Add/Edit */}
      <Modal
        isOpen={showAddModal || !!editingLoc}
        onClose={() => { setShowAddModal(false); setEditingLoc(null); }}
        title={editingLoc ? 'Sửa Vị Trí Kho' : 'Khai Báo Vị Trí Kho / Kệ Chứa Mới'}
        maxWidth="3xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mã Vị Trí <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="VD: VT-A1-T1, KE-B2..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sức Chứa Tối Đa
              </label>
              <input
                type="number"
                min={1}
                required
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên Vị Trí / Mô Tả Kệ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Kệ A1 - Tầng 1 (Khu Điện tử cửa vào)..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
            />
          </div>

          <LookupField
            label="Thuộc Kho Bãi"
            required
            value={warehouseName}
            placeholder="Tra cứu chọn kho bãi..."
            onLookupClick={() => setShowWarehouseLookup(true)}
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phân Khu (Zone)
              </label>
              <input
                type="text"
                value={zone}
                onChange={e => setZone(e.target.value)}
                placeholder="Khu A"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dãy / Kệ (Rack)
              </label>
              <input
                type="text"
                value={rack}
                onChange={e => setRack(e.target.value)}
                placeholder="A1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tầng / Hộc (Shelf)
              </label>
              <input
                type="text"
                value={shelf}
                onChange={e => setShelf(e.target.value)}
                placeholder="Tầng 1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Trạng Thái Vị Trí
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100"
            >
              <option value="Còn chỗ">Còn chỗ</option>
              <option value="Đầy">Đầy</option>
              <option value="Bảo trì">Bảo trì</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setEditingLoc(null); }}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Lưu Vị Trí Kho
            </Button>
          </div>
        </form>
      </Modal>

      {/* Warehouse Lookup */}
      {showWarehouseLookup && (
        <MasterLookupModal
          isOpen={true}
          onClose={() => setShowWarehouseLookup(false)}
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
