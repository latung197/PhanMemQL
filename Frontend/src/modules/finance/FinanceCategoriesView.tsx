import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  Filter, 
  X,
  Wallet,
  Building2,
  Tag
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../components/common/CategoryHeaderToolbar';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { UserProfile } from '../../types';
import { getActionPermission } from '../../mock/initialRoles';
import { showToast } from '../../utils/toast';

interface FinanceCategoriesViewProps {
  currentUser?: UserProfile;
}

interface FundAccount {
  id: string;
  name: string;
  accountNumber: string;
  balance: number;
  type: string;
}

interface FinCategory {
  id: string;
  code: string;
  name: string;
  type: 'Thu' | 'Chi';
}

export const FinanceCategoriesView: React.FC<FinanceCategoriesViewProps> = ({ currentUser }) => {
  const perms = getActionPermission(currentUser, 'fin_categories');

  // Accounts state
  const [fundAccounts] = useState<FundAccount[]>([
    { id: 'BANK01', name: 'Ngân hàng Techcombank (TK CTY)', accountNumber: '1903889920101', balance: 385000000, type: 'Ngân hàng' },
    { id: 'BANK02', name: 'Ngân hàng Vietcombank (TK Chi nhánh)', accountNumber: '0071001188291', balance: 192000000, type: 'Ngân hàng' },
    { id: 'CASH01', name: 'Quỹ tiền mặt Thủ quỹ HCM', accountNumber: 'CASH-HCM-01', balance: 45000000, type: 'Tiền mặt' }
  ]);

  // Categories state
  const [categories, setCategories] = useState<FinCategory[]>([
    { id: '1', code: 'THU_BH', name: 'Thu tiền bán hàng & Cung cấp dịch vụ', type: 'Thu' },
    { id: '2', code: 'THU_DT', name: 'Thu tiền đầu tư / Vốn góp cổ đông', type: 'Thu' },
    { id: '3', code: 'CHI_NV', name: 'Chi nhập hàng hóa vật tư sản xuất', type: 'Chi' },
    { id: '4', code: 'CHI_LUONG', name: 'Chi lương cán bộ nhân sự', type: 'Chi' },
    { id: '5', code: 'CHI_VH', name: 'Chi phí vận hành văn phòng & Điện nước', type: 'Chi' }
  ]);

  // Single & Bulk Delete confirmation states
  const [itemToDelete, setItemToDelete] = useState<FinCategory | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Collapsible Advanced Filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'Thu' | 'Chi'>('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    type: 'ALL'
  });

  // Modal & Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCat, setEditingCat] = useState<FinCategory | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'Thu' | 'Chi'>('Thu');

  const handleApplyFilter = () => {
    const parsedCodes = filterMultiCodes
      .split(/[,;\s]+/)
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    setAppliedFilters({
      name: filterName.trim().toLowerCase(),
      codes: parsedCodes,
      type: filterType
    });
    showToast.info('Đã áp dụng bộ lọc Khoản mục Thu Chi!');
  };

  const handleClearFilter = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterType('ALL');
    setAppliedFilters({ name: '', codes: [], type: 'ALL' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      // 1. Multi-code filter
      if (appliedFilters.codes.length > 0) {
        const itemCode = c.code.toLowerCase();
        const matchesCode = appliedFilters.codes.some(codeStr => itemCode.includes(codeStr));
        if (!matchesCode) return false;
      }

      // 2. Keyword filter
      if (appliedFilters.name) {
        const matchName = c.name.toLowerCase().includes(appliedFilters.name) ||
                          c.code.toLowerCase().includes(appliedFilters.name);
        if (!matchName) return false;
      }

      // 3. Type filter
      if (appliedFilters.type !== 'ALL' && c.type !== appliedFilters.type) {
        return false;
      }

      return true;
    });
  }, [categories, appliedFilters]);

  // Format Currency
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  // Export Excel
  const handleExportExcel = () => {
    const headers = ['Mã Khoản Mục', 'Tên Khoản Mục Thu Chi', 'Loại Giao Dịch'];
    const csvRows = [headers.join(',')];

    filteredCategories.forEach(c => {
      const row = [
        `"${c.code}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.type}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Khoan_muc_Thu_Chi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel khoản mục thu chi thành công!');
  };

  // Import Excel
  const handleImportExcel = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền NHẬP DỮ LIỆU Khoản mục!');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast.success(`Đã nhận file "${file.name}". Đang đồng bộ khoản mục thu chi...`);
      }
    };
    input.click();
  };

  // Open Handlers
  const handleOpenAdd = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN KHAI BÁO MÃ THU CHI!');
      return;
    }
    setEditingCat(null);
    setCode(`KM_${Date.now().toString().slice(-4)}`);
    setName('');
    setType('Thu');
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: FinCategory) => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN SỬA KHOẢN MỤC!');
      return;
    }
    setEditingCat(c);
    setCode(c.code);
    setName(c.name);
    setType(c.type);
  };

  const handleDeleteClick = (c: FinCategory) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA KHOẢN MỤC THU CHI!');
      return;
    }
    setItemToDelete(c);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;
    setCategories(prev => prev.filter(c => c.id !== id));
    showToast.success(`Đã xóa thành công khoản mục "${name}"!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const count = bulkToDeleteIds.length;
    setCategories(prev => prev.filter(c => !bulkToDeleteIds.includes(c.id)));
    showToast.success(`Đã xóa thành công ${count} khoản mục đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showToast.error('Vui lòng nhập Mã và Tên Khoản mục Thu chi!');
      return;
    }

    if (editingCat) {
      setCategories(prev => prev.map(c => c.id === editingCat.id ? { ...c, code: code.trim().toUpperCase(), name: name.trim(), type } : c));
      setEditingCat(null);
      showToast.success(`Cập nhật thông tin khoản mục "${name}" thành công!`);
    } else {
      const newCat: FinCategory = {
        id: `CAT-${Date.now()}`,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type
      };
      setCategories(prev => [newCat, ...prev]);
      setShowAddModal(false);
      showToast.success(`Khai báo khoản mục mới "${name}" thành công!`);
    }
  };

  // Grid Columns
  const columns: GridViewColumn<FinCategory>[] = [
    {
      key: 'code',
      title: 'Mã Khoản Mục',
      sortable: true,
      width: '140px',
      render: (item) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {item.code}
        </span>
      )
    },
    {
      key: 'name',
      title: 'Tên Khoản Mục Thu / Chi',
      sortable: true,
      render: (item) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {item.name}
        </span>
      )
    },
    {
      key: 'type',
      title: 'Loại Giao Dịch',
      sortable: true,
      width: '130px',
      align: 'center',
      render: (item) => (
        <Badge variant={item.type === 'Thu' ? 'success' : 'danger'} size="sm">
          {item.type === 'Thu' ? 'Khoản Thu' : 'Khoản Chi'}
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
            title="Sửa khoản mục"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa khoản mục"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const activeFilterCount = (appliedFilters.codes.length > 0 ? 1 : 0) + (appliedFilters.name ? 1 : 0) + (appliedFilters.type !== 'ALL' ? 1 : 0);

  return (
    <div className="w-full min-w-full space-y-6">
      
      {/* Overview Cards for Bank & Cash Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {fundAccounts.map(acc => (
          <div key={acc.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-indigo-500" />
                {acc.type}
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate max-w-[200px]">{acc.name}</div>
              <div className="text-xs font-mono text-slate-400">{acc.accountNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Số dư hiện tại</div>
              <div className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{formatVND(acc.balance)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<CreditCard />}
          title="Khai Báo Danh Mục Khoản Mục Thu Chi"
          count={filteredCategories.length}
          countLabel="Khoản Mục"
          subtitle="Quản lý phân loại mã khoản thu, mã khoản chi dùng cho Lập phiếu thu / Lập phiếu chi"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            showToast.info('Đã tải lại danh mục Khoản mục Thu chi!');
          }}
          onExportExcel={handleExportExcel}
          onImportExcel={handleImportExcel}
          addLabel="Khai Báo Khoản Mục"
          onOpenAdd={handleOpenAdd}
          canCreate={perms.createEdit}
        />

        {/* Collapsible Advanced Search Bar */}
        {showAdvancedFilter && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Khoản Mục (phân cách dấu phẩy)</label>
              <input
                type="text"
                placeholder="VD: THU_BH, CHI_LUONG"
                value={filterMultiCodes}
                onChange={(e) => setFilterMultiCodes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên Khoản Mục</label>
              <input
                type="text"
                placeholder="VD: Bán hàng, Lương nhân viên..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Loại Giao Dịch</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả Loại Thu/Chi</option>
                <option value="Thu">Khoản Thu</option>
                <option value="Chi">Khoản Chi</option>
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
      <GridView<FinCategory>
        data={filteredCategories}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh mã khoản mục, tên khoản thu chi..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa khoản mục đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Khoản mục Thu chi!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingCat}
        onClose={() => {
          setShowAddModal(false);
          setEditingCat(null);
        }}
        title={editingCat ? `Sửa Khoản Mục Thu Chi: ${editingCat.code}` : 'Khai Báo Thêm Khoản Mục Mới'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Mã Khoản Mục <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: THU_BH, CHI_LUONG..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Tên Khoản Mục Thu / Chi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Thu tiền cung cấp dịch vụ bảo trì"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">Phân Loại Giao Dịch</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Thu">Khoản Thu (Phiếu Thu)</option>
              <option value="Chi">Khoản Chi (Phiếu Chi)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingCat(null);
              }}
            >
              Hủy Bỏ
            </Button>
            <Button type="submit">
              {editingCat ? 'Lưu Khoản Mục' : 'Khai Báo Khoản Mục'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single Delete Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Xác nhận xóa khoản mục thu chi"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Bạn có chắc chắn muốn xóa?</p>
              <p>
                Khoản mục <span className="font-bold text-slate-900 dark:text-white">"{itemToDelete?.name}"</span> (Mã: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemToDelete?.code}</span>) sẽ bị xóa khỏi danh mục tài chính.
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
        title="Xác nhận xóa hàng loạt khoản mục"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Xóa {bulkToDeleteIds?.length} khoản mục đã chọn?</p>
              <p>Toàn bộ khoản mục đã chọn sẽ bị gỡ bỏ khỏi hệ thống.</p>
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
