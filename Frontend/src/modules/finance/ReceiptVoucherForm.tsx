import React, { useState } from 'react';
import { ArrowDownLeft, Plus, DollarSign } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FinancialTransaction } from '../../types';

interface ReceiptVoucherFormProps {
  transactions: FinancialTransaction[];
  onAddTransaction: (tx: FinancialTransaction) => void;
}

export const ReceiptVoucherForm: React.FC<ReceiptVoucherFormProps> = ({ transactions, onAddTransaction }) => {
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState(15000000);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Thu bán hàng');
  const [performedBy, setPerformedBy] = useState('Nguyễn Văn A');

  const receiptList = transactions.filter(t => t.type === 'Thu');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const newTx: FinancialTransaction = {
      id: `PT${String(transactions.length + 1).padStart(3, '0')}`,
      type: 'Thu',
      category,
      amount,
      date: new Date().toISOString().split('T')[0],
      description: description.trim(),
      performedBy: performedBy.trim() || 'Trần Thịnh (Admin)',
      account: 'Ngân hàng VCB'
    };

    onAddTransaction(newTx);
    setShowModal(false);
    setDescription('');
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Chứng Từ Quỹ - Phiếu Thu Tiền
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Lập và quản lý các phiếu thu tiền mặt, chuyển khoản ngân hàng chính thức</p>
        </div>

        <Button icon={<Plus className="h-4 w-4" />} variant="success" onClick={() => setShowModal(true)}>
          Lập Phiếu Thu Tiền
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Mã Phiếu Thu / Ngày</th>
                <th className="py-3 px-4">Khoản Mục Thu</th>
                <th className="py-3 px-4">Diễn Giải Nội Dung</th>
                <th className="py-3 px-4">Đối Tượng / Người Nộp</th>
                <th className="py-3 px-4 text-right">Số Tiền Thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {receiptList.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{t.id}</p>
                    <p className="text-[10px] text-slate-400">{t.date}</p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">{t.category}</td>
                  <td className="py-3 px-4">{t.description}</td>
                  <td className="py-3 px-4">{t.performedBy}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    +{formatVND(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Lập Phiếu Thu Tiền Mới" maxWidth="3xl">
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300">Khoản Mục Thu *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            >
              <option value="Thu bán hàng">Thu bán hàng & Cung cấp dịch vụ</option>
              <option value="Thu nợ khách hàng">Thu nợ khách hàng</option>
              <option value="Thu khác">Thu tài chính / Hoàn ứng / Thu khác</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-600 dark:text-slate-300">Số Tiền Thu (VNĐ) *</label>
              <input
                type="number"
                required
                min={1000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600 dark:text-slate-300">Người Nộp Tiền</label>
              <input
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-600 dark:text-slate-300">Nội Dung Lý Do Thu *</label>
            <textarea
              rows={2}
              required
              placeholder="VD: Thu tiền đợt 1 hợp đồng HD-2026-001..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Hủy</Button>
            <Button variant="success" type="submit">Xác Nhận Lập Phiếu Thu</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
