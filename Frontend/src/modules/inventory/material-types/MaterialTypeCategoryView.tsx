import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Tag, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  Filter, 
  X,
  Layers
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { MaterialType, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';

interface MaterialTypeCategoryViewProps {
  materialTypes: MaterialType[];
  onAddMaterialType?: (mt: MaterialType) => void;
  onUpdateMaterialType?: (id: string, mt: Partial<MaterialType>) => void;
  onDeleteMaterialType?: (id: string) => void;
  currentUser?: UserProfile;
}

export const MaterialTypeCategoryView: React.FC<MaterialTypeCategoryViewProps> = ({
  materialTypes: initialTypes = [],
  onAddMaterialType,
  onUpdateMaterialType,
  onDeleteMaterialType,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_material_type_cat');

  const [localTypes, setLocalTypes] = useState<MaterialType[]>(initialTypes);

  React.useEffect(() => {
    setLocalTypes(initialTypes);
  }, [initialTypes]);

  const materialTypes = localTypes;

  // Single & Bulk Delete state
  const [itemToDelete, setItemToDelete] = useState<MaterialType | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Collapsible Advanced Filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState('');
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    group: 'ALL',
    status: 'ALL'
  });

  // Modal & Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingType, setEditingType] = useState<MaterialType | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Vật tư sản xuất');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Hoạt động' | 'Tạm dừng'>('Hoạt động');

  const groupsList = useMemo(() => {
    return Array.from(new Set(materialTypes.map(t => t.group).filter(Boolean)));
  }, [materialTypes]);

  const handleApplyFilter = () => {
    const parsedCodes = filterMultiCodes
      .split(/[,;\s]+/)
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    setAppliedFilters({
      name: filterName.trim().toLowerCase(),
      codes: parsedCodes,
      group: filterGroup,
      status: filterStatus
    });
    showToast.info('Đã áp dụng bộ lọc Loại vật tư!');
  };

  const handleClearFilter = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterGroup('ALL');
    setFilterStatus('ALL');
    setAppliedFilters({ name: '', codes: [], group: 'ALL', status: 'ALL' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredTypes = useMemo(() => {
    return materialTypes.filter(t => {
      // 1. Multi-code filter
      if (appliedFilters.codes.length > 0) {
        const itemCode = t.code.toLowerCase();
        const matchesCode = appliedFilters.codes.some(c => itemCode.includes(c));
        if (!matchesCode) return false;
      }

      // 2. Keyword filter
      if (appliedFilters.name) {
        const matchName = t.name.toLowerCase().includes(appliedFilters.name) ||
                          t.code.toLowerCase().includes(appliedFilters.name) ||
                          (t.description && t.description.toLowerCase().includes(appliedFilters.name));
        if (!matchName) return false;
      }

      // 3. Group filter
      if (appliedFilters.group !== 'ALL' && t.group !== appliedFilters.group) {
        return false;
      }

      // 4. Status filter
      if (appliedFilters.status !== 'ALL' && t.status !== appliedFilters.status) {
        return false;
      }

      return true;
    });
  }, [materialTypes, appliedFilters]);

  // Export Excel
  const handleExportExcel = () => {
    const headers = ['Mã Loại', 'Tên Loại Vật Tư', 'Nhóm', 'Mô Tả', 'Trạng Thái'];
    const csvRows = [headers.join(',')];

    filteredTypes.forEach(t => {
      const row = [
        `"${t.code}"`,
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.group || ''}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${t.status || 'Hoạt động'}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Loai_Vat_Tu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel loại vật tư thành công!');
  };

  // Import Excel
  const handleImportExcel = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền NHẬP DỮ LIỆU Loại vật tư!');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast.success(`Đã nhận file "${file.name}". Đang nhập dữ liệu...`);
      }
    };
    input.click();
  };

  // Open Handlers
  const handleOpenAddModal = () => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền THÊM hoặc SỬA danh mục loại vật tư!');
      return;
    }
    setEditingType(null);
    setCode(`MT-${Date.now().toString().slice(-4)}`);
    setName('');
    setGroup('Vật tư sản xuất');
    setDescription('');
    setStatus('Hoạt động');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (mt: MaterialType) => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền CHỈNH SỬA loại vật tư này!');
      return;
    }
    setEditingType(mt);
    setCode(mt.code);
    setName(mt.name);
    setGroup(mt.group);
    setDescription(mt.description || '');
    setStatus(mt.status);
  };

  const handleDeleteClick = (mt: MaterialType) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA loại vật tư!');
      return;
    }
    setItemToDelete(mt);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;
    if (onDeleteMaterialType) {
      onDeleteMaterialType(id);
    }
    setLocalTypes(prev => prev.filter(t => t.id !== id));
    showToast.success(`Đã xóa loại vật tư "${name}" thành công!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const count = bulkToDeleteIds.length;
    bulkToDeleteIds.forEach(id => {
      if (onDeleteMaterialType) {
        onDeleteMaterialType(String(id));
      }
    });
    setLocalTypes(prev => prev.filter(t => !bulkToDeleteIds.includes(t.id)));
    showToast.success(`Đã xóa thành công ${count} loại vật tư đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      showToast.error('Vui lòng điền đầy đủ Mã loại và Tên loại vật tư!');
      return;
    }

    if (editingType) {
      const updated = { code: code.trim().toUpperCase(), name: name.trim(), group, description: description.trim(), status };
      if (onUpdateMaterialType) {
        onUpdateMaterialType(editingType.id, updated);
      } else {
        setLocalTypes(prev => prev.map(t => t.id === editingType.id ? { ...t, ...updated } : t));
      }
      setEditingType(null);
      showToast.success('Cập nhật loại vật tư thành công!');
    } else {
      const newType: MaterialType = {
        id: `LVT-${Date.now()}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        group,
        description: description.trim(),
        status
      };
      if (onAddMaterialType) {
        onAddMaterialType(newType);
      } else {
        setLocalTypes(prev => [...prev, newType]);
      }
      setShowAddModal(false);
      showToast.success('Tạo loại vật tư mới thành công!');
    }
  };

  // Grid Columns
  const columns: GridViewColumn<MaterialType>[] = [
    {
      key: 'code',
      title: 'Mã Loại',
      sortable: true,
      width: '130px',
      render: (item) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {item.code}
        </span>
      )
    },
    {
      key: 'name',
      title: 'Tên Loại Vật Tư / Hàng Hóa',
      sortable: true,
      render: (item) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {item.name}
        </span>
      )
    },
    {
      key: 'group',
      title: 'Nhóm Phân Loại',
      sortable: true,
      width: '180px',
      render: (item) => (
        <Badge variant="indigo" size="sm" className="font-semibold">{item.group}</Badge>
      )
    },
    {
      key: 'description',
      title: 'Mô Tả / Quy Cách Chức Năng',
      render: (item) => (
        <span className="text-slate-500 max-w-xs truncate block">
          {item.description || '—'}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Trạng Thái',
      sortable: true,
      width: '120px',
      align: 'center',
      render: (item) => (
        <Badge variant={item.status === 'Hoạt động' ? 'success' : 'neutral'} size="sm">
          {item.status}
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
            onClick={() => handleOpenEditModal(item)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Sửa loại vật tư"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa loại vật tư"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const activeFilterCount = (appliedFilters.codes.length > 0 ? 1 : 0) + (appliedFilters.name ? 1 : 0) + (appliedFilters.group !== 'ALL' ? 1 : 0) + (appliedFilters.status !== 'ALL' ? 1 : 0);

  return (
    <div className="w-full min-w-full space-y-4">
      
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<Tag />}
          title="Danh Mục Loại Vật Tư & Hàng Hóa"
          count={filteredTypes.length}
          countLabel="Loại"
          subtitle="Phân loại vật tư sản xuất, công cụ dụng cụ, thành phẩm, hàng hóa thương mại"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalTypes([...initialTypes]);
            showToast.info('Đã làm mới danh mục Loại vật tư!');
          }}
          onExportExcel={handleExportExcel}
          onImportExcel={handleImportExcel}
          addLabel="Khai Báo Loại Mới"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.createEdit}
        />

        {/* Collapsible Advanced Search Bar */}
        {showAdvancedFilter && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 animate-fade-in text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Loại (dấu phẩy phân cách)</label>
              <input
                type="text"
                placeholder="VD: MT01, MT02"
                value={filterMultiCodes}
                onChange={(e) => setFilterMultiCodes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên / Mô Tả</label>
              <input
                type="text"
                placeholder="VD: Inox, Thép tấm..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Nhóm Phân Loại</label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả Nhóm</option>
                {groupsList.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Trạng Thái</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả Trạng thái</option>
                <option value="Hoạt động">Hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>

            <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
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
      <GridView<MaterialType>
        data={filteredTypes}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh mã loại, tên loại vật tư, mô tả..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa các loại vật tư đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Loại vật tư!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingType}
        onClose={() => {
          setShowAddModal(false);
          setEditingType(null);
        }}
        title={editingType ? `Sửa Loại Vật Tư: ${editingType.code}` : 'Khai Báo Thêm Loại Vật Tư Mới'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Mã Loại Vật Tư <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: NVL_INOX, VT_MAY..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Tên Loại Vật Tư <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Nguyên vật liệu Inox Tấm..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Nhóm Phân Loại</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Vật tư sản xuất">Vật tư sản xuất</option>
                <option value="Thiết bị linh kiện">Thiết bị linh kiện</option>
                <option value="Bao bì & Vật liệu phụ">Bao bì & Vật liệu phụ</option>
                <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                <option value="Hàng hóa thương mại">Hàng hóa thương mại</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Trạng Thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Hoạt động">Hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">Mô Tả Chi Tiết / Quy Cách</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả quy cách vật tư..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingType(null);
              }}
            >
              Hủy Bỏ
            </Button>
            <Button type="submit">
              {editingType ? 'Lưu Thay Đổi' : 'Tạo Loại Vật Tư'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single Delete Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Xác nhận xóa loại vật tư"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Bạn có chắc chắn muốn xóa?</p>
              <p>
                Loại vật tư <span className="font-bold text-slate-900 dark:text-white">"{itemToDelete?.name}"</span> (Mã: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemToDelete?.code}</span>) sẽ bị xoá khỏi danh mục.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)}>
              Hủy
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmSingleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Xác Nhận Xóa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        title="Xác nhận xóa hàng loạt loại vật tư"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Xóa {bulkToDeleteIds?.length} loại vật tư?</p>
              <p>Toàn bộ các loại vật tư đã chọn sẽ bị gỡ khỏi danh mục.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setBulkToDeleteIds(null)}>
              Hủy
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Xác Nhận Xóa ({bulkToDeleteIds?.length})
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
