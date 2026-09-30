import { RoleDefinition, SubMenuKey, ActionPermissions } from '../types';
import { FULL_ACTIONS, FORBIDDEN_ACTIONS } from '../utils/permissions';

// Permission checks live in utils/permissions; re-exported for existing imports.
export { FULL_ACTIONS, FORBIDDEN_ACTIONS, getActionPermission } from '../utils/permissions';

export const ALL_SUB_MENU_KEYS: SubMenuKey[] = [
  // Inventory Data
  'inv_receipt',
  'inv_issue',
  'inv_transfer_order',
  'inv_transfer_issue',
  'inv_transfer_receipt',
  'inv_audit_count',
  'inv_calc_monthly_cost',
  'inv_calc_instant_stock',

  // Approvals
  'inv_approve_receipt',
  'inv_approve_issue',
  'inv_approve_transfer',

  // Master Data
  'inv_material_cat',
  'inv_material_type_cat',
  'inv_warehouse_cat',
  'inv_location_cat',
  'inv_uom_cat',
  'inv_uom_conversion_cat',
  'inv_stock_norm_cat',
  'inv_lot_cat',

  // Reports
  'inv_report_inward',
  'inv_report_outward',
  'inv_report_stock',
  'inv_report_nxt',
  'inv_report_aging',

  // Settings
  'sys_users',
  'inv_company_unit_cat',
  'sys_default_config',
  'sys_fiscal_year',
  'sys_currencies',
  'sys_exchange_rates',

  // Sales
  'sales_customers',
  'sales_orders',
  'sales_delivery',
  'sales_report',

  // Finance
  'fin_categories',
  'fin_receipt_voucher',
  'fin_payment_voucher',
  'fin_report',

  // HR
  'hr_list',
  'hr_payroll',
  'hr_report',

  // System Main
  'overview_main',
  'reports_main',
  'ai_main',
  'settings_main'
];

export const READONLY_ACTIONS: ActionPermissions = {
  view: true,
  createEdit: false,
  delete: false,
  approve: false,
  printExport: true
};

// Helper to build full matrix
const buildPerms = (
  customRules: Partial<Record<SubMenuKey, ActionPermissions>>,
  defaultAction: ActionPermissions = FORBIDDEN_ACTIONS
): Record<SubMenuKey, ActionPermissions> => {
  const result: Record<string, ActionPermissions> = {};
  ALL_SUB_MENU_KEYS.forEach(key => {
    result[key] = customRules[key] || { ...defaultAction };
  });
  return result as Record<SubMenuKey, ActionPermissions>;
};

export const initialRoles: RoleDefinition[] = [
  {
    id: 'ROLE_ADMIN',
    code: 'ADMIN',
    name: 'Ban Giám Đốc (System CEO / Admin)',
    description: 'Toàn bộ đặc quyền trong hệ thống ERP: Xem, Sửa, Xóa, Phê duyệt chứng từ và In/Xuất báo cáo.',
    isSystemRole: true,
    permissions: buildPerms({}, FULL_ACTIONS)
  },
  {
    id: 'ROLE_CHIEF_ACCOUNTANT',
    code: 'KTT',
    name: 'Kế Toán Trưởng (Chief Accountant)',
    description: 'Phê duyệt chứng từ Thu Chi, Đơn hàng & Bảng lương; Kiểm soát báo cáo tài chính & doanh số.',
    isSystemRole: false,
    permissions: buildPerms({
      overview_main: FULL_ACTIONS,
      fin_categories: FULL_ACTIONS,
      fin_receipt_voucher: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      fin_payment_voucher: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      fin_report: FULL_ACTIONS,
      sales_customers: READONLY_ACTIONS,
      sales_orders: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      sales_report: FULL_ACTIONS,
      inv_report_stock: READONLY_ACTIONS,
      inv_report_nxt: READONLY_ACTIONS,
      hr_list: READONLY_ACTIONS,
      hr_payroll: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      reports_main: FULL_ACTIONS,
      ai_main: FULL_ACTIONS,
      settings_main: READONLY_ACTIONS
    })
  },
  {
    id: 'ROLE_WAREHOUSE_MASTER',
    code: 'TK',
    name: 'Thủ Kho (Warehouse Master)',
    description: 'Quản lý danh mục kho, tạo & duyệt Phiếu Nhập/Xuất kho, lập báo cáo Nhập-Xuất-Tồn.',
    isSystemRole: false,
    permissions: buildPerms({
      overview_main: READONLY_ACTIONS,
      inv_material_cat: { view: true, createEdit: true, delete: false, approve: false, printExport: true },
      inv_warehouse_cat: { view: true, createEdit: true, delete: false, approve: false, printExport: true },
      inv_receipt: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      inv_issue: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      inv_report_stock: FULL_ACTIONS,
      inv_report_nxt: FULL_ACTIONS,
      sales_delivery: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      reports_main: READONLY_ACTIONS,
      ai_main: READONLY_ACTIONS
    })
  },
  {
    id: 'ROLE_SALES_EXEC',
    code: 'NVKD',
    name: 'Nhân Viên Kinh Doanh (Sales Executive)',
    description: 'Tạo khách hàng CRM, lập Đơn bán hàng, theo dõi báo cáo doanh số cá nhân.',
    isSystemRole: false,
    permissions: buildPerms({
      overview_main: READONLY_ACTIONS,
      sales_customers: { view: true, createEdit: true, delete: false, approve: false, printExport: true },
      sales_orders: { view: true, createEdit: true, delete: false, approve: false, printExport: true },
      sales_delivery: READONLY_ACTIONS,
      sales_report: READONLY_ACTIONS,
      inv_material_cat: READONLY_ACTIONS,
      inv_report_stock: READONLY_ACTIONS,
      ai_main: { view: true, createEdit: true, delete: false, approve: false, printExport: true }
    })
  },
  {
    id: 'ROLE_HR_OFFICER',
    code: 'NVNS',
    name: 'Chuyên Viên Nhân Sự (HR Specialist)',
    description: 'Quản lý hồ sơ nhân viên, tính bảng lương, chấm công và báo cáo nhân sự.',
    isSystemRole: false,
    permissions: buildPerms({
      overview_main: READONLY_ACTIONS,
      hr_list: { view: true, createEdit: true, delete: false, approve: false, printExport: true },
      hr_payroll: { view: true, createEdit: true, delete: false, approve: true, printExport: true },
      hr_report: FULL_ACTIONS,
      reports_main: READONLY_ACTIONS,
      ai_main: READONLY_ACTIONS
    })
  },
  {
    id: 'ROLE_READONLY',
    code: 'VIEWER',
    name: 'Nhân Viên Chỉ Xem (Read-Only Viewer)',
    description: 'Chỉ có quyền Tra cứu & In/Xuất dữ liệu các Danh mục và Báo cáo, không thể sửa/xóa/duyệt.',
    isSystemRole: false,
    permissions: buildPerms({
      overview_main: READONLY_ACTIONS,
      inv_material_cat: READONLY_ACTIONS,
      inv_warehouse_cat: READONLY_ACTIONS,
      inv_report_stock: READONLY_ACTIONS,
      inv_report_nxt: READONLY_ACTIONS,
      sales_customers: READONLY_ACTIONS,
      sales_report: READONLY_ACTIONS,
      fin_categories: READONLY_ACTIONS,
      fin_report: READONLY_ACTIONS,
      hr_list: READONLY_ACTIONS,
      hr_report: READONLY_ACTIONS,
      reports_main: READONLY_ACTIONS,
      ai_main: READONLY_ACTIONS
    })
  }
];
