import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Layers, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShoppingBag,
  Bell,
  CheckCircle,
  FileText
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { ERPData, Product, SalesOrder, Transaction } from '../types';

interface DashboardViewProps {
  data: ERPData;
  onNavigate: (module: 'Tổng quan' | 'Bán hàng' | 'Kho hàng' | 'Nhân sự' | 'Tài chính' | 'Trợ lý AI') => void;
  onQuickSale: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate, onQuickSale }) => {
  // Format price helper
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // 1. Calculations for KPIs
  const totalRevenue = useMemo(() => {
    return data.orders
      .filter(o => o.status === 'Hoàn thành')
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [data.orders]);

  const totalExpense = useMemo(() => {
    return data.transactions
      .filter(t => t.type === 'Chi')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [data.transactions]);

  const netProfit = totalRevenue - totalExpense;

  const lowStockProducts = useMemo(() => {
    return data.products.filter(p => p.quantity <= p.minThreshold);
  }, [data.products]);

  const pendingOrders = useMemo(() => {
    return data.orders.filter(o => o.status === 'Đang xử lý');
  }, [data.orders]);

  // 2. Chart Data: Monthly Cashflow aggregation
  // Grouping recent transactions for cashflow comparison
  const chartCashflowData = useMemo(() => {
    // We mock a timeline of recent transactions for visual effect, using actual transactions or dynamic categorization
    return [
      { name: 'Tháng 1', Thu: 120000000, Chi: 90000000, Profit: 30000000 },
      { name: 'Tháng 2', Thu: 145000000, Chi: 85000000, Profit: 60000000 },
      { name: 'Tháng 3', Thu: 110000000, Chi: 115000000, Profit: -500000 },
      { name: 'Tháng 4', Thu: 180000000, Chi: 110000000, Profit: 70000000 },
      { name: 'Tháng 5', Thu: totalRevenue, Chi: totalExpense, Profit: totalRevenue - totalExpense },
    ];
  }, [totalRevenue, totalExpense]);

  // 3. Category distribution data for visual Pie graph
  const categoryChartData = useMemo(() => {
    const counts: { [key: string]: { name: string; value: number } } = {};
    data.products.forEach(p => {
      if (!counts[p.category]) {
        counts[p.category] = { name: p.category, value: 0 };
      }
      counts[p.category].value += p.quantity;
    });
    return Object.values(counts);
  }, [data.products]);

  const PIE_COLORS = ['#3bb273', '#4d9de0', '#e1bc29', '#f26419', '#8c5383'];

  return (
    <div className="space-y-6" id="dashboard-root-view">
      {/* 4. Banner Alert for Critical issues */}
      {(lowStockProducts.length > 0 || pendingOrders.length > 0) && (
        <div className="flex flex-col md:flex-row gap-3 bg-rose-50 border border-rose-100 p-4 rounded-xl shadow-xs" id="critical-alerts-banner">
          <div className="flex items-center gap-2 text-rose-700 font-medium">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Cảnh báo hệ thống:</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-rose-600">
            {lowStockProducts.length > 0 && (
              <button 
                onClick={() => onNavigate('Kho hàng')}
                className="hover:underline flex items-center gap-1.5 focus:outline-hidden"
              >
                <span>● {lowStockProducts.length} sản phẩm sắp hết kho</span>
              </button>
            )}
            {pendingOrders.length > 0 && (
              <button 
                onClick={() => onNavigate('Bán hàng')}
                className="hover:underline flex items-center gap-1.5 focus:outline-hidden"
              >
                <span>● {pendingOrders.length} đơn hàng cần xử lý gấp</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="stats-bento-grid">
        {/* Metric Card 1: Revenue */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Tổng thu nhập (Doanh thu)</p>
              <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight">{formatVND(totalRevenue)}</h3>
            </div>
            <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600">
            <ArrowUpRight className="h-4 w-4" />
            <span className="font-semibold">+18.4%</span>
            <span className="text-gray-400">so với tháng trước</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-b-2xl"></div>
        </div>

        {/* Metric Card 2: Expense */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Tổng chi phí vận hành</p>
              <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight">{formatVND(totalExpense)}</h3>
            </div>
            <span className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-rose-600">
            <ArrowDownRight className="h-4 w-4" />
            <span className="font-semibold">+4.2%</span>
            <span className="text-gray-400">so với tháng trước</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500 rounded-b-2xl"></div>
        </div>

        {/* Metric Card 3: Inventory value */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs relative overflow-hidden group hover:border-amber-200 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Tổng sản phẩm tồn kho</p>
              <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
                {data.products.reduce((acc, p) => acc + p.quantity, 0)} <span className="text-sm font-normal text-gray-500">mã</span>
              </h3>
            </div>
            <span className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Layers className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold">{lowStockProducts.length} mặt hàng</span>
            <span className="text-gray-400">ở dưới mức an toàn</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-b-2xl"></div>
        </div>

        {/* Metric Card 4: Employees/Headcount */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Tổng số Nhân sự</p>
              <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
                {data.employees.filter(e => e.status !== 'Đã nghỉ việc').length} <span className="text-sm font-normal text-gray-500">nhân sự</span>
              </h3>
            </div>
            <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-blue-600">
            <CheckCircle className="h-4 w-4" />
            <span className="font-semibold">100% hoạt động</span>
            <span className="text-gray-400">hoàn thành đúng ca</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-b-2xl"></div>
        </div>
      </div>

      {/* 6. Main Interactive Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-panel">
        {/* Left Chart: Cashflow Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
            <div>
              <h4 className="font-bold text-gray-900">Biểu đồ dòng tiền (Doanh thu & Chi phí)</h4>
              <p className="text-xs text-gray-500">So sánh dòng tiền Thu - Chi tích lũy hàng tháng</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span> Doanh thu
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block"></span> Chi phi
              </span>
            </div>
          </div>
          <div className="h-72 w-full mt-2" id="cashflow-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartCashflowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorThu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorChi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`}
                />
                <Tooltip 
                  formatter={(value: any) => [formatVND(Number(value)), '']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #f3f4f6', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="Thu" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorThu)" />
                <Area type="monotone" dataKey="Chi" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorChi)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Category Pie Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-gray-900">Phân Phối Tồn Kho Theo Ngành</h4>
            <p className="text-xs text-gray-500 mb-4">Phần trăm số lượng tồn kho của các nhóm sản phẩm</p>
          </div>
          <div className="h-56 w-full flex items-center justify-center relative" id="pie-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${val} sản phẩm`, 'Số lượng']} />
              </PieChart>
            </ResponsiveContainer>
            {/* Inner absolute label center */}
            <div className="absolute text-center">
              <p className="text-2xl font-bold text-gray-800 font-mono">
                {data.products.reduce((acc, p) => acc + p.quantity, 0)}
              </p>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Tồn kho</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] mt-2 border-t border-gray-50 pt-3">
            {categoryChartData.map((d, index) => (
              <div key={d.name} className="flex items-center gap-1.5 truncate">
                <span className="h-2 w-2 rounded-xs shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                <span className="text-gray-600 truncate">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. Bottom Bento Row: Interactive quick entries & alerts & logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-bottom-panel">
        
        {/* Left Box: Quick Actions Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-gray-900">Tính năng Truy Cập Nhanh</h4>
            <p className="text-xs text-gray-500 mb-4">Các tác vụ ERP khẩn cấp thường được thiết lập</p>
          </div>
          <div className="space-y-3">
            <button 
              onClick={onQuickSale}
              className="w-full flex items-center justify-between p-3.5 bg-emerald-50 text-emerald-800 rounded-xl hover:bg-emerald-100/80 hover:scale-[1.01] transition-all text-left font-medium text-sm border border-emerald-100 focus:outline-hidden"
              id="action-btn-quick-sale"
            >
              <span className="flex items-center gap-2.5">
                <ShoppingBag className="h-4 w-4 shrink-0" />
                Đăng ký đơn hàng bán lẻ mới
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button 
              onClick={() => onNavigate('Trợ lý AI')}
              className="w-full flex items-center justify-between p-3.5 bg-indigo-50 text-indigo-800 rounded-xl hover:bg-indigo-100/80 hover:scale-[1.01] transition-all text-left font-medium text-sm border border-indigo-100 focus:outline-hidden"
              id="action-btn-ai-consult"
            >
              <span className="flex items-center gap-2.5">
                <Bell className="h-4 w-4 shrink-0 text-indigo-600 animate-pulse" />
                Hỏi Trợ lý AI báo cáo tài chính
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button 
              onClick={() => onNavigate('Kho hàng')}
              className="w-full flex items-center justify-between p-3.5 bg-amber-50 text-amber-800 rounded-xl hover:bg-amber-100/80 hover:scale-[1.01] transition-all text-left font-medium text-sm border border-amber-100 focus:outline-hidden"
              id="action-btn-check-stock"
            >
              <span className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 shrink-0" />
                Kiểm kho và hiệu chỉnh tịnh tiến
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <button 
              onClick={() => onNavigate('Nhân sự')}
              className="w-full flex items-center justify-between p-3.5 bg-blue-50 text-blue-800 rounded-xl hover:bg-blue-100/80 hover:scale-[1.01] transition-all text-left font-medium text-sm border border-blue-100 focus:outline-hidden"
              id="action-btn-recruit"
            >
              <span className="flex items-center gap-2.5">
                <Users className="h-4 w-4 shrink-0" />
                Tiếp nhận hồ sơ nhân sự mới
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-4 text-center">
            Mọi thao tác thay đổi ở hệ thống con sẽ tự cập nhật lên Tổng quan.
          </div>
        </div>

        {/* Right 2 columns: Recent activities */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-gray-900">Lịch sử Hoạt động Doanh nghiệp</h4>
              <span className="text-[10px] bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded-full">Real-time</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">Các thao tác của các bộ phận ERP trong hệ thống</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto pr-1">
            {data.activities.slice().reverse().map((act) => (
              <div key={act.id} className="py-3 flex items-start gap-3 text-xs leading-relaxed hover:bg-gray-50/50 rounded-sm px-1.5 transition-all">
                <span className={`px-2 py-0.5 rounded-sm font-semibold shrink-0 text-[10px] tracking-wide ${
                  act.module === 'Bán hàng' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  act.module === 'Kho hàng' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  act.module === 'Nhân sự' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                  act.module === 'Tài chính' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                  act.module === 'Trợ lý AI' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                  'bg-gray-50 text-gray-700 border border-gray-100'
                }`}>
                  {act.module}
                </span>
                <div className="grow">
                  <p className="text-gray-800 font-medium">{act.action}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Thực hiện bởi <strong className="text-gray-600 font-normal">{act.user}</strong> vào {act.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 text-right text-xs">
            <button 
              onClick={() => onNavigate('Bán hàng')}
              className="text-indigo-600 font-semibold hover:underline flex items-center gap-1 ml-auto focus:outline-hidden"
            >
              Xem chi tiết hóa đơn của đơn hàng <FileText className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
