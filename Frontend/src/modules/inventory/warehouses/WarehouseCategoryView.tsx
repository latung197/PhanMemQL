import React, { useState, useMemo } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  MapPin, 
  User, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Warehouse as WarehouseType, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';

interface WarehouseCategoryViewProps {
  warehouses: WarehouseType[];
  onAddWarehouse: (wh: WarehouseType) => void;
  onUpdateWarehouse?: (id: string, wh: Partial<WarehouseType>) => void;
  onDeleteWarehouse?: (id: string) => void;
  currentUser?: UserProfile;
}

export const WarehouseCategoryView: React.FC<WarehouseCategoryViewProps> = ({
  warehouses: initialWarehouses,
  onAddWarehouse,
  onUpdateWarehouse,
  onDeleteWarehouse,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_warehouse_cat');

  const [localWarehouses, setLocalWarehouses] = useState<WarehouseType[]>(initialWarehouses);

  React.useEffect(() => {
    setLocalWarehouses(initialWarehouses);
  }, [initialWarehouses]);

  const warehouses = localWarehouses;

  // Single & Bulk Delete confirmation modal states
  const [itemToDelete, setItemToDelete] = useState<WarehouseType | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Collapsible Advanced Filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState(''); // e.g. "KH01, KH02"
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    status: 'ALL'
  });

  // Modal & Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWh, setEditingWh] = useState<WarehouseType | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');
  const [capacity, setCapacity] = useState('2,500 m2');
  const [status, setStatus] = useState<WarehouseType['status']>('Đang hoạt động');

  const handleApplyFilter = () => {
    const parsedCodes = filterMultiCodes
      .split(/[,;\s]+/)
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    setAppliedFilters({
      name: filterName.trim().toLowerCase(),
      codes: parsedCodes,
      status: filterStatus
    });
    showToast.info('Đã áp dụng bộ lọc danh mục Kho bãi!');
  };

  const handleClearFilter = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterStatus('ALL');
    setAppliedFilters({ name: '', codes: [], status: 'ALL' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => {
      // 1. Multi-code filter
      if (appliedFilters.codes.length > 0) {
        const itemCode = w.code.toLowerCase();
        const matchesCode = appliedFilters.codes.some(c => itemCode.includes(c));
        if (!matchesCode) return false;
      }

      // 2. Keyword filter (name, address, manager)
      if (appliedFilters.name) {
        const matchName = w.name.toLowerCase().includes(appliedFilters.name) ||
                          w.code.toLowerCase().includes(appliedFilters.name) ||
                          w.address.toLowerCase().includes(appliedFilters.name) ||
                          (w.manager && w.manager.toLowerCase().includes(appliedFilters.name));
        if (!matchName) return false;
      }

      // 3. Status filter
      if (appliedFilters.status !== 'ALL') {
        const wStatus = w.status || 'Đang hoạt động';
        if (wStatus !== appliedFilters.status) return false;
      }

      return true;
    });
  }, [warehouses, appliedFilters]);

  // Handle Export Excel
  const handleExportExcel = () => {
    const headers = ['Mã Kho', 'Tên Địa Điểm Kho', 'Địa Chỉ', 'Thủ Kho Phụ Trách', 'Sức Chứa', 'Trạng Thái'];
    const csvRows = [headers.join(',')];

    filteredWarehouses.forEach(w => {
      const row = [
        `"${w.code}"`,
        `"${w.name.replace(/"/g, '""')}"`,
        `"${(w.address || '').replace(/"/g, '""')}"`,
        `"${(w.manager || '').replace(/"/g, '""')}"`,
        `"${w.capacity || ''}"`,
        `"${w.status || 'Đang hoạt động'}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Danh_muc_Kho_Bai_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel danh mục kho bãi thành công!');
  };

  // Handle Import Excel
  const handleImportExcel = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền NHẬP DỮ LIỆU Kho bãi!');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast.success(`Đã nhận file "${file.name}". Đang đồng bộ vào hệ thống...`);
      }
    };
    input.click();
  };

  // Open Handlers
  const handleOpenAdd = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền KHAI BÁO KHO MỚI!');
      return;
    }
    setEditingWh(null);
    setName('');
    setCode(`KH${(warehouses.length + 1).toString().padStart(2, '0')}`);
    setAddress('');
    setManager('Trần Thịnh');
    setCapacity('2,500 m2');
    setStatus('Đang hoạt động');
    setShowAddModal(true);
  };

  const handleOpenEdit = (wh: WarehouseType) => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn chỉ có quyền XEM, không có quyền SỬA!');
      return;
    }
    setEditingWh(wh);
    setName(wh.name);
    setCode(wh.code);
    setAddress(wh.address);
    setManager(wh.manager || '');
    setCapacity(wh.capacity || '2,500 m2');
    setStatus(wh.status || 'Đang hoạt động');
  };

  const handleDeleteClick = (wh: WarehouseType) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA KHO BÃI!');
      return;
    }
    setItemToDelete(wh);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;
    if (onDeleteWarehouse) {
      onDeleteWarehouse(id);
    }
    setLocalWarehouses(prev => prev.filter(w => w.id !== id));
    showToast.success(`Đã xóa thành công kho "${name}"!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const count = bulkToDeleteIds.length;
    bulkToDeleteIds.forEach(id => {
      if (onDeleteWarehouse) {
        onDeleteWarehouse(String(id));
      }
    });
    setLocalWarehouses(prev => prev.filter(w => !bulkToDeleteIds.includes(w.id)));
    showToast.success(`Đã xóa thành công ${count} kho đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showToast.error('Vui lòng nhập Tên kho và Mã kho!');
      return;
    }

    if (editingWh) {
      const updated = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim(),
        manager: manager.trim(),
        capacity,
        status
      };

      if (onUpdateWarehouse) {
        onUpdateWarehouse(editingWh.id, updated);
      } else {
        setLocalWarehouses(prev => prev.map(w => w.id === editingWh.id ? { ...w, ...updated } : w));
      }
      setEditingWh(null);
      showToast.success(`Cập nhật thông tin kho "${name}" thành công!`);
    } else {
      const newWh: WarehouseType = {
        id: `KH${String(warehouses.length + 1).padStart(3, '0')}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address: address.trim() || 'Chi nhánh toàn quốc',
        manager: manager.trim() || 'Trần Thịnh',
        capacity,
        status
      };

      if (onAddWarehouse) {
        onAddWarehouse(newWh);
      } else {
        setLocalWarehouses(prev => [...prev, newWh]);
      }
      setShowAddModal(false);
      showToast.success(`Khai báo kho mới "${name}" thành công!`);
    }
  };

  // Grid Columns
  const columns: GridViewColumn<WarehouseType>[] = [
    {
      key: 'code',
      title: 'Mã Kho',
      sortable: true,
      width: '120px',
      render: (item) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {item.code}
        </span>
      )
    },
    {
      key: 'name',
      title: 'Tên Địa Điểm Kho Bãi',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            <span>{item.address || 'Chưa cập nhật địa chỉ'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'manager',
      title: 'Thủ Kho Phụ Trách',
      width: '180px',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{item.manager || '—'}</span>
        </div>
      )
    },
    {
      key: 'capacity',
      title: 'Sức Chứa / Quy Mô',
      width: '150px',
      render: (item) => (
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {item.capacity || '—'}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Trạng Thái',
      sortable: true,
      width: '130px',
      align: 'center',
      render: (item) => (
        <Badge variant={item.status === 'Đang hoạt động' ? 'success' : 'neutral'} size="sm">
          {item.status || 'Đang hoạt động'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Thao Tác',
      width: '100px',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Sửa kho"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa kho"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const activeFilterCount = (appliedFilters.codes.length > 0 ? 1 : 0) + (appliedFilters.name ? 1 : 0) + (appliedFilters.status !== 'ALL' ? 1 : 0);

  return (
    <div className="w-full min-w-full space-y-4">
      
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<WarehouseIcon />}
          title="Khai Báo Danh Mục Kho Bãi"
          count={filteredWarehouses.length}
          countLabel="Kho"
          subtitle="Quản lý vị trí địa lý, thủ kho phụ trách, sức chứa & phân quyền quản lý từng điểm kho"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalWarehouses([...initialWarehouses]);
            showToast.info('Đã tải lại danh mục Kho bãi!');
          }}
          onExportExcel={handleExportExcel}
          onImportExcel={handleImportExcel}
          addLabel="Khai Báo Kho Mới"
          onOpenAdd={handleOpenAdd}
          canCreate={perms.createEdit}
        />

        {/* Collapsible Advanced Search Bar */}
        {showAdvancedFilter && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Kho Hàng Loạt (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="VD: KH01, KH02, KH_HCM"
                value={filterMultiCodes}
                onChange={(e) => setFilterMultiCodes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên / Địa Chỉ / Thủ Kho</label>
              <input
                type="text"
                placeholder="VD: Kho Cần Thơ, Nguyễn Văn A..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Trạng Thái Hoạt Động</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả Trạng thái</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <Button size="sm" variant="outline" onClick={handleClearFilter} className="text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-3.5 w-3.5 mr-1" /> Xóa bộ lọc
              </Button>
              <Button size="sm" onClick={handleApplyFilter} icon={<Filter className="h-3.5 w-3.5" />}>
                Áp Dụng Lọc
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* GridView Component */}
      <GridView<WarehouseType>
        data={filteredWarehouses}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh tên kho, mã kho, thủ kho, địa chỉ..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa các kho đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Kho bãi!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingWh}
        onClose={() => {
          setShowAddModal(false);
          setEditingWh(null);
        }}
        title={editingWh ? `Chỉnh Sửa Địa Điểm Kho: ${editingWh.code}` : 'Khai Báo Thêm Mới Kho Bãi'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Mã Kho <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: KH01, KH_HCM..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Tên Địa Điểm Kho Bãi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Kho Trung Luân Cần Thơ..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Thủ Kho Phụ Trách</label>
              <input
                type="text"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Sức Chứa / Quy Mô</label>
              <input
                type="text"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="VD: 3,500 m2"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Địa Chỉ Địa Lý Kho</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: Lô B2, KCN Tân Bình, Quận Tân Phú, TP. Hồ Chí Minh"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Trạng Thái Kho</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingWh(null);
              }}
            >
              Hủy Bỏ
            </Button>
            <Button type="submit">
              {editingWh ? 'Lưu Thay Đổi' : 'Khai Báo Kho'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Xác nhận xóa địa điểm Kho bãi"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Bạn có chắc chắn muốn xóa kho?</p>
              <p>
                Kho <span className="font-bold text-slate-900 dark:text-white">"{itemToDelete?.name}"</span> (Mã: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemToDelete?.code}</span>) sẽ bị loại bỏ khỏi danh mục.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">Lưu ý: Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)}>
              Hủy bỏ
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmSingleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Xác Nhận Xóa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        title="Xác nhận xóa hàng loạt Kho bãi"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Xác nhận xóa {bulkToDeleteIds?.length} kho đã chọn?</p>
              <p>
                Toàn bộ <span className="font-bold text-slate-900 dark:text-white">{bulkToDeleteIds?.length} địa điểm kho</span> sẽ bị xóa khỏi danh mục.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">Lưu ý: Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setBulkToDeleteIds(null)}>
              Hủy bỏ
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Xác Nhận Xóa ({bulkToDeleteIds?.length})
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
