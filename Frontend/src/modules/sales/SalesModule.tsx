import React from 'react';
import { SubMenuKey, Customer, SalesOrder, Product, UserProfile } from '../../types';
import { CustomerCategoryView } from './CustomerCategoryView';
import { SalesOrderView } from './SalesOrderView';
import { DeliveryNoteView } from './DeliveryNoteView';
import { SalesReportView } from './SalesReportView';
import { ModuleHeader, ModuleNavGroup } from '../../components/layout/ModuleHeader';
import { FolderTree, FileText, PieChart, ShoppingBag, UserCheck, Truck } from 'lucide-react';

interface SalesModuleProps {
  subKey: SubMenuKey;
  onSelectSubKey: (key: SubMenuKey) => void;
  customers: Customer[];
  orders: SalesOrder[];
  products: Product[];
  onAddCustomer: (cust: Customer) => void;
  onAddOrder: (ord: SalesOrder) => void;
  onUpdateOrderStatus: (orderId: string, status: SalesOrder['status']) => void;
  currentUser?: UserProfile;
}

export const SalesModule: React.FC<SalesModuleProps> = ({
  subKey,
  onSelectSubKey,
  customers,
  orders,
  products,
  onAddCustomer,
  onAddOrder,
  onUpdateOrderStatus,
  currentUser
}) => {
  const salesGroups: ModuleNavGroup[] = [
    {
      id: 'danh_muc',
      title: '1. Danh Mục Khách Hàng',
      badgeText: 'Khai báo CRM Khách hàng',
      icon: <FolderTree className="h-4 w-4 text-indigo-500" />,
      items: [
        { subKey: 'sales_customers', label: 'Danh mục Khách Hàng & Phân nhóm CRM', icon: <UserCheck className="h-3.5 w-3.5" /> }
      ]
    },
    {
      id: 'chung_tu',
      title: '2. Chứng Từ Bán Hàng & Vận Chuyển',
      badgeText: 'Lập đơn hàng & Phiếu giao',
      icon: <FileText className="h-4 w-4 text-brand-500" />,
      items: [
        { subKey: 'sales_orders', label: 'Hóa đơn & Đơn bán hàng (Sales Orders)', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
        { subKey: 'sales_delivery', label: 'Phiếu Giao Hàng & Vận Chuyển', icon: <Truck className="h-3.5 w-3.5" /> }
      ]
    },
    {
      id: 'bao_cao',
      title: '3. Báo Cáo Doanh Số',
      badgeText: 'Thống kê bán hàng & công nợ',
      icon: <PieChart className="h-4 w-4 text-amber-500" />,
      items: [
        { subKey: 'sales_report', label: 'Báo cáo Doanh số & Bảng xếp hạng CRM', icon: <PieChart className="h-3.5 w-3.5" /> }
      ]
    }
  ];

  const renderActiveView = () => {
    switch (subKey) {
      case 'sales_customers':
        return <CustomerCategoryView customers={customers} onAddCustomer={onAddCustomer} currentUser={currentUser} />;
      case 'sales_delivery':
        return <DeliveryNoteView orders={orders} />;
      case 'sales_report':
        return <SalesReportView orders={orders} customers={customers} />;
      case 'sales_orders':
      default:
        return (
          <SalesOrderView
            orders={orders}
            customers={customers}
            products={products}
            onAddOrder={onAddOrder}
            onUpdateOrderStatus={onUpdateOrderStatus}
          />
        );
    }
  };

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      {renderActiveView()}
    </div>
  );
};
