import React, { useState } from 'react';
import { Coins, Plus, Search, Edit2, Trash2, CheckCircle2, DollarSign, X, Check, Star } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { showToast, saveWithFeedback } from '../../utils/toast';
import { systemSettingsService, CurrencyItem } from '../../services/systemSettingsService';

export const CurrencyCategoryView: React.FC = () => {
  const [currencies, setCurrencies] = useState<CurrencyItem[]>(() => systemSettingsService.getCurrencies());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CurrencyItem | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimalPlaces, setDecimalPlaces] = useState('2');
  const [isBaseCurrency, setIsBaseCurrency] = useState(false);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setCode('');
    setNameVi('');
    setSymbol('');
    setDecimalPlaces('2');
    setIsBaseCurrency(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: CurrencyItem) => {
    setEditingItem(item);
    setCode(item.code);
    setNameVi(item.nameVi);
    setSymbol(item.symbol);
    setDecimalPlaces(item.decimalPlaces.toString());
    setIsBaseCurrency(item.isBaseCurrency);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, currencyCode: string) => {
    if (currencyCode === 'VND') {
      showToast.error('Không thể xóa đồng tiền hạch toán cơ sở chuẩn VND!');
      return;
    }
    const updated = currencies.filter(c => c.id !== id);
    setCurrencies(updated);
    void saveWithFeedback(systemSettingsService.saveCurrencies(updated),
      () => showToast.success(`Đã xóa ngoại tệ ${currencyCode} thành công`),
      () => setCurrencies(systemSettingsService.getCurrencies()));
  };

  const handleSetBaseCurrency = (item: CurrencyItem) => {
    const updated = currencies.map(c => ({
      ...c,
      isBaseCurrency: c.id === item.id
    }));
    setCurrencies(updated);
    void saveWithFeedback(systemSettingsService.saveCurrencies(updated),
      () => showToast.success(`Đã chọn ${item.code} làm đồng tiền hạch toán cơ sở chính!`),
      () => setCurrencies(systemSettingsService.getCurrencies()));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = nameVi.trim();

    if (!cleanCode || !cleanName) {
      showToast.error('Vui lòng nhập đầy đủ mã ngoại tệ và tên!');
      return;
    }

    if (editingItem) {
      const updated = currencies.map(c => {
        if (c.id === editingItem.id) {
          return {
            ...c,
            code: cleanCode,
            nameVi: cleanName,
            symbol: symbol.trim() || cleanCode,
            decimalPlaces: Number(decimalPlaces),
            isBaseCurrency: isBaseCurrency
          };
        }
        // If this one is made base, unset others
        if (isBaseCurrency) {
          return { ...c, isBaseCurrency: false };
        }
        return c;
      });
      setCurrencies(updated);
      void saveWithFeedback(systemSettingsService.saveCurrencies(updated),
        () => showToast.success(`Cập nhật ngoại tệ ${cleanCode} thành công`),
        () => setCurrencies(systemSettingsService.getCurrencies()));
    } else {
      // Check duplicate
      if (currencies.some(c => c.code === cleanCode)) {
        showToast.error(`Mã tiền tệ ${cleanCode} đã tồn tại trong danh mục!`);
        return;
      }

      const newItem: CurrencyItem = {
        id: Date.now().toString(),
        code: cleanCode,
        nameVi: cleanName,
        symbol: symbol.trim() || cleanCode,
        isBaseCurrency: isBaseCurrency,
        decimalPlaces: Number(decimalPlaces),
        status: 'active'
      };

      let updated = [...currencies, newItem];
      if (isBaseCurrency) {
        updated = updated.map(c => c.id === newItem.id ? c : { ...c, isBaseCurrency: false });
      }

      setCurrencies(updated);
      void saveWithFeedback(systemSettingsService.saveCurrencies(updated),
        () => showToast.success(`Thêm mới ngoại tệ ${newItem.code} thành công`),
        () => setCurrencies(systemSettingsService.getCurrencies()));
    }

    setIsModalOpen(false);
  };

  const filteredCurrencies = currencies.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nameVi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-[5px] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-[5px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Danh Mục Ngoại Tệ & Tiền Tệ
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                sys_currencies
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Khai báo các loại đồng tiền sử dụng trong giao dịch mua bán, hóa đơn nhập xuất kho & báo cáo tài chính đa ngoại tệ
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenAdd} className="flex items-center gap-1.5 rounded-[5px] bg-amber-600 hover:bg-amber-700 text-white font-bold">
          <Plus className="h-3.5 w-3.5" />
          <span>Thêm Ngoại Tệ</span>
        </Button>
      </div>

      {/* Toolbar Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên loại tiền (VND, USD, EUR...)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-[5px] text-xs font-medium focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100"
          />
        </div>
        <span className="text-xs text-slate-500 font-semibold">
          Tổng số: <strong className="text-slate-900 dark:text-slate-100">{filteredCurrencies.length}</strong> loại tiền
        </span>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-[5px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-800 text-[11px]">
                <th className="py-3 px-4">Mã Tiền Tệ</th>
                <th className="py-3 px-4">Tên Gọi Đầy Đủ</th>
                <th className="py-3 px-4 text-center">Ký Hiệu</th>
                <th className="py-3 px-4 text-center">Số Chữ Số Lẻ</th>
                <th className="py-3 px-4 text-center">Đồng Tiền Cơ Sở</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredCurrencies.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                    <span className="px-2 py-0.5 rounded-[5px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {item.code}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {item.nameVi}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {item.symbol}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-300">
                    {item.decimalPlaces} chữ số
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.isBaseCurrency ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                        <Check className="h-3 w-3" />
                        Tiền hạch toán chính
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetBaseCurrency(item)}
                        className="text-[10px] text-slate-400 hover:text-indigo-600 underline cursor-pointer"
                      >
                        Đặt làm cơ sở
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-[5px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      Hoạt động
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px]"
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {!item.isBaseCurrency && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.code)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[5px]"
                          title="Xóa ngoại tệ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingItem ? `Chỉnh Sửa Ngoại Tệ: ${editingItem.code}` : 'Thêm Mới Ngoại Tệ'}
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Mã Ngoại Tệ (ISO 3 Chữ Cái) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={5}
                placeholder="Ví dụ: USD, EUR, JPY..."
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Tên Loại Tiền <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Đô la Mỹ, Đồng Euro..."
                value={nameVi}
                onChange={(e) => setNameVi(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Ký Hiệu Tiền Tệ
                </label>
                <input
                  type="text"
                  placeholder="$, €, ₫..."
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 font-bold text-amber-600 text-center"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Số Chữ Số Thập Phân
                </label>
                <select
                  value={decimalPlaces}
                  onChange={(e) => setDecimalPlaces(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-3 py-2 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="0">0 số lẻ (VND, JPY)</option>
                  <option value="2">2 số lẻ (USD, EUR, SGD)</option>
                  <option value="3">3 số lẻ</option>
                  <option value="4">4 số lẻ</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isBaseCurrencyCheck"
                checked={isBaseCurrency}
                onChange={(e) => setIsBaseCurrency(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <label htmlFor="isBaseCurrencyCheck" className="text-slate-700 dark:text-slate-300 font-medium">
                Đặt làm đồng tiền hạch toán cơ sở chính (Base Currency)
              </label>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} className="rounded-[5px]">
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm" className="rounded-[5px] bg-amber-600 hover:bg-amber-700 text-white font-bold">
                {editingItem ? 'Lưu Cập Nhật' : 'Thêm Ngoại Tệ'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
