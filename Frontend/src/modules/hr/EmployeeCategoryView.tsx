import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Building2, 
  Mail, 
  Phone, 
  Edit, 
  Trash2
} from 'lucide-react';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { CategoryHeaderToolbar } from '../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal';
import { Employee, UserProfile } from '../../types';
import { getActionPermission } from '../../mock/initialRoles';
import { showToast } from '../../utils/toast';

interface EmployeeCategoryViewProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee?: (id: string, emp: Partial<Employee>) => void;
  onDeleteEmployee?: (id: string) => void;
  currentUser?: UserProfile;
}

export const EmployeeCategoryView: React.FC<EmployeeCategoryViewProps> = ({
  employees: initialEmployees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  currentUser
}) => {
  const perms = getActionPermission(currentUser, 'hr_list');

  const [localEmployees, setLocalEmployees] = useState<Employee[]>(initialEmployees);

  React.useEffect(() => {
    setLocalEmployees(initialEmployees);
  }, [initialEmployees]);

  const employees = localEmployees;

  // Single & Bulk Delete confirmation states
  const [itemToDelete, setItemToDelete] = useState<Employee | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Collapsible Advanced Filter state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    department: 'ALL',
    status: 'ALL'
  });

  // Modal & Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [name, setName] = useState('');
  const [position, setPosition] = useState('Chuyên viên');
  const [department, setDepartment] = useState('Phòng Kinh Doanh');
  const [salary, setSalary] = useState(15000000);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const departmentsList = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
  }, [employees]);

  const handleApplyFilter = () => {
    const parsedCodes = filterMultiCodes
      .split(/[,;\s]+/)
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    setAppliedFilters({
      name: filterName.trim().toLowerCase(),
      codes: parsedCodes,
      department: filterDepartment,
      status: filterStatus
    });
    showToast.info('Đã áp dụng bộ lọc Nhân sự!');
  };

  const handleClearFilter = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterDepartment('ALL');
    setFilterStatus('ALL');
    setAppliedFilters({ name: '', codes: [], department: 'ALL', status: 'ALL' });
    showToast.info('Đã xóa bộ lọc!');
  };

  // Filtered dataset
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      // 1. Multi-code filter
      if (appliedFilters.codes.length > 0) {
        const itemCode = e.id.toLowerCase();
        const matchesCode = appliedFilters.codes.some(c => itemCode.includes(c));
        if (!matchesCode) return false;
      }

      // 2. Keyword filter
      if (appliedFilters.name) {
        const matchName = e.name.toLowerCase().includes(appliedFilters.name) ||
                          e.id.toLowerCase().includes(appliedFilters.name) ||
                          e.position.toLowerCase().includes(appliedFilters.name) ||
                          (e.email && e.email.toLowerCase().includes(appliedFilters.name)) ||
                          (e.phone && e.phone.includes(appliedFilters.name));
        if (!matchName) return false;
      }

      // 3. Department filter
      if (appliedFilters.department !== 'ALL' && e.department !== appliedFilters.department) {
        return false;
      }

      // 4. Status filter
      if (appliedFilters.status !== 'ALL' && e.status !== appliedFilters.status) {
        return false;
      }

      return true;
    });
  }, [employees, appliedFilters]);

  // Format Currency
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  // Export Excel
  const handleExportExcel = () => {
    const headers = ['Mã NV', 'Họ Và Tên', 'Phòng Ban', 'Chức Danh', 'Mức Lương Cơ Bản', 'Email', 'Điện Thoại', 'Ngày Vào Làm'];
    const csvRows = [headers.join(',')];

    filteredEmployees.forEach(e => {
      const row = [
        `"${e.id}"`,
        `"${e.name.replace(/"/g, '""')}"`,
        `"${(e.department || '').replace(/"/g, '""')}"`,
        `"${(e.position || '').replace(/"/g, '""')}"`,
        `"${e.salary || 0}"`,
        `"${e.email || ''}"`,
        `"${e.phone || ''}"`,
        `"${e.joinDate || e.hireDate || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hoso_Nhan_vien_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel danh sách nhân viên thành công!');
  };

  // Import Excel
  const handleImportExcel = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền NHẬP DỮ LIỆU Nhân sự!');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast.success(`Đã nhận file "${file.name}". Đang cập nhật hồ sơ...`);
      }
    };
    input.click();
  };

  // Open Handlers
  const handleOpenAdd = () => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN KHAI BÁO HỒ SƠ NHÂN VIÊN!');
      return;
    }
    setEditingEmp(null);
    setName('');
    setPosition('Chuyên viên');
    setDepartment('Phòng Kinh Doanh');
    setSalary(15000000);
    setEmail('');
    setPhone('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    if (!perms.createEdit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN SỬA HỒ SƠ NHÂN VIÊN!');
      return;
    }
    setEditingEmp(emp);
    setName(emp.name);
    setPosition(emp.position || 'Chuyên viên');
    setDepartment(emp.department || 'Phòng Kinh Doanh');
    setSalary(emp.salary || 15000000);
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
  };

  const handleDeleteClick = (emp: Employee) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA HỒ SƠ NHÂN VIÊN!');
      return;
    }
    setItemToDelete(emp);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;
    if (onDeleteEmployee) {
      onDeleteEmployee(id);
    }
    setLocalEmployees(prev => prev.filter(e => e.id !== id));
    showToast.success(`Đã xóa hồ sơ nhân viên "${name}"!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const count = bulkToDeleteIds.length;
    bulkToDeleteIds.forEach(id => {
      if (onDeleteEmployee) {
        onDeleteEmployee(String(id));
      }
    });
    setLocalEmployees(prev => prev.filter(e => !bulkToDeleteIds.includes(e.id)));
    showToast.success(`Đã xóa thành công ${count} hồ sơ nhân viên đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error('Vui lòng nhập Họ và Tên Nhân viên!');
      return;
    }

    if (editingEmp) {
      const updated = {
        name: name.trim(),
        position,
        role: position,
        department,
        salary,
        email: email.trim(),
        phone: phone.trim()
      };

      if (onUpdateEmployee) {
        onUpdateEmployee(editingEmp.id, updated);
      } else {
        setLocalEmployees(prev => prev.map(emp => emp.id === editingEmp.id ? { ...emp, ...updated } : emp));
      }
      setEditingEmp(null);
      showToast.success(`Cập nhật hồ sơ nhân viên "${name}" thành công!`);
    } else {
      const newEmp: Employee = {
        id: `EMP${String(employees.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        position,
        role: position,
        department,
        salary,
        email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '')}@company.vn`,
        phone: phone.trim() || '0901234567',
        joinDate: new Date().toISOString().split('T')[0],
        hireDate: new Date().toISOString().split('T')[0],
        status: 'Đang làm việc'
      };

      if (onAddEmployee) {
        onAddEmployee(newEmp);
      } else {
        setLocalEmployees(prev => [...prev, newEmp]);
      }
      setShowAddModal(false);
      showToast.success(`Thêm hồ sơ nhân viên mới "${name}" thành công!`);
    }
  };

  // Grid Columns
  const columns: GridViewColumn<Employee>[] = [
    {
      key: 'id',
      title: 'Mã NV',
      sortable: true,
      width: '110px',
      render: (item) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {item.id}
        </span>
      )
    },
    {
      key: 'name',
      title: 'Họ Và Tên / Chức Danh',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            {item.position || item.role}
          </div>
        </div>
      )
    },
    {
      key: 'department',
      title: 'Phòng Ban / Đơn Vị',
      sortable: true,
      width: '180px',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{item.department || '—'}</span>
        </div>
      )
    },
    {
      key: 'contact',
      title: 'Email & Điện Thoại',
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
      key: 'salary',
      title: 'Lương Cơ Bản',
      sortable: true,
      width: '150px',
      align: 'right',
      render: (item) => (
        <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
          {formatVND(item.salary || 0)}
        </div>
      )
    },
    {
      key: 'status',
      title: 'Trạng Thái',
      sortable: true,
      width: '120px',
      align: 'center',
      render: (item) => (
        <Badge variant={item.status === 'Chính thức' ? 'success' : 'neutral'} size="sm">
          {item.status || 'Đang làm việc'}
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
            title="Sửa hồ sơ"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa hồ sơ"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const activeFilterCount = (appliedFilters.codes.length > 0 ? 1 : 0) + (appliedFilters.name ? 1 : 0) + (appliedFilters.department !== 'ALL' ? 1 : 0) + (appliedFilters.status !== 'ALL' ? 1 : 0);

  return (
    <div className="w-full min-w-full space-y-4">
      
      {/* Dark Modern Header Toolbar */}
      <CategoryHeaderToolbar
        icon={<Users className="h-6 w-6 text-indigo-400" />}
        title="Danh Mục Hồ Sơ Nhân Sự (HRM)"
        subtitle="Khai báo thông tin nhân sự, phòng ban, chức danh công việc, mức lương cơ bản & ngày vào làm"
        count={filteredEmployees.length}
        countLabel="Nhân Viên"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => {
          setLocalEmployees([...initialEmployees]);
          showToast.info('Đã tải lại danh sách Nhân sự!');
        }}
        onExportExcel={handleExportExcel}
        onImportExcel={handleImportExcel}
        addLabel="Khai Báo NV Mới"
        canCreate={perms.createEdit}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã Nhân Viên (dấu phẩy phân cách)</label>
              <input
                type="text"
                placeholder="VD: EMP001, EMP002"
                value={filterMultiCodes}
                onChange={(e) => setFilterMultiCodes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên / SĐT / Email / Chức Danh</label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn A, Chuyên viên..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Phòng Ban</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả Phòng Ban</option>
                {departmentsList.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Trạng Thái Làm Việc</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả Trạng thái</option>
                <option value="Đang làm việc">Đang làm việc</option>
                <option value="Nghỉ việc">Đã nghỉ việc</option>
              </select>
            </div>
          </div>
        }
        onApplyFilter={handleApplyFilter}
        onClearFilter={handleClearFilter}
      />

      {/* GridView Component */}
      <GridView<Employee>
        data={filteredEmployees}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh tên nhân viên, mã NV, phòng ban, chức danh..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa hồ sơ đã chọn',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Nhân sự!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingEmp}
        onClose={() => {
          setShowAddModal(false);
          setEditingEmp(null);
        }}
        title={editingEmp ? `Sửa Hồ Sơ Nhân Viên: ${editingEmp.id}` : 'Khai Báo Thêm Hồ Sơ Nhân Viên Mới'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Họ Và Tên Nhân Viên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Trần Hoàng Nam"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Chức Danh Công Việc</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="VD: Trưởng phòng Kinh doanh"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Phòng Ban Công Tác</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Phòng Kinh Doanh">Phòng Kinh Doanh</option>
                <option value="Phòng Kế Toán">Phòng Kế Toán</option>
                <option value="Phòng Kỹ Thuật">Phòng Kỹ Thuật</option>
                <option value="Phòng Nhân Sự">Phòng Nhân Sự</option>
                <option value="Khối Kho Vận">Khối Kho Vận</option>
                <option value="Ban Giám Đốc">Ban Giám Đốc</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Mức Lương Cơ Bản (VNĐ)</label>
              <input
                type="number"
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                step={500000}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Số Điện Thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912 345 678"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">Email Doanh Nghiệp</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: nam.th@erp-company.vn"
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
                setEditingEmp(null);
              }}
            >
              Hủy Bỏ
            </Button>
            <Button type="submit">
              {editingEmp ? 'Lưu Hồ Sơ' : 'Khai Báo Nhân Viên'}
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
