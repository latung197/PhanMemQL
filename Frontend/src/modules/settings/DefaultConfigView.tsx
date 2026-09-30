import React, { useState, useEffect } from 'react';
import { Sliders, Save, RotateCcw, Warehouse, FileText, Printer, CheckCircle2, Eye, Hash } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { showToast, saveWithFeedback } from '../../utils/toast';
import { systemSettingsService, SystemDefaultConfig, DEFAULT_SYSTEM_CONFIG } from '../../services/systemSettingsService';

export const DefaultConfigView: React.FC = () => {
  const [config, setConfig] = useState<SystemDefaultConfig>(() => systemSettingsService.getSystemDefaults());
  const [activeTab, setActiveTab] = useState<'inventory' | 'numbering' | 'print'>('inventory');

  // Preview generated codes
  const getPreviewCode = (voucherType: string) => {
    const rule = config.autoNumbering[voucherType];
    if (!rule) return '';
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const seqStr = String(rule.nextNumber).padStart(rule.digits || 4, '0');
    return rule.pattern
      .replace('{PREFIX}', rule.prefix)
      .replace('{YYYY}', yyyy)
      .replace('{YY}', yy)
      .replace('{MM}', mm)
      .replace('{DD}', dd)
      .replace('{SEQ}', seqStr);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    void saveWithFeedback(systemSettingsService.saveSystemDefaults(config),
      () => showToast.success('Đã lưu cấu hình khai báo mặc định hệ thống thành công!'));
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_SYSTEM_CONFIG });
    void saveWithFeedback(systemSettingsService.saveSystemDefaults(DEFAULT_SYSTEM_CONFIG),
      () => showToast.info('Đã khôi phục các tham số mặc định chuẩn hệ thống!'),
      () => setConfig(systemSettingsService.getSystemDefaults()));
  };

  const updateNumberingRule = (key: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      autoNumbering: {
        ...prev.autoNumbering,
        [key]: {
          ...prev.autoNumbering[key],
          [field]: value
        }
      }
    }));
  };

  const updatePrintField = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      printTemplate: {
        ...prev.printTemplate,
        [field]: value
      }
    }));
  };

  const updateSignature = (field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      printTemplate: {
        ...prev.printTemplate,
        signatures: {
          ...prev.printTemplate.signatures,
          [field]: value
        }
      }
    }));
  };

  const voucherTypesList = [
    { key: 'PNK', name: 'Phiếu Nhập Kho', desc: 'Nhập mua hàng, nhập trả lại, nhập kho sản xuất' },
    { key: 'PXK', name: 'Phiếu Xuất Kho', desc: 'Xuất bán buôn, xuất bán lẻ, xuất hủy' },
    { key: 'LDC', name: 'Lệnh Điều Chuyển Kho', desc: 'Lệnh điều chuyển hàng hóa liên chi nhánh' },
    { key: 'PXDC', name: 'Phiếu Xuất Điều Chuyển', desc: 'Xuất chuyển kho xuất' },
    { key: 'PNDC', name: 'Phiếu Nhập Điều Chuyển', desc: 'Nhập kho nhận điều chuyển' },
    { key: 'PKK', name: 'Phiếu Kiểm Kê Hàng Hóa', desc: 'Kiểm kê thực tế & xử lý chênh lệch' },
    { key: 'SO', name: 'Đơn Bán Hàng (Sales Order)', desc: 'Hợp đồng & đơn đặt hàng bán' },
    { key: 'PT', name: 'Phiếu Thu Tiền Mặt / Quỹ', desc: 'Thu nợ khách hàng, thu khác' },
    { key: 'PC', name: 'Phiếu Chi Tiền Mặt / Quỹ', desc: 'Thanh toán nhà cung cấp, chi phí' }
  ];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-[5px] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[5px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Khai Báo Mặc Định Hệ Thống (System Defaults)
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                sys_default_config
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cấu hình các tham số vận hành chung, phương pháp tính giá kho, quy tắc đánh số tự động & mẫu in chứng từ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="flex items-center gap-1.5 rounded-[5px]">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Mặc Định</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleSave()} className="flex items-center gap-1.5 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <Save className="h-3.5 w-3.5" />
            <span>Lưu Cấu Hình</span>
          </Button>
        </div>
      </div>

      {/* Sub-tabs inside Defaults */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-3 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'inventory'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Warehouse className="h-4 w-4" />
          1. Tham Số Vận Hành Kho & Giá Vốn
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('numbering')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'numbering'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Hash className="h-4 w-4" />
          2. Quy Tắc Đánh Số Chứng Từ Tự Động
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('print')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'print'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Printer className="h-4 w-4" />
          3. Tiêu Đề Mẫu In & Chữ Ký Chứng Từ
        </button>
      </div>

      {/* Tab 1: Inventory & Costing */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4 border border-slate-200 dark:border-slate-800 rounded-[5px]">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Warehouse className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Thiết Lập Kho & Phương Pháp Tính Giá Vốn
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Kho Bãi Mặc Định Khi Tạo Chứng Từ
                </label>
                <select
                  value={config.defaultWarehouse}
                  onChange={(e) => setConfig({ ...config, defaultWarehouse: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="WH01">WH01 - Kho Tổng TP. Hồ Chí Minh</option>
                  <option value="WH02">WH02 - Kho Chi Nhánh Hà Nội</option>
                  <option value="WH03">WH03 - Kho Chi Nhánh Đà Nẵng</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Kho này sẽ được tự động chọn sẵn khi nhân viên mở form tạo mới phiếu nhập, xuất hoặc đơn hàng.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Phương Pháp Tính Giá Tồn Kho Xuất
                </label>
                <select
                  value={config.costingMethod}
                  onChange={(e) => setConfig({ ...config, costingMethod: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="MONTHLY_AVG">Giá Bình Quân Gia Quyền Cuối Tháng (Monthly Weighted Avg)</option>
                  <option value="INSTANT_AVG">Giá Bình Quân Di Động Tức Thời (Real-time Moving Avg)</option>
                  <option value="FIFO">Nhập Trước Xuất Trước (FIFO - First In First Out)</option>
                  <option value="SPECIFIC">Giá Đích Danh Theo Lô Sản Xuất (Specific Lot Costing)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Áp dụng cho nghiệp vụ tính giá xuất kho vật tư trong kỳ báo cáo tài chính kế toán.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Đồng Tiền Hạch Toán Mặc Định Toàn Hệ Thống
                </label>
                <select
                  value={config.defaultCurrency}
                  onChange={(e) => setConfig({ ...config, defaultCurrency: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="VND">VND - Việt Nam Đồng (₫)</option>
                  <option value="USD">USD - Đô la Mỹ ($)</option>
                  <option value="EUR">EUR - Đồng Euro Châu Âu (€)</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4 border border-slate-200 dark:border-slate-800 rounded-[5px]">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Quy Chuẩn Làm Tròn & Kiểm Soát Âm Kho
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Số Lẻ Lượng (Quantity)
                  </label>
                  <select
                    value={config.qtyDecimalPlaces}
                    onChange={(e) => setConfig({ ...config, qtyDecimalPlaces: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-xs font-medium"
                  >
                    <option value="0">0 số lẻ (ví dụ: 1,000)</option>
                    <option value="2">2 số lẻ (ví dụ: 1,000.50)</option>
                    <option value="3">3 số lẻ (ví dụ: 1,000.500)</option>
                    <option value="4">4 số lẻ (ví dụ: 1,000.5000)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Số Lẻ Tiền (Price)
                  </label>
                  <select
                    value={config.priceDecimalPlaces}
                    onChange={(e) => setConfig({ ...config, priceDecimalPlaces: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 text-xs font-medium"
                  >
                    <option value="0">0 số lẻ (ví dụ: 10,000,000)</option>
                    <option value="2">2 số lẻ (ví dụ: 10,000,000.00)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-[5px] border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Quy định kiểm soát xuất âm kho:
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hệ thống mặc định chặn xuất kho nếu số lượng tồn thực tế trong kho nhỏ hơn số lượng yêu cầu xuất, nhằm bảo toàn số liệu kế toán kho.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Auto Numbering Rules */}
      {activeTab === 'numbering' && (
        <Card className="p-5 space-y-4 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Hash className="h-4 w-4 text-emerald-600" />
                Cấu Hình Đánh Số Nhảy Tự Động (Auto Numbering Rules)
              </h3>
              <p className="text-xs text-slate-500">
                Các thẻ thay thế hỗ trợ: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600 font-mono font-bold">{"{PREFIX}"}</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600 font-mono font-bold">{"{YYYY}"}</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600 font-mono font-bold">{"{YY}"}</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600 font-mono font-bold">{"{MM}"}</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600 font-mono font-bold">{"{SEQ}"}</code>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3">Loại Chứng Từ</th>
                  <th className="py-2.5 px-3">Tiền Tố (Prefix)</th>
                  <th className="py-2.5 px-3">Mẫu Định Dạng (Pattern)</th>
                  <th className="py-2.5 px-3 text-center">Độ Dài Số</th>
                  <th className="py-2.5 px-3 text-center">Số Kế Tiếp</th>
                  <th className="py-2.5 px-3">Mã Xem Trước Thực Tế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {voucherTypesList.map(item => {
                  const rule = config.autoNumbering[item.key] || {
                    prefix: item.key,
                    pattern: '{PREFIX}-{YYYY}{MM}-{SEQ}',
                    nextNumber: 1,
                    digits: 4
                  };
                  const preview = getPreviewCode(item.key);

                  return (
                    <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">[{item.key}] - {item.desc}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={rule.prefix}
                          onChange={(e) => updateNumberingRule(item.key, 'prefix', e.target.value.toUpperCase())}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] font-mono font-bold text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={rule.pattern}
                          onChange={(e) => updateNumberingRule(item.key, 'pattern', e.target.value)}
                          className="w-48 sm:w-56 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] font-mono text-[11px] text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="3"
                          max="8"
                          value={rule.digits || 4}
                          onChange={(e) => updateNumberingRule(item.key, 'digits', Number(e.target.value))}
                          className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] text-center font-mono font-bold text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={rule.nextNumber}
                          onChange={(e) => updateNumberingRule(item.key, 'nextNumber', Number(e.target.value))}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] text-center font-mono font-bold text-emerald-600 dark:text-emerald-400"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-slate-100 dark:bg-slate-800 font-mono font-extrabold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs">
                          <Eye className="h-3 w-3 text-indigo-500" />
                          {preview}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Print Template Headers & Signatures */}
      {activeTab === 'print' && (
        <Card className="p-5 space-y-5 border border-slate-200 dark:border-slate-800 rounded-[5px]">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Printer className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Khai Báo Tiêu Đề Mẫu In Chứng Từ & Chân Trang Ký Duyệt
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Tên Đơn Vị Doanh Nghiệp (Trên Tiêu Đề In)
              </label>
              <input
                type="text"
                value={config.printTemplate.companyHeader}
                onChange={(e) => updatePrintField('companyHeader', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Địa Chỉ Doanh Nghiệp
              </label>
              <input
                type="text"
                value={config.printTemplate.companyAddress}
                onChange={(e) => updatePrintField('companyAddress', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Mã Số Thuế (MST)
              </label>
              <input
                type="text"
                value={config.printTemplate.taxCode}
                onChange={(e) => updatePrintField('taxCode', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Số Điện Thoại / Hotline
              </label>
              <input
                type="text"
                value={config.printTemplate.phone}
                onChange={(e) => updatePrintField('phone', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Lời Cảm Ơn / Ghi Chú Chân Trang Chứng Từ
              </label>
              <input
                type="text"
                value={config.printTemplate.footerNote}
                onChange={(e) => updatePrintField('footerNote', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-2 font-medium"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Nhãn Tiêu Đề Các Ô Chữ Ký Trên Chứng Từ In:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Chữ ký 1 (Người lập)</label>
                <input
                  type="text"
                  value={config.printTemplate.signatures.preparedBy}
                  onChange={(e) => updateSignature('preparedBy', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100 text-center"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Chữ ký 2 (Thủ kho)</label>
                <input
                  type="text"
                  value={config.printTemplate.signatures.storekeeper}
                  onChange={(e) => updateSignature('storekeeper', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100 text-center"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Chữ ký 3 (Kế toán trưởng)</label>
                <input
                  type="text"
                  value={config.printTemplate.signatures.chiefAccountant}
                  onChange={(e) => updateSignature('chiefAccountant', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100 text-center"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Chữ ký 4 (Giám đốc)</label>
                <input
                  type="text"
                  value={config.printTemplate.signatures.director}
                  onChange={(e) => updateSignature('director', e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100 text-center"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
