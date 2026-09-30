// Functions shown in the permission matrix, grouped by module, and helpers on matrices.
// Codes are the SubMenuKey values also listed in the backend FunctionCatalog.
import { ActionPermissions, SubMenuKey, UserProfile } from '../../../types';
import { getActionPermission } from '../../../utils/permissions';

export type ModuleName = 'Kho Hàng' | 'Bán Hàng' | 'Tài Chính' | 'Nhân Sự' | 'Hệ Thống';
export type FunctionGroup = 'danh_muc' | 'chung_tu' | 'bao_cao' | 'he_thong';

export interface FunctionItem {
  subKey: SubMenuKey;
  label: string;
  module: ModuleName;
  group: FunctionGroup;
}

export type FullMatrix = Record<SubMenuKey, ActionPermissions>;

export const ACTIONS: { key: keyof ActionPermissions; label: string; short: string }[] = [
  { key: 'view', label: 'Xem', short: 'Xem' },
  { key: 'createEdit', label: 'Thêm & Sửa', short: 'Thêm/Sửa' },
  { key: 'delete', label: 'Xóa', short: 'Xóa' },
  { key: 'approve', label: 'Phê duyệt', short: 'Duyệt' },
  { key: 'printExport', label: 'In & Xuất file', short: 'In/Xuất' }
];

export const GROUP_LABELS: Record<FunctionGroup, string> = {
  danh_muc: 'Danh mục',
  chung_tu: 'Chứng từ',
  bao_cao: 'Báo cáo',
  he_thong: 'Hệ thống'
};

export const MODULE_NAMES: ModuleName[] = ['Kho Hàng', 'Bán Hàng', 'Tài Chính', 'Nhân Sự', 'Hệ Thống'];

const f = (subKey: SubMenuKey, label: string, module: ModuleName, group: FunctionGroup): FunctionItem =>
  ({ subKey, label, module, group });

