// The one list of ERP functions (SubMenuKey). Routes, breadcrumbs, the screen guard and the permission
// matrix are all derived from it, so a new function is declared here once (plus a sidebar entry in
// mock/initialMenuData.ts and the backend FunctionCatalog.cs). Typed as Record<SubMenuKey, ...>, so a
// code added to SubMenuKey without an entry here is a compile error.
import { ModuleCategoryKey, SubMenuKey } from '../types';
import { translate } from '../utils/i18n';

/** What the function is; drives the grouping of the permission matrix. */
export type FunctionKind = 'catalog' | 'voucher' | 'report' | 'process' | 'system';

export interface FunctionDef {
  category: ModuleCategoryKey;
  /** Hash route, e.g. '/inventory/receipts' (unique). */
  path: string;
  label: string;
  kind: FunctionKind;
}

const fn = (category: ModuleCategoryKey, path: string, label: string, kind: FunctionKind): FunctionDef =>
  ({ category, path, label, kind });

export const FUNCTION_REGISTRY: Record<SubMenuKey, FunctionDef> = {
  overview_main: fn('overview', '/overview', 'Bàn điều hành tổng quan', 'system'),

  // Kho hàng - danh mục
  inv_material_cat: fn('inventory', '/inventory/materials', 'Vật tư & sản phẩm', 'catalog'),
  inv_material_type_cat: fn('inventory', '/inventory/types', 'Loại vật tư', 'catalog'),
  inv_material_group_cat: fn('inventory', '/inventory/material-groups', 'Nhóm vật tư', 'catalog'),
  inv_uom_cat: fn('inventory', '/inventory/uom', 'Đơn vị tính', 'catalog'),
  inv_uom_conversion_cat: fn('inventory', '/inventory/uom-conversions', 'Quy đổi đơn vị tính', 'catalog'),
  inv_stock_norm_cat: fn('inventory', '/inventory/stock-norms', 'Định mức tồn kho', 'catalog'),
  inv_lot_cat: fn('inventory', '/inventory/lots', 'Lô & hạn sử dụng', 'catalog'),
  inv_location_cat: fn('inventory', '/inventory/locations', 'Vị trí lưu kho', 'catalog'),
  inv_warehouse_cat: fn('inventory', '/inventory/warehouses', 'Danh mục kho', 'catalog'),
  inv_warehouse_type_cat: fn('inventory', '/inventory/warehouse-types', 'Danh mục loại kho', 'catalog'),
  // Kho hàng - chứng từ
  inv_receipt: fn('inventory', '/inventory/receipts', 'Phiếu nhập kho', 'voucher'),
  inv_issue: fn('inventory', '/inventory/issues', 'Phiếu xuất kho', 'voucher'),
  inv_transfer_order: fn('inventory', '/inventory/transfer-orders', 'Lệnh điều chuyển kho', 'voucher'),
  inv_transfer_issue: fn('inventory', '/inventory/transfer-issues', 'Phiếu xuất điều chuyển', 'voucher'),
  inv_transfer_receipt: fn('inventory', '/inventory/transfer-receipts', 'Phiếu nhập điều chuyển', 'voucher'),
  inv_audit_count: fn('inventory', '/inventory/stock-audits', 'Phiếu kiểm kê', 'voucher'),
  inv_calc_monthly_cost: fn('inventory', '/inventory/monthly-cost', 'Tính giá trung bình tháng', 'process'),
  inv_calc_instant_stock: fn('inventory', '/inventory/instant-stock', 'Tính tồn kho tức thời', 'process'),
  inv_approve_receipt: fn('inventory', '/inventory/approvals/receipts', 'Phê duyệt nhập kho', 'process'),
  inv_approve_issue: fn('inventory', '/inventory/approvals/issues', 'Phê duyệt xuất kho', 'process'),
  inv_approve_transfer: fn('inventory', '/inventory/approvals/transfers', 'Phê duyệt điều chuyển', 'process'),
  // Kho hàng - báo cáo
  inv_report_stock: fn('inventory', '/inventory/report-stock', 'Báo cáo tồn kho', 'report'),
  inv_report_nxt: fn('inventory', '/inventory/report-nxt', 'Báo cáo nhập - xuất - tồn', 'report'),
  inv_report_inward: fn('inventory', '/inventory/report-inward', 'Báo cáo hàng nhập', 'report'),
  inv_report_outward: fn('inventory', '/inventory/report-outward', 'Báo cáo hàng xuất', 'report'),
  inv_report_aging: fn('inventory', '/inventory/report-aging', 'Báo cáo tuổi hàng tồn', 'report'),

  // Bán hàng
  sales_customers: fn('sales', '/sales/customers', 'Khách hàng', 'catalog'),
  sales_orders: fn('sales', '/sales/orders', 'Đơn bán hàng', 'voucher'),
  sales_delivery: fn('sales', '/sales/delivery', 'Phiếu giao hàng', 'voucher'),
  sales_report: fn('sales', '/sales/report', 'Báo cáo doanh số', 'report'),

  // Tài chính
  fin_categories: fn('finance', '/finance/categories', 'Khoản mục thu chi', 'catalog'),
  fin_receipt_voucher: fn('finance', '/finance/receipts', 'Phiếu thu', 'voucher'),
  fin_payment_voucher: fn('finance', '/finance/payments', 'Phiếu chi', 'voucher'),
  fin_report: fn('finance', '/finance/report', 'Báo cáo sổ quỹ & lợi nhuận', 'report'),

  // Nhân sự
  hr_list: fn('hr', '/hr/employees', 'Hồ sơ nhân sự', 'catalog'),
  hr_payroll: fn('hr', '/hr/payroll', 'Chấm công & lương', 'voucher'),
  hr_resource_booking: fn('hr', '/hr/resource-booking', 'Đăng ký tài nguyên', 'voucher'),
  hr_report: fn('hr', '/hr/report', 'Báo cáo nhân sự', 'report'),

  // Hệ thống
  reports_main: fn('reports', '/reports', 'Báo cáo tổng hợp', 'system'),
  ai_main: fn('ai', '/ai', 'Trợ lý AI', 'system'),
  settings_main: fn('settings', '/settings', 'Hồ sơ doanh nghiệp & sao lưu', 'system'),
  sys_users: fn('settings', '/settings/users', 'Người dùng & phân quyền', 'system'),
  inv_company_unit_cat: fn('settings', '/settings/company-units', 'Đơn vị cơ sở', 'system'),
  sys_departments: fn('settings', '/settings/departments', 'Phòng ban', 'system'),
  sys_default_config: fn('settings', '/settings/defaults', 'Tham số mặc định & đánh số chứng từ', 'system'),
  sys_fiscal_year: fn('settings', '/settings/fiscal-year', 'Năm tài chính & khóa sổ', 'system'),
  sys_currencies: fn('settings', '/settings/currencies', 'Ngoại tệ', 'system'),
  sys_exchange_rates: fn('settings', '/settings/exchange-rates', 'Tỷ giá', 'system'),
  sys_languages: fn('settings', '/settings/languages', 'Ngôn ngữ', 'system'),
  sys_audit_log: fn('settings', '/settings/audit-log', 'Nhật ký thay đổi', 'system'),
  sys_menu: fn('settings', '/settings/menu', 'Quản lý menu', 'system')
};

/** Function codes in declaration order. */
export const FUNCTION_KEYS = Object.keys(FUNCTION_REGISTRY) as SubMenuKey[];

export const CATEGORY_NAMES: Record<ModuleCategoryKey, string> = {
  overview: 'Tổng Quan',
  inventory: 'Kho Hàng',
  sales: 'Bán Hàng',
  finance: 'Tài Chính',
  hr: 'Nhân Sự',
  reports: 'Báo Cáo',
  ai: 'Trợ Lý AI',
  settings: 'Cài Đặt'
};

/** Name of a function in the user's language (texts: function.<code>); the Vietnamese label above when untranslated. */
export const functionLabel = (key: SubMenuKey): string => {
  const text = translate(`function.${key}`);
  return text === `function.${key}` ? FUNCTION_REGISTRY[key]?.label ?? key : text;
};

export const getFunction = (key: SubMenuKey): FunctionDef => FUNCTION_REGISTRY[key] ?? FUNCTION_REGISTRY.overview_main;

export const findFunctionByPath = (path: string): SubMenuKey | undefined =>
  FUNCTION_KEYS.find(key => FUNCTION_REGISTRY[key].path === path);
