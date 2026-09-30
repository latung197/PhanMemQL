// Global Types Index for S-ERP System

export interface CompanyUnit {
  id: string;
  code: string;         // ma_dvcs (e.g. 'DVCS01', 'DVCS02')
  name: string;         // ten_dvcs (e.g. 'Trụ sở chính TP. Hồ Chí Minh')
  shortName?: string;   // Tên viết tắt
  address?: string;     // Địa chỉ
  phone?: string;       // Số điện thoại
  email?: string;       // Email
  taxCode?: string;     // Mã số thuế
  status: 'Hoạt động' | 'Tạm dừng';
  isDefault?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  costPrice: number; // Giá vốn nhập kho
  unit: string; // Đơn vị tính (Cái, Bộ, Hộp, Kg,...)
  warehouseId: string; // Mã kho lưu trữ
  warehouseName: string; // Tên kho (Kho Tổng HCMC, Kho Hà Nội, Kho Miền Trung)
  minThreshold: number; // Ngưỡng tối thiểu báo động hết hàng
  position: string; // Vị trí trong kho, ví dụ: "Kệ A-1"

  // Linked Master Data & ERP Extended Fields requested by user:
  ma_vt?: string;             // Mã vật tư
  ma_vt_kh?: string;          // Mã vật tư khách hàng
  ten_vt?: string;             // Tên vật tư
  dvt?: string;                // Đơn vị tính
  nhieu_dvt?: boolean;         // Có nhiều đơn vị tính
  lo_yn?: boolean;             // Theo dõi lô (YN)
  seri_yn?: boolean;           // Theo dõi Series (YN)
  kk_yn?: boolean;             // Kiểm kê định kỳ (YN)
  vt_ton_kho?: boolean;        // Vật tư tồn kho (YN)
  gia_ton?: string;            // Phương pháp tính giá tồn kho (FIFO, Bình quân...)
  nh_vt1?: string;             // Nhóm vật tư 1
  nh_vt2?: string;             // Nhóm vật tư 2
  nh_vt3?: string;             // Nhóm vật tư 3
  nh_vt4?: string;             // Nhóm vật tư 4
  nh_vt5?: string;             // Nhóm vật tư 5
  ghi_chu?: string;            // Ghi chú
  creattime?: string;          // Thời gian tạo
  createid?: string;           // Người tạo
  updatetime?: string;         // Thời gian cập nhật
  updateid?: string;           // Người cập nhật
  status?: 'Hoạt động' | 'Tạm dừng';
  ma_kho?: string;             // Mã kho
  ma_vi_tri?: string;          // Mã vị trí
  ma_thue?: string;            // Mã thuế GTGT
  ma_thue_nk?: string;         // Mã thuế nhập khẩu
  kieu_lo?: string;            // Kiểu lô
  so_ngay_sp?: number;         // Số ngày sản xuất
  so_ngay_bh?: number;         // Số ngày bảo hành
  ma_kh?: string;              // Mã nhà cung cấp/khách hàng
  height?: number;             // Chiều cao
  length?: number;             // Chiều dài
  width?: number;              // Chiều rộng
  weight?: number;             // Trọng lượng
  volume?: number;             // Thể tích
  ngay_mua?: string;           // Ngày mua
  loai_vt?: string;            // Loại vật tư
  kieu_kh?: string;            // Kiểu khấu hao
  gop_tk?: string;             // Gộp tài khoản
  ton_kho?: number;            // Tồn kho
  ton_kho_min?: number;        // Tồn kho min
  ton_kho_max?: number;        // Tồn kho max
  sl_min?: number;             // Số lượng min
  sl_max?: number;             // Số lượng max
  sl_bs_dh?: number;           // Số lượng bổ sung đơn hàng
  kieu_sx?: string;            // Kiểu sản xuất (MTS/MTO)
  ma_cau_truc?: string;        // Mã cấu trúc sản phẩm
  part_no?: string;            // Part Number
  gia_mua?: number;            // Giá mua
  gia_ban?: number;            // Giá bán
  gia_von?: number;            // Giá vốn
  bo_yn?: boolean;             // Bộ sản phẩm / Combo
  ma_dvcs?: string;            // Mã đơn vị cơ sở chính
  ds_ma_dvcs?: string[];       // Danh sách các mã ĐVCS được phân quyền sử dụng
  ma_vv?: string;              // Mã vụ việc
  ma_series_no?: string;       // Mã series
  model?: string;              // Model
  so_ngay_ton_kho?: number;    // Số ngày tồn kho tối đa
  dinh_luong?: string;         // Định lượng
  qc_yn?: boolean;             // Kiểm định chất lượng QC
  ma_phan_xuong?: string;      // Mã phân xưởng
  ma_cd_gt?: string;           // Mã công đoạn giá thành
  ma_version?: string;         // Phiên bản
  ma_kh_ban?: string;          // Mã khách hàng bán
  nhom_sp?: string;            // Nhóm sản phẩm
  ma_kho_ng?: string;          // Mã kho hàng lỗi NG
  ma_cp_yn?: boolean;          // Có phân bổ chi phí
  ma_cp?: string;              // Mã chi phí
  noi_dia_yn?: boolean;        // Hàng nội địa
  tb_yn?: boolean;             // Thiết bị tài sản
  leadtime?: number;           // Thời gian cung ứng (Leadtime)

