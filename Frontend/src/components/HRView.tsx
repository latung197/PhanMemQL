import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  UserPlus, 
  Briefcase, 
  Mail, 
  Phone, 
  Calendar, 
  X,
  CreditCard,
  Building,
  UserCheck
} from 'lucide-react';
import { Employee, EmployeeStatus } from '../types';

interface HRViewProps {
  employees: Employee[];
  onAddEmployee: (employee: Omit<Employee, 'id'>) => void;
  onUpdateEmployeeStatus: (id: string, status: EmployeeStatus) => void;
}

export const HRView: React.FC<HRViewProps> = ({ 
  employees, 
  onAddEmployee, 
  onUpdateEmployeeStatus 
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('Tất cả');
  const [statusFilter, setStatusFilter] = useState('Tất cả');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<'Kinh doanh' | 'Kỹ thuật' | 'Nhân sự' | 'Kế toán' | 'Kho vận'>('Kinh doanh');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState(10000000);
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);

  // Compute total monthly payroll of active workers
  const totalActivePayroll = useMemo(() => {
    return employees
      .filter(e => e.status !== 'Đã nghỉ việc')
      .reduce((sum, e) => sum + e.salary, 0);
  }, [employees]);

  // Unique departments for filter
  const depts = ['Tất cả', 'Kinh doanh', 'Kỹ thuật', 'Nhân sự', 'Kế toán', 'Kho vận'];

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = deptFilter === 'Tất cả' || e.department === deptFilter;
      const matchStatus = statusFilter === 'Tất cả' || e.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, searchTerm, deptFilter, statusFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !email.trim()) {
      alert('Vui lòng hoàn tất các mục bắt buộc (*)!');
      return;
    }

    onAddEmployee({
      name: name.trim(),
      department,
      role: role.trim(),
      email: email.trim(),
      phone: phone.trim() || 'N/A',
      salary,
      status: 'Đang làm việc',
      hireDate
    });

    // Reset Form
    setName('');
    setRole('');
    setEmail('');
    setPhone('');
    setSalary(10000000);
    setHireDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(false);
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="space-y-6" id="hr-module-view">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-5.5 w-5.5 text-blue-600" />
            Nhân Sự & Quỹ Lương (HRM)
          </h2>
          <p className="text-xs text-gray-500">Giám sát hồ sơ lao động doanh nghiệp, định ngạch vai trò, phòng ban và quỹ phúc lợi hàng tháng</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer focus:outline-hidden"
          id="btn-add-employee-modal-trigger"
        >
          <Plus className="h-4.5 w-4.5" />
          Tuyển dụng nhân sự mới
        </button>
      </div>

      {/* HRM Stats summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="hr-stats-row">
        {/* Headcount */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-650 rounded-xl shrink-0">
            <Users className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-semibold uppercase tracking-wider">Tổng nhân headcount hoạt động</p>
            <h4 className="text-2xl font-bold font-mono text-gray-800 mt-1">
              {employees.filter(e => e.status !== 'Đã nghỉ việc').length} / {employees.length} <span className="text-xs font-normal text-gray-500">Thành viên</span>
            </h4>
          </div>
        </div>

        {/* Budget Payroll */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-650 rounded-xl shrink-0">
            <CreditCard className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-semibold uppercase tracking-wider">Tổng ngân sách lương hàng tháng</p>
            <h4 className="text-2xl font-bold font-mono text-gray-800 mt-1">{formatVND(totalActivePayroll)}</h4>
          </div>
        </div>

        {/* Staffing highlight */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-650 rounded-xl shrink-0">
            <Building className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-semibold uppercase tracking-wider">Bộ phận quy tụ năng động</p>
            <h4 className="text-lg font-bold text-gray-850 mt-1">Kỹ thuật & Kinh doanh</h4>
          </div>
        </div>
      </div>

      {/* Advanced Filter and Search Row */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-4 shadow-xs">
        <div className="relative grow">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm nhân sự theo Tên, Chức danh, Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            id="search-employees-input"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Dept selection */}
          <div className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg bg-white">
            <span className="text-[10px] uppercase font-bold text-gray-400">Phòng Ban:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="font-semibold text-xs text-gray-700 outline-none cursor-pointer"
            >
              {depts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status selection */}
          <div className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg bg-white font-semibold">
            <span className="text-[10px] uppercase font-bold text-gray-400">Trạng Thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="font-semibold text-xs text-gray-700 outline-none cursor-pointer"
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Đang làm việc">Đang làm việc</option>
              <option value="Nghỉ phép">Nghỉ phép</option>
              <option value="Đã nghỉ việc">Đã nghỉ việc</option>
            </select>
          </div>
        </div>
      </div>

      {/* HR Records Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="hr-employees-table">
            <thead>
              <tr className="bg-gray-55 border-b border-gray-100 text-xs font-bold uppercase text-gray-500 tracking-wider">
                <th className="py-4 px-6">Mã nhân viên</th>
                <th className="py-4 px-6">Họ Tên</th>
                <th className="py-4 px-6">Bộ Phận / vai trò</th>
                <th className="py-4 px-6">Hồ sơ Liên Hệ</th>
                <th className="py-4 px-6">Đóng Ngạch Lương</th>
                <th className="py-4 px-6">Ngày tiếp nhận</th>
                <th className="py-4 px-6">Xử lý Trạng Thái</th>
                <th className="py-4 px-6 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Không tìm thấy thành viên nào phù hợp!
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/50 transition-all">
                    <td className="py-4 px-6 font-mono font-bold text-gray-900">{e.id}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                          {e.name.substring(e.name.lastIndexOf(' ') + 1)[0] || 'NV'}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">{e.name}</p>
                          <p className="text-[10px] bg-slate-50 border border-slate-100 px-1 py-0.2 select-none inline-block text-gray-500 rounded-sm mt-0.5">{e.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-semibold">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Briefcase className="h-3.5 w-3.5 text-gray-450" />
                        {e.department}
                      </span>
                    </td>
                    <td className="py-4 px-6 space-y-0.5 text-xs">
                      <p className="flex items-center gap-1 text-gray-600">
                        <Mail className="h-3 w-3 text-gray-400" /> {e.email}
                      </p>
                      <p className="flex items-center gap-1 text-gray-550">
                        <Phone className="h-3 w-3 text-gray-400" /> {e.phone}
                      </p>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-gray-800">{formatVND(e.salary)}</td>
                    <td className="py-4 px-6 text-gray-500 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {e.hireDate}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block border ${
                        e.status === 'Đang làm việc' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        e.status === 'Nghỉ phép' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {e.status !== 'Đã nghỉ việc' ? (
                        <div className="flex justify-end gap-1" id={`hr-control-${e.id}`}>
                          {e.status === 'Đang làm việc' && (
                            <button
                              onClick={() => {
                                if (confirm(`Bạn có chắc muốn cấp phép cho ${e.name} Nghỉ phép?`)) {
                                  onUpdateEmployeeStatus(e.id, 'Nghỉ phép');
                                }
                              }}
                              className="text-xs px-2 py-1 border border-amber-100 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-md cursor-pointer focus:outline-hidden"
                            >
                              Phép
                            </button>
                          )}
                          {e.status === 'Nghỉ phép' && (
                            <button
                              onClick={() => onUpdateEmployeeStatus(e.id, 'Đang làm việc')}
                              className="text-xs px-2 py-1 border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-md cursor-pointer focus:outline-hidden"
                            >
                              Xong phép
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có thực sự muốn tích dấu Nghỉ việc cho nhân sự ${e.name}? Thao tác này sẽ xoá ngạch nhân sự khỏi danh sách biểu đồ tiền lương.`)) {
                                onUpdateEmployeeStatus(e.id, 'Đã nghỉ việc');
                              }
                            }}
                            className="text-xs px-2 py-1 border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-md cursor-pointer focus:outline-hidden"
                          >
                            Bãi nhiệm
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Đã ngừng hợp đồng</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="add-employee-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Tiếp nhận hồ sơ nhân viên
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg focus:outline-hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Full name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Họ và tên nhân viên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Thế Đan, Nguyễn Trọng Trực..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2.5 px-3 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Department & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Phòng ban chỉ định</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as any)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-2.5 outline-none cursor-pointer text-gray-700 font-semibold"
                  >
                    <option value="Kinh doanh">Kinh doanh</option>
                    <option value="Kỹ thuật">Kỹ thuật</option>
                    <option value="Nhân sự">Nhân sự</option>
                    <option value="Kế toán">Kế toán</option>
                    <option value="Kho vận">Kho vận</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Chức vụ cụ thể *</label>
                  <input
                    type="text"
                    required
                    placeholder="Chức danh phòng ban..."
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Email công ty/cá nhân *</label>
                  <input
                    type="email"
                    required
                    placeholder="email@tên_miền.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">SĐT di động</label>
                  <input
                    type="tel"
                    placeholder="Số liên lạc gấp..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
              </div>

              {/* Salary & Hire Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Định ngạch lương tháng *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={salary}
                    onChange={(e) => setSalary(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Ngày tiếp nhận việc</label>
                  <input
                    type="date"
                    required
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Submit buttons */}
              <div className="flex justify-end gap-2 text-xs pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-slate-50 text-gray-600 font-semibold focus:outline-hidden"
                >
                  Đóng lại
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs transition-all cursor-pointer focus:outline-hidden"
                >
                  Thực hiện tiếp nhận
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
