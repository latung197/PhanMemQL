import { ModuleCategoryKey, SubMenuKey } from '../types';

export interface RouteConfig {
  path: string;
  category: ModuleCategoryKey;
  subMenu: SubMenuKey;
  label: string;
}

export const ROUTE_MAP: RouteConfig[] = [
  // Overview
  { path: '/overview', category: 'overview', subMenu: 'overview_main', label: 'Tổng Quan Hệ Thống' },

  // Inventory
  { path: '/inventory/materials', category: 'inventory', subMenu: 'inv_material_cat', label: 'Khai Báo Vật Tư & SP' },
  { path: '/inventory/types', category: 'inventory', subMenu: 'inv_material_type_cat', label: 'Danh Mục Loại Vật Tư' },
  { path: '/inventory/uom', category: 'inventory', subMenu: 'inv_uom_cat', label: 'Danh Mục Đơn Vị Tính' },
  { path: '/inventory/uom-conversions', category: 'inventory', subMenu: 'inv_uom_conversion_cat', label: 'Quy Đổi ĐVT' },
  { path: '/inventory/stock-norms', category: 'inventory', subMenu: 'inv_stock_norm_cat', label: 'Định Mức Tồn Kho' },
  { path: '/inventory/lots', category: 'inventory', subMenu: 'inv_lot_cat', label: 'Danh Mục Lô & HSD' },
  { path: '/inventory/locations', category: 'inventory', subMenu: 'inv_location_cat', label: 'Vị Trí Lưu Kho / Kệ' },
  { path: '/inventory/warehouses', category: 'inventory', subMenu: 'inv_warehouse_cat', label: 'Danh Mục Kho Bãi' },
  { path: '/inventory/receipts', category: 'inventory', subMenu: 'inv_receipt', label: 'Phiếu Nhập Kho' },
  { path: '/inventory/issues', category: 'inventory', subMenu: 'inv_issue', label: 'Phiếu Xuất Kho' },
  { path: '/inventory/report-stock', category: 'inventory', subMenu: 'inv_report_stock', label: 'Báo Cáo Tồn Kho' },
  { path: '/inventory/report-nxt', category: 'inventory', subMenu: 'inv_report_nxt', label: 'Báo Cáo Nhập Xuất Tồn' },

  // Sales
  { path: '/sales/customers', category: 'sales', subMenu: 'sales_customers', label: 'Khách Hàng / Đối Tác' },
  { path: '/sales/orders', category: 'sales', subMenu: 'sales_orders', label: 'Đơn Bán Hàng' },
  { path: '/sales/delivery', category: 'sales', subMenu: 'sales_delivery', label: 'Phiếu Giao Hàng' },
  { path: '/sales/report', category: 'sales', subMenu: 'sales_report', label: 'Báo Cáo Doanh Số' },

  // Finance
  { path: '/finance/categories', category: 'finance', subMenu: 'fin_categories', label: 'Khoản Mục Thu / Chi' },
  { path: '/finance/receipts', category: 'finance', subMenu: 'fin_receipt_voucher', label: 'Phiếu Thu Tiền' },
  { path: '/finance/payments', category: 'finance', subMenu: 'fin_payment_voucher', label: 'Phiếu Chi Tiền' },
  { path: '/finance/report', category: 'finance', subMenu: 'fin_report', label: 'Báo Cáo Thu Chi & Quỹ' },

  // HR
  { path: '/hr/employees', category: 'hr', subMenu: 'hr_list', label: 'Danh Sách Nhân Sự' },
  { path: '/hr/payroll', category: 'hr', subMenu: 'hr_payroll', label: 'Chấm Công & Lương' },
  { path: '/hr/report', category: 'hr', subMenu: 'hr_report', label: 'Báo Cáo Chi Phí HR' },

  // System
  { path: '/reports', category: 'reports', subMenu: 'reports_main', label: 'Báo Cáo Tổng Hợp' },
  { path: '/ai', category: 'ai', subMenu: 'ai_main', label: 'Trợ Lý AI ERP' },
  { path: '/settings', category: 'settings', subMenu: 'settings_main', label: 'Cài Đặt Hệ Thống' },
];

export const getRouteBySubMenu = (subMenu: SubMenuKey): RouteConfig => {
  return ROUTE_MAP.find(r => r.subMenu === subMenu) || ROUTE_MAP[0];
};

export const getRouteByHash = (hash: string): RouteConfig | undefined => {
  const cleanPath = hash.replace(/^#/, '') || '/overview';
  return ROUTE_MAP.find(r => r.path === cleanPath);
};