  materialTypeId?: string;
  materialTypeName?: string;
  baseUnitId?: string;
  secondaryUnitId?: string;
  conversionRate?: number;
  stockNormId?: string;
  maxThreshold?: number;
  safetyStock?: number;
  lotId?: string;
  lotNumber?: string;
  locationId?: string;
  locationCode?: string;
}

export interface MaterialType {
  id: string;
  code: string;
  name: string;
  group: string;
  description: string;
  status: 'Hoạt động' | 'Tạm dừng';
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string;
  note?: string;
  status: 'Hoạt động' | 'Tạm dừng';
}

export interface UomConversion {
  id: string;
  code: string;
  materialId?: string;
  materialName?: string;
  fromUnitId: string;
  fromUnitName: string;
  toUnitId: string;
  toUnitName: string;
  conversionFactor: number;
  description?: string;
}

export interface StockNorm {
  id: string;
  code: string;
  materialId: string;
  materialName: string;
  materialSku?: string;
  warehouseId: string;
  warehouseName: string;
  minQuantity: number;
  maxQuantity: number;
  safetyStock: number;
  reorderPoint: number;
  status: 'Bình thường' | 'Cảnh báo tồn' | 'Thiếu hàng';
}

export interface MaterialLot {
  id: string;
  lotNumber: string;
  materialId: string;
  materialName: string;
  mfgDate: string; // YYYY-MM-DD
  expDate: string; // YYYY-MM-DD
  initialQuantity: number;
  currentQuantity: number;
  qualityStatus: 'Đạt chuẩn' | 'Cần kiểm định' | 'Cảnh báo hạn' | 'Hết hạn';
  supplierName?: string;
}

export interface StorageLocation {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  zone: string;
  rack: string;
  shelf: string;
  capacity: number;
  currentOccupancy: number;
  status: 'Còn chỗ' | 'Đầy' | 'Bảo trì';
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  manager: string;
  capacity: string;
  status: 'Đang hoạt động' | 'Tạm dừng';
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unitPrice?: number;
}

export type OrderStatus = 'Hoàn thành' | 'Đang xử lý' | 'Chờ xử lý' | 'Đang giao' | 'Đã hoàn thành' | 'Đã hủy';

export interface SalesOrder {
  id: string;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  salesperson?: string;
  date: string; // YYYY-MM-DD
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: 'Tiền mặt' | 'Chuyển khoản' | 'Ví điện tử';
  deliveryNoteId?: string;
}

export interface DeliveryNote {
  id: string;
  orderId: string;
  customerName: string;
  deliveryDate: string;
  carrier: string;
  trackingNumber: string;
  status: 'Đã xuất kho' | 'Đang giao' | 'Đã giao hàng' | 'Thất bại';
}

export type EmployeeStatus = 'Đang làm việc' | 'Nghỉ phép' | 'Đã nghỉ việc' | 'Chính thức';

export interface Employee {
  id: string;
  name: string;
  position?: string;
  department: string;
  role: string;
  email: string;
  phone: string;
  salary: number;
  status: EmployeeStatus;
  hireDate: string; // YYYY-MM-DD
  joinDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  totalSpent: number;
  lastPurchaseDate: string;
}

export type TransactionType = 'Thu' | 'Chi';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string; // Ví dụ: "Bán hàng", "Trả lương", "Thuê mặt bằng", "Nhập hàng",...
  amount: number;
  date: string;
  description: string;
  refId?: string; // Mã liên danh (ví dụ, Mã đơn hàng hoặc Mã nhân sự)
  account: 'Tiền mặt' | 'Ngân hàng VCB' | 'Ngân hàng TCB';
  performedBy?: string;
}

