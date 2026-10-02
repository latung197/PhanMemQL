import React, { useState, useMemo } from 'react';
import { Tag, Edit, Trash2 } from 'lucide-react';
import { CategoryHeaderToolbar } from './CategoryHeaderToolbar';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { GridView, GridViewColumn } from './GridView';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { UserProfile } from '../../types';
import { getActionPermission } from '../../mock/initialRoles';
import { showToast } from '../../utils/toast';

/**
 * CATEGORY VIEW TEMPLATE (MẪU DANH MỤC TIÊU CHUẨN)
 * Có thể sao chép (copy) file này để tạo bất kỳ giao diện Quản lý Danh mục nào mới!
 */

export interface SampleCategoryItem {
  id: string;
  code: string;
  name: string;
  status: 'Hoạt động' | 'Tạm dừng';
}

interface CategoryViewTemplateProps {
  items?: SampleCategoryItem[];
  currentUser?: UserProfile;
}

export const CategoryViewTemplate: React.FC<CategoryViewTemplateProps> = ({
  items: initialItems = [
    { id: '1', code: 'CAT001', name: 'Mẫu Danh Mục 01', status: 'Hoạt động' },
    { id: '2', code: 'CAT002', name: 'Mẫu Danh Mục 02', status: 'Tạm dừng' }
  ],
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_material_cat');

  const [items, setItems] = useState<SampleCategoryItem[]>(initialItems);

  // Search & Filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterCode, setFilterCode] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    code: '',
    name: '',
    status: 'ALL'
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SampleCategoryItem | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'Hoạt động' | 'Tạm dừng'>('Hoạt động');

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<SampleCategoryItem | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Filter handlers
  const handleApplyFilter = () => {
    setAppliedFilters({
      code: filterCode.trim().toLowerCase(),
      name: filterName.trim().toLowerCase(),
      status: filterStatus
    });
    showToast.info('Đã áp dụng bộ lọc!');
  };

  const handleClearFilter = () => {
    setFilterCode('');
    setFilterName('');
    setFilterStatus('ALL');
    setAppliedFilters({ code: '', name: '', status: 'ALL' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (appliedFilters.code && !item.code.toLowerCase().includes(appliedFilters.code)) return false;
      if (appliedFilters.name && !item.name.toLowerCase().includes(appliedFilters.name)) return false;
      if (appliedFilters.status !== 'ALL' && item.status !== appliedFilters.status) return false;
      return true;
    });
  }, [items, appliedFilters]);

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      showToast.error('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, code, name, status } : i));
      setEditingItem(null);
      showToast.success(`Cập nhật "${name}" thành công!`);
    } else {
      const newItem: SampleCategoryItem = {
        id: `ID-${Date.now()}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        status
      };
      setItems(prev => [newItem, ...prev]);
      setShowAddModal(false);
      showToast.success(`Thêm mới "${name}" thành công!`);
    }
  };

  // Single Delete
  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
    showToast.success(`Đã xóa "${itemToDelete.name}"!`);
    setItemToDelete(null);
  };

  // Bulk Delete
  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds) return;
    setItems(prev => prev.filter(i => !bulkToDeleteIds.includes(i.id)));
    showToast.success(`Đã xóa ${bulkToDeleteIds.length} mục đã chọn!`);
    setBulkToDeleteIds(null);
  };

  // Table Columns
  const columns: GridViewColumn<SampleCategoryItem>[] = [
    {
      key: 'code',
      title: 'Mã Danh Mục',
      sortable: true,
      width: '140px',
      render: (item) => <span className="font-mono font-bold text-indigo-600">{item.code}</span>
    },
    {
      key: 'name',
      title: 'Tên Danh Mục',
      sortable: true,
      render: (item) => <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
    },
    {
      key: 'status',
      title: 'Trạng Thái',
      sortable: true,
      width: '130px',
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
            onClick={() => {
              setEditingItem(item);
              setCode(item.code);
              setName(item.name);
              setStatus(item.status);
            }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setItemToDelete(item)}
            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const activeFilterCount = (appliedFilters.code ? 1 : 0) + (appliedFilters.name ? 1 : 0) + (appliedFilters.status !== 'ALL' ? 1 : 0);

  return (
    <div className="w-full min-w-full space-y-4">
      {/* Unified Header Toolbar */}
      <CategoryHeaderToolbar
        icon={<Tag className="h-6 w-6 text-indigo-400" />}
        title="Danh Mục Mẫu Tiêu Chuẩn"
        subtitle="Mẫu giao diện danh mục chuẩn hóa phục vụ tra cứu, thêm, sửa, xóa & lọc dữ liệu"
        count={filteredItems.length}
        countLabel="Mục"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => showToast.info('Đã làm mới dữ liệu!')}
        onExportExcel={perms.export ? () => showToast.success('Đã xuất file Excel!') : undefined}
        onImportExcel={perms.create ? () => showToast.info('Mở hộp thoại nhập file Excel...') : undefined}
        addLabel="Khai Báo Mới"
        canCreate={perms.create}
        onOpenAdd={() => {
          setEditingItem(null);
          setCode(`CAT${Date.now().toString().slice(-4)}`);
          setName('');
          setStatus('Hoạt động');
          setShowAddModal(true);
        }}
        filterPanelContent={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">Mã Danh Mục</label>
              <input
                type="text"
                value={filterCode}
                onChange={e => setFilterCode(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5"
                placeholder="VD: CAT001"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">Tên Danh Mục</label>
              <input
                type="text"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5"
                placeholder="VD: Mẫu 01"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">Trạng Thái</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-bold"
              >
                <option value="ALL">Tất cả</option>
                <option value="Hoạt động">Hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>
          </div>
        }
        onApplyFilter={handleApplyFilter}
        onClearFilter={handleClearFilter}
      />

      {/* GridView Component */}
      <GridView<SampleCategoryItem>
        data={filteredItems}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh..."
        keyExtractor={item => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa mục đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, ids) => setBulkToDeleteIds(ids)
          }
        ]}
      />

      {/* Add / Edit Form Modal */}
      <Modal
        isOpen={showAddModal || !!editingItem}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
        title={editingItem ? `Sửa Danh Mục: ${editingItem.code}` : 'Khai Báo Thêm Mới'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Mã Danh Mục *</label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono uppercase"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Tên Danh Mục *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Trạng Thái</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
            >
              <option value="Hoạt động">Hoạt động</option>
              <option value="Tạm dừng">Tạm dừng</option>
            </select>
          </div>
          <div className="pt-4 border-t flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => { setShowAddModal(false); setEditingItem(null); }}>
              Hủy
            </Button>
            <Button type="submit">Lưu Dữ Liệu</Button>
          </div>
        </form>
      </Modal>

      {/* Standard Delete Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        itemCode={itemToDelete?.code}
        itemName={itemToDelete?.name}
      />

      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        isBulk
        bulkCount={bulkToDeleteIds?.length || 0}
      />
    </div>
  );
};
