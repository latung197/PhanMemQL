import React, { useState, useMemo } from 'react';
import { 
  FolderTree, 
  Edit, 
  Trash2, 
  Filter, 
  X, 
  Save, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { DeleteConfirmModal } from '../../../components/common/DeleteConfirmModal';
import { UserProfile, SubMenuKey } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';
import { CategoryItemModel, CategoryFilterCriteria, CategoryFormData } from './types';

interface CategoryFeatureViewProps {
  initialItems?: CategoryItemModel[];
  currentUser?: UserProfile;
  subKey?: SubMenuKey;
  onSaveItem?: (item: CategoryItemModel) => void;
  onDeleteItem?: (id: string) => void;
}

const DEFAULT_MOCK_DATA: CategoryItemModel[] = [
  {
    id: '1',
    code: 'CAT-001',
    name: 'Bản ghi mẫu số 01',
    categoryGroup: 'Nhóm A',
    description: 'Dữ liệu mẫu khởi tạo cho chức năng danh mục',
    status: 'Hoạt động',
    createdDate: '2026-05-10'
  },
  {
    id: '2',
    code: 'CAT-002',
    name: 'Bản ghi mẫu số 02',
    categoryGroup: 'Nhóm B',
    description: 'Dữ liệu kiểm thử bộ lọc và xuất excel',
    status: 'Hoạt động',
    createdDate: '2026-05-12'
  },
  {
    id: '3',
    code: 'CAT-003',
    name: 'Bản ghi tạm dừng 03',
    categoryGroup: 'Nhóm A',
    description: 'Dữ liệu mẫu trạng thái tạm ngưng sử dụng',
    status: 'Tạm dừng',
    createdDate: '2026-05-15'
  }
];

export const CategoryFeatureView: React.FC<CategoryFeatureViewProps> = ({
  initialItems = DEFAULT_MOCK_DATA,
  currentUser,
  subKey = 'inv_material_cat',
  onSaveItem,
  onDeleteItem
}) => {
  // 1. Phân quyền thao tác theo tài khoản đăng nhập (Xem, Thêm/Sửa, Xóa)
  const currentSubKey: SubMenuKey = (subKey || 'inv_material_cat') as SubMenuKey;
  const perms = getActionPermission(currentUser, currentSubKey);

  // 2. State dữ liệu danh sách
  const [items, setItems] = useState<CategoryItemModel[]>(initialItems);

  // 3. State bộ lọc nâng cao
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<CategoryFilterCriteria>({
    multiCodes: '',
    keyword: '',
    group: 'ALL',
    status: 'ALL'
  });
  const [appliedFilters, setAppliedFilters] = useState<CategoryFilterCriteria>({
    multiCodes: '',
    keyword: '',
    group: 'ALL',
    status: 'ALL'
  });

  // 4. State Modal Thêm / Chỉnh sửa
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CategoryItemModel | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    code: '',
    name: '',
    categoryGroup: 'Nhóm A',
    description: '',
    status: 'Hoạt động'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 5. State Modal Xác nhận Xóa
  const [itemToDelete, setItemToDelete] = useState<CategoryItemModel | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Danh sách các nhóm danh mục duy nhất
  const groupsList = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => { if (it.categoryGroup) set.add(it.categoryGroup); });
    return Array.from(set);
  }, [items]);

  // Đếm số lượng bộ lọc đang có hiệu lực
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.multiCodes.trim()) count++;
    if (appliedFilters.keyword.trim()) count++;
    if (appliedFilters.group !== 'ALL') count++;
    if (appliedFilters.status !== 'ALL') count++;
    return count;
  }, [appliedFilters]);

  // 6. Xử lý Lọc Dữ Liệu
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Lọc danh sách mã (phân cách bằng dấu phẩy)
      if (appliedFilters.multiCodes.trim()) {
        const codes = appliedFilters.multiCodes
          .split(',')
          .map(c => c.trim().toLowerCase())
          .filter(Boolean);
        if (codes.length > 0 && !codes.some(c => item.code.toLowerCase().includes(c))) {
          return false;
        }
      }

      // Lọc từ khóa tên / mô tả
      if (appliedFilters.keyword.trim()) {
        const kw = appliedFilters.keyword.toLowerCase();
        const matchName = item.name.toLowerCase().includes(kw);
        const matchDesc = item.description?.toLowerCase().includes(kw);
        if (!matchName && !matchDesc) return false;
      }

      // Lọc theo nhóm
      if (appliedFilters.group !== 'ALL' && item.categoryGroup !== appliedFilters.group) {
        return false;
      }

      // Lọc theo trạng thái
      if (appliedFilters.status !== 'ALL' && item.status !== appliedFilters.status) {
        return false;
      }

      return true;
    });
  }, [items, appliedFilters]);

  // Áp dụng bộ lọc
  const handleApplyFilter = () => {
    setAppliedFilters({ ...filterCriteria });
    showToast.info('Đã áp dụng bộ lọc dữ liệu!');
  };

  // Xóa trắng bộ lọc
  const handleClearFilter = () => {
    const reset: CategoryFilterCriteria = {
      multiCodes: '',
      keyword: '',
      group: 'ALL',
      status: 'ALL'
    };
    setFilterCriteria(reset);
    setAppliedFilters(reset);
    showToast.info('Đã xóa bộ lọc, hiển thị tất cả bản ghi!');
  };

  // Mở modal Thêm mới
  const handleOpenAdd = () => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền thêm mới danh mục này!');
      return;
    }
    setEditingItem(null);
    setFormData({
      code: `CAT-${(items.length + 1).toString().padStart(3, '0')}`,
      name: '',
      categoryGroup: 'Nhóm A',
      description: '',
      status: 'Hoạt động'
    });
    setErrors({});
    setShowModal(true);
  };

  // Mở modal Sửa
  const handleOpenEdit = (item: CategoryItemModel) => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền chỉnh sửa danh mục này!');
      return;
    }
    setEditingItem(item);
    setFormData({ ...item });
    setErrors({});
    setShowModal(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.code?.trim()) errs.code = 'Mã không được để trống!';
    if (!formData.name?.trim()) errs.name = 'Tên không được để trống!';

    // Kiểm tra trùng mã khi tạo mới
    if (!editingItem) {
      const isDuplicate = items.some(it => it.code.trim().toLowerCase() === formData.code?.trim().toLowerCase());
      if (isDuplicate) errs.code = 'Mã này đã tồn tại trong hệ thống!';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Lưu bản ghi (Thêm / Cập nhật)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingItem) {
      // Cập nhật
      const updated: CategoryItemModel = {
        ...editingItem,
        ...formData,
        code: formData.code!.trim().toUpperCase(),
        name: formData.name!.trim()
      };
      setItems(prev => prev.map(it => it.id === editingItem.id ? updated : it));
      onSaveItem?.(updated);
      showToast.success(`Đã cập nhật bản ghi [${updated.code}]!`);
    } else {
      // Thêm mới
      const newItem: CategoryItemModel = {
        id: Date.now().toString(),
        code: formData.code!.trim().toUpperCase(),
        name: formData.name!.trim(),
        categoryGroup: formData.categoryGroup || 'Nhóm A',
        description: formData.description || '',
        status: formData.status || 'Hoạt động',
        createdDate: new Date().toISOString().split('T')[0]
      };
      setItems(prev => [newItem, ...prev]);
      onSaveItem?.(newItem);
      showToast.success(`Đã thêm mới bản ghi [${newItem.code}] thành công!`);
    }

    setShowModal(false);
  };

  // Xóa 1 bản ghi
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    setItems(prev => prev.filter(it => it.id !== itemToDelete.id));
    onDeleteItem?.(itemToDelete.id);
    showToast.success(`Đã xóa bản ghi [${itemToDelete.code}]!`);
    setItemToDelete(null);
  };

  // Xóa hàng loạt bản ghi
  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const strIds = bulkToDeleteIds.map(String);
    setItems(prev => prev.filter(it => !strIds.includes(it.id)));
    showToast.success(`Đã xóa thành công ${bulkToDeleteIds.length} bản ghi được chọn!`);
    setBulkToDeleteIds(null);
  };

  // Xuất Excel
  const handleExportExcel = () => {
    showToast.success(`Đã xuất file Excel ${filteredItems.length} bản ghi!`);
  };

  // Nhập Excel
  const handleImportExcel = () => {
    showToast.info('Chọn tệp Excel (.xlsx, .csv) để nhập dữ liệu hàng loạt.');
  };

  // Cấu hình các cột hiển thị trong GridView
  const columns: GridViewColumn<CategoryItemModel>[] = [
    {
      key: 'code',
      header: 'Mã Danh Mục',
      accessor: (it) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {it.code}
        </span>
      ),
      sortable: true,
      width: '140px'
    },
    {
      key: 'name',
      header: 'Tên Danh Mục',
      accessor: (it) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{it.name}</p>
          {it.description && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-xs">{it.description}</p>
          )}
        </div>
      ),
      sortable: true
    },
    {
      key: 'categoryGroup',
      header: 'Nhóm Phân Loại',
      accessor: (it) => it.categoryGroup || '---',
      sortable: true,
      width: '150px'
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      accessor: (it) => (
        <Badge variant={it.status === 'Hoạt động' ? 'emerald' : 'rose'}>
          {it.status}
        </Badge>
      ),
      sortable: true,
      align: 'center',
      width: '120px'
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'center',
      width: '90px',
      accessor: (it) => (
        <div className="flex items-center justify-center gap-1">
          {perms.createEdit && (
            <button
              onClick={() => handleOpenEdit(it)}
              className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px] transition-colors"
              title="Chỉnh sửa"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {perms.delete && (
            <button
              onClick={() => setItemToDelete(it)}
              className="p-1 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[5px] transition-colors"
              title="Xóa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="w-full min-w-full flex-1 flex flex-col min-h-0 space-y-3">
      {/* 1. Header Toolbar Tiêu Chuẩn */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<FolderTree className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
          title="Khai Báo Danh Mục Tiêu Chuẩn (Template)"
          subtitle="Mẫu chức năng danh mục chuẩn: Thêm, sửa, xóa, lọc nâng cao, xuất/nhập Excel"
          count={filteredItems.length}
          countLabel="Bản ghi"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setItems([...initialItems]);
            showToast.info('Đã tải lại dữ liệu danh mục!');
          }}
          onExportExcel={handleExportExcel}
          onImportExcel={handleImportExcel}
          addLabel="Thêm Mới"
          onOpenAdd={handleOpenAdd}
          canCreate={perms.createEdit}
          filterPanelContent={
            /* 2. Bộ lọc nâng cao: Nền sáng / tối chuẩn, bo góc 5px */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Mã (phân cách dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="VD: CAT-001, CAT-002"
                  value={filterCriteria.multiCodes}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, multiCodes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Từ Khóa Tên / Mô Tả
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên cần tìm..."
                  value={filterCriteria.keyword}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, keyword: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Nhóm Phân Loại
                </label>
                <select
                  value={filterCriteria.group}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, group: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả các nhóm</option>
                  {groupsList.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                  Trạng Thái Hoạt Động
                </label>
                <select
                  value={filterCriteria.status}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm dừng">Tạm dừng</option>
                </select>
              </div>
            </div>
          }
          onApplyFilter={handleApplyFilter}
          onClearFilter={handleClearFilter}
        />
      </div>

      {/* 3. Lưới Hiển Thị GridView Tiêu Chuẩn */}
      <GridView<CategoryItemModel>
        data={filteredItems}
        columns={columns}
        searchPlaceholder="Tìm nhanh theo mã hoặc tên danh mục..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable={perms.delete}
        batchActions={[
          {
            label: 'Xóa các bản ghi đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Bạn không có quyền xóa dữ liệu!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* 4. Modal Thêm / Chỉnh Sửa Bản Ghi */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? `Chỉnh Sửa Bản Ghi: [${editingItem.code}]` : 'Khai Báo Bản Ghi Danh Mục Mới'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Mã Danh Mục <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="VD: CAT-001"
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${
                  errors.code ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                } text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-mono font-bold focus:ring-1 focus:ring-indigo-500`}
              />
              {errors.code && <p className="text-rose-500 text-[10px] mt-1">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Nhóm Phân Loại
              </label>
              <input
                type="text"
                value={formData.categoryGroup}
                onChange={(e) => setFormData({ ...formData, categoryGroup: e.target.value })}
                placeholder="VD: Nhóm A, Nhóm B..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Tên Danh Mục <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nhập tên danh mục..."
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${
                  errors.name ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                } text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-semibold focus:ring-1 focus:ring-indigo-500`}
              />
              {errors.name && <p className="text-rose-500 text-[10px] mt-1">{errors.name}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Mô Tả / Ghi Chú
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ghi chú chi tiết thêm..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Trạng Thái Sử Dụng
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Hoạt động">Hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Hủy Bỏ
            </Button>
            <Button type="submit" icon={<Save className="h-4 w-4" />}>
              Lưu Dữ Liệu
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Modal Xác Nhận Xóa Đơn Lẻ */}
      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác Nhận Xóa Bản Ghi Danh Mục"
        message={`Bạn có chắc chắn muốn xóa bản ghi [${itemToDelete?.code} - ${itemToDelete?.name}]? Dữ liệu đã xóa sẽ không thể hoàn tác.`}
      />

      {/* 6. Modal Xác Nhận Xóa Hàng Loạt */}
      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        title="Xác Nhận Xóa Nhiều Bản Ghi"
        message={`Bạn có chắc chắn muốn xóa ${bulkToDeleteIds?.length} bản ghi đã chọn? Thao tác này sẽ xóa vĩnh viễn khỏi danh sách.`}
      />
    </div>
  );
};