export interface VoucherItem {
  productId?: string;
  productName: string;
  sku?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  lotNumber?: string;
  position?: string;
}

export interface GoodsVoucher {
  id: string;
  type: 'Nhập kho' | 'Xuất kho';
  code: string;
  date: string;                      // Ngày chứng từ (Document Date)
  createdDate?: string;               // Ngày lập chứng từ
  companyUnitId?: string;             // Đơn vị cơ sở ID
  companyUnitName?: string;           // Đơn vị cơ sở
  voucherType?: string;               // Loại nhập xuất: Nhập mua mới, Nhập điều chuyển, Nhập trả lại, Nhập sản xuất
  currencyCode?: string;              // Loại tiền (VND, USD, EUR, JPY, CNY...)
  exchangeRate?: number;              // Tỷ giá quy đổi so với VNĐ
  supplierName?: string;              // Nhà cung cấp / Đối tác
  partnerName?: string;               // Khách hàng / Đơn vị nhận hàng
  delivererName?: string;             // Người giao hàng / Người nhận hàng
  warehouseId: string;
  warehouseName: string;
  items: VoucherItem[];
  materialItems?: VoucherItem[];       // Tab Nguyên vật liệu (Định mức / Cấu trúc SP - BOM)
  totalValue: number;
  createdBy: string;
  approvedBy?: string;
  status?: 'Lập chứng từ' | 'Chờ duyệt' | 'Đã phê duyệt' | 'Chuyển sổ kho' | 'Hủy' | string;
  note: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: 'Tổng quan' | 'Kho hàng' | 'Bán hàng' | 'Nhân sự' | 'Tài chính' | 'Trợ lý AI' | 'Cài đặt';
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  /** Creation time as an ISO string (backend) or a display label (mock data). */
  time: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  read: boolean;
  linkModule?: string;
  /** Full name of the person who sent it (backend). */
  sender?: string | null;
  /** Linked document: function code (e.g. inv_receipt) and document id. */
  linkFunction?: SubMenuKey | null;
  linkDocumentId?: string | null;
}

export interface ActionPermissions {
  view: boolean;         // Xem
  createEdit: boolean;   // Thêm & Sửa
  delete: boolean;       // Xóa
  approve: boolean;      // Phê duyệt chứng từ
  printExport: boolean;  // In & Xuất file PDF/Excel
}

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystemRole?: boolean;
  permissions: Record<SubMenuKey, ActionPermissions>;
  /** Special rights as "{function}:{code}", e.g. "inv_receipt:VIEW_PRICE". */
  specialRights?: string[];
}

export type SubKeyPermissions = boolean | ActionPermissions;

export type UserPermissions = Partial<Record<SubMenuKey, SubKeyPermissions>>;

/** Signed-in user or user record returned by the backend (/api/auth/me, /api/settings/users). */
export interface UserProfile {
  id: string;
  username: string;
  /** Only present in mock data; the backend never returns passwords. */
  password?: string;
  fullName: string;
  email: string;
  role: string;          // Ten vai tro / Role Name
  roleId?: string;       // ID vai tro ma dinh
  /** Department name, for display. */
  department: string;
  /** Department code (Settings › Phòng ban); used by approval rules. */
  departmentCode?: string | null;
  phone: string;
  avatar: string;
  themePref: 'light' | 'dark';
  notificationsEnabled: boolean;
  isSystemAdmin?: boolean;
  permissions?: UserPermissions;
  ma_dvcs?: string;      // Đơn vị cơ sở mặc định của tài khoản
  ds_ma_dvcs?: string[]; // Các đơn vị cơ sở tài khoản được truy cập
  employeeCode?: string; // Mã nhân viên
  isActive?: boolean;    // false = tài khoản bị khóa
  /** Quyền đặc biệt "{function}:{code}" (xem giá, sửa phiếu đã duyệt...). */
  specialRights?: string[];
}

