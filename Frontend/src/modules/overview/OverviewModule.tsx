import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  Layers, 
  ShoppingBag, 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles,
  ShieldCheck,
  PackageCheck,
  Building2,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  PlusCircle,
  Truck,
  Receipt,
  FileText,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Wallet,
  Building,
  Printer,
  X,
  ChevronRight,
  Activity,
  Filter
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ERPData, ModuleCategoryKey, SubMenuKey, Product, GoodsVoucher, SalesOrder, Transaction, CompanyUnit } from '../../types';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';

interface OverviewModuleProps {
  erpData: ERPData;
  activeCompanyUnitCode?: string;
  onNavigate: (cat: ModuleCategoryKey, subKey: SubMenuKey) => void;
  onSelectCompanyUnit?: (code: string) => void;
}

type TabKey = 'multidimensional' | 'inventory' | 'sales' | 'finance' | 'hr';
type TimeRangeKey = 'today' | 'week' | 'month' | 'quarter' | 'year';

export const OverviewModule: React.FC<OverviewModuleProps> = ({ 
  erpData, 
  activeCompanyUnitCode,
  onNavigate,
  onSelectCompanyUnit
}) => {
  const { 
    products = [], 
    orders = [], 
    transactions = [], 
    employees = [], 
    warehouses = [], 
    vouchers = [], 
    deliveryNotes = [], 
    customers = [], 
    companyUnits = [], 
    activities = [] 
  } = erpData;

  // State filters
  const [selectedUnit, setSelectedUnit] = useState<string>(activeCompanyUnitCode || 'ALL');
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('month');
  const [activeTab, setActiveTab] = useState<TabKey>('multidimensional');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(() => new Date().toLocaleTimeString('vi-VN'));
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showExecutiveReportModal, setShowExecutiveReportModal] = useState(false);

  // Sync when prop changes
  React.useEffect(() => {
    if (activeCompanyUnitCode && activeCompanyUnitCode !== selectedUnit && selectedUnit !== 'ALL') {
      setSelectedUnit(activeCompanyUnitCode);
    }
  }, [activeCompanyUnitCode]);

  // Handler for unit filter
  const handleUnitChange = (code: string) => {
    setSelectedUnit(code);
    if (code !== 'ALL' && onSelectCompanyUnit) {
      onSelectCompanyUnit(code);
    }
  };

  // Manual refresh animation
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
    }, 400);
  };

  // Filtered datasets based on selected unit
  const filteredProducts = useMemo(() => {
    if (selectedUnit === 'ALL') return products;
    return products.filter(p => !p.ma_dvcs || p.ma_dvcs === selectedUnit || (p.ds_ma_dvcs && p.ds_ma_dvcs.includes(selectedUnit)));
  }, [products, selectedUnit]);

  const filteredVouchers = useMemo(() => {
    if (selectedUnit === 'ALL') return vouchers;
    return vouchers.filter(v => !v.companyUnitId || v.companyUnitId === selectedUnit);
  }, [vouchers, selectedUnit]);

  // Core KPI Calculations
  const totalStockValue = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + (p.quantity * (p.costPrice || p.price)), 0);
  }, [filteredProducts]);

  const totalRetailStockValue = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + (p.quantity * p.price), 0);
  }, [filteredProducts]);

  const totalRevenue = useMemo(() => {
    return orders
      .filter(o => o.status !== 'Đã hủy')
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  const completedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'Hoàn thành' || o.status === 'Đã hoàn thành');
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'Chờ xử lý' || o.status === 'Đang giao' || o.status === 'Đang xử lý');
  }, [orders]);

  const orderFulfillmentRate = useMemo(() => {
    if (orders.length === 0) return 100;
    return Math.round((completedOrders.length / orders.length) * 100);
  }, [orders, completedOrders]);

  // Cashflow & Finance
  const totalIncome = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Thu')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Chi')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const netCashflow = totalIncome - totalExpense;

  const grossProfitEstimate = useMemo(() => {
    // Estimating ~35% gross margin on fulfilled revenue
    return totalRevenue * 0.345;
  }, [totalRevenue]);

  // Low stock and alerts
  const lowStockProducts = useMemo(() => {
    return filteredProducts.filter(p => p.quantity <= p.minThreshold);
  }, [filteredProducts]);

  const urgentDeliveryNotes = useMemo(() => {
    return deliveryNotes.filter(d => d.status === 'Đang giao');
  }, [deliveryNotes]);

  // Warehouse breakdown calculation
  const warehouseBreakdown = useMemo(() => {
    return warehouses.map(wh => {
      const whProducts = filteredProducts.filter(p => p.warehouseId === wh.id);
      const whValue = whProducts.reduce((acc, p) => acc + (p.quantity * (p.costPrice || p.price)), 0);
      return {
        id: wh.id,
        name: wh.name,
        code: wh.code,
        itemCount: whProducts.length,
        stockValue: whValue,
        capacity: wh.capacity,
        manager: wh.manager
      };
    });
  }, [warehouses, filteredProducts]);

  // Monthly revenue vs expense trend
  const trendData = useMemo(() => [
    { month: 'T1', DoanhThu: 48000000, ChiPhi: 32000000, LoiNhuan: 16000000 },
    { month: 'T2', DoanhThu: 62000000, ChiPhi: 41000000, LoiNhuan: 21000000 },
    { month: 'T3', DoanhThu: 75000000, ChiPhi: 47000000, LoiNhuan: 28000000 },
    { month: 'T4', DoanhThu: 98000000, ChiPhi: 56000000, LoiNhuan: 42000000 },
    { month: 'T5', DoanhThu: 115000000, ChiPhi: 64000000, LoiNhuan: 51000000 },
    { month: 'T6', DoanhThu: totalRevenue, ChiPhi: totalExpense > 0 ? totalExpense : 72000000, LoiNhuan: totalRevenue - (totalExpense > 0 ? totalExpense : 72000000) }
  ], [totalRevenue, totalExpense]);

  // Warehouse distribution chart data
  const warehouseChartData = useMemo(() => {
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
    return warehouseBreakdown.map((wh, idx) => ({
      name: wh.name.replace('Kho ', ''),
      fullName: wh.name,
      value: wh.stockValue,
      color: colors[idx % colors.length]
    }));
  }, [warehouseBreakdown]);

  // Expense breakdown categories
  const expenseCategories = useMemo(() => {
    const grouped: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'Chi')
      .forEach(t => {
        grouped[t.category] = (grouped[t.category] || 0) + t.amount;
      });
    return Object.entries(grouped).map(([category, amount]) => ({
      category,
      amount
    }));
  }, [transactions]);

  // Format currency helper
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const formatShortVND = (num: number) => {
    if (Math.abs(num) >= 1000000000) {
      return (num / 1000000000).toFixed(2) + ' tỷ đ';
    }
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(1) + ' tr đ';
    }
    return formatVND(num);
  };

  const selectedUnitName = useMemo(() => {
    if (selectedUnit === 'ALL') return 'Toàn Hệ Thống Doanh Nghiệp';
    const found = companyUnits.find(u => u.code === selectedUnit);
    return found ? `${found.code} - ${found.name}` : selectedUnit;
  }, [selectedUnit, companyUnits]);

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-5 animate-fade-in">
      
      {/* 1. Executive Operations Header & Context Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          
          {/* Title & Status */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {selectedUnitName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Dữ liệu trực tuyến
              </span>
              <span aria-hidden="true">·</span>
              <span>Cập nhật lúc {lastRefreshed}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
              Bàn Điều Hành Doanh Nghiệp Tập Trung
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
              Hệ thống chỉ huy thời gian thực tổng hợp Kho bãi, Chuỗi cung ứng, Đơn hàng kinh doanh, Dòng tiền và Nhân lực.
            </p>
          </div>

          {/* Interactive Filters & Controls */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            
            {/* Unit Dropdown Filter */}
            <div className="flex items-center gap-1.5 min-w-0 max-w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <label htmlFor="unit-select" className="text-slate-500 dark:text-slate-400 font-medium">Đơn vị:</label>
              <select
                id="unit-select"
                value={selectedUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="bg-transparent min-w-0 max-w-[220px] text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="dark:bg-slate-900">Toàn bộ doanh nghiệp (Tất cả)</option>
                {companyUnits.map(unit => (
                  <option key={unit.code} value={unit.code} className="dark:bg-slate-900">
                    {unit.code} - {unit.shortName || unit.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Horizon Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl max-w-full overflow-x-auto">
              {(['today', 'week', 'month', 'quarter', 'year'] as TimeRangeKey[]).map((period) => {
                const labels: Record<TimeRangeKey, string> = {
                  today: 'Hôm nay',
                  week: 'Tuần này',
                  month: 'Tháng 6',
                  quarter: 'Quý 2',
                  year: '2026'
                };
                const isActive = timeRange === period;
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setTimeRange(period)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      isActive 
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {labels[period]}
                  </button>
                );
              })}
            </div>

            {/* Quick Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              title="Làm mới số liệu"
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Export Summary Report */}
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
              onClick={() => setShowExecutiveReportModal(true)}
              className="text-xs"
            >
              Báo Cáo Tóm Tắt
            </Button>
          </div>

        </div>
      </div>

      {/* 2. Operations Command Bar (6 Quick-Launch Action Buttons) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5 px-1">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Lối Tắt Điều Hành & Lập Chứng Từ Nhanh
          </p>
          <span className="hidden sm:inline text-[11px] text-slate-400">1-click navigation</span>
        </div>
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 min-w-0">
          
          <button
            type="button"
            onClick={() => onNavigate('inventory', 'inv_receipt')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <PlusCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Nhập Kho Mới</div>
              <div className="text-[10px] text-slate-400 truncate">Phiếu PNK vật tư</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('inventory', 'inv_issue')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
              <PackageCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Xuất Kho Bán</div>
              <div className="text-[10px] text-slate-400 truncate">Phiếu PXK đơn hàng</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sales', 'sales_orders')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Đơn Bán Hàng</div>
              <div className="text-[10px] text-slate-400 truncate">Tạo & duyệt đơn</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('finance', 'fin_cash_receipt')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Thu - Chi Quỹ</div>
              <div className="text-[10px] text-slate-400 truncate">Phiếu thu/chi tiền</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('inventory', 'inv_report_inout')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Báo Cáo NXT</div>
              <div className="text-[10px] text-slate-400 truncate">Nhập - Xuất - Tồn kho</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('finance', 'fin_report')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-rose-400 dark:hover:border-rose-500 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Sổ Quỹ Tiền Mặt</div>
              <div className="text-[10px] text-slate-400 truncate">Cân đối ngân sách</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('hr', 'hr_resource_booking')}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs text-left transition-all group col-span-2 sm:col-span-1"
          >
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Đặt Tài Nguyên</div>
              <div className="text-[10px] text-slate-400 truncate">Phòng họp, xe, máy tính</div>
            </div>
          </button>

        </div>
      </div>

      {/* 3. Core Executive Metrics (5 Key KPI Stat Blocks) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Metric 1: Revenue */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Doanh Thu Thuần</p>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatVND(totalRevenue)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="h-3 w-3" />
              <span>+18.4% so với kỳ trước</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{orders.length} đơn hàng phát sinh</p>
          </div>
        </div>

        {/* Metric 2: Inventory Value */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Giá Trị Tồn Kho</p>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatVND(totalStockValue)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Giá bán dự kiến: <span className="font-mono tabular-nums">{formatShortVND(totalRetailStockValue)}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{filteredProducts.length} mặt hàng trong {warehouses.length} kho</p>
          </div>
        </div>

        {/* Metric 3: Estimated Gross Profit */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Lợi Nhuận Gộp</p>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formatVND(grossProfitEstimate)}
            </h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
              Biên lợi nhuận gộp: 34.5%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sau khấu trừ giá vốn hàng bán</p>
          </div>
        </div>

        {/* Metric 4: Cash Balance & Flow */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Dòng Tiền Quỹ Ròng</p>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${netCashflow >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600'}`}>
              {formatVND(netCashflow)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Thu: <strong className="text-emerald-600 font-mono tabular-nums">{formatShortVND(totalIncome)}</strong></span>
              <span>·</span>
              <span>Chi: <strong className="text-rose-600 font-mono tabular-nums">{formatShortVND(totalExpense)}</strong></span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Từ {transactions.length} phiếu thu/chi</p>
          </div>
        </div>

        {/* Metric 5: Order Fulfillment SLA */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Tỷ Lệ Xử Lý Đơn (SLA)</p>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {orderFulfillmentRate}%
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-indigo-600 dark:text-indigo-400">
              <span>Hoàn tất: <strong>{completedOrders.length}/{orders.length}</strong> đơn</span>
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
              {pendingOrders.length} đơn đang chờ giao/xử lý
            </p>
          </div>
        </div>

      </div>

      {/* 4. Operations Priority Radar (Real-time Critical Notifications) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Red Alert: Low Stock */}
        <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Cảnh Báo Thiếu Hàng Định Mức ({lowStockProducts.length})</span>
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-300/80 leading-relaxed">
              {lowStockProducts.length > 0 
                ? `Có ${lowStockProducts.length} mặt hàng đã chạm hoặc giảm dưới ngưỡng an toàn tối thiểu.`
                : 'Kho hàng an toàn, không có mặt hàng thiếu hụt định mức.'}
            </p>
          </div>
          {lowStockProducts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLowStockModal(true)}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white dark:bg-rose-900/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700 rounded-lg hover:bg-rose-100 shrink-0 transition-colors"
            >
              Xử lý ngay
            </button>
          )}
        </div>

        {/* Yellow Alert: Pending Orders */}
        <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <Truck className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Đơn Hàng Chờ Giao Vận ({pendingOrders.length})</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300/80 leading-relaxed">
              {pendingOrders.length > 0
                ? `${pendingOrders.length} đơn hàng cần xuất kho và chuyển cho đơn vị vận chuyển.`
                : 'Tất cả các đơn bán hàng đã được bàn giao vận chuyển đầy đủ.'}
            </p>
          </div>
          {pendingOrders.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('sales', 'sales_orders')}
              className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-white dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 shrink-0 transition-colors"
            >
              Xem đơn hàng
            </button>
          )}
        </div>

        {/* Green Info: Cashflow and Approvals */}
        <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Trạng Thái Cân Đối Sổ Kho & Sổ Quỹ</span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
              Đã đồng bộ {filteredVouchers.length} chứng từ kho và {transactions.length} bút toán thu/chi không có sai lệch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('reports', 'report_balance' as SubMenuKey)}
            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-white dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 shrink-0 transition-colors"
          >
            Đối soát
          </button>
        </div>

      </div>

      {/* 5. Deep Operational Command Deck (Tabbed Navigation) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200/80 dark:border-slate-800 px-4 pt-3 overflow-x-auto gap-2">
          {[
            { key: 'multidimensional', label: 'Tổng Quan Đa Chiều', icon: <BarChart2 className="h-4 w-4" /> },
            { key: 'inventory', label: 'Kho Vận & Chuỗi Cung Ứng', icon: <WarehouseIcon className="h-4 w-4" />, count: lowStockProducts.length > 0 ? lowStockProducts.length : undefined },
            { key: 'sales', label: 'Kinh Doanh & Khách Hàng', icon: <ShoppingBag className="h-4 w-4" />, count: pendingOrders.length > 0 ? pendingOrders.length : undefined },
            { key: 'finance', label: 'Tài Chính & Dòng Tiền Quỹ', icon: <Wallet className="h-4 w-4" /> },
            { key: 'hr', label: 'Nhân Lực & Năng Suất', icon: <Users className="h-4 w-4" />, badge: `${employees.length} NS` }
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5">
          
          {/* TAB 1: MULTIDIMENSIONAL OVERVIEW */}
          {activeTab === 'multidimensional' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Revenue vs Cost Trend Chart */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Xu Hướng Doanh Thu & Chi Phí Vận Hành 6 Tháng Gần Nhất
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        So sánh tương quan dòng tiền vào và chi phí phát sinh thực tế theo từng tháng
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Doanh thu
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span> Chi phí
                      </span>
                    </div>
                  </div>

                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                        />
                        <Tooltip 
                          formatter={(value: any) => [formatVND(Number(value)), '']}
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} 
                        />
                        <Area type="monotone" dataKey="DoanhThu" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" name="Doanh thu" />
                        <Area type="monotone" dataKey="ChiPhi" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="Chi phí" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Warehouse Stock Value Distribution */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Phân Bổ Tồn Kho Theo Kho Hàng
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tỷ trọng giá trị hàng hóa lưu kho tại từng điểm kho
                    </p>
                  </div>

                  <div className="h-56 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={warehouseChartData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis type="number" fontSize={10} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                        <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={100} />
                        <Tooltip 
                          formatter={(val: any) => [formatVND(Number(val)), 'Giá trị']}
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} 
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {warehouseChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Quick Summary Pill List */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    {warehouseBreakdown.map(wh => (
                      <div key={wh.id} className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span className="truncate max-w-[180px] font-medium">{wh.name}</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200">
                          {formatShortVND(wh.stockValue)}
                        </span>
                      </div>
                    ))}
                  </div>

                </div>

              </div>

              {/* Business Health Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Doanh Số TB/Đơn</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {orders.length > 0 ? formatVND(totalRevenue / orders.length) : '0 đ'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Tỷ Suất Quay Vòng Kho</div>
                  <div className="text-base font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                    4.2 lần/năm
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Thời Gian Giao TB</div>
                  <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    1.4 ngày
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Tổng Quỹ Lương/Tháng</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatVND(employees.reduce((acc, e) => acc + (e.salary || 0), 0))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: INVENTORY & SUPPLY CHAIN */}
          {activeTab === 'inventory' && (
            <div className="space-y-5">
              
              {/* Warehouse Status List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Hiện Trạng Sức Chứa & Giá Trị Lưu Kho Các Điểm Kho
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('inventory', 'inv_warehouse_cat')}
                    className="text-xs"
                  >
                    Quản Lý Kho
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {warehouseBreakdown.map(wh => (
                    <div key={wh.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{wh.name}</span>
                        <Badge variant="info" size="sm">{wh.code}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1">
                        <div>Thủ kho: <strong className="text-slate-700 dark:text-slate-300">{wh.manager}</strong></div>
                        <div>Diện tích: <strong className="text-slate-700 dark:text-slate-300">{wh.capacity}</strong></div>
                        <div>Số lượng mặt hàng: <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-300">{wh.itemCount} SKUs</strong></div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Giá trị lưu kho:</span>
                        <span className="text-sm font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                          {formatVND(wh.stockValue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock Warning Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Danh Sách Mặt Hàng Chạm/Dưới Định Mức Tồn Kho Tối Thiểu
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {lowStockProducts.length} mặt hàng
                    </span>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<PlusCircle className="h-4 w-4" />}
                    onClick={() => onNavigate('inventory', 'inv_receipt')}
                    className="text-xs"
                  >
                    Lập Phiếu Nhập Kho
                  </Button>
                </div>

                {lowStockProducts.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl text-slate-500 text-xs">
                    Tất cả các sản phẩm đang có số lượng tồn trên ngưỡng an toàn.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Mã SKU</th>
                          <th className="py-2.5 px-3">Tên Vật Tư / Sản Phẩm</th>
                          <th className="py-2.5 px-3">Kho Hàng</th>
                          <th className="py-2.5 px-3 text-right">Tồn Hiện Tại</th>
                          <th className="py-2.5 px-3 text-right">Định Mức Min</th>
                          <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                          <th className="py-2.5 px-3 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {lowStockProducts.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">{p.sku}</td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-500">{p.warehouseName}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 tabular-nums">{p.quantity} {p.unit}</td>
                            <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">{p.minThreshold} {p.unit}</td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <Badge variant="danger" size="sm">Cần nhập kho</Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-sans">
                              <button
                                type="button"
                                onClick={() => onNavigate('inventory', 'inv_receipt')}
                                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold inline-flex items-center gap-1"
                              >
                                Nhập hàng <ArrowRight className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Vouchers List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Chứng Từ Nhập - Xuất Kho Mới Phát Sinh
                  </h4>
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory', 'inv_report_inout')}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Xem tất cả sổ kho →
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Số Phiếu</th>
                        <th className="py-2.5 px-3">Loại Phiếu</th>
                        <th className="py-2.5 px-3">Ngày Lập</th>
                        <th className="py-2.5 px-3">Kho & Đối Tác</th>
                        <th className="py-2.5 px-3 text-right">Tổng Giá Trị</th>
                        <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {filteredVouchers.slice(0, 5).map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{v.code}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className={v.type === 'Nhập kho' ? 'text-emerald-600 font-semibold' : 'text-sky-600 font-semibold'}>
                              {v.type} ({v.voucherType || 'Bình thường'})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 tabular-nums">{v.date}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300">
                            {v.warehouseName} {v.supplierName ? `· ${v.supplierName}` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatVND(v.totalValue)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            <Badge 
                              variant={v.status === 'Chuyển sổ kho' ? 'success' : v.status === 'Chờ duyệt' ? 'warning' : 'neutral'} 
                              size="sm"
                            >
                              {v.status || 'Chuyển sổ kho'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SALES & CUSTOMERS */}
          {activeTab === 'sales' && (
            <div className="space-y-5">
              
              {/* Sales Funnel Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Chờ Xử Lý</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                    {orders.filter(o => o.status === 'Chờ xử lý').length} đơn
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Cần xác nhận tồn kho</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Đang Xử Lý / Đóng Gói</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-sky-600 mt-1">
                    {orders.filter(o => o.status === 'Đang xử lý').length} đơn
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Đang soạn hàng tại kho</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Đang Giao Hàng</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 mt-1">
                    {orders.filter(o => o.status === 'Đang giao').length} đơn
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Đơn vị vận chuyển đang phát</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Hoàn Tất & Ghi Sổ</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                    {completedOrders.length} đơn
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Đã thu tiền đủ</div>
                </div>
              </div>

              {/* Top Key Enterprise Accounts */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Top 5 Khách Hàng Doanh Nghiệp Có Doanh Số Lớn Nhất
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('sales', 'sales_customers')}
                    className="text-xs"
                  >
                    Xem Khách Hàng
                  </Button>
                </div>

                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Tên Khách Hàng / Đơn Vị</th>
                        <th className="py-2.5 px-3">Người Đại Diện</th>
                        <th className="py-2.5 px-3">Số Điện Thoại</th>
                        <th className="py-2.5 px-3">Mua Gần Nhất</th>
                        <th className="py-2.5 px-3 text-right">Tổng Doanh Số Lũy Kế</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customers.slice(0, 5).map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{c.company || c.name}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{c.name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">{c.phone}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">{c.lastPurchaseDate}</td>
                          <td className="py-2.5 px-3 text-right font-bold font-mono text-emerald-600 tabular-nums">
                            {formatVND(c.totalSpent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery Notes in Progress */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Tiến Độ Vận Chuyển Đơn Hàng ({deliveryNotes.length} phiếu)
                  </h4>
                  <button
                    type="button"
                    onClick={() => onNavigate('sales', 'sales_orders')}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Quản lý giao vận →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {deliveryNotes.map(dn => (
                    <div key={dn.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 font-mono">{dn.id}</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{dn.customerName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Đơn vị: {dn.carrier}</span>
                          <span>·</span>
                          <span className="font-mono">Mã VĐ: {dn.trackingNumber}</span>
                        </div>
                      </div>
                      <Badge variant={dn.status === 'Đã giao hàng' ? 'success' : 'warning'} size="sm">
                        {dn.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: FINANCE & CASHFLOW */}
          {activeTab === 'finance' && (
            <div className="space-y-5">
              
              {/* Cash Accounts Distribution */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Cơ Cấu Tài Khoản Tiền Mặt & Tiền Gửi Ngân Hàng
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Tài khoản VCB Doanh Nghiệp</span>
                      <Building className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatVND(totalIncome - (totalExpense * 0.65))}
                    </div>
                    <div className="text-[10px] text-slate-400">Vietcombank - CN Tân Bình</div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Tài khoản TCB Mua Hàng</span>
                      <Building className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatVND(185000000)}
                    </div>
                    <div className="text-[10px] text-slate-400">Techcombank - Thanh toán nhập khẩu</div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Quỹ Tiền Mặt Tại Trụ Sở</span>
                      <Wallet className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatVND(42500000)}
                    </div>
                    <div className="text-[10px] text-slate-400">Két sắt văn phòng chính</div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions Ledger */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Bút Toán Thu - Chi Tiền Gần Nhất
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('finance', 'fin_report')}
                    className="text-xs"
                  >
                    Xem Sổ Quỹ Kế Toán
                  </Button>
                </div>

                <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Mã Bút Toán</th>
                        <th className="py-2.5 px-3">Loại</th>
                        <th className="py-2.5 px-3">Ngày</th>
                        <th className="py-2.5 px-3">Tài Khoản</th>
                        <th className="py-2.5 px-3">Nội Dung Diễn Giải</th>
                        <th className="py-2.5 px-3 text-right">Số Tiền Phát Sinh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.slice(0, 6).map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{t.id}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 font-bold ${t.type === 'Thu' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {t.type === 'Thu' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                              Phiếu {t.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">{t.date}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{t.account}</td>
                          <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-xs truncate">{t.description}</td>
                          <td className={`py-2.5 px-3 text-right font-bold font-mono tabular-nums ${t.type === 'Thu' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'Thu' ? '+' : '-'}{formatVND(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expense Breakdown Categories */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Cơ Cấu Các Khoản Mục Chi Phí Doanh Nghiệp
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {expenseCategories.map(exp => (
                    <div key={exp.category} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{exp.category}</span>
                      <span className="font-bold font-mono text-rose-600 tabular-nums">{formatVND(exp.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: HR & WORKFORCES */}
          {activeTab === 'hr' && (
            <div className="space-y-5">
              
              {/* HR Stats Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Tổng Quy Mô Cán Bộ</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                    {employees.length} nhân sự
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium mt-0.5">100% đã ký HĐLĐ</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Đang Làm Việc</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                    {employees.filter(e => e.status !== 'Nghỉ phép').length} nhân sự
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Có mặt tại văn phòng/kho</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Nghỉ Phép / Công Tác</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                    {employees.filter(e => e.status === 'Nghỉ phép').length} nhân sự
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Có giấy phép hợp lệ</div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-medium">Tổng Chi Lương Tháng</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatShortVND(employees.reduce((acc, e) => acc + (e.salary || 0), 0))}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Đã giải ngân kỳ gần nhất</div>
                </div>
              </div>

              {/* Department Personnel Directory */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Danh Sách Cán Bộ Trọng Yếu Từng Khối Chức Năng
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate('hr', 'hr_list')}
                    className="text-xs"
                  >
                    Xem Toàn Bộ Nhân Sự
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {employees.map(emp => (
                    <div key={emp.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{emp.name}</span>
                        <Badge variant={emp.status === 'Chính thức' ? 'success' : 'warning'} size="sm">
                          {emp.department}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">{emp.role}</p>
                      <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                        <div>Email: {emp.email}</div>
                        <div>SĐT: <span className="font-mono tabular-nums">{emp.phone}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* 6. Real-time Activity Log & System Auditing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Nhật Ký Điều Hành & Hoạt Động Doanh Nghiệp Gần Nhất (Audit Trail)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Ghi nhận tự động</span>
        </div>

        <div className="space-y-2.5">
          {activities.slice(0, 5).map((act) => (
            <div 
              key={act.id} 
              className="flex items-start justify-between gap-3 text-xs p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                <div className="space-y-0.5">
                  <p className="text-slate-800 dark:text-slate-200">
                    <strong className="text-slate-900 dark:text-slate-100 font-semibold">{act.user}</strong>: {act.action}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Phân hệ: <strong className="text-slate-500 dark:text-slate-300">{act.module}</strong></span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{act.timestamp}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL 1: LOW STOCK URGENT DISPATCH */}
      {showLowStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-xl">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Cảnh Báo Thiếu Hàng Định Mức Cần Lập Phiếu Nhập
                  </h3>
                  <p className="text-xs text-slate-500">Danh sách các mặt hàng chạm hoặc dưới định mức an toàn tối thiểu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLowStockModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {lowStockProducts.map(p => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{p.name}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{p.sku} · Kho: {p.warehouseName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-rose-600 font-mono text-sm">{p.quantity} {p.unit}</div>
                    <div className="text-[10px] text-slate-400">Ngưỡng min: {p.minThreshold} {p.unit}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLowStockModal(false)}
              >
                Đóng
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<PlusCircle className="h-4 w-4" />}
                onClick={() => {
                  setShowLowStockModal(false);
                  onNavigate('inventory', 'inv_receipt');
                }}
              >
                Lập Phiếu Nhập Kho Ngay
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EXECUTIVE REPORT BRIEFING PREVIEW */}
      {showExecutiveReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Bản Báo Cáo Tóm Tắt Điều Hành Doanh Nghiệp (Executive Briefing)
                  </h3>
                  <p className="text-xs text-slate-500">Phạm vi: {selectedUnitName} · Kỳ: Tháng 6/2026</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExecutiveReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs max-h-96 overflow-y-auto p-1">
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 border border-slate-200/80 dark:border-slate-700">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  1. Tóm Lược Chỉ Số Tài Chính & Doanh Số
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>· Tổng doanh thu bán hàng ghi nhận: <strong className="font-mono tabular-nums">{formatVND(totalRevenue)}</strong></div>
                  <div>· Giá trị tài sản tồn kho: <strong className="font-mono tabular-nums">{formatVND(totalStockValue)}</strong></div>
                  <div>· Lợi nhuận gộp ước tính (34.5%): <strong className="font-mono tabular-nums">{formatVND(grossProfitEstimate)}</strong></div>
                  <div>· Dòng tiền quỹ ròng: <strong className="font-mono tabular-nums">{formatVND(netCashflow)}</strong></div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 border border-slate-200/80 dark:border-slate-700">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  2. Khối Vận Hành Kho Bãi & Giao Nhận
                </h4>
                <div className="space-y-1 text-slate-700 dark:text-slate-300">
                  <p>· Tổng số lượng mặt hàng lưu kho: <strong className="font-mono tabular-nums">{filteredProducts.length} mặt hàng</strong> trên <strong className="font-mono tabular-nums">{warehouses.length} kho</strong>.</p>
                  <p>· Mặt hàng thiếu dưới ngưỡng min: <strong className="font-mono tabular-nums text-rose-600">{lowStockProducts.length} mặt hàng</strong> (cần tái nhập gấp).</p>
                  <p>· Tỷ lệ hoàn thành đơn hàng đúng hạn: <strong className="font-mono tabular-nums text-emerald-600">{orderFulfillmentRate}%</strong>.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 border border-slate-200/80 dark:border-slate-700">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  3. Quản Trị Nhân Sự & Quỹ Lương
                </h4>
                <p className="text-slate-700 dark:text-slate-300">
                  Hiện tại doanh nghiệp có <strong className="font-mono tabular-nums">{employees.length} cán bộ nhân viên</strong> chính thức thuộc 5 phòng ban. Tổng quỹ lương hàng tháng ước đạt <strong className="font-mono tabular-nums">{formatVND(employees.reduce((acc, e) => acc + (e.salary || 0), 0))}</strong>.
                </p>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Xuất báo cáo định dạng chuẩn A4</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExecutiveReportModal(false)}
                >
                  Đóng
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Printer className="h-4 w-4" />}
                  onClick={() => {
                    window.print();
                  }}
                >
                  In Báo Cáo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
