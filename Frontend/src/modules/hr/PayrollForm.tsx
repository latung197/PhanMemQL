import React from 'react';
import { DollarSign, CheckCircle2, FileText, Calendar } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Employee } from '../../types';

interface PayrollFormProps {
  employees: Employee[];
}

export const PayrollForm: React.FC<PayrollFormProps> = ({ employees }) => {
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  const totalMonthlyPayroll = employees.reduce((acc, e) => acc + e.salary, 0);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Bảng Chấm Công & Tổng Quỹ Lương Tháng 06/2026
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Xác nhận ngày công thực tế, phụ cấp công tác và tổng quỹ lương chi trả</p>
        </div>

        <div className="text-right">
          <p className="text-[10px] uppercase font-bold text-slate-400">Tổng Quỹ Lương Tháng</p>
          <p className="text-lg font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{formatVND(totalMonthlyPayroll)}</p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Mã NV / Họ Tên</th>
                <th className="py-3 px-4">Chức Danh & Phòng Ban</th>
                <th className="py-3 px-4 text-center">Số Ngày Công Tích Lũy</th>
                <th className="py-3 px-4 text-right">Lương Cơ Bản</th>
                <th className="py-3 px-4 text-right">Phụ Cấp KPI</th>
                <th className="py-3 px-4 text-right">Thực Lĩnh</th>
                <th className="py-3 px-4 text-center">Trạng Thái Chi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {employees.map(emp => {
                const workDays = 22;
                const bonus = emp.salary * 0.1;
                const netSalary = emp.salary + bonus;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{emp.name}</p>
                      <span className="font-mono text-[10px] text-slate-400">{emp.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{emp.position}</p>
                      <p className="text-[10px] text-slate-400">{emp.department}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono">{workDays}/22 ngày</td>
                    <td className="py-3 px-4 text-right font-mono">{formatVND(emp.salary)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">+{formatVND(bonus)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                      {formatVND(netSalary)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="success">Đã duyệt chi</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
