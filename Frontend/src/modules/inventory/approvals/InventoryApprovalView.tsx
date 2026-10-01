import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Search, Filter, ShieldCheck, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, FileText } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { showToast } from '../../../utils/toast';
import { canApproveVoucher } from '../../../utils/permissions';
import { SubMenuKey, UserProfile } from '../../../types';

interface ApprovalItem {
  id: string;
  code: string;
  type: 'RECEIPT' | 'ISSUE' | 'TRANSFER';
  date: string;
  warehouseName: string;
  creatorName: string;
  totalValue: number;
  totalQty: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface InventoryApprovalViewProps {
  typeFilter?: 'receipt' | 'issue' | 'transfer' | 'all';
  currentUser?: UserProfile | null;
}

/** Voucher function of each approval item (the transfer list shows transfer orders). */
const VOUCHER_OF: Record<ApprovalItem['type'], SubMenuKey> = {
  RECEIPT: 'inv_receipt', ISSUE: 'inv_issue', TRANSFER: 'inv_transfer_order'
};

export const InventoryApprovalView: React.FC<InventoryApprovalViewProps> = ({
  typeFilter = 'all', currentUser
}) => {
  // "Duyệt" on the voucher or on this approval screen, same rule as the backend (display only).
  const canApprove = (item: ApprovalItem) => canApproveVoucher(currentUser, VOUCHER_OF[item.type]);
  const [items, setItems] = useState<ApprovalItem[]>([
    {
      id: 'APP001',
      code: 'PNK-202608-015',
      type: 'RECEIPT',
      date: '2026-08-09',
      warehouseName: 'Kho Tổng TP.HCM',
      creatorName: 'Phạm Thị Mua Hàng',
      totalValue: 125000000,
      totalQty: 500,
      reason: 'Nhập kho lô hàng Xi măng từ Nhà cung cấp Hà Tiên',
      status: 'PENDING'
    },
    {
      id: 'APP002',
      code: 'PXK-202608-022',
      type: 'ISSUE',
      date: '2026-08-09',
      warehouseName: 'Kho Tổng TP.HCM',
      creatorName: 'Nguyễn Văn Bán Hàng',
      totalValue: 88000000,
      totalQty: 120,
      reason: 'Xuất kho cho Đơn hàng DH-2026-089 (Khách hàng Hòa Phát)',
      status: 'PENDING'
    },
    {
      id: 'APP003',
      code: 'LDC-202608-005',
      type: 'TRANSFER',
      date: '2026-08-08',
      warehouseName: 'Kho TP.HCM -> Kho Hà Nội',
      creatorName: 'Trần Điều Độ',
      totalValue: 210000000,
      totalQty: 300,
      reason: 'Điều chuyển vật tư thi công công trình Hà Nội',
      status: 'PENDING'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');

  const handleApprove = (id: string, code: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: 'APPROVED' } : i));
    showToast.success(`Đã phê duyệt chứng từ ${code} thành công`);
  };

  const handleReject = (id: string, code: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: 'REJECTED' } : i));
    showToast.warning(`Đã từ chối chứng từ ${code}`);
  };

  const filteredItems = items.filter(item => {
    if (typeFilter === 'receipt' && item.type !== 'RECEIPT') return false;
    if (typeFilter === 'issue' && item.type !== 'ISSUE') return false;
    if (typeFilter === 'transfer' && item.type !== 'TRANSFER') return false;
    if (searchQuery && !item.code.toLowerCase().includes(searchQuery.toLowerCase()) && !item.reason.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getTitle = () => {
    if (typeFilter === 'receipt') return 'Phê Duyệt Phiếu Nhập Kho (Receipt Approval)';
    if (typeFilter === 'issue') return 'Phê Duyệt Phiếu Xuất Kho (Issue Approval)';
    if (typeFilter === 'transfer') return 'Phê Duyệt Điều Chuyển Kho (Transfer Approval)';
    return 'Trung Tâm Phê Duyệt Chứng Từ Kho Hàng';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {getTitle()}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kiểm tra & Ký duyệt các chứng từ Nhập kho, Xuất kho và Điều chuyển trước khi vào sổ kho
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <CategoryHeaderToolbar
        searchPlaceholder="Tìm theo mã phiếu, lý do, người tạo..."
        onSearchChange={setSearchQuery}
        onRefresh={() => showToast.info('Đã cập nhật danh sách chờ duyệt')}
        totalItems={filteredItems.length}
      />

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Loại Chứng Từ</th>
                <th className="py-3 px-4">Số Phiếu</th>
                <th className="py-3 px-4">Ngày Lập</th>
                <th className="py-3 px-4">Kho Bãi</th>
                <th className="py-3 px-4">Người Lập Phiếu</th>
                <th className="py-3 px-4 text-right">Tổng SL</th>
                <th className="py-3 px-4 text-right">Tổng Giá Trị (VND)</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Duyệt Phiếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold">
                    {item.type === 'RECEIPT' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ArrowDownLeft className="h-3.5 w-3.5" /> Nhập Kho
                      </span>
                    ) : item.type === 'ISSUE' ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <ArrowUpRight className="h-3.5 w-3.5" /> Xuất Kho
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Điều Chuyển
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {item.code}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {item.date}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {item.warehouseName}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {item.creatorName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {item.totalQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {item.totalValue.toLocaleString('vi-VN')} ₫
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.status === 'APPROVED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                        Đã Duyệt
                      </span>
                    ) : item.status === 'REJECTED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold text-[10px]">
                        Từ Chối
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold text-[10px]">
                        Chờ Phê Duyệt
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.status === 'PENDING' && !canApprove(item) && (
                      <span className="text-[11px] text-slate-400">Không có quyền duyệt</span>
                    )}
                    {item.status === 'PENDING' && canApprove(item) && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApprove(item.id, item.code)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(item.id, item.code)}
                          className="px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg font-bold text-[11px] flex items-center gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Từ chối
                        </button>
                      </div>
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
