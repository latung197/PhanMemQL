import { SysModule } from '../types/menu';

/**
 * Sidebar menu: modules → groups → items. An item only names its function (subKey); the route, label
 * and permission of a function come from config/functions.ts. To show a new function in the sidebar,
 * add an item to the right group here.
 */
export const INITIAL_SYS_MODULES: SysModule[] = [
  {
    id: 'MOD_OVERVIEW',
    key: 'overview',
    titleVi: 'Bàn Tổng Quan',
    titleEn: 'Overview Dashboard',
    icon: 'BarChart',
    orderNo: 10,
    directSubKey: 'overview_main',
    isActive: true
  },
  {
    id: 'MOD_INVENTORY',
    key: 'inventory',
    titleVi: 'Phân Hệ Kho Hàng',
    titleEn: 'Inventory Module',
    icon: 'Layers',
    orderNo: 20,
    isActive: true,
    subGroups: [
      {
        id: 'GRP_INV_DATA_UPDATE',
        groupCode: 'data_processing',
        titleVi: '1. Cập Nhật Số Liệu',
        titleEn: 'Vouchers & Operations',
        icon: 'FileText',
        iconColor: 'text-emerald-400',
        orderNo: 10,
        isActive: true,
        items: [
          {
            id: 'MNU_INV_RECEIPT',
            subKey: 'inv_receipt',
            titleVi: 'Phiếu Nhập kho',
            titleEn: 'Goods Receipt Vouchers',
            icon: 'ArrowDownLeft',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_INV_ISSUE',
            subKey: 'inv_issue',
            titleVi: 'Phiếu Xuất kho',
            titleEn: 'Goods Issue Vouchers',
            icon: 'ArrowUpRight',
            orderNo: 20,
            isActive: true
          },
          {
            id: 'MNU_INV_TRANSFER_ORDER',
            subKey: 'inv_transfer_order',
            titleVi: 'Lệnh điều chuyển kho',
            titleEn: 'Transfer Orders',
            icon: 'ArrowRightLeft',
            orderNo: 30,
            isActive: true
          },
          {
            id: 'MNU_INV_TRANSFER_ISSUE',
            subKey: 'inv_transfer_issue',
            titleVi: 'Phiếu xuất điều chuyển kho',
            titleEn: 'Transfer Outward Vouchers',
            icon: 'ArrowUpRight',
            orderNo: 40,
            isActive: true
          },
          {
            id: 'MNU_INV_TRANSFER_RECEIPT',
            subKey: 'inv_transfer_receipt',
            titleVi: 'Phiếu nhập điều chuyển kho',
            titleEn: 'Transfer Inward Vouchers',
            icon: 'ArrowDownLeft',
            orderNo: 50,
            isActive: true
          },
          {
            id: 'MNU_INV_AUDIT',
            subKey: 'inv_audit_count',
            titleVi: 'Phiếu kiểm kê hàng hóa',
            titleEn: 'Physical Inventory Audit',
            icon: 'ClipboardCheck',
            orderNo: 60,
            isActive: true
          },
          {
            id: 'MNU_INV_CALC_COST',
            subKey: 'inv_calc_monthly_cost',
            titleVi: 'Tính giá trung bình tháng',
            titleEn: 'Monthly Weighted Avg Cost',
            icon: 'Calculator',
            orderNo: 70,
            isActive: true
          },
          {
            id: 'MNU_INV_CALC_STOCK',
            subKey: 'inv_calc_instant_stock',
            titleVi: 'Tính tồn kho tức thời',
            titleEn: 'Instant Stock Balance Calc',
            icon: 'RefreshCw',
            orderNo: 80,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_INV_APPROVALS',
        groupCode: 'approvals',
        titleVi: '2. Phê Duyệt Kho',
        titleEn: 'Voucher Approvals',
        icon: 'CheckCircle2',
        iconColor: 'text-indigo-400',
        orderNo: 20,
        isActive: true,
        items: [
          {
            id: 'MNU_INV_APPROVE_RECEIPT',
            subKey: 'inv_approve_receipt',
            titleVi: 'Phê duyệt nhập kho',
            titleEn: 'Approve Receipts',
            icon: 'CheckSquare',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_INV_APPROVE_ISSUE',
            subKey: 'inv_approve_issue',
            titleVi: 'Phê duyệt xuất kho',
            titleEn: 'Approve Issues',
            icon: 'CheckSquare',
            orderNo: 20,
            isActive: true
          },
          {
            id: 'MNU_INV_APPROVE_TRANSFER',
            subKey: 'inv_approve_transfer',
            titleVi: 'Phê duyệt điều chuyển',
            titleEn: 'Approve Transfers',
            icon: 'CheckSquare',
            orderNo: 30,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_INV_CAT',
        groupCode: 'categories',
        titleVi: '3. Danh Mục Kho',
        titleEn: 'Master Data Catalogs',
        icon: 'FolderTree',
        iconColor: 'text-indigo-400',
        orderNo: 30,
        isActive: true,
        items: [
          {
            id: 'MNU_INV_MATERIAL',
            subKey: 'inv_material_cat',
            titleVi: 'Khai báo vật tư & Sản phẩm',
            titleEn: 'Materials & Products Catalog',
            icon: 'Package',
            orderNo: 10,
            badgeType: 'lowStock',
            isActive: true
          },
          {
            id: 'MNU_INV_MATERIAL_TYPE',
            subKey: 'inv_material_type_cat',
            titleVi: 'Danh mục Loại vật tư',
            titleEn: 'Material Types',
            icon: 'Tag',
            orderNo: 20,
            isActive: true
          },
          {
            id: 'MNU_INV_WAREHOUSE',
            subKey: 'inv_warehouse_cat',
            titleVi: 'Khai báo danh mục kho',
            titleEn: 'Warehouses Master',
            icon: 'Warehouse',
            orderNo: 30,
            isActive: true
          },
          {
            id: 'MNU_INV_LOCATION',
            subKey: 'inv_location_cat',
            titleVi: 'Danh mục Vị trí kho (Bin/Rack)',
            titleEn: 'Rack Locations (Bin/Rack)',
            icon: 'MapPin',
            orderNo: 40,
            isActive: true
          },
          {
            id: 'MNU_INV_UOM',
            subKey: 'inv_uom_cat',
            titleVi: 'Danh mục Đơn vị tính',
            titleEn: 'Units of Measure (UOM)',
            icon: 'Scale',
            orderNo: 50,
            isActive: true
          },
          {
            id: 'MNU_INV_UOM_CONV',
            subKey: 'inv_uom_conversion_cat',
            titleVi: 'Danh mục Quy đổi ĐVT',
            titleEn: 'UOM Conversions',
            icon: 'ArrowRightLeft',
            orderNo: 60,
            isActive: true
          },
          {
            id: 'MNU_INV_STOCK_NORM',
            subKey: 'inv_stock_norm_cat',
            titleVi: 'Danh mục Định mức tồn kho',
            titleEn: 'Stock Norms',
            icon: 'ShieldAlert',
            orderNo: 70,
            isActive: true
          },
          {
            id: 'MNU_INV_LOT',
            subKey: 'inv_lot_cat',
            titleVi: 'Danh mục Lô & Hạn sử dụng',
            titleEn: 'Lots & Expiration',
            icon: 'Boxes',
            orderNo: 80,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_INV_INWARD_REP',
        groupCode: 'inward_reports',
        titleVi: '4. Báo Cáo Hàng Nhập',
        titleEn: 'Inward Goods Reports',
        icon: 'Download',
        iconColor: 'text-cyan-400',
        orderNo: 40,
        isActive: true,
        items: [
          {
            id: 'MNU_INV_REPORT_INWARD',
            subKey: 'inv_report_inward',
            titleVi: 'Bảng kê & Báo cáo hàng nhập kho',
            titleEn: 'Inward Summary Report',
            icon: 'PieChart',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_INV_OUTWARD_REP',
        groupCode: 'outward_reports',
        titleVi: '5. Báo Cáo Hàng Xuất',
        titleEn: 'Outward Goods Reports',
        icon: 'Upload',
        iconColor: 'text-amber-400',
        orderNo: 50,
        isActive: true,
        items: [
          {
            id: 'MNU_INV_REPORT_OUTWARD',
            subKey: 'inv_report_outward',
            titleVi: 'Bảng kê & Báo cáo hàng xuất kho',
            titleEn: 'Outward Summary Report',
            icon: 'PieChart',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_INV_BALANCE_REP',
        groupCode: 'stock_reports',
        titleVi: '6. Báo Cáo Hàng Tồn',
        titleEn: 'Stock Balance Reports',
        icon: 'PieChart',
        iconColor: 'text-purple-400',
        orderNo: 60,
        isActive: true,
        items: [
          {
            id: 'MNU_INV_REPORT_NXT',
            subKey: 'inv_report_nxt',
            titleVi: 'Tồn đầu kỳ & Tổng hợp Nhập-Xuất-Tồn',
            titleEn: 'Beginning & In-Out-Stock (NXT)',
            icon: 'PieChart',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_INV_REPORT_STOCK',
            subKey: 'inv_report_stock',
            titleVi: 'Báo cáo Tồn kho cuối kỳ / Tức thời',
            titleEn: 'Ending & Real-Time Stock',
            icon: 'PieChart',
            orderNo: 20,
            isActive: true
          },
          {
            id: 'MNU_INV_REPORT_AGING',
            subKey: 'inv_report_aging',
            titleVi: 'Báo cáo Tuổi hàng tồn kho',
            titleEn: 'Inventory Aging Analysis',
            icon: 'Clock',
            orderNo: 30,
            isActive: true
          }
        ]
      }
    ]
  },
  {
    id: 'MOD_SALES',
    key: 'sales',
    titleVi: 'Bán Hàng & CRM',
    titleEn: 'Sales & CRM',
    icon: 'ShoppingBag',
    orderNo: 30,
    isActive: true,
    subGroups: [
      {
        id: 'GRP_SALES_CAT',
        groupCode: 'categories',
        titleVi: 'Danh Mục',
        titleEn: 'Master Data',
        icon: 'FolderTree',
        iconColor: 'text-indigo-400',
        orderNo: 10,
        isActive: true,
        items: [
          {
            id: 'MNU_SALES_CUSTOMER',
            subKey: 'sales_customers',
            titleVi: 'Danh mục Khách hàng & Phân nhóm',
            titleEn: 'Customers & Partners',
            icon: 'UserCheck',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_SALES_VOUCHER',
        groupCode: 'vouchers',
        titleVi: 'Chứng Từ',
        titleEn: 'Vouchers & Documents',
        icon: 'FileText',
        iconColor: 'text-emerald-400',
        orderNo: 20,
        isActive: true,
        items: [
          {
            id: 'MNU_SALES_ORDER',
            subKey: 'sales_orders',
            titleVi: 'Hóa đơn & Đơn bán hàng',
            titleEn: 'Sales Orders & Invoices',
            icon: 'FileText',
            orderNo: 10,
            badgeType: 'pendingOrder',
            isActive: true
          },
          {
            id: 'MNU_SALES_DELIVERY',
            subKey: 'sales_delivery',
            titleVi: 'Phiếu giao hàng / Vận chuyển',
            titleEn: 'Delivery Notes',
            icon: 'FileText',
            orderNo: 20,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_SALES_REPORT',
        groupCode: 'salesReports',
        titleVi: 'Báo Cáo Doanh Số',
        titleEn: 'Sales Reports',
        icon: 'PieChart',
        iconColor: 'text-amber-400',
        orderNo: 30,
        isActive: true,
        items: [
          {
            id: 'MNU_SALES_REP',
            subKey: 'sales_report',
            titleVi: 'Báo cáo Doanh số & Công nợ',
            titleEn: 'Sales & AR Report',
            icon: 'PieChart',
            orderNo: 10,
            isActive: true
          }
        ]
      }
    ]
  },
  {
    id: 'MOD_FINANCE',
    key: 'finance',
    titleVi: 'Phân Hệ Tài Chính',
    titleEn: 'Finance Module',
    icon: 'DollarSign',
    orderNo: 40,
    isActive: true,
    subGroups: [
      {
        id: 'GRP_FIN_CAT',
        groupCode: 'categories',
        titleVi: 'Danh Mục',
        titleEn: 'Master Data',
        icon: 'FolderTree',
        iconColor: 'text-indigo-400',
        orderNo: 10,
        isActive: true,
        items: [
          {
            id: 'MNU_FIN_CAT',
            subKey: 'fin_categories',
            titleVi: 'Khai báo khoản mục Thu Chi',
            titleEn: 'Revenue/Expense Items',
            icon: 'CreditCard',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_FIN_VOUCHER',
        groupCode: 'vouchers',
        titleVi: 'Chứng Từ',
        titleEn: 'Vouchers & Documents',
        icon: 'FileText',
        iconColor: 'text-emerald-400',
        orderNo: 20,
        isActive: true,
        items: [
          {
            id: 'MNU_FIN_RECEIPT',
            subKey: 'fin_receipt_voucher',
            titleVi: 'Lập Phiếu Thu tiền',
            titleEn: 'Cash Receipt Vouchers',
            icon: 'FileText',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_FIN_PAYMENT',
            subKey: 'fin_payment_voucher',
            titleVi: 'Lập Phiếu Chi tiền',
            titleEn: 'Cash Payment Vouchers',
            icon: 'FileText',
            orderNo: 20,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_FIN_REPORT',
        groupCode: 'fundReports',
        titleVi: 'Báo Cáo Qũy',
        titleEn: 'Cashflow Reports',
        icon: 'PieChart',
        iconColor: 'text-amber-400',
        orderNo: 30,
        isActive: true,
        items: [
          {
            id: 'MNU_FIN_REP',
            subKey: 'fin_report',
            titleVi: 'Báo cáo Sổ quỹ & Lợi nhuận',
            titleEn: 'Cashbook & Profit Report',
            icon: 'PieChart',
            orderNo: 10,
            isActive: true
          }
        ]
      }
    ]
  },
  {
    id: 'MOD_HR',
    key: 'hr',
    titleVi: 'Nhân Sự & Quỹ Lương',
    titleEn: 'HR & Payroll',
    icon: 'Users',
    orderNo: 50,
    isActive: true,
    subGroups: [
      {
        id: 'GRP_HR_CAT',
        groupCode: 'categories',
        titleVi: 'Danh Mục',
        titleEn: 'Master Data',
        icon: 'FolderTree',
        iconColor: 'text-indigo-400',
        orderNo: 10,
        isActive: true,
        items: [
          {
            id: 'MNU_HR_LIST',
            subKey: 'hr_list',
            titleVi: 'Danh sách Cán bộ Nhân sự',
            titleEn: 'Employee Directory',
            icon: 'Building2',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_HR_VOUCHER',
        groupCode: 'hrVouchers',
        titleVi: 'Chứng Từ & Lương',
        titleEn: 'Vouchers & Payroll',
        icon: 'FileText',
        iconColor: 'text-emerald-400',
        orderNo: 20,
        isActive: true,
        items: [
          {
            id: 'MNU_HR_PAYROLL',
            subKey: 'hr_payroll',
            titleVi: 'Bảng Chấm công & Quỹ lương',
            titleEn: 'Timekeeping & Payroll',
            icon: 'FileText',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_HR_RESOURCE',
        groupCode: 'resourceBooking',
        titleVi: 'Tài Nguyên & Thời Khóa Biểu',
        titleEn: 'Resource Timetable & Booking',
        icon: 'Calendar',
        iconColor: 'text-sky-400',
        orderNo: 25,
        isActive: true,
        items: [
          {
            id: 'MNU_HR_RESOURCE_BOOKING',
            subKey: 'hr_resource_booking',
            titleVi: 'Đăng ký tài nguyên (Phòng họp, Xe, Máy tính...)',
            titleEn: 'Resource Booking & Timetable',
            icon: 'Calendar',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_HR_REPORT',
        groupCode: 'hrReports',
        titleVi: 'Báo Cáo HR',
        titleEn: 'HR Reports',
        icon: 'PieChart',
        iconColor: 'text-amber-400',
        orderNo: 30,
        isActive: true,
        items: [
          {
            id: 'MNU_HR_REP',
            subKey: 'hr_report',
            titleVi: 'Báo cáo Biến động Nhân sự',
            titleEn: 'HR Movement Report',
            icon: 'PieChart',
            orderNo: 10,
            isActive: true
          }
        ]
      }
    ]
  },
  {
    id: 'MOD_REPORTS',
    key: 'reports',
    titleVi: 'Báo Cáo Tổng Hợp',
    titleEn: 'Reports & Analytics',
    icon: 'FileSpreadsheet',
    orderNo: 60,
    directSubKey: 'reports_main',
    isActive: true
  },
  {
    id: 'MOD_AI',
    key: 'ai',
    titleVi: 'Trợ Lý AI Cố Vấn',
    titleEn: 'AI Assistant',
    icon: 'Bot',
    orderNo: 70,
    directSubKey: 'ai_main',
    isActive: true
  },
  {
    id: 'MOD_SETTINGS',
    key: 'settings',
    titleVi: 'Cài Đặt Hệ Thống',
    titleEn: 'System Settings',
    icon: 'Settings',
    orderNo: 80,
    isActive: true,
    subGroups: [
      {
        id: 'GRP_SYS_USERS',
        groupCode: 'users_permissions',
        titleVi: 'Người Sử Dụng & Phân Quyền',
        titleEn: 'Users & Permissions',
        icon: 'Users',
        iconColor: 'text-indigo-400',
        orderNo: 10,
        isActive: true,
        items: [
          {
            id: 'MNU_SYS_USERS',
            subKey: 'sys_users',
            titleVi: 'Quản lý người sử dụng & phân quyền',
            titleEn: 'User Directory & Permissions',
            icon: 'ShieldCheck',
            orderNo: 10,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_SYS_UNITS',
        groupCode: 'company_units',
        titleVi: 'Tổ Chức Doanh Nghiệp',
        titleEn: 'Organization',
        icon: 'Building2',
        iconColor: 'text-cyan-400',
        orderNo: 20,
        isActive: true,
        items: [
          {
            id: 'MNU_SYS_COMPANY_UNITS',
            subKey: 'inv_company_unit_cat',
            titleVi: 'Danh mục Đơn vị cơ sở',
            titleEn: 'Company / Branch Units',
            icon: 'Building2',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_SYS_DEPARTMENTS',
            subKey: 'sys_departments',
            titleVi: 'Danh mục phòng ban',
            titleEn: 'Departments',
            icon: 'Network',
            orderNo: 20,
            isActive: true
          },
          {
            id: 'MNU_SYS_COMPANY_PROFILE',
            subKey: 'settings_main',
            titleVi: 'Hồ sơ doanh nghiệp & sao lưu',
            titleEn: 'Company Profile & Backup',
            icon: 'Landmark',
            orderNo: 30,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_SYS_DEFAULTS',
        groupCode: 'system_defaults',
        titleVi: 'Khai Báo Mặc Định & Năm Làm Việc',
        titleEn: 'System Defaults & Fiscal Year',
        icon: 'Sliders',
        iconColor: 'text-emerald-400',
        orderNo: 30,
        isActive: true,
        items: [
          {
            id: 'MNU_SYS_DEFAULT_CONFIG',
            subKey: 'sys_default_config',
            titleVi: 'Khai báo mặc định hệ thống',
            titleEn: 'System Default Configurations',
            icon: 'Sliders',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_SYS_FISCAL_YEAR',
            subKey: 'sys_fiscal_year',
            titleVi: 'Khai báo năm làm việc & Ngày nhập liệu',
            titleEn: 'Fiscal Year & Entry Start Date',
            icon: 'Calendar',
            orderNo: 20,
            isActive: true
          }
        ]
      },
      {
        id: 'GRP_SYS_CURRENCY',
        groupCode: 'currencies',
        titleVi: 'Ngoại Tệ & Tỷ Giá',
        titleEn: 'Currencies & Rates',
        icon: 'DollarSign',
        iconColor: 'text-amber-400',
        orderNo: 40,
        isActive: true,
        items: [
          {
            id: 'MNU_SYS_CURRENCIES',
            subKey: 'sys_currencies',
            titleVi: 'Danh mục ngoại tệ',
            titleEn: 'Currencies List',
            icon: 'Coins',
            orderNo: 10,
            isActive: true
          },
          {
            id: 'MNU_SYS_EXCHANGE_RATES',
            subKey: 'sys_exchange_rates',
            titleVi: 'Cập nhật tỷ giá ngoại tệ',
            titleEn: 'Exchange Rate Updates',
            icon: 'TrendingUp',
            orderNo: 20,
            isActive: true
          }
        ]
      }
    ]
  }
];
