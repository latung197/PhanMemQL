import React from 'react';
import { SubMenuKey, Transaction, UserProfile } from '../../types';
import { FinanceCategoriesView } from './FinanceCategoriesView';
import { ReceiptVoucherForm } from './ReceiptVoucherForm';
import { PaymentVoucherForm } from './PaymentVoucherForm';
import { FinanceReportView } from './FinanceReportView';
import { ModuleHeader, ModuleNavGroup } from '../../components/layout/ModuleHeader';
import { FolderTree, FileText, PieChart, DollarSign, CreditCard, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface FinanceModuleProps {
  subKey: SubMenuKey;
  onSelectSubKey: (key: SubMenuKey) => void;
  transactions: Transaction[];
  onAddTransaction: (tx: Transaction) => void;
  currentUser?: UserProfile;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  subKey,
  onSelectSubKey,
  transactions,
  onAddTransaction,
  currentUser
}) => {
  const financeGroups: ModuleNavGroup[] = [
    {
      id: 'danh_muc',
      title: '1. Danh Mục Khoản Mục Thu Chi',
      badgeText: 'Khai báo tài khoản & khoản mục',
      icon: <FolderTree className="h-4 w-4 text-indigo-500" />,
      items: [
        { subKey: 'fin_categories', label: 'Danh mục Khoản Mục Thu / Chi & Tài khoản Qũy', icon: <CreditCard className="h-3.5 w-3.5" /> }
      ]
    },
    {
      id: 'chung_tu',
      title: '2. Chứng Từ Thu & Chi Tiền',
      badgeText: 'Lập phiếu thu & phiếu chi',
      icon: <FileText className="h-4 w-4 text-brand-500" />,
      items: [
        { subKey: 'fin_receipt_voucher', label: 'Lập Phiếu Thu Tiền (Receipt Voucher)', icon: <ArrowDownLeft className="h-3.5 w-3.5" /> },
        { subKey: 'fin_payment_voucher', label: 'Lập Phiếu Chi Tiền (Payment Voucher)', icon: <ArrowUpRight className="h-3.5 w-3.5" /> }
      ]
    },
    {
      id: 'bao_cao',
      title: '3. Báo Cáo Tài Chính & Qũy',
      badgeText: 'Báo cáo Sổ quỹ & Lợi nhuận',
      icon: <PieChart className="h-4 w-4 text-amber-500" />,
      items: [
        { subKey: 'fin_report', label: 'Báo cáo Sổ Qũy, Thu Chi & Lợi Nhuận', icon: <PieChart className="h-3.5 w-3.5" /> }
      ]
    }
  ];

  const renderActiveView = () => {
    switch (subKey) {
      case 'fin_categories':
        return <FinanceCategoriesView currentUser={currentUser} />;
      case 'fin_receipt_voucher':
        return <ReceiptVoucherForm transactions={transactions} onAddTransaction={onAddTransaction} />;
      case 'fin_payment_voucher':
        return <PaymentVoucherForm transactions={transactions} onAddTransaction={onAddTransaction} />;
      case 'fin_report':
      default:
        return <FinanceReportView transactions={transactions} />;
    }
  };

  return (
    <div className="space-y-4">
      {renderActiveView()}
    </div>
  );
};
