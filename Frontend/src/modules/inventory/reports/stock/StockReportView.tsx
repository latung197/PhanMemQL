import React from 'react';
import { PieChart, AlertTriangle, Layers, DollarSign } from 'lucide-react';
import { StatCard } from '../../../../components/common/StatCard';
import { Card } from '../../../../components/common/Card';
import { Badge } from '../../../../components/common/Badge';
import { Product } from '../../../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface StockReportViewProps {
  products: Product[];
}

export const StockReportView: React.FC<StockReportViewProps> = ({ products }) => {
  const totalItemsCount = products.reduce((acc, p) => acc + p.quantity, 0);
  const totalStockValue = products.reduce((acc, p) => acc + p.quantity * p.price, 0);
  const lowStockProducts = products.filter(p => p.quantity <= p.minThreshold);

  const chartData = products.map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
    'Số lượng tồn': p.quantity,
    'Ngưỡng an toàn': p.minThreshold
  }));

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Báo Cáo Giá Trị Tồn Kho Thời Gian Thực
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tổng hợp cơ cấu lượng hàng tồn, giá trị vốn lưu động và mức độ an toàn kho</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Tổng Số Lượng Tồn Kho"
          value={`${totalItemsCount.toLocaleString()} đơn vị`}
          subtitle={`Trên tổng số ${products.length} mã SKU vật tư`}
          icon={<Layers className="h-6 w-6" />}
          colorTheme="indigo"
        />
        <StatCard
          title="Tổng Giá Trị Tồn Kho"
          value={formatVND(totalStockValue)}
          subtitle="Tính theo giá bán niêm yết hiện hành"
          icon={<DollarSign className="h-6 w-6" />}
          colorTheme="emerald"
        />
        <StatCard
          title="Cảnh Báo Chạm Ngưỡng Hết"
          value={`${lowStockProducts.length} sản phẩm`}
          subtitle="Cần lập lệnh nhập hàng gấp"
          icon={<AlertTriangle className="h-6 w-6" />}
          colorTheme="rose"
        />
      </div>

      <Card title="Biểu Đồ Mức Tồn Kho So Với Ngưỡng An Toàn (Min Threshold)">
        <div className="h-72 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} angle={-15} textAnchor="end" />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
              <Bar dataKey="Số lượng tồn" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Ngưỡng an toàn" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
