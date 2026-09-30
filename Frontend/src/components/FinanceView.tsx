import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Search, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  X,
  CreditCard,
  FileText,
  BadgeCent
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Transaction } from '../types';

interface FinanceViewProps {
  transactions: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({ 
  transactions, 
  onAddTransaction 
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'Tất cả' | 'Thu' | 'Chi'>('Tất cả');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [type, setType] = useState<'Thu' | 'Chi'>('Thu');
  const [category, setCategory] = useState('Doanh thu đơn hàng');
  const [amount, setAmount] = useState(100000);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Computations
  const totalIn = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Thu')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const totalOut = useMemo(() => {
    return transactions
      .filter(t => t.type === 'Chi')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const currentProfit = totalIn - totalOut;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'Tất cả' || t.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [transactions, searchTerm, typeFilter]);

  // Aggregate daily transactions for the bar chart
  const barChartData = useMemo(() => {
    // We map categories or recent dates
    const categoryTotals: { [key: string]: { name: string; 'Thu': number; 'Chi': number } } = {};
    
    transactions.forEach(t => {
      const cat = t.category;
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { name: cat, 'Thu': 0, 'Chi': 0 };
      }
      if (t.type === 'Thu') {
        categoryTotals[cat]['Thu'] += t.amount;
      } else {
        categoryTotals[cat]['Chi'] += t.amount;
      }
    });

    return Object.values(categoryTotals);
  }, [transactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert('Vui lòng điền mô tả và nhập số tiền lớn hơn 0!');
      return;
    }

    onAddTransaction({
      type,
      category,
      amount,
      date,
      description: description.trim()
    });

    // Reset Form
    setDescription('');
    setAmount(100000);
    setDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(false);
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className="space-y-6" id="finance-module-view">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5.5 w-5.5 text-rose-500" />
            Tài Chính Doanh Nghiệp (Lập Sổ Ledger)
          </h2>
          <p className="text-xs text-gray-500">Giám sát tổng doanh thu ròng, chi phí vận hành, quỹ lương nhân sự và tạo mới thu chi trực tiếp</p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setCategory(type === 'Thu' ? 'Doanh thu đơn hàng' : 'Chi phí văn phòng');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-650 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer focus:outline-hidden"
          id="btn-add-transaction-modal-trigger"
        >
          <Plus className="h-4.5 w-4.5" />
          Tạo dòng thu/chi trực tiếp
        </button>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="finance-stats-row">
        {/* Sum Received */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <ArrowUpRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tổng Thu (Receipts)</p>
            <h4 className="text-2xl font-bold font-mono text-gray-900 mt-1">{formatVND(totalIn)}</h4>
          </div>
          <div className="absolute top-0 right-0 h-full w-1 bg-emerald-500"></div>
        </div>

        {/* Sum Expensed */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <ArrowDownRight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tổng Chi (Expenses)</p>
            <h4 className="text-2xl font-bold font-mono text-gray-905 mt-1">{formatVND(totalOut)}</h4>
          </div>
          <div className="absolute top-0 right-0 h-full w-1 bg-rose-500"></div>
        </div>

        {/* Balance Profit */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 flex items-center gap-4 relative overflow-hidden">
          <div className={`p-3.5 rounded-xl shrink-0 ${currentProfit >= 0 ? 'bg-indigo-50 text-indigo-650' : 'bg-red-50 text-red-650'}`}>
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Lợi nhuận ròng tạm tính</p>
            <h4 className={`text-2xl font-bold font-mono mt-1 ${currentProfit >= 0 ? 'text-indigo-650' : 'text-rose-600'}`}>
              {formatVND(currentProfit)}
            </h4>
          </div>
          <div className={`absolute top-0 right-0 h-full w-1 ${currentProfit >= 0 ? 'bg-indigo-550' : 'bg-rose-500'}`}></div>
        </div>
      </div>

      {/* Recharts Bar Ledger report */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
        <h4 className="font-bold text-gray-800 text-sm mb-4">Tổng Hợp Thu Chi theo Danh Mục Hàng Hoá & Phúc Lợi</h4>
        <div className="h-64 w-full" id="finance-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`}
              />
              <Tooltip 
                formatter={(value: any) => [formatVND(Number(value)), '']}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #f3f4f6', borderRadius: '12px', fontSize: '11px' }}
              />
              <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs space-y-4">
        {/* Table header operations */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="relative grow">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tra cứu nội dung giao dịch, danh mục, liên danh..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 pl-9 pr-4 py-1.8 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-rose-500 outline-none"
              id="search-transactions-input"
            />
          </div>

          <div className="flex gap-1.5" id="tx-type-selector">
            {(['Tất cả', 'Thu', 'Chi'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setTypeFilter(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-hidden ${
                  typeFilter === opt 
                    ? 'bg-rose-500 text-white' 
                    : 'text-gray-500 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* The ledger data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="finance-ledger-table">
            <thead>
              <tr className="bg-gray-55 border-b border-gray-100 text-xs font-bold uppercase text-gray-500 tracking-wider">
                <th className="py-4 px-6">ID Giao Dịch</th>
                <th className="py-4 px-6">Dòng Nghiệp Vụ</th>
                <th className="py-4 px-6">Phân Nhóm Thu/Chi</th>
                <th className="py-4 px-6">Nội Dung Chi Tiết</th>
                <th className="py-4 px-6">Liên Danh Đơn / Mã số</th>
                <th className="py-4 px-6">Ngày Hóa Đơn</th>
                <th className="py-4 px-6 text-right">Giá Trị Số (VND)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Không tìm thấy dòng thông tin giao dịch!
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice().reverse().map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-all">
                    <td className="py-4 px-6 font-mono font-bold text-gray-800">{tx.id}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold leading-none inline-block border ${
                        tx.type === 'Thu' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {tx.type === 'Thu' ? 'Thu nhập' : 'Khoản chi'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-semibold">{tx.category}</td>
                    <td className="py-4 px-6 text-gray-700 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-400">{tx.refId || 'Ngoại thương'}</td>
                    <td className="py-4 px-6 text-gray-500 text-xs">{tx.date}</td>
                    <td className={`py-4 px-6 text-right font-mono font-bold text-base ${
                      tx.type === 'Thu' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {tx.type === 'Thu' ? '+' : '-'}{formatVND(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Direct transaction modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="add-transaction-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BadgeCent className="h-5 w-5 text-rose-500" />
                Ghi Sổ Giao Dịch Thu Chi
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg focus:outline-hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Phân loại dòng vốn</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('Thu');
                      setCategory('Doanh thu đơn hàng');
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      type === 'Thu'
                        ? 'bg-emerald-50 text-emerald-750 border-emerald-200'
                        : 'bg-white text-gray-650 border-gray-200 hover:bg-slate-50'
                    }`}
                  >
                    Phiếu Thu (Tiền mặt / Bank)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('Chi');
                      setCategory('Chi phí văn phòng');
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      type === 'Chi'
                        ? 'bg-rose-50 text-rose-750 border-rose-200'
                        : 'bg-white text-gray-650 border-gray-200 hover:bg-slate-50'
                    }`}
                  >
                    Phiếu Chi (Thanh toán / Thải chi)
                  </button>
                </div>
              </div>

              {/* Category selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Danh mục nghiệp vụ</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none cursor-pointer text-gray-700"
                >
                  {type === 'Thu' ? (
                    <>
                      <option value="Doanh thu đơn hàng">Doanh thu đơn hàng</option>
                      <option value="Thu đầu tư">Thu khoản nợ/đầu tư</option>
                      <option value="Doanh thu dịch vụ">Doanh thu dịch vụ ngoài</option>
                      <option value="Thu khác">Vay mượn/Thu khác</option>
                    </>
                  ) : (
                    <>
                      <option value="Chi phí văn phòng">Chi thuê phòng mặt bằng</option>
                      <option value="Chi trả lương">Chi trả quỹ lương</option>
                      <option value="Nhập hàng">Chi sỉ sắm nhập kho</option>
                      <option value="Quảng cáo tiếp thị">Marketing và ads</option>
                      <option value="Chi khác">Thù lao/Chi khác</option>
                    </>
                  )}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Giá Trị Giao Dịch *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-500">Ngày Tạo Sổ</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none font-bold text-gray-750"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Nội dung chi tiết *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Điền lý lịch giao dịch rõ ràng để hỗ trợ kiểm toán..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg text-xs py-2 px-3 outline-none resize-none"
                />
              </div>

              {/* Action triggers */}
              <div className="flex justify-end gap-2 text-xs pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-slate-50 text-gray-600 font-semibold focus:outline-hidden"
                >
                  Đóng lại
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-semibold shadow-xs transition-all cursor-pointer focus:outline-hidden"
                >
                  Lưu Sổ Giao Dịch
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
