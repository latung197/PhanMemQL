import React, { useState } from 'react';
import { Calculator, Play, CheckCircle2, Clock, Calendar, Warehouse, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { showToast } from '../../../utils/toast';

interface CostCalcLog {
  materialCode: string;
  materialName: string;
  unitName: string;
  openingQty: number;
  inwardQty: number;
  inwardAmount: number;
  avgUnitPrice: number;
  outwardQty: number;
  outwardAmount: number;
}

export const MonthlyCostCalcView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('8');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalcTime, setLastCalcTime] = useState<string | null>('2026-08-01 17:30:00');

  const [calcResults, setCalcResults] = useState<CostCalcLog[]>([
    {
      materialCode: 'VT-STEEL-01',
      materialName: 'Thép Cuộn Phi 8 Hòa Phát',
      unitName: 'Kg',
      openingQty: 1000,
      inwardQty: 5000,
      inwardAmount: 85000000,
      avgUnitPrice: 17000,
      outwardQty: 3200,
      outwardAmount: 54400000
    },
    {
      materialCode: 'VT-CEMENT-02',
      materialName: 'Xi Măng Hà Tiên PCB40',
      unitName: 'Bao',
      openingQty: 200,
      inwardQty: 1000,
      inwardAmount: 90000000,
      avgUnitPrice: 90000,
      outwardQty: 650,
      outwardAmount: 58500000
    },
    {
      materialCode: 'SP-ELE-03',
      materialName: 'Tủ Điện Trung Thế 24kV',
      unitName: 'Bộ',
      openingQty: 5,
      inwardQty: 10,
      inwardAmount: 450000000,
      avgUnitPrice: 45000000,
      outwardQty: 4,
      outwardAmount: 180000000
    }
  ]);

  const handleRunCalculation = () => {
    setIsCalculating(true);
    showToast.info(`Đang tính giá bình quân tháng ${selectedMonth}/${selectedYear}...`);
    
    setTimeout(() => {
      setIsCalculating(false);
      setLastCalcTime(new Date().toISOString().replace('T', ' ').slice(0, 19));
      showToast.success(`Đã tính giá bình quân và áp đơn giá giá vốn thành công cho Tháng ${selectedMonth}/${selectedYear}!`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tính Giá Bình Quân Tháng Kho Hàng (Monthly Weighted Average Costing)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tự động tập hợp chi phí nhập kho, xác định đơn giá bình quân gia quyền tháng & áp đơn giá xuất kho
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleRunCalculation}
          disabled={isCalculating}
          className="flex items-center gap-1.5"
        >
          {isCalculating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          <span>{isCalculating ? 'Đang Tính Toán...' : 'Thực Hiện Tính Giá'}</span>
        </Button>
      </div>

      {/* Options Panel */}
      <Card className="p-5 border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
              Kỳ Tháng Hạch Toán
            </label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-bold"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m < 10 ? `0${m}` : m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-bold"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
              Phạm Vi Kho Bãi
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-bold"
            >
              <option value="ALL">Tất Cả Các Kho Bãi trong Công Ty</option>
              <option value="WH01">Kho Tổng TP.HCM (WH01)</option>
              <option value="WH02">Kho Chi Nhánh Hà Nội (WH02)</option>
              <option value="WH03">Kho Chi Nhánh Đà Nẵng (WH03)</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
              <span className="font-semibold">Lần tính gần nhất:</span>
              <span className="font-mono font-bold">{lastCalcTime || 'Chưa thực hiện'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Log Results Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Kết Quả Phân Bổ Đơn Giá Bình Quân & Giá Vốn Xuất Kho (Tháng {selectedMonth}/{selectedYear})
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">Công thức: Đơn giá = (Giá trị tồn đầu + Giá trị nhập) / (SL tồn đầu + SL nhập)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Mã Vật Tư</th>
                <th className="py-3 px-4">Tên Vật Tư / Sản Phẩm</th>
                <th className="py-3 px-4">ĐVT</th>
                <th className="py-3 px-4 text-right">SL Nhập Tháng</th>
                <th className="py-3 px-4 text-right">Giá Trị Nhập (VND)</th>
                <th className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">Đơn Giá Bình Quân</th>
                <th className="py-3 px-4 text-right">SL Xuất Tháng</th>
                <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">Thành Tiền Xuất Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {calcResults.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {item.materialCode}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {item.materialName}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-medium">
                    {item.unitName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {item.inwardQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {item.inwardAmount.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">
                    {item.avgUnitPrice.toLocaleString('vi-VN')} ₫
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {item.outwardQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {item.outwardAmount.toLocaleString('vi-VN')} ₫
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
