import React, { useState } from 'react';
import { useNumberFormat, DEFAULT_NUMBER_FORMAT_CONFIG } from '../../context/NumberFormatContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { 
  NumberInput, 
  CurrencyInput, 
  ForeignCurrencyInput, 
  QuantityInput, 
  PercentageInput 
} from '../../components/common';
import { showToast } from '../../utils/toast';
import { Calculator, Save, RotateCcw, CheckCircle2, Sparkles, Sliders } from 'lucide-react';

export const NumberFormatSettings: React.FC = () => {
  const { config, updateConfig, resetConfig, formatCurrency, formatForeignCurrency, formatQuantity, formatPercent } = useNumberFormat();

  const [formConfig, setFormConfig] = useState({ ...config });
  const [testAmount, setTestAmount] = useState<number>(12500000);
  const [testForeignAmount, setTestForeignAmount] = useState<number>(1500);
  const [testExchangeRate, setTestExchangeRate] = useState<number>(25450);
  const [testQuantity, setTestQuantity] = useState<number>(25);
  const [testTaxRate, setTestTaxRate] = useState<number>(8);

  const handleSave = () => {
    updateConfig(formConfig);
    showToast.success('Đã lưu cấu hình khai báo định dạng số & tiền tệ thành công!');
  };

  const handleReset = () => {
    resetConfig();
    setFormConfig({ ...DEFAULT_NUMBER_FORMAT_CONFIG });
    showToast.info('Đã khôi phục cấu hình định dạng số & tiền tệ mặc định');
  };

  return (
    <div className="space-y-6">
      {/* Intro Header Card */}
      <Card className="bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border-indigo-200 dark:border-indigo-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shrink-0">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                Cấu Hình Khai Báo Định Dạng Số, Tiền Tệ & Ngoại Tệ
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                  System-Wide
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Thiết lập dấu phân cách hàng nghìn, số thập phân, ký hiệu tiền tệ nội tệ/ngoại tệ áp dụng tự động cho toàn bộ chứng từ & báo cáo ERP.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button variant="outline" size="sm" onClick={handleReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
              Mặc Định
            </Button>
            <Button size="sm" onClick={handleSave} icon={<Save className="h-3.5 w-3.5" />} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Lưu Khai Báo
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: Separators & Local Currency */}
          <Card title="1. Dấu Phân Cách & Ký Hiệu Tiền Tệ Nội Tệ">
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Thousand Separator */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Dấu Phân Cách Hàng Nghìn
                  </label>
                  <select
                    value={formConfig.thousandSeparator}
                    onChange={(e) => {
                      const val = e.target.value as ',' | '.' | ' ' | '';
                      setFormConfig(prev => ({
                        ...prev,
                        thousandSeparator: val,
                        decimalSeparator: val === '.' ? ',' : '.'
                      }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value=",">Dấu phẩy ( , ) — Ví dụ: 1,000,000</option>
                    <option value=".">Dấu chấm ( . ) — Ví dụ: 1.000.000</option>
                    <option value=" ">Khoảng trắng ( Space ) — Ví dụ: 1 000 000</option>
                  </select>
                </div>

                {/* Decimal Separator */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Dấu Phân Cách Thập Phân
                  </label>
                  <select
                    value={formConfig.decimalSeparator}
                    onChange={(e) => {
                      const val = e.target.value as '.' | ',';
                      setFormConfig(prev => ({
                        ...prev,
                        decimalSeparator: val,
                        thousandSeparator: val === '.' ? ',' : '.'
                      }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value=".">Dấu chấm ( . ) — Ví dụ: 100.50</option>
                    <option value=",">Dấu phẩy ( , ) — Ví dụ: 100,50</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* Local Currency Symbol */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Ký Hiệu Tiền Tệ Nội Tệ
                  </label>
                  <input
                    type="text"
                    value={formConfig.currencySymbol}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, currencySymbol: e.target.value }))}
                    placeholder="VNĐ"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-indigo-600 dark:text-indigo-400"
                  />
                </div>

                {/* Symbol Position */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Vị Trí Ký Hiệu Tiền Tệ
                  </label>
                  <select
                    value={formConfig.currencyPosition}
                    onChange={(e) => setFormConfig(prev => ({ ...prev, currencyPosition: e.target.value as 'prefix' | 'suffix' }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                  >
                    <option value="suffix">Hiển thị phía Sau (10,000,000 {formConfig.currencySymbol})</option>
                    <option value="prefix">Hiển thị phía Trước ({formConfig.currencySymbol} 10,000,000)</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Decimal Precision Rules */}
          <Card title="2. Quy Định Số Chữ Số Thập Phân (Decimal Precision)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Số tiền nội tệ ({formConfig.currencySymbol})
                </label>
                <select
                  value={formConfig.amountDecimals}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, amountDecimals: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value={0}>0 chữ số lẻ (Ví dụ: 100,000)</option>
                  <option value={2}>2 chữ số lẻ (Ví dụ: 100,000.00)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Số tiền ngoại tệ (USD, EUR...)
                </label>
                <select
                  value={formConfig.foreignAmountDecimals}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, foreignAmountDecimals: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value={2}>2 chữ số lẻ (Ví dụ: $1,250.50)</option>
                  <option value={4}>4 chữ số lẻ (Ví dụ: $1,250.5025)</option>
                  <option value={0}>0 chữ số lẻ (Ví dụ: $1,251)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Tỷ giá hối đoái ngoại tệ
                </label>
                <select
                  value={formConfig.exchangeRateDecimals}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, exchangeRateDecimals: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value={2}>2 chữ số lẻ (Ví dụ: 25,450.00)</option>
                  <option value={4}>4 chữ số lẻ (Ví dụ: 25,450.1250)</option>
                  <option value={0}>0 chữ số lẻ (Ví dụ: 25,450)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Số lượng hàng hóa / vật tư
                </label>
                <select
                  value={formConfig.quantityDecimals}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, quantityDecimals: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value={0}>0 chữ số lẻ (Ví dụ: 250)</option>
                  <option value={2}>2 chữ số lẻ (Ví dụ: 250.50)</option>
                  <option value={3}>3 chữ số lẻ (Ví dụ: 250.325 - Mét/Kg)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Đơn giá hàng hóa / vật tư
                </label>
                <select
                  value={formConfig.unitPriceDecimals}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, unitPriceDecimals: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value={0}>0 chữ số lẻ (Ví dụ: 150,000)</option>
                  <option value={2}>2 chữ số lẻ (Ví dụ: 150,000.50)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Tỷ lệ % / Thuế suất
                </label>
                <select
                  value={formConfig.percentDecimals}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, percentDecimals: Number(e.target.value) }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value={1}>1 chữ số lẻ (Ví dụ: 8.5%)</option>
                  <option value={2}>2 chữ số lẻ (Ví dụ: 8.25%)</option>
                  <option value={0}>0 chữ số lẻ (Ví dụ: 8%)</option>
                </select>
              </div>

            </div>
          </Card>

          {/* Save Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={handleReset}>
              Khôi Phục Ban Đầu
            </Button>
            <Button onClick={handleSave} icon={<Save className="h-4 w-4" />} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Lưu Cấu Hình Định Dạng Số
            </Button>
          </div>
        </div>

        {/* Right Column: Interactive Live Demonstration & Controls Test */}
        <div className="lg:col-span-5 space-y-6">
          <Card 
            title="3. Demo Trực Tiếp Các Control Dùng Chung" 
            action={
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Live Preview
              </span>
            }
          >
            <div className="space-y-5">
              
              {/* Control 1: Local Currency Input */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Control Nhập Số Tiền Nội Tệ (CurrencyInput)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formConfig.currencySymbol}
                  </span>
                </div>
                <CurrencyInput
                  value={testAmount}
                  onChange={setTestAmount}
                  showQuickButtons={true}
                  placeholder="Nhập số tiền..."
                />
              </div>

              {/* Control 2: Foreign Currency Input */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  Control Nhập Tiền Ngoại Tệ & Quy Đổi Tỷ Giá (ForeignCurrencyInput)
                </span>
                <ForeignCurrencyInput
                  foreignAmount={testForeignAmount}
                  exchangeRate={testExchangeRate}
                  onForeignAmountChange={setTestForeignAmount}
                  onExchangeRateChange={setTestExchangeRate}
                />
              </div>

              {/* Control 3: Quantity Input */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Control Nhập Số Lượng & Stepper (QuantityInput)
                  </span>
                </div>
                <QuantityInput
                  value={testQuantity}
                  onChange={setTestQuantity}
                  unit="Thùng / Cuộn"
                  showStepper={true}
                />
              </div>

              {/* Control 4: Percentage Input */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Control Nhập Tỷ Lệ / Thuế Suất (PercentageInput)
                  </span>
                </div>
                <PercentageInput
                  value={testTaxRate}
                  onChange={setTestTaxRate}
                />
              </div>

              {/* Format Summary Overview Box */}
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs space-y-2">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Kết quả định dạng thực tế đang áp dụng:
                </div>
                <ul className="space-y-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 divide-y divide-indigo-100 dark:divide-indigo-900/50">
                  <li className="pt-1 flex justify-between">
                    <span className="font-sans text-slate-500">Số tiền nội tệ:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{formatCurrency(testAmount)}</strong>
                  </li>
                  <li className="pt-1 flex justify-between">
                    <span className="font-sans text-slate-500">Tiền ngoại tệ:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{formatForeignCurrency(testForeignAmount, 'USD')}</strong>
                  </li>
                  <li className="pt-1 flex justify-between">
                    <span className="font-sans text-slate-500">Số lượng vật tư:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{formatQuantity(testQuantity)} Thùng</strong>
                  </li>
                  <li className="pt-1 flex justify-between">
                    <span className="font-sans text-slate-500">Tỷ lệ chiết khấu:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">{formatPercent(testTaxRate)}</strong>
                  </li>
                </ul>
              </div>

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
