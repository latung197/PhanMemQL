import React from 'react';
import { PieChart, Users, Building2, UserPlus, UserCheck } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Employee } from '../../types';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface HRReportViewProps {
  employees: Employee[];
}

export const HRReportView: React.FC<HRReportViewProps> = ({ employees }) => {
  const departmentCounts: Record<string, number> = {};
  employees.forEach(e => {
    departmentCounts[e.department] = (departmentCounts[e.department] || 0) + 1;
  });

  const pieData = Object.keys(departmentCounts).map(dept => ({
    name: dept,
    value: departmentCounts[dept]
  }));

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Báo Cáo Cơ Cấu Nhân Sự & Biến Động Định Biên
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Phân tích tỷ lệ phân bổ cán bộ theo phòng ban và xu hướng nhân sự toàn tập đoàn</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Tổng Cán Bộ Nhân Sự"
          value={`${employees.length} nhân sự`}
          subtitle="Hợp đồng lao động chính thức"
          icon={<Users className="h-6 w-6" />}
          colorTheme="indigo"
        />
        <StatCard
          title="Số Phòng Ban Hoạt Động"
          value={`${Object.keys(departmentCounts).length} phòng ban`}
          subtitle="Cấu trúc tổ chức tinh gọn"
          icon={<Building2 className="h-6 w-6" />}
          colorTheme="emerald"
        />
        <StatCard
          title="Thành Viên Mới Trong Tháng"
          value="+2 nhân sự"
          subtitle="Tỷ lệ giữ chân nhân tài: 98%"
          icon={<UserPlus className="h-6 w-6" />}
          colorTheme="sky"
        />
      </div>

      <Card title="Tỷ Lệ Tương Quan Cán Bộ Phân Bổ Theo Phòng Ban">
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
