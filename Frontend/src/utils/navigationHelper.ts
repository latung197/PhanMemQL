import { ModuleCategoryKey, SubMenuKey } from '../types';

export interface NavHistoryItem {
  category: ModuleCategoryKey;
  subKey: SubMenuKey;
  label: string;
  moduleName: string;
  timestamp: number;
}

export const SUB_MENU_MAP: Record<SubMenuKey, { category: ModuleCategoryKey; label: string; moduleName: string }> = {
  // Overview
  overview_main: { category: 'overview', label: 'Bàn Tổng Quan & Điều Hành', moduleName: 'Tổng Quan' },
  
  // Inventory - 1. Cập nhật số liệu
  inv_receipt: { category: 'inventory', label: 'Phiếu Nhập Kho (Goods Receipt)', moduleName: 'Kho Hàng' },
  inv_issue: { category: 'inventory', label: 'Phiếu Xuất Kho (Goods Issue)', moduleName: 'Kho Hàng' },
  inv_transfer_order: { category: 'inventory', label: 'Lệnh Điều Chuyển Kho', moduleName: 'Kho Hàng' },
  inv_transfer_issue: { category: 'inventory', label: 'Phiếu Xuất Điều Chuyển Kho', moduleName: 'Kho Hàng' },
  inv_transfer_receipt: { category: 'inventory', label: 'Phiếu Nhập Điều Chuyển Kho', moduleName: 'Kho Hàng' },
  inv_audit_count: { category: 'inventory', label: 'Phiếu Kiểm Kê Hàng Hóa', moduleName: 'Kho Hàng' },
  inv_calc_monthly_cost: { category: 'inventory', label: 'Tính Giá Trung Bình Tháng', moduleName: 'Kho Hàng' },
  inv_calc_instant_stock: { category: 'inventory', label: 'Tính Tồn Kho Tức Thời', moduleName: 'Kho Hàng' },

  // Inventory - 2. Phê duyệt
  inv_approve_receipt: { category: 'inventory', label: 'Phê Duyệt Nhập Kho', moduleName: 'Kho Hàng' },
  inv_approve_issue: { category: 'inventory', label: 'Phê Duyệt Xuất Kho', moduleName: 'Kho Hàng' },
  inv_approve_transfer: { category: 'inventory', label: 'Phê Duyệt Điều Chuyển Kho', moduleName: 'Kho Hàng' },

  // Inventory - 3. Danh mục
  inv_material_cat: { category: 'inventory', label: 'Khai báo Vật tư & Sản phẩm', moduleName: 'Kho Hàng' },
  inv_material_type_cat: { category: 'inventory', label: 'Danh mục Loại vật tư', moduleName: 'Kho Hàng' },
  inv_warehouse_cat: { category: 'inventory', label: 'Khai báo Danh mục Kho', moduleName: 'Kho Hàng' },
  inv_location_cat: { category: 'inventory', label: 'Danh mục Vị trí kho (Bin/Rack)', moduleName: 'Kho Hàng' },
  inv_uom_cat: { category: 'inventory', label: 'Danh mục Đơn vị tính', moduleName: 'Kho Hàng' },
  inv_uom_conversion_cat: { category: 'inventory', label: 'Danh mục Quy đổi ĐVT', moduleName: 'Kho Hàng' },
  inv_stock_norm_cat: { category: 'inventory', label: 'Danh mục Định mức tồn kho', moduleName: 'Kho Hàng' },
  inv_lot_cat: { category: 'inventory', label: 'Danh mục Lô & Hạn sử dụng', moduleName: 'Kho Hàng' },

  // Inventory - 4. Hàng nhập
  inv_report_inward: { category: 'inventory', label: 'Báo cáo Bảng kê Hàng Nhập Kho', moduleName: 'Kho Hàng' },

  // Inventory - 5. Hàng xuất
  inv_report_outward: { category: 'inventory', label: 'Báo cáo Bảng kê Hàng Xuất Kho', moduleName: 'Kho Hàng' },

  // Inventory - 6. Hàng tồn
  inv_report_stock: { category: 'inventory', label: 'Báo cáo Tồn Kho Cuối Kỳ / Tức Thời', moduleName: 'Kho Hàng' },
  inv_report_nxt: { category: 'inventory', label: 'Báo cáo Tồn Đầu Kỳ & Nhập - Xuất - Tồn', moduleName: 'Kho Hàng' },
  inv_report_aging: { category: 'inventory', label: 'Báo cáo Phân Tích Tuổi Hàng Tồn Kho', moduleName: 'Kho Hàng' },

  // Settings
  sys_users: { category: 'settings', label: 'Quản lý Người Sử Dụng & Phân Quyền', moduleName: 'Cài Đặt' },
  inv_company_unit_cat: { category: 'settings', label: 'Khai báo Danh mục Đơn vị cơ sở', moduleName: 'Cài Đặt' },
  sys_default_config: { category: 'settings', label: 'Khai báo Mặc định Hệ thống', moduleName: 'Cài Đặt' },
  sys_fiscal_year: { category: 'settings', label: 'Khai báo Năm Làm Việc & Ngày Nhập Liệu', moduleName: 'Cài Đặt' },
  sys_currencies: { category: 'settings', label: 'Danh mục Ngoại tệ & Tiền tệ', moduleName: 'Cài Đặt' },
  sys_exchange_rates: { category: 'settings', label: 'Cập nhật Tỷ giá Hối đoái', moduleName: 'Cài Đặt' },

  // Sales
  sales_customers: { category: 'sales', label: 'Danh mục Khách hàng CRM', moduleName: 'Bán Hàng' },
  sales_orders: { category: 'sales', label: 'Hóa đơn & Đơn bán hàng', moduleName: 'Bán Hàng' },
  sales_delivery: { category: 'sales', label: 'Phiếu Giao Hàng & Vận Chuyển', moduleName: 'Bán Hàng' },
  sales_report: { category: 'sales', label: 'Báo cáo Doanh số & Công nợ', moduleName: 'Bán Hàng' },

  // Finance
  fin_categories: { category: 'finance', label: 'Danh mục Khoản mục Thu Chi', moduleName: 'Tài Chính' },
  fin_receipt_voucher: { category: 'finance', label: 'Phiếu Thu Tiền', moduleName: 'Tài Chính' },
  fin_payment_voucher: { category: 'finance', label: 'Phiếu Chi Tiền', moduleName: 'Tài Chính' },
  fin_report: { category: 'finance', label: 'Báo cáo Sổ Quỹ & Lợi Nhuận', moduleName: 'Tài Chính' },

  // HR
  hr_list: { category: 'hr', label: 'Danh sách Hồ sơ Nhân sự', moduleName: 'Nhân Sự' },
  hr_payroll: { category: 'hr', label: 'Bảng Chấm công & Tính Lương', moduleName: 'Nhân Sự' },
  hr_report: { category: 'hr', label: 'Báo cáo Chi phí Nhân sự', moduleName: 'Nhân Sự' },
  hr_resource_booking: { category: 'hr', label: 'Đăng Ký & Thời Khóa Biểu Tài Nguyên (Phòng họp, Xe, Máy tính)', moduleName: 'Nhân Sự & Tài Nguyên' },

  // Others
  reports_main: { category: 'reports', label: 'Báo cáo Tổng hợp Hệ thống', moduleName: 'Báo Cáo' },
  ai_main: { category: 'ai', label: 'Trợ lý Trí tuệ Nhân tạo AI', moduleName: 'Trợ Lý AI' },
  settings_main: { category: 'settings', label: 'Cài đặt & Phân quyền Hệ thống', moduleName: 'Cài Đặt' }
};

export function getSubMenuMeta(subKey: SubMenuKey) {
  return SUB_MENU_MAP[subKey] || {
    category: 'overview' as ModuleCategoryKey,
    label: subKey,
    moduleName: 'Chức năng'
  };
}
