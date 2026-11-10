import React from 'react';
import { SubMenuKey, Customer, SalesOrder, Product, UserProfile, CompanyUnit } from '../../types';
import { CustomerCategoryView } from './categories/customers';
import { CustomerGroupCategoryView } from './categories/customer-groups';
import { PriceListCategoryView } from './categories/price-lists';
import { SalesOrderView } from './documents/sales-orders';
import { SalesOrderApprovalView } from './documents/approval-sales-order/SalesOrderApprovalView';
import { DeliveryNoteView } from './DeliveryNoteView';
import { SalesReportView } from './SalesReportView';
import { ModuleHeader, ModuleNavGroup } from '../../components/layout/ModuleHeader';
import { FolderTree, FileText, PieChart, ShoppingBag, UserCheck, Truck, Users, Tags, CheckCircle2 } from 'lucide-react';
// [tao-danh-muc] Import màn của danh mục mới: thêm ngay trên dòng này.

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
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
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
  currentUser,
  companyUnits,
  activeCompanyUnitCode
}) => {
  const salesGroups: ModuleNavGroup[] = [
    {
      id: 'danh_muc',
      title: '1. Danh Mục Khách Hàng',
      badgeText: 'Khai báo CRM Khách hàng',
      icon: <FolderTree className="h-4 w-4 text-indigo-500" />,
      items: [
        { subKey: 'sales_customers', label: 'Danh mục Khách Hàng', icon: <UserCheck className="h-3.5 w-3.5" /> },
        { subKey: 'sales_customer_group_cat', label: 'Danh mục Nhóm Khách Hàng', icon: <Users className="h-3.5 w-3.5" /> },
        { subKey: 'sales_price_list_cat', label: 'Danh mục Bảng Giá Bán', icon: <Tags className="h-3.5 w-3.5" /> }
      ]
    },
    {
      id: 'chung_tu',
      title: '2. Chứng Từ Bán Hàng & Vận Chuyển',
      badgeText: 'Lập đơn hàng & Phiếu giao',
      icon: <FileText className="h-4 w-4 text-brand-500" />,
      items: [
        { subKey: 'sales_orders', label: 'Đơn bán hàng (Sales Orders)', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
        { subKey: 'sales_delivery', label: 'Phiếu Giao Hàng & Vận Chuyển', icon: <Truck className="h-3.5 w-3.5" /> },
        { subKey: 'sales_approve_order', label: 'Phê duyệt đơn bán hàng', icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
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
      // [tao-danh-muc] Màn của danh mục mới: thêm case 'mã chức năng': return <...View currentUser={currentUser} />; ngay trên dòng này.
      case 'sales_customers':
        return <CustomerCategoryView currentUser={currentUser} />;
      case 'sales_customer_group_cat':
        return <CustomerGroupCategoryView currentUser={currentUser} />;
      case 'sales_price_list_cat':
        return <PriceListCategoryView currentUser={currentUser} />;
      case 'sales_delivery':
        return <DeliveryNoteView orders={orders} />;
      case 'sales_report':
        return <SalesReportView orders={orders} customers={customers} />;
      case 'sales_approve_order':
        return <SalesOrderApprovalView currentUser={currentUser} />;
      case 'sales_orders':
      default:
        return <SalesOrderView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    }
  };

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      {renderActiveView()}
    </div>
  );
};