export interface ERPData {
  companyUnits?: CompanyUnit[];
  products: Product[];
  warehouses: Warehouse[];
  materialTypes?: MaterialType[];
  unitsOfMeasure?: UnitOfMeasure[];
  uomConversions?: UomConversion[];
  stockNorms?: StockNorm[];
  lots?: MaterialLot[];
  storageLocations?: StorageLocation[];
  orders: SalesOrder[];
  deliveryNotes: DeliveryNote[];
  employees: Employee[];
  customers: Customer[];
  transactions: Transaction[];
  vouchers: GoodsVoucher[];
  activities: ActivityLog[];
  notifications: SystemNotification[];
  /** Mock users only; real accounts come from the backend. */
  users?: UserProfile[];
}

export type ModuleCategoryKey = 
  | 'overview'
  | 'inventory'
  | 'sales'
  | 'finance'
  | 'hr'
  | 'reports'
  | 'ai'
  | 'settings';

export type SubMenuKey = 
  // Inventory submenus - 1. Cập nhật số liệu
  | 'inv_receipt'               // Phiếu nhập kho
  | 'inv_issue'                 // Phiếu xuất kho
  | 'inv_transfer_order'        // Lệnh điều chuyển kho
  | 'inv_transfer_issue'        // Phiếu xuất điều chuyển kho
  | 'inv_transfer_receipt'      // Phiếu nhập điều chuyển kho
  | 'inv_audit_count'           // Phiếu kiểm kê hàng hóa
  | 'inv_calc_monthly_cost'     // Tính giá trung bình tháng
  | 'inv_calc_instant_stock'    // Tính tồn kho tức thời

  // Inventory submenus - 2. Phê duyệt
  | 'inv_approve_receipt'       // Phê duyệt nhập
  | 'inv_approve_issue'         // Phê duyệt xuất
  | 'inv_approve_transfer'      // Phê duyệt điều chuyển

  // Inventory submenus - 3. Danh mục
  | 'inv_material_cat'          // Khai báo vật tư & SP
  | 'inv_material_type_cat'     // Danh mục Loại vật tư
  | 'inv_warehouse_cat'         // Danh mục kho bãi
  | 'inv_location_cat'          // Danh mục Vị trí lưu kho
  | 'inv_uom_cat'               // Danh mục Đơn vị tính
  | 'inv_uom_conversion_cat'    // Danh mục Quy đổi ĐVT
  | 'inv_stock_norm_cat'        // Danh mục Định mức tồn kho
  | 'inv_lot_cat'               // Danh mục Lô & Hạn sử dụng

  // Inventory submenus - 4. Hàng nhập
  | 'inv_report_inward'         // Báo cáo Hàng nhập

  // Inventory submenus - 5. Hàng xuất
  | 'inv_report_outward'        // Báo cáo Hàng xuất

  // Inventory submenus - 6. Hàng tồn
  | 'inv_report_stock'          // Báo cáo tồn kho cuối kỳ / tức thời
  | 'inv_report_nxt'            // Báo cáo Tồn đầu kỳ & NXT
  | 'inv_report_aging'          // Báo cáo Tuổi hàng tồn

  // Settings submenus
  | 'sys_users'                 // Người sử dụng & Phân quyền
  | 'inv_company_unit_cat'      // Khai báo Đơn vị cơ sở (Chuyển sang Cài đặt)
  | 'sys_departments'           // Danh mục phòng ban
  | 'sys_default_config'        // Khai báo mặc định
  | 'sys_fiscal_year'           // Khai báo năm làm việc & Ngày nhập liệu
  | 'sys_currencies'            // Danh mục ngoại tệ
  | 'sys_exchange_rates'        // Cập nhật tỷ giá

  // Sales submenus
  | 'sales_customers'           // Danh mục khách hàng
  | 'sales_orders'              // Chứng từ đơn hàng
  | 'sales_delivery'            // Chứng từ giao hàng
  | 'sales_report'              // Báo cáo doanh số

  // Finance submenus
  | 'fin_categories'            // Danh mục khoản mục Thu Chi
  | 'fin_receipt_voucher'       // Phiếu Thu
  | 'fin_payment_voucher'       // Phiếu Chi
  | 'fin_report'                // Báo cáo Sổ quỹ & Lợi nhuận

  // HR submenus
  | 'hr_list'                   // Danh mục nhân sự
  | 'hr_payroll'                // Bảng chấm công & lương
  | 'hr_report'                 // Báo cáo chi phí nhân sự
  | 'hr_resource_booking'       // Đăng ký & Thời khóa biểu sử dụng tài nguyên

  // Others
  | 'overview_main'
  | 'reports_main'
  | 'ai_main'
  | 'settings_main';

export * from './menu';
export * from './voucherGrid';
export * from './resourceBooking';
