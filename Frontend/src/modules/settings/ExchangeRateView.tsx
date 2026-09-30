import React, { useState } from 'react';
import { TrendingUp, Plus, Calendar, Search, Edit2, ArrowUpRight, DollarSign, Trash2, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { showToast, saveWithFeedback } from '../../utils/toast';
import { systemSettingsService, ExchangeRateEntry, CurrencyItem } from '../../services/systemSettingsService';

export const ExchangeRateView: React.FC = () => {
  const [rates, setRates] = useState<ExchangeRateEntry[]>(() => systemSettingsService.getExchangeRates());
  const [currencies] = useState<CurrencyItem[]>(() => systemSettingsService.getCurrencies());
  const [selectedCurrency, setSelectedCurrency] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExchangeRateEntry | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [buyRate, setBuyRate] = useState('25400');
  const [sellRate, setSellRate] = useState('25780');
  const [accountingRate, setAccountingRate] = useState('25550');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setDate(new Date().toISOString().slice(0, 10));
    setCurrencyCode('USD');
    setBuyRate('25400');
    setSellRate('25780');
    setAccountingRate('25550');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ExchangeRateEntry) => {
    setEditingItem(item);
    setDate(item.date);
    setCurrencyCode(item.currencyCode);
    setBuyRate(item.buyRate.toString());
    setSellRate(item.sellRate.toString());
    setAccountingRate(item.accountingRate.toString());
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    const updated = rates.filter(r => r.id !== id);
    setRates(updated);
    void saveWithFeedback(systemSettingsService.saveExchangeRates(updated),
      () => showToast.success('Đã xóa bản ghi tỷ giá thành công'),
      () => setRates(systemSettingsService.getExchangeRates()));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numBuy = Number(buyRate) || 0;
    const numSell = Number(sellRate) || 0;
    const numAcc = Number(accountingRate) || numBuy;

    if (numBuy <= 0 || numSell <= 0) {
      showToast.error('Vui lòng nhập tỷ giá mua và bán hợp lệ (> 0)!');
      return;
    }

    if (editingItem) {
      const updated = rates.map(r => r.id === editingItem.id ? {
        ...r,
        date,
        currencyCode,
        buyRate: numBuy,
        sellRate: numSell,
        accountingRate: numAcc,
        updatedBy: 'admin'
      } : r);
      setRates(updated);
      void saveWithFeedback(systemSettingsService.saveExchangeRates(updated),
        () => showToast.success(`Cập nhật tỷ giá ${currencyCode} ngày ${date} thành công`),
        () => setRates(systemSettingsService.getExchangeRates()));
    } else {
      const newRate: ExchangeRateEntry = {
        id: Date.now().toString(),
        date,
        currencyCode,
        buyRate: numBuy,
        sellRate: numSell,
        accountingRate: numAcc,
        updatedBy: 'admin'
      };
      const updated = [newRate, ...rates];
      setRates(updated);
      void saveWithFeedback(systemSettingsService.saveExchangeRates(updated),
        () => showToast.success(`Thêm mới tỷ giá ${currencyCode} ngày ${date} thành công`),
        () => setRates(systemSettingsService.getExchangeRates()));
    }

    setIsModalOpen(false);
  };

  const filteredRates = rates.filter(r => 
    selectedCurrency === 'ALL' || r.currencyCode === selectedCurrency
  );

  const availableCurrencies = currencies.filter(c => !c.isBaseCurrency);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-[5px] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[5px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Cập Nhật Tỷ Giá Ngoại Tệ Hàng Ngày / Kỳ
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                sys_exchange_rates
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý lịch sử tỷ giá giao dịch, tỷ giá hạch toán xuất kho & quy đổi tiền tệ chứng từ sang VNĐ
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenAdd} className="flex items-center gap-1.5 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
          <Plus className="h-3.5 w-3.5" />
          <span>Cập Nhật Tỷ Giá Mới</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-[5px] border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Lọc Theo Ngoại Tệ:</span>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-bold"
          >
            <option value="ALL">Tất Cả Ngoại Tệ ({rates.length})</option>
            {availableCurrencies.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.nameVi}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-[5px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <th className="py-3 px-4">Ngày Áp Dụng</th>
                <th className="py-3 px-4">Mã Ngoại Tệ</th>
                <th className="py-3 px-4 text-right">Tỷ Giá Mua Vào (VND)</th>
                <th className="py-3 px-4 text-right">Tỷ Giá Bán Ra (VND)</th>
                <th className="py-3 px-4 text-right">Tỷ Giá Hạch Toán (VND)</th>
                <th className="py-3 px-4 text-center">Người Cập Nhật</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Chưa có bản ghi tỷ giá nào cho ngoại tệ đã chọn
                  </td>
                </tr>
              ) : (
                filteredRates.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {item.date}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-[5px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-mono font-bold border border-amber-200 dark:border-amber-800">
                        {item.currencyCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300 font-medium">
                      {item.buyRate.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300 font-medium">
                      {item.sellRate.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {item.accountingRate.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                      {item.updatedBy}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px]"
                          title="Chỉnh sửa tỷ giá"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[5px]"
                          title="Xóa tỷ giá"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingItem ? `Chỉnh Sửa Tỷ Giá: ${editingItem.currencyCode}` : 'Cập Nhật Tỷ Giá Ngoại Tệ Mới'}
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Ngày Áp Dụng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Mã Ngoại Tệ <span className="text-rose-500">*</span>
                </label>
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-bold text-slate-900 dark:text-slate-100"
                >
                  {availableCurrencies.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.nameVi}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Tỷ Giá Mua (VNĐ)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={buyRate}
                  onChange={(e) => setBuyRate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Tỷ Giá Bán (VNĐ)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={sellRate}
                  onChange={(e) => setSellRate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Tỷ Giá Hạch Toán
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={accountingRate}
                  onChange={(e) => setAccountingRate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="rounded-[5px]">
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm" className="rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Lưu Tỷ Giá
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