export const FUNCTIONS: FunctionItem[] = [
  f('inv_material_cat', 'Vật tư & Sản phẩm', 'Kho Hàng', 'danh_muc'),
  f('inv_material_type_cat', 'Loại vật tư', 'Kho Hàng', 'danh_muc'),
  f('inv_uom_cat', 'Đơn vị tính', 'Kho Hàng', 'danh_muc'),
  f('inv_uom_conversion_cat', 'Quy đổi đơn vị tính', 'Kho Hàng', 'danh_muc'),
  f('inv_stock_norm_cat', 'Định mức tồn kho', 'Kho Hàng', 'danh_muc'),
  f('inv_lot_cat', 'Lô & Hạn sử dụng', 'Kho Hàng', 'danh_muc'),
  f('inv_location_cat', 'Vị trí lưu kho', 'Kho Hàng', 'danh_muc'),
  f('inv_warehouse_cat', 'Danh mục kho', 'Kho Hàng', 'danh_muc'),
  f('inv_receipt', 'Phiếu nhập kho', 'Kho Hàng', 'chung_tu'),
  f('inv_issue', 'Phiếu xuất kho', 'Kho Hàng', 'chung_tu'),
  f('inv_transfer_order', 'Lệnh điều chuyển kho', 'Kho Hàng', 'chung_tu'),
  f('inv_transfer_issue', 'Phiếu xuất điều chuyển', 'Kho Hàng', 'chung_tu'),
  f('inv_transfer_receipt', 'Phiếu nhập điều chuyển', 'Kho Hàng', 'chung_tu'),
  f('inv_audit_count', 'Phiếu kiểm kê', 'Kho Hàng', 'chung_tu'),
  f('inv_calc_monthly_cost', 'Tính giá trung bình tháng', 'Kho Hàng', 'chung_tu'),
  f('inv_calc_instant_stock', 'Tính tồn kho tức thời', 'Kho Hàng', 'chung_tu'),
  f('inv_approve_receipt', 'Phê duyệt nhập kho', 'Kho Hàng', 'chung_tu'),
  f('inv_approve_issue', 'Phê duyệt xuất kho', 'Kho Hàng', 'chung_tu'),
  f('inv_approve_transfer', 'Phê duyệt điều chuyển', 'Kho Hàng', 'chung_tu'),
  f('inv_report_stock', 'Báo cáo tồn kho', 'Kho Hàng', 'bao_cao'),
  f('inv_report_nxt', 'Báo cáo nhập - xuất - tồn', 'Kho Hàng', 'bao_cao'),
  f('inv_report_inward', 'Báo cáo hàng nhập', 'Kho Hàng', 'bao_cao'),
  f('inv_report_outward', 'Báo cáo hàng xuất', 'Kho Hàng', 'bao_cao'),
  f('inv_report_aging', 'Báo cáo tuổi hàng tồn', 'Kho Hàng', 'bao_cao'),

  f('sales_customers', 'Khách hàng', 'Bán Hàng', 'danh_muc'),
  f('sales_orders', 'Đơn bán hàng', 'Bán Hàng', 'chung_tu'),
  f('sales_delivery', 'Phiếu giao hàng', 'Bán Hàng', 'chung_tu'),
  f('sales_report', 'Báo cáo doanh số', 'Bán Hàng', 'bao_cao'),

  f('fin_categories', 'Khoản mục thu chi', 'Tài Chính', 'danh_muc'),
  f('fin_receipt_voucher', 'Phiếu thu', 'Tài Chính', 'chung_tu'),
  f('fin_payment_voucher', 'Phiếu chi', 'Tài Chính', 'chung_tu'),
  f('fin_report', 'Báo cáo sổ quỹ & lợi nhuận', 'Tài Chính', 'bao_cao'),

  f('hr_list', 'Hồ sơ nhân sự', 'Nhân Sự', 'danh_muc'),
  f('hr_payroll', 'Chấm công & lương', 'Nhân Sự', 'chung_tu'),
  f('hr_resource_booking', 'Đăng ký tài nguyên', 'Nhân Sự', 'chung_tu'),
  f('hr_report', 'Báo cáo nhân sự', 'Nhân Sự', 'bao_cao'),

  f('overview_main', 'Bàn điều hành tổng quan', 'Hệ Thống', 'he_thong'),
  f('reports_main', 'Báo cáo tổng hợp', 'Hệ Thống', 'he_thong'),
  f('ai_main', 'Trợ lý AI', 'Hệ Thống', 'he_thong'),
  f('settings_main', 'Cài đặt & hồ sơ doanh nghiệp', 'Hệ Thống', 'he_thong'),
  f('sys_users', 'Người dùng & phân quyền', 'Hệ Thống', 'he_thong'),
  f('inv_company_unit_cat', 'Đơn vị cơ sở', 'Hệ Thống', 'he_thong'),
  f('sys_default_config', 'Tham số mặc định', 'Hệ Thống', 'he_thong'),
  f('sys_fiscal_year', 'Năm tài chính & khóa sổ', 'Hệ Thống', 'he_thong'),
  f('sys_currencies', 'Ngoại tệ', 'Hệ Thống', 'he_thong'),
  f('sys_exchange_rates', 'Tỷ giá', 'Hệ Thống', 'he_thong')
];

const NONE: ActionPermissions = { view: false, createEdit: false, delete: false, approve: false, printExport: false };
const ALL: ActionPermissions = { view: true, createEdit: true, delete: true, approve: true, printExport: true };

/** Matrix with every function of the catalog, from a user or a role. */
export const toFullMatrix = (source: Pick<UserProfile, 'isSystemAdmin' | 'permissions'>): FullMatrix =>
  Object.fromEntries(FUNCTIONS.map(fn => [fn.subKey, getActionPermission(source, fn.subKey)])) as FullMatrix;

export const uniformMatrix = (value: 'none' | 'all' | 'view'): FullMatrix =>
  Object.fromEntries(FUNCTIONS.map(fn => [fn.subKey,
    value === 'all' ? ALL : value === 'view' ? { ...NONE, view: true } : NONE])) as FullMatrix;

/** Number of checkboxes that differ between two matrices. */
export const countDifferences = (a: FullMatrix, b: FullMatrix): number =>
  FUNCTIONS.reduce((sum, fn) => sum + ACTIONS.filter(ac => a[fn.subKey]?.[ac.key] !== b[fn.subKey]?.[ac.key]).length, 0);

export const matrixEquals = (a: FullMatrix, b: FullMatrix) => countDifferences(a, b) === 0;

/** Number of functions the matrix can at least view. */
export const countViewable = (m: FullMatrix): number => FUNCTIONS.filter(fn => m[fn.subKey]?.view).length;

/** Special rights are compared as sets of "{function}:{code}". */
export const normalizeRights = (rights?: string[]): string[] => [...new Set(rights ?? [])].sort();

export const countRightDifferences = (a: string[], b: string[]): number => {
  const setA = new Set(a);
  const setB = new Set(b);
  return a.filter(x => !setB.has(x)).length + b.filter(x => !setA.has(x)).length;
};
