import React, { useState } from 'react';
import { Clock, Download, Printer, Search, AlertTriangle, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import { Card } from '../../../../components/common/Card';
import { Button } from '../../../../components/common/Button';
import { showToast } from '../../../../utils/toast';

interface AgingReportRow {
  materialCode: string;
  materialName: string;
  warehouseName: string;
  unitName: string;
  totalQty: number;
  totalAmount: number;
  qty0To30: number;
  qty31To60: number;
  qty61To90: number;
  qtyOver90: number;
  slowMovingStatus: 'NORMAL' | 'SLOW_MOVING' | 'CRITICAL';
}

export const InventoryAgingReportView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');

  const [rows, setRows] = useState<AgingReportRow[]>([
    {
      materialCode: 'VT-STEEL-01',
      materialName: 'Thép Cuộn Phi 8 Hòa Phát',
      warehouseName: 'Kho Tổng TP.HCM',
      unitName: 'Kg',
      totalQty: 2800,
      totalAmount: 47600000,
      qty0To30: 2000,
      qty31To60: 500,
      qty61To90: 300,
      qtyOver90: 0,
      slowMovingStatus: 'NORMAL'
    },
    {
      materialCode: 'VT-CEMENT-02',
      materialName: 'Xi Măng Hà Tiên PCB40',
      warehouseName: 'Kho Tổng TP.HCM',
      unitName: 'Bao',
      totalQty: 550,
      totalAmount: 49500000,
      qty0To30: 150,
      qty31To60: 200,
      qty61To90: 100,
      qtyOver90: 100,
      slowMovingStatus: 'SLOW_MOVING'
    },
    {
      materialCode: 'SP-ELE-03',
      materialName: 'Tủ Điện Trung Thế 24kV',
      warehouseName: 'Kho Chi Nhánh Hà Nội',
      unitName: 'Bộ',
      totalQty: 11,
      totalAmount: 495000000,
      qty0To30: 2,
      qty31To60: 4,
      qty61To90: 2,
      qtyOver90: 3,
      slowMovingStatus: 'CRITICAL'
    }
  ]);

  const filteredRows = rows.filter(r => {
    if (selectedWarehouse !== 'ALL' && !r.warehouseName.includes(selectedWarehouse)) return false;
    if (searchQuery && !r.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) && !r.materialName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleExportExcel = () => {
    showToast.success('Đã xuất báo cáo phân tích tuổi hàng tồn kho ra file Excel!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Báo Cáo Phân Tích Tuổi Hàng Tồn Kho (Inventory Aging Report)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cảnh báo vật tư tồn đọng lâu ngày (0-30 ngày, 31-60 ngày, 61-90 ngày và trên 90 ngày)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand-600" />
            <span>Xuất Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            <span>In Báo Cáo</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">0 - 30 Ngày (Hàng Luân Chuyển Tốt)</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">2,152 SP</div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-950/10">
          <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">31 - 60 Ngày (Tồn Bình Thường)</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">704 SP</div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-950/10">
          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">61 - 90 Ngày (Chậm Luân Chuyển)</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">402 SP</div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800 bg-rose-50/20 dark:bg-rose-950/10">
          <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">&gt; 90 Ngày (Cảnh Báo Tồn Ứ Đọng)</div>
          <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">103 SP</div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Kho Bãi:</span>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-medium"
            >
              <option value="ALL">Tất Cả Các Kho</option>
              <option value="TP.HCM">Kho Tổng TP.HCM</option>
              <option value="Hà Nội">Kho Chi Nhánh Hà Nội</option>
            </select>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã, tên vật tư..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Mã Vật Tư</th>
                <th className="py-3 px-4">Tên Vật Tư / Sản Phẩm</th>
                <th className="py-3 px-4">Kho Bãi</th>
                <th className="py-3 px-4 text-right">Tổng Tồn Kho</th>
                <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">0 - 30 Ngày</th>
                <th className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">31 - 60 Ngày</th>
                <th className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">61 - 90 Ngày</th>
                <th className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">&gt; 90 Ngày</th>
                <th className="py-3 px-4 text-center">Đánh Giá Luân Chuyển</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredRows.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {r.materialCode}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {r.materialName}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {r.warehouseName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {r.totalQty.toLocaleString('vi-VN')} {r.unitName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {r.qty0To30.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {r.qty31To60.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {r.qty61To90.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20">
                    {r.qtyOver90.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.slowMovingStatus === 'CRITICAL' ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold text-[10px] inline-flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> Tồn Ứ Động Cao
                      </span>
                    ) : r.slowMovingStatus === 'SLOW_MOVING' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                        Chậm Luân Chuyển
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                        Bình Thường
                      </span>
                    )}
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
