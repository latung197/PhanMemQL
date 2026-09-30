import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Scale, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  Filter, 
  X,
  Ruler
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { UnitOfMeasure, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';

interface UomCategoryViewProps {
  unitsOfMeasure: UnitOfMeasure[];
  onAddUom?: (uom: UnitOfMeasure) => void;
  onUpdateUom?: (id: string, uom: Partial<UnitOfMeasure>) => void;
  onDeleteUom?: (id: string) => void;
  currentUser?: UserProfile;
}

export const UomCategoryView: React.FC<UomCategoryViewProps> = ({
  unitsOfMeasure: initialUoms = [],
  onAddUom,
  onUpdateUom,
  onDeleteUom,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'inv_uom_cat');

  const [localUoms, setLocalUoms] = useState<UnitOfMeasure[]>(initialUoms);

  React.useEffect(() => {
    setLocalUoms(initialUoms);
  }, [initialUoms]);

  const unitsOfMeasure = localUoms;

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<UnitOfMeasure | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Advanced Filter State
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    status: 'ALL'
  });

  // Modal & Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUom, setEditingUom] = useState<UnitOfMeasure | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'Hoạt động' | 'Tạm dừng'>('Hoạt động');

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
    showToast.info('Đã áp dụng bộ lọc Đơn vị tính!');
  };

  const handleClearFilter = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterStatus('ALL');
    setAppliedFilters({ name: '', codes: [], status: 'ALL' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredUoms = useMemo(() => {
    return unitsOfMeasure.filter(u => {
      // 1. Multi-code filter
      if (appliedFilters.codes.length > 0) {
        const itemCode = u.code.toLowerCase();
        const matchesCode = appliedFilters.codes.some(c => itemCode.includes(c));
        if (!matchesCode) return false;
      }

      // 2. Keyword filter
      if (appliedFilters.name) {
        const matchName = u.name.toLowerCase().includes(appliedFilters.name) ||
                          u.code.toLowerCase().includes(appliedFilters.name) ||
                          u.symbol.toLowerCase().includes(appliedFilters.name) ||
                          (u.note && u.note.toLowerCase().includes(appliedFilters.name));
        if (!matchName) return false;
      }

      // 3. Status filter
      if (appliedFilters.status !== 'ALL' && u.status !== appliedFilters.status) {
        return false;
      }

      return true;
    });
  }, [unitsOfMeasure, appliedFilters]);

  // Export Excel
  const handleExportExcel = () => {
    const headers = ['Mã ĐVT', 'Tên Đơn Vị Tính', 'Ký Hiệu Quy Ước', 'Ghi Chú', 'Trạng Thái'];
    const csvRows = [headers.join(',')];

    filteredUoms.forEach(u => {
      const row = [
        `"${u.code}"`,
        `"${u.name.replace(/"/g, '""')}"`,
        `"${u.symbol || ''}"`,
        `"${(u.note || '').replace(/"/g, '""')}"`,
        `"${u.status || 'Hoạt động'}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Don_Vi_Tinh_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel đơn vị tính thành công!');
  };

  // Import Excel
  const handleImportExcel = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền NHẬP DỮ LIỆU Đơn vị tính!');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast.success(`Đã nhận file "${file.name}". Đang cập nhật dữ liệu...`);
      }
    };
    input.click();
  };

  // Open Handlers
  const handleOpenAddModal = () => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền THÊM đơn vị tính!');
      return;
    }
    setEditingUom(null);
    setCode(`DVT${(unitsOfMeasure.length + 1).toString().padStart(2, '0')}`);
    setName('');
    setSymbol('');
    setNote('');
    setStatus('Hoạt động');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (u: UnitOfMeasure) => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền CHỈNH SỬA đơn vị tính!');
      return;
    }
    setEditingUom(u);
    setCode(u.code);
    setName(u.name);
    setSymbol(u.symbol);
    setNote(u.note || '');
    setStatus(u.status);
  };

  const handleDeleteClick = (u: UnitOfMeasure) => {
    if (!perms.delete) {
      showToast.error('Bạn KHÔNG CÓ QUYỀN XÓA đơn vị tính!');
      return;
    }
    setItemToDelete(u);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;
    if (onDeleteUom) {
      onDeleteUom(id);
    }
    setLocalUoms(prev => prev.filter(u => u.id !== id));
    showToast.success(`Đã xóa đơn vị tính "${name}" thành công!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const count = bulkToDeleteIds.length;
    bulkToDeleteIds.forEach(id => {
      if (onDeleteUom) {
        onDeleteUom(String(id));
      }
    });
    setLocalUoms(prev => prev.filter(u => !bulkToDeleteIds.includes(u.id)));
    showToast.success(`Đã xóa thành công ${count} đơn vị tính đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      showToast.error('Vui lòng điền đầy đủ Mã ĐVT và Tên đơn vị tính!');
      return;
    }

    if (editingUom) {
      const updated = { code: code.trim().toUpperCase(), name: name.trim(), symbol: symbol.trim() || name.trim().toLowerCase(), note: note.trim(), status };
      if (onUpdateUom) {
        onUpdateUom(editingUom.id, updated);
      } else {
        setLocalUoms(prev => prev.map(u => u.id === editingUom.id ? { ...u, ...updated } : u));
      }
      setEditingUom(null);
      showToast.success('Cập nhật đơn vị tính thành công!');
    } else {
      const newUom: UnitOfMeasure = {
        id: `UOM${Date.now().toString().slice(-4)}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        symbol: symbol.trim() || name.trim().toLowerCase(),
        note: note.trim(),
        status
      };
      if (onAddUom) {
        onAddUom(newUom);
      } else {
        setLocalUoms(prev => [newUom, ...prev]);
      }
      setShowAddModal(false);
      showToast.success('Khai báo đơn vị tính mới thành công!');
    }
  };

  // Grid Columns
  const columns: GridViewColumn<UnitOfMeasure>[] = [
    {
      key: 'code',
      title: 'Mã ĐVT',
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
      title: 'Tên Đơn Vị Tính',
      sortable: true,
      render: (item) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {item.name}
        </span>
      )
    },
    {
      key: 'symbol',
      title: 'Ký Hiệu Quy Ước',
      width: '140px',
      render: (item) => (
        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
          {item.symbol || item.name}
        </span>
      )
    },
    {
      key: 'note',
      title: 'Ghi Chú / Quy Định',
      render: (item) => (
        <span className="text-slate-500 max-w-xs truncate block">
          {item.note || '—'}
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
            title="Sửa đơn vị tính"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa đơn vị tính"
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
          icon={<Scale />}
          title="Khai Báo Danh Mục Đơn Vị Tính (UOM)"
          count={filteredUoms.length}
          countLabel="ĐVT"
          subtitle="Quản lý đơn vị đo lường cơ sở (Cái, Chiếc, Thùng, Hộp, Kg, Mét, Cuộn...)"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalUoms([...initialUoms]);
            showToast.info('Đã tải lại danh mục Đơn vị tính!');
          }}
          onExportExcel={handleExportExcel}
          onImportExcel={handleImportExcel}
          addLabel="Khai Báo ĐVT Mới"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.createEdit}
        />

        {/* Collapsible Advanced Search Bar */}
        {showAdvancedFilter && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã ĐVT (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="VD: DVT01, DVT02"
                value={filterMultiCodes}
                onChange={(e) => setFilterMultiCodes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên / Ký Hiệu / Ghi Chú</label>
              <input
                type="text"
                placeholder="VD: Thùng, kg, mét..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
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
      <GridView<UnitOfMeasure>
        data={filteredUoms}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh tên đơn vị tính, mã ĐVT, ký hiệu quy ước..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa các đơn vị tính đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Bạn KHÔNG CÓ QUYỀN XÓA Đơn vị tính!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingUom}
        onClose={() => {
          setShowAddModal(false);
          setEditingUom(null);
        }}
        title={editingUom ? `Chỉnh Sửa ĐVT: ${editingUom.code}` : 'Khai Báo Thêm Mới Đơn Vị Tính'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Mã Đơn Vị Tính <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: CAI, THUNG, KG..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Tên Đơn Vị Tính <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Cái, Thùng, Cuộn..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Ký Hiệu Quy Ước</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="VD: pcs, box, kg..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
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
            <label className="font-bold text-slate-700 dark:text-slate-300">Ghi Chú Quy Đổi / Hướng Dẫn</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú hoặc quy cách quy đổi nếu có..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingUom(null);
              }}
            >
              Hủy Bỏ
            </Button>
            <Button type="submit">
              {editingUom ? 'Lưu Thay Đổi' : 'Tạo Đơn Vị Tính'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single Delete Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Xác nhận xóa đơn vị tính"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Bạn có chắc chắn muốn xóa?</p>
              <p>
                Đơn vị tính <span className="font-bold text-slate-900 dark:text-white">"{itemToDelete?.name}"</span> (Mã: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemToDelete?.code}</span>) sẽ bị xóa khỏi danh mục.
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
        title="Xác nhận xóa hàng loạt đơn vị tính"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Xóa {bulkToDeleteIds?.length} đơn vị tính đã chọn?</p>
              <p>Toàn bộ các đơn vị tính đã chọn sẽ bị gỡ bỏ khỏi hệ thống.</p>
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
