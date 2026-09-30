import React from 'react';
import { PieChart, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Order, Customer } from '../../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface SalesReportViewProps {
  orders: Order[];
  customers: Customer[];
}

export const SalesReportView: React.FC<SalesReportViewProps> = ({ orders, customers }) => {
  const totalRevenue = orders
    .filter(o => o.status !== 'Đã hủy')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  const completedOrdersCount = orders.filter(o => o.status === 'Đã hoàn thành').length;

  const chartData = [
    { name: 'T1', 'Doanh số': 45000000 },
    { name: 'T2', 'Doanh số': 58000000 },
    { name: 'T3', 'Doanh số': 62000000 },
    { name: 'T4', 'Doanh số': 85000000 },
    { name: 'T5', 'Doanh số': 92000000 },
    { name: 'T6 (Hiện tại)', 'Doanh số': totalRevenue }
  ];

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Báo Cáo Doanh Số Bán Hàng & Công Nợ
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Phân tích tổng hợp doanh thu bán hàng, tăng trưởng theo tháng và công nợ phải thu</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Tổng Doanh Thu Đã Phát Sinh"
          value={formatVND(totalRevenue)}
          subtitle="Tích lũy từ tất cả hợp đồng và hóa đơn"
          icon={<DollarSign className="h-6 w-6" />}
          colorTheme="indigo"
          trend="+18.4% so với tháng trước"
        />
        <StatCard
          title="Số Đơn Hoàn Tất Phê Duyệt"
          value={`${completedOrdersCount} / ${orders.length} đơn`}
          subtitle="Tỷ lệ giao hàng thành công cao"
          icon={<TrendingUp className="h-6 w-6" />}
          colorTheme="emerald"
        />
        <StatCard
          title="Tổng Số Đối Tác Khách Hàng"
          value={`${customers.length} công ty`}
          subtitle="Khách hàng tích cực tương tác"
          icon={<Users className="h-6 w-6" />}
          colorTheme="sky"
        />
      </div>

      <Card title="Xu Hướng Doanh Số Tăng Trưởng (Đơn vị: VNĐ)">
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
              <Area type="monotone" dataKey="Doanh số" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
