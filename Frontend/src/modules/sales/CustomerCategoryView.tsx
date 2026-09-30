import React, { useState, useMemo } from 'react';
import { 
  Building, 
  Phone, 
  Mail, 
  Edit, 
  Trash2, 
  Users
} from 'lucide-react';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { CategoryHeaderToolbar } from '../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal';
import { Customer, UserProfile } from '../../types';
import { getActionPermission } from '../../mock/initialRoles';
import { showToast } from '../../utils/toast';

interface CustomerCategoryViewProps {
  customers: Customer[];
  onAddCustomer: (cust: Customer) => void;
  onUpdateCustomer?: (id: string, cust: Partial<Customer>) => void;
  onDeleteCustomer?: (id: string) => void;
  currentUser?: UserProfile;
}

export const CustomerCategoryView: React.FC<CustomerCategoryViewProps> = ({
  customers: initialCustomers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'sales_customers');

  const [localCustomers, setLocalCustomers] = useState<Customer[]>(initialCustomers);

  React.useEffect(() => {
    setLocalCustomers(initialCustomers);
  }, [initialCustomers]);

  const customers = localCustomers;

  // Single & Bulk Delete confirmation states
  const [itemToDelete, setItemToDelete] = useState<Customer | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Collapsible Advanced Filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    company: ''
  });

  // Modal & Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleApplyFilter = () => {
    const parsedCodes = filterMultiCodes
      .split(/[,;\s]+/)
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    setAppliedFilters({
      name: filterName.trim().toLowerCase(),
      codes: parsedCodes,
      company: filterCompany.trim().toLowerCase()
    });
    showToast.info('Đã áp dụng bộ lọc Khách hàng!');
  };

  const handleClearFilter = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterCompany('');
    setAppliedFilters({ name: '', codes: [], company: '' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // 1. Multi-code filter
      if (appliedFilters.codes.length > 0) {
        const itemCode = c.id.toLowerCase();
        const matchesCode = appliedFilters.codes.some(codeStr => itemCode.includes(codeStr));
        if (!matchesCode) return false;
      }

      // 2. Keyword filter
      if (appliedFilters.name) {
        const matchName = c.name.toLowerCase().includes(appliedFilters.name) ||
                          c.id.toLowerCase().includes(appliedFilters.name) ||
                          (c.email && c.email.toLowerCase().includes(appliedFilters.name)) ||
                          (c.phone && c.phone.includes(appliedFilters.name));
        if (!matchName) return false;
      }

      // 3. Company filter
      if (appliedFilters.company) {
        if (!c.company || !c.company.toLowerCase().includes(appliedFilters.company)) {
          return false;
        }
      }

      return true;
    });
  }, [customers, appliedFilters]);

  // Format Currency
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  // Export Excel
  const handleExportExcel = () => {
    const headers = ['Mã KH', 'Họ Tên Khách Hàng', 'Công Ty / Đơn Vị', 'Email', 'Điện Thoại', 'Tổng Doanh Số'];
    const csvRows = [headers.join(',')];

    filteredCustomers.forEach(c => {
      const row = [
        `"${c.id}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${(c.company || '').replace(/"/g, '""')}"`,
        `"${c.email || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.totalSpent || 0}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Danh_sach_Khach_hang_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel danh sách khách hàng thành công!');
  };

  // Import Excel
  const handleImportExcel = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền NHẬP DỮ LIỆU Khách hàng!');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast.success(`Đã nhận file "${file.name}". Đang đồng bộ danh sách khách hàng...`);
      }
    };
    input.click();
  };

  // Open Handlers
  const handleOpenAdd = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN KHAI BÁO KHÁCH HÀNG!');
      return;
    }
    setEditingCust(null);
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN SỬA KHÁCH HÀNG!');
      return;
    }
    setEditingCust(c);
    setName(c.name);
    setCompany(c.company || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
  };

  const handleDeleteClick = (c: Customer) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA KHÁCH HÀNG!');
      return;
    }
    setItemToDelete(c);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;
    if (onDeleteCustomer) {
      onDeleteCustomer(id);
    }
    setLocalCustomers(prev => prev.filter(c => c.id !== id));
    showToast.success(`Đã xóa thành công đối tác "${name}"!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const count = bulkToDeleteIds.length;
    bulkToDeleteIds.forEach(id => {
      if (onDeleteCustomer) {
        onDeleteCustomer(String(id));
      }
    });
    setLocalCustomers(prev => prev.filter(c => !bulkToDeleteIds.includes(c.id)));
    showToast.success(`Đã xóa thành công ${count} khách hàng đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error('Vui lòng nhập Họ tên Khách hàng!');
      return;
    }

    if (editingCust) {
      const updated = {
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim()
      };

      if (onUpdateCustomer) {
        onUpdateCustomer(editingCust.id, updated);
      } else {
        setLocalCustomers(prev => prev.map(c => c.id === editingCust.id ? { ...c, ...updated } : c));
      }
      setEditingCust(null);
      showToast.success(`Cập nhật đối tác "${name}" thành công!`);
    } else {
      const newCust: Customer = {
        id: `KH${String(customers.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        company: company.trim() || 'Doanh nghiệp Tư nhân',
        email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '')}@client.vn`,
        phone: phone.trim() || '0901234567',
        totalSpent: 0,
        lastPurchaseDate: new Date().toISOString().split('T')[0]
      };

      if (onAddCustomer) {
        onAddCustomer(newCust);
      } else {
        setLocalCustomers(prev => [...prev, newCust]);
      }
      setShowAddModal(false);
      showToast.success(`Thêm khách hàng "${name}" thành công!`);
    }
  };

  // Grid Columns
  const columns: GridViewColumn<Customer>[] = [
    {
      key: 'id',
      title: 'Mã KH',
      sortable: true,
      width: '120px',
      render: (item) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {item.id}
        </span>
      )
    },
    {
      key: 'name',
      title: 'Họ Tên Khách Hàng',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
          {item.company && (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <Building className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{item.company}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'contact',
      title: 'Liên Hệ (SĐT / Email)',
      width: '200px',
      render: (item) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
            <span>{item.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate max-w-[150px]">{item.email || '—'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'totalSpent',
      title: 'Tổng Chi Tiêu / Doanh Số',
      sortable: true,
      width: '160px',
      align: 'right',
      render: (item) => (
        <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
          {formatVND(item.totalSpent || 0)}
        </div>
      )
    },
    {
      key: 'lastPurchaseDate',
      title: 'Giao Dịch Gần Nhất',
      sortable: true,
      width: '140px',
      align: 'center',
      render: (item) => (
        <span className="text-xs text-slate-500 font-mono">
          {item.lastPurchaseDate || '—'}
        </span>
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
            title="Sửa thông tin khách hàng"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa khách hàng"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const activeFilterCount = (appliedFilters.codes.length > 0 ? 1 : 0) + (appliedFilters.name ? 1 : 0) + (appliedFilters.company ? 1 : 0);

  return (
    <div className="w-full min-w-full space-y-4">
      
      {/* Dark Modern Header Toolbar */}
      <CategoryHeaderToolbar
        icon={<Users className="h-6 w-6 text-indigo-400" />}
        title="Danh Mục Hồ Sơ Khách Hàng (CRM)"
        subtitle="Khai báo thông tin khách hàng, doanh nghiệp, thông tin liên hệ & theo dõi lịch sử doanh số mua hàng"
        count={filteredCustomers.length}
        countLabel="Đối Tác"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => {
          setLocalCustomers([...initialCustomers]);
          showToast.info('Đã tải lại danh sách Khách hàng!');
        }}
        onExportExcel={handleExportExcel}
        onImportExcel={handleImportExcel}
        addLabel="Khai Báo KH Mới"
        canCreate={perms.createEdit}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã KH (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                placeholder="VD: KH001, KH002"
                value={filterMultiCodes}
                onChange={(e) => setFilterMultiCodes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên / SĐT / Email</label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn A, 090123..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Tên Công Ty / Doanh Nghiệp</label>
              <input
                type="text"
                placeholder="VD: Tập đoàn Hòa Phát..."
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        }
        onApplyFilter={handleApplyFilter}
        onClearFilter={handleClearFilter}
      />

      {/* GridView Component */}
      <GridView<Customer>
        data={filteredCustomers}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh tên khách hàng, mã KH, công ty, SĐT, email..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa các khách hàng đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Khách hàng!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingCust}
        onClose={() => {
          setShowAddModal(false);
          setEditingCust(null);
        }}
        title={editingCust ? `Sửa Hồ Sơ Khách Hàng: ${editingCust.id}` : 'Khai Báo Thêm Khách Hàng Mới'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Họ Và Tên Khách Hàng <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nguyễn Văn Anh"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Công Ty / Đơn Vị Công Tác</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="VD: Công ty TNHH Giải Pháp Công Nghệ"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Số Điện Thoại Liên Hệ</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0908 123 456"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Email Điện Tử</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: partner@company.com.vn"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingCust(null);
              }}
            >
              Hủy Bỏ
            </Button>
            <Button type="submit">
              {editingCust ? 'Lưu Thông Tin' : 'Khai Báo Khách Hàng'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        itemCode={itemToDelete?.id}
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
