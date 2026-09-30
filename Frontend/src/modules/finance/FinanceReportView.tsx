import React from 'react';
import { PieChart, ArrowDownLeft, ArrowUpRight, DollarSign } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { FinancialTransaction } from '../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface FinanceReportViewProps {
  transactions: FinancialTransaction[];
}

export const FinanceReportView: React.FC<FinanceReportViewProps> = ({ transactions }) => {
  const totalIncome = transactions
    .filter(t => t.type === 'Thu')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'Chi')
    .reduce((acc, t) => acc + t.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const chartData = [
    { name: 'Tháng 1', 'Tổng Thu': 120000000, 'Tổng Chi': 75000000 },
    { name: 'Tháng 2', 'Tổng Thu': 145000000, 'Tổng Chi': 88000000 },
    { name: 'Tháng 3', 'Tổng Thu': 180000000, 'Tổng Chi': 92000000 },
    { name: 'Tháng 4', 'Tổng Thu': 210000000, 'Tổng Chi': 110000000 },
    { name: 'Tháng 5', 'Tổng Thu': 240000000, 'Tổng Chi': 125000000 },
    { name: 'Tháng 6 (Hiện tại)', 'Tổng Thu': totalIncome, 'Tổng Chi': totalExpense }
  ];

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Báo Cáo Sổ Quỹ Thu Chi & Lợi Nhuận Ròng (P&L)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tổng hợp dòng tiền vào/ra toàn công ty và cán cân lợi nhuận ròng</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Tổng Dòng Tiền Thu Vào"
          value={formatVND(totalIncome)}
          subtitle="Tích lũy từ tất cả phiếu thu"
          icon={<ArrowDownLeft className="h-6 w-6" />}
          colorTheme="emerald"
        />
        <StatCard
          title="Tổng Dòng Tiền Chi Ra"
          value={formatVND(totalExpense)}
          subtitle="Tích lũy từ tất cả phiếu chi"
          icon={<ArrowUpRight className="h-6 w-6" />}
          colorTheme="rose"
        />
        <StatCard
          title="Lợi Nhuận Ròng (Net Cash)"
          value={formatVND(netProfit)}
          subtitle="Tổng Thu trừ Tổng Chi"
          icon={<DollarSign className="h-6 w-6" />}
          colorTheme={netProfit >= 0 ? 'indigo' : 'amber'}
        />
      </div>

      <Card title="So Sánh Dòng Tiền Thu Chi Tích Lũy Theo Tháng (VNĐ)">
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Tổng Thu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Tổng Chi" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
