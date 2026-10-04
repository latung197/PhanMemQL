import React, { useState } from 'react';
import { RefreshCw, Zap, CheckCircle2, Warehouse, Search, Shield, Package, MapPin } from 'lucide-react';
import { Card } from '../../../../components/common/Card';
import { Button } from '../../../../components/common/Button';
import { showToast } from '../../../../utils/toast';

interface InstantStockItem {
  materialCode: string;
  materialName: string;
  warehouseCode: string;
  warehouseName: string;
  locationBin: string;
  totalPhysicalQty: number;
  reservedQty: number; // Đã giữ chỗ đơn hàng
  availableQty: number; // Tồn khả dụng
  unitName: string;
  lastUpdated: string;
}

export const InstantStockCalcView: React.FC = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [instantStocks, setInstantStocks] = useState<InstantStockItem[]>([
    {
      materialCode: 'VT-STEEL-01',
      materialName: 'Thép Cuộn Phi 8 Hòa Phát',
      warehouseCode: 'WH01',
      warehouseName: 'Kho Tổng TP.HCM',
      locationBin: 'BIN-A1-02',
      totalPhysicalQty: 2800,
      reservedQty: 300,
      availableQty: 2500,
      unitName: 'Kg',
      lastUpdated: 'Vừa xong'
    },
    {
      materialCode: 'VT-CEMENT-02',
      materialName: 'Xi Măng Hà Tiên PCB40',
      warehouseCode: 'WH01',
      warehouseName: 'Kho Tổng TP.HCM',
      locationBin: 'BIN-B2-01',
      totalPhysicalQty: 550,
      reservedQty: 50,
      availableQty: 500,
      unitName: 'Bao',
      lastUpdated: 'Vừa xong'
    },
    {
      materialCode: 'SP-ELE-03',
      materialName: 'Tủ Điện Trung Thế 24kV',
      warehouseCode: 'WH02',
      warehouseName: 'Kho Chi Nhánh Hà Nội',
      locationBin: 'BIN-C1-05',
      totalPhysicalQty: 11,
      reservedQty: 2,
      availableQty: 9,
      unitName: 'Bộ',
      lastUpdated: 'Vừa xong'
    }
  ]);

  const handleRecalculateInstantStock = () => {
    setIsRecalculating(true);
    showToast.info('Đang quét lại thẻ kho & đối soát tồn kho tức thời...');

    setTimeout(() => {
      setIsRecalculating(false);
      showToast.success('Đã hoàn tất tính toán tồn kho tức thời cho toàn bộ danh mục vật tư!');
    }, 1200);
  };

  const filteredStocks = instantStocks.filter(s =>
    s.materialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.warehouseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tính Tồn Kho Tức Thời & Đối Soát Tồn Khả Dụng (Instant Stock Balance)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đối soát tức thời lượng tồn thực tế bãi kho, hàng đang giữ chỗ cho đơn bán & hàng tồn khả dụng
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleRecalculateInstantStock}
          disabled={isRecalculating}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
          <span>{isRecalculating ? 'Đang Tái Tính Tồn...' : 'Tính Tồn Tức Thời'}</span>
        </Button>
      </div>

      {/* Toolbar Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã vật tư, tên hoặc kho bãi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Mã Vật Tư</th>
                <th className="py-3 px-4">Tên Vật Tư / SP</th>
                <th className="py-3 px-4">Kho Bãi</th>
                <th className="py-3 px-4">Vị Trí Bin/Rack</th>
                <th className="py-3 px-4 text-right">Tổng Tồn Thực Tế</th>
                <th className="py-3 px-4 text-right">Đã Giữ Chỗ (Reserved)</th>
                <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">Tồn Khả Dụng (Available)</th>
                <th className="py-3 px-4 text-center">Cập Nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredStocks.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {item.materialCode}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {item.materialName}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    <span className="font-mono text-slate-400 mr-1">[{item.warehouseCode}]</span>
                    {item.warehouseName}
                  </td>
                  <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400">
                    {item.locationBin}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    {item.totalPhysicalQty.toLocaleString('vi-VN')} {item.unitName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">
                    {item.reservedQty.toLocaleString('vi-VN')} {item.unitName}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                    {item.availableQty.toLocaleString('vi-VN')} {item.unitName}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-400 text-[10px]">
                    {item.lastUpdated}
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
