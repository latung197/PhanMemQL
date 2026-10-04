import React, { useState } from 'react';
import { ArrowRightLeft, Plus, Search, Filter, Download, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, Eye, Printer, X, Building2 } from 'lucide-react';
import { Card } from '../../../../components/common/Card';
import { Button } from '../../../../components/common/Button';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { showToast } from '../../../../utils/toast';
import { Product, Warehouse } from '../../../../types';

interface TransferVoucher {
  id: string;
  code: string;
  date: string;
  type: 'order' | 'issue' | 'receipt';
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  createdByName: string;
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED';
  itemsCount: number;
  totalQuantity: number;
  notes?: string;
}

interface TransferVouchersViewProps {
  typeFilter?: 'order' | 'issue' | 'receipt' | 'all';
  products?: Product[];
  warehouses?: Warehouse[];
}

export const TransferVouchersView: React.FC<TransferVouchersViewProps> = ({
  typeFilter = 'all',
  products = [],
  warehouses = []
}) => {
  const [vouchers, setVouchers] = useState<TransferVoucher[]>([
    {
      id: 'TR001',
      code: 'LDC-202608-001',
      date: '2026-08-08',
      type: 'order',
      fromWarehouseCode: 'WH01',
      fromWarehouseName: 'Kho Tổng TP.HCM',
      toWarehouseCode: 'WH02',
      toWarehouseName: 'Kho Chi Nhánh Hà Nội',
      createdByName: 'Nguyễn Văn Quản Lý',
      status: 'APPROVED',
      itemsCount: 3,
      totalQuantity: 150,
      notes: 'Điều chuyển vật tư hỗ trợ dự án Hà Nội'
    },
    {
      id: 'TR002',
      code: 'XDC-202608-001',
      date: '2026-08-09',
      type: 'issue',
      fromWarehouseCode: 'WH01',
      fromWarehouseName: 'Kho Tổng TP.HCM',
      toWarehouseCode: 'WH02',
      toWarehouseName: 'Kho Chi Nhánh Hà Nội',
      createdByName: 'Trần Thủ Kho',
      status: 'IN_TRANSIT',
      itemsCount: 3,
      totalQuantity: 150,
      notes: 'Xuất kho vận chuyển xe tải biển số 51C-88899'
    },
    {
      id: 'TR003',
      code: 'NDC-202608-001',
      date: '2026-08-09',
      type: 'receipt',
      fromWarehouseCode: 'WH02',
      fromWarehouseName: 'Kho Chi Nhánh Hà Nội',
      toWarehouseCode: 'WH03',
      toWarehouseName: 'Kho Chi Nhánh Đà Nẵng',
      createdByName: 'Lê Thủ Kho Đà Nẵng',
      status: 'COMPLETED',
      itemsCount: 2,
      totalQuantity: 80,
      notes: 'Đã hoàn tất kiểm kê và nhập kho đủ'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<TransferVoucher | null>(null);

  // Form State
  const [fromWh, setFromWh] = useState('WH01');
  const [toWh, setToWh] = useState('WH02');
  const [voucherNotes, setVoucherNotes] = useState('');

  const handleOpenAdd = () => {
    setFromWh('WH01');
    setToWh('WH02');
    setVoucherNotes('');
    setIsModalOpen(true);
  };

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromWh === toWh) {
      showToast.error('Kho xuất và Kho nhập không được giống nhau!');
      return;
    }

    const newCode = typeFilter === 'issue' ? `XDC-202608-${Math.floor(Math.random() * 900 + 100)}`
      : typeFilter === 'receipt' ? `NDC-202608-${Math.floor(Math.random() * 900 + 100)}`
      : `LDC-202608-${Math.floor(Math.random() * 900 + 100)}`;

    const newVoucher: TransferVoucher = {
      id: Date.now().toString(),
      code: newCode,
      date: new Date().toISOString().slice(0, 10),
      type: typeFilter === 'issue' ? 'issue' : typeFilter === 'receipt' ? 'receipt' : 'order',
      fromWarehouseCode: fromWh,
      fromWarehouseName: fromWh === 'WH01' ? 'Kho Tổng TP.HCM' : fromWh === 'WH02' ? 'Kho Hà Nội' : 'Kho Đà Nẵng',
      toWarehouseCode: toWh,
      toWarehouseName: toWh === 'WH01' ? 'Kho Tổng TP.HCM' : toWh === 'WH02' ? 'Kho Hà Nội' : 'Kho Đà Nẵng',
      createdByName: 'Quản trị viên',
      status: 'PENDING',
      itemsCount: 2,
      totalQuantity: 100,
      notes: voucherNotes || 'Tạo mới từ hệ thống'
    };

    setVouchers([newVoucher, ...vouchers]);
    showToast.success(`Tạo thành công chứng từ điều chuyển ${newCode}`);
    setIsModalOpen(false);
  };

  const filteredVouchers = vouchers.filter(v => {
    if (typeFilter !== 'all' && v.type !== typeFilter) return false;
    if (searchQuery && !v.code.toLowerCase().includes(searchQuery.toLowerCase()) && !v.notes?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getTitle = () => {
    if (typeFilter === 'issue') return 'Phiếu Xuất Điều Chuyển Kho (Outward Transfer)';
    if (typeFilter === 'receipt') return 'Phiếu Nhập Điều Chuyển Kho (Inward Transfer)';
    if (typeFilter === 'order') return 'Lệnh Điều Chuyển Kho Nội Bộ (Transfer Order)';
    return 'Quản Lý Điều Chuyển Kho Nội Bộ';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {getTitle()}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Điều chuyển hàng hóa, vật tư giữa các kho bãi trong cùng hệ thống công ty
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenAdd} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>Tạo Chứng Từ Mới</span>
        </Button>
      </div>

      {/* Toolbar */}
      <CategoryHeaderToolbar
        searchPlaceholder="Tìm theo số chứng từ, ghi chú điều chuyển..."
        onSearchChange={setSearchQuery}
        onRefresh={() => showToast.info('Đã tải lại danh sách lệnh điều chuyển')}
        totalItems={filteredVouchers.length}
      />

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Số Chứng Từ</th>
                <th className="py-3 px-4">Ngày Lập</th>
                <th className="py-3 px-4">Từ Kho (Xuất)</th>
                <th className="py-3 px-4">Đến Kho (Nhập)</th>
                <th className="py-3 px-4 text-center">Số Mặt Hàng</th>
                <th className="py-3 px-4 text-right">Tổng SL</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredVouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {v.code}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                    {v.date}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-slate-500 mr-1">[{v.fromWarehouseCode}]</span>
                    {v.fromWarehouseName}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-slate-500 mr-1">[{v.toWarehouseCode}]</span>
                    {v.toWarehouseName}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {v.itemsCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {v.totalQuantity.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {v.status === 'COMPLETED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                        Hoàn Tất
                      </span>
                    ) : v.status === 'IN_TRANSIT' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold text-[10px]">
                        Đang Vận Chuyển
                      </span>
                    ) : v.status === 'APPROVED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                        Đã Phê Duyệt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                        Chờ Phê Duyệt
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedVoucher(v)}
                      className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                      title="Xem chi tiết"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Add */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Lập Chứng Từ Điều Chuyển Kho Mới
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Kho Xuất Hàng (Kho Đi)
                  </label>
                  <select
                    value={fromWh}
                    onChange={(e) => setFromWh(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="WH01">Kho Tổng TP.HCM (WH01)</option>
                    <option value="WH02">Kho Chi Nhánh Hà Nội (WH02)</option>
                    <option value="WH03">Kho Chi Nhánh Đà Nẵng (WH03)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Kho Nhập Hàng (Kho Đến)
                  </label>
                  <select
                    value={toWh}
                    onChange={(e) => setToWh(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="WH02">Kho Chi Nhánh Hà Nội (WH02)</option>
                    <option value="WH01">Kho Tổng TP.HCM (WH01)</option>
                    <option value="WH03">Kho Chi Nhánh Đà Nẵng (WH03)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Lý Do / Ghi Chú Điều Chuyển
                </label>
                <textarea
                  rows={3}
                  value={voucherNotes}
                  onChange={(e) => setVoucherNotes(e.target.value)}
                  placeholder="Ví dụ: Điều chuyển vật tư sản xuất đợt 2 theo lệnh điều động..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Lập Chứng Từ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
