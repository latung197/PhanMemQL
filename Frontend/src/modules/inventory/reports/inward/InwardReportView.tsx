import React, { useState } from 'react';
import { Download, Printer, Search, Calendar, Filter, ArrowDownLeft, PieChart, FileSpreadsheet } from 'lucide-react';
import { Card } from '../../../../components/common/Card';
import { Button } from '../../../../components/common/Button';
import { showToast } from '../../../../utils/toast';

interface InwardReportRow {
  receiptCode: string;
  receiptDate: string;
  warehouseName: string;
  supplierName: string;
  materialCode: string;
  materialName: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export const InwardReportView: React.FC = () => {
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [rows, setRows] = useState<InwardReportRow[]>([
    {
      receiptCode: 'PNK-202608-001',
      receiptDate: '2026-08-02',
      warehouseName: 'Kho Tổng TP.HCM',
      supplierName: 'Công Ty Cổ Phần Thép Hòa Phát',
      materialCode: 'VT-STEEL-01',
      materialName: 'Thép Cuộn Phi 8 Hòa Phát',
      unitName: 'Kg',
      quantity: 5000,
      unitPrice: 17000,
      amount: 85000000
    },
    {
      receiptCode: 'PNK-202608-002',
      receiptDate: '2026-08-05',
      warehouseName: 'Kho Chi Nhánh Hà Nội',
      supplierName: 'Công Ty Xi Măng Hà Tiên',
      materialCode: 'VT-CEMENT-02',
      materialName: 'Xi Măng Hà Tiên PCB40',
      unitName: 'Bao',
      quantity: 1000,
      unitPrice: 90000,
      amount: 90000000
    },
    {
      receiptCode: 'PNK-202608-003',
      receiptDate: '2026-08-07',
      warehouseName: 'Kho Tổng TP.HCM',
      supplierName: 'Tập Đoàn Thiết Bị Điện ABB',
      materialCode: 'SP-ELE-03',
      materialName: 'Tủ Điện Trung Thế 24kV',
      unitName: 'Bộ',
      quantity: 10,
      unitPrice: 45000000,
      amount: 450000000
    }
  ]);

  const filteredRows = rows.filter(r => {
    if (selectedWarehouse !== 'ALL' && !r.warehouseName.includes(selectedWarehouse)) return false;
    if (searchQuery && !r.receiptCode.toLowerCase().includes(searchQuery.toLowerCase()) && !r.materialName.toLowerCase().includes(searchQuery.toLowerCase()) && !r.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalQty = filteredRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalAmount = filteredRows.reduce((sum, r) => sum + r.amount, 0);

  const handleExportExcel = () => {
    showToast.success('Đã xuất báo cáo hàng nhập kho ra file Excel thành công!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Báo Cáo & Bảng Kê Tổng Hợp Hàng Nhập Kho (Inward Summary)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thống kê tổng hợp số lượng, giá trị hàng hóa vật tư nhập mua, nhập điều chuyển, nhập khác theo kỳ
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

      {/* Filter Toolbar */}
      <Card className="p-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Từ ngày:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Đến ngày:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Kho Bãi:</span>
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
                <th className="py-3 px-4">Số Phiếu Nhập</th>
                <th className="py-3 px-4">Ngày Nhập</th>
                <th className="py-3 px-4">Kho Bãi</th>
                <th className="py-3 px-4">Nhà Cung Cấp / Đối Tác</th>
                <th className="py-3 px-4">Mã - Tên Vật Tư</th>
                <th className="py-3 px-4 text-right">SL Nhập</th>
                <th className="py-3 px-4 text-right">Đơn Giá (VND)</th>
                <th className="py-3 px-4 text-right">Thành Tiền (VND)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredRows.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {r.receiptCode}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {r.receiptDate}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {r.warehouseName}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {r.supplierName}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    <span className="font-mono text-indigo-500 mr-1.5">[{r.materialCode}]</span>
                    {r.materialName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {r.quantity.toLocaleString('vi-VN')} {r.unitName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {r.unitPrice.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    {r.amount.toLocaleString('vi-VN')} ₫
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-slate-100 text-xs border-t-2 border-slate-300 dark:border-slate-700">
                <td colSpan={5} className="py-3 px-4 uppercase text-right">
                  Tổng Cộng Nhập Kho:
                </td>
                <td className="py-3 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                  {totalQty.toLocaleString('vi-VN')}
                </td>
                <td></td>
                <td className="py-3 px-4 text-right font-mono text-cyan-600 dark:text-cyan-400">
                  {totalAmount.toLocaleString('vi-VN')} ₫
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};
