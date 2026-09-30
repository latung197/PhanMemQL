import React, { useState } from 'react';
import { ClipboardCheck, Plus, Search, Filter, RefreshCw, CheckCircle2, AlertTriangle, FileText, X, Eye, Calculator } from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { showToast } from '../../../utils/toast';

interface StockAuditVoucher {
  id: string;
  code: string;
  auditDate: string;
  warehouseCode: string;
  warehouseName: string;
  auditorName: string;
  totalBookQty: number;
  totalPhysicalQty: number;
  totalVarianceQty: number; // Chênh lệch (Physical - Book)
  status: 'DRAFT' | 'AUDITED' | 'ADJUSTED';
  notes?: string;
}

export const StockAuditView: React.FC = () => {
  const [audits, setAudits] = useState<StockAuditVoucher[]>([
    {
      id: 'AUD001',
      code: 'PKK-202608-001',
      auditDate: '2026-08-05',
      warehouseCode: 'WH01',
      warehouseName: 'Kho Tổng TP.HCM',
      auditorName: 'Đoàn Kiểm Kê Tháng 8',
      totalBookQty: 1250,
      totalPhysicalQty: 1248,
      totalVarianceQty: -2,
      status: 'ADJUSTED',
      notes: 'Hao hụt tự nhiên do bảo quản vật tư thép'
    },
    {
      id: 'AUD002',
      code: 'PKK-202608-002',
      auditDate: '2026-08-08',
      warehouseCode: 'WH02',
      warehouseName: 'Kho Chi Nhánh Hà Nội',
      auditorName: 'Nguyễn Văn Kiểm Kê',
      totalBookQty: 800,
      totalPhysicalQty: 805,
      totalVarianceQty: 5,
      status: 'AUDITED',
      notes: 'Thừa 5 sản phẩm chưa ghi nhận phiếu nhập hàng'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [warehouseCode, setWarehouseCode] = useState('WH01');
  const [auditorName, setAuditorName] = useState('Ban Kiểm Kê');
  const [notes, setNotes] = useState('');

  const handleOpenAdd = () => {
    setWarehouseCode('WH01');
    setAuditorName('Ban Kiểm Kê');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleCreateAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCode = `PKK-202608-${Math.floor(Math.random() * 900 + 100)}`;
    const newAudit: StockAuditVoucher = {
      id: Date.now().toString(),
      code: newCode,
      auditDate: new Date().toISOString().slice(0, 10),
      warehouseCode,
      warehouseName: warehouseCode === 'WH01' ? 'Kho Tổng TP.HCM' : warehouseCode === 'WH02' ? 'Kho Hà Nội' : 'Kho Đà Nẵng',
      auditorName,
      totalBookQty: 500,
      totalPhysicalQty: 500,
      totalVarianceQty: 0,
      status: 'DRAFT',
      notes
    };
    setAudits([newAudit, ...setAudits.length ? audits : []]);
    showToast.success(`Tạo thành công phiếu kiểm kê ${newCode}`);
    setIsModalOpen(false);
  };

  const handleAdjustStock = (audit: StockAuditVoucher) => {
    setAudits(audits.map(a => a.id === audit.id ? { ...a, status: 'ADJUSTED' } : a));
    showToast.success(`Đã xử lý điều chỉnh chênh lệch tồn kho cho phiếu ${audit.code}`);
  };

  const filteredAudits = audits.filter(a =>
    a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.warehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.auditorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Phiếu Kiểm Kê Hàng Hóa & Xử Lý Điều Chỉnh Tồn Kho
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              So sánh số liệu tồn sổ sách với thực tế kiểm kê bãi kho và lập phiếu xử lý thừa/thiếu
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenAdd} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span>Tạo Phiếu Kiểm Kê Mới</span>
        </Button>
      </div>

      {/* Toolbar */}
      <CategoryHeaderToolbar
        searchPlaceholder="Tìm theo số phiếu kiểm kê, kho, người kiểm kê..."
        onSearchChange={setSearchQuery}
        onRefresh={() => showToast.info('Đã cập nhật danh sách phiếu kiểm kê')}
        totalItems={filteredAudits.length}
      />

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Số Phiếu PKK</th>
                <th className="py-3 px-4">Ngày Kiểm Kê</th>
                <th className="py-3 px-4">Kho Bãi Kiểm Kê</th>
                <th className="py-3 px-4">Người/Ban Kiểm Kê</th>
                <th className="py-3 px-4 text-right">SL Sổ Sách</th>
                <th className="py-3 px-4 text-right">SL Thực Tế</th>
                <th className="py-3 px-4 text-right">Chênh Lệch</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredAudits.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {a.code}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                    {a.auditDate}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-slate-500 mr-1">[{a.warehouseCode}]</span>
                    {a.warehouseName}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {a.auditorName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                    {a.totalBookQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {a.totalPhysicalQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold">
                    {a.totalVarianceQty < 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{a.totalVarianceQty} (Thiếu)</span>
                    ) : a.totalVarianceQty > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">+{a.totalVarianceQty} (Thừa)</span>
                    ) : (
                      <span className="text-slate-400">0 (Khớp)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {a.status === 'ADJUSTED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                        Đã Điều Chỉnh Sổ
                      </span>
                    ) : a.status === 'AUDITED' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold text-[10px]">
                        Đã Đếm Xong
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                        Bản Nháp
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {a.status === 'AUDITED' && (
                        <button
                          onClick={() => handleAdjustStock(a)}
                          className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-md font-semibold text-[10px]"
                        >
                          Xử Lý Tồn Sổ
                        </button>
                      )}
                    </div>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Tạo Phiếu Kiểm Kê Tồn Kho Mới
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAudit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Chọn Kho Kiểm Kê
                </label>
                <select
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-medium"
                >
                  <option value="WH01">Kho Tổng TP.HCM (WH01)</option>
                  <option value="WH02">Kho Chi Nhánh Hà Nội (WH02)</option>
                  <option value="WH03">Kho Chi Nhánh Đà Nẵng (WH03)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Đoàn / Ban Kiểm Kê
                </label>
                <input
                  type="text"
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Ghi Chú
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú đợt kiểm kê..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Tạo Phiếu Kiểm Kê
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
