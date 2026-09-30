import React, { useState } from 'react';
import { FileSpreadsheet, Download, Printer, Filter } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ERPData } from '../../types';

interface ReportsModuleProps {
  erpData: ERPData;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ erpData }) => {
  const [reportType, setReportType] = useState<'inventory' | 'sales' | 'finance' | 'hr'>('inventory');

  const handleExport = () => {
    alert('Đã xuất báo cáo thành file Excel / PDF thành công!');
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Trung Tâm Báo Cáo Tổng Hợp Doanh Nghiệp ERP
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Xuất dữ liệu kiểm toán chuẩn ban giám đốc & cơ quan quản lý nhà nước</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={handleExport}>
            In Báo Cáo
          </Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Xuất Excel (.XLSX)
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          onClick={() => setReportType('inventory')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'inventory' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500'
          }`}
        >
          Báo Cáo Tổng Hợp Kho Hàng (NXT)
        </button>
        <button
          onClick={() => setReportType('sales')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'sales' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500'
          }`}
        >
          Báo Cáo Tổng Hợp Doanh Số & Công Nợ
        </button>
        <button
          onClick={() => setReportType('finance')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            reportType === 'finance' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500'
          }`}
        >
          Báo Cáo Tài Chính (P&L)
        </button>
      </div>

      <Card>
        {reportType === 'inventory' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Bảng Tổng Hợp Tồn Kho Thực Tế & Giá Trị Vốn</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Tên Vật Tư</th>
                    <th className="py-3 px-4">Mã SKU</th>
                    <th className="py-3 px-4 text-center">ĐVT</th>
                    <th className="py-3 px-4 text-right">Số Lượng Tồn</th>
                    <th className="py-3 px-4 text-right">Giá Trị Tồn Kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {erpData.products.map(p => (
                    <tr key={p.id}>
                      <td className="py-3 px-4 font-bold">{p.name}</td>
                      <td className="py-3 px-4 font-mono">{p.sku}</td>
                      <td className="py-3 px-4 text-center">{p.unit}</td>
                      <td className="py-3 px-4 text-right font-bold">{p.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{formatVND(p.quantity * p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'sales' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Bảng Báo Cáo Doanh Số & Hóa Đơn Khách Hàng</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Khách Hàng</th>
                    <th className="py-3 px-4">Tổng Số Đơn Mua</th>
                    <th className="py-3 px-4 text-right">Doanh Số Tích Lũy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {erpData.customers.map(c => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-bold">{c.name} ({c.company})</td>
                      <td className="py-3 px-4">Đã mua 5 đơn hàng</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatVND(c.totalSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'finance' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Cân Đối Dòng Tiền & Lợi Nhuận</h3>
            <p className="text-slate-500">Tổng thu tiền bán hàng: <strong className="text-emerald-600">{formatVND(350000000)}</strong></p>
            <p className="text-slate-500">Tổng chi phí vận hành: <strong className="text-rose-600">{formatVND(120000000)}</strong></p>
            <p className="text-slate-800 dark:text-slate-200 font-bold text-sm pt-2 border-t border-slate-200 dark:border-slate-800">Lợi Nhuận Ròng Trước Thuế: <span className="text-indigo-600 dark:text-indigo-400">{formatVND(230000000)}</span></p>
          </div>
        )}
      </Card>
    </div>
  );
};
