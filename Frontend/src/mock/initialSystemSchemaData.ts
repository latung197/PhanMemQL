import {
  SysVoucherHeader,
  SysGridColumn,
  SysOption,
  SysCompanyUnit,
  SysRole,
  SysNumberingRule,
  SysReport,
  SysPermission
} from '../types/systemSchema';

export const INITIAL_SYS_VOUCHER_HEADERS: SysVoucherHeader[] = [
  {
    voucher_id: 'PN71',
    voucher_name: 'Phiếu Nhập Kho Vật Tư Hàng Hóa',
    voucher_name_en: 'Goods Receipt Note',
    module_code: 'INV',
    master_table: 'ph71',
    detail_table: 'ct71',
    numbering_prefix: 'PN',
    numbering_length: 6,
    current_sequence: 142,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: true,
    post_to_stock: true,
    post_to_ar_ap: true,
    allow_edit_after_post: false,
    default_account_dr: '1521',
    default_account_cr: '3311',
    status: 'Active',
    description: 'Chứng từ ghi nhận nhập kho vật tư, nguyên vật liệu từ nhà cung cấp theo ph71/ct71'
  },
  {
    voucher_id: 'PX71',
    voucher_name: 'Phiếu Xuất Kho Bán Hàng & Sản Xuất',
    voucher_name_en: 'Goods Issue Note',
    module_code: 'INV',
    master_table: 'ph71',
    detail_table: 'ct71',
    numbering_prefix: 'PX',
    numbering_length: 6,
    current_sequence: 289,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: true,
    post_to_stock: true,
    post_to_ar_ap: false,
    allow_edit_after_post: false,
    default_account_dr: '6321',
    default_account_cr: '1561',
    status: 'Active',
    description: 'Chứng từ xuất kho bán hàng, xuất dùng sản xuất hoặc điều chuyển nội bộ'
  },
  {
    voucher_id: 'NK70',
    voucher_name: 'Phiếu Nhập Kho Thành Phẩm Sản Xuất',
    voucher_name_en: 'Finished Goods Receipt',
    module_code: 'INV',
    master_table: 'ph70',
    detail_table: 'ct70',
    numbering_prefix: 'NK',
    numbering_length: 6,
    current_sequence: 88,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: true,
    post_to_stock: true,
    post_to_ar_ap: false,
    allow_edit_after_post: false,
    default_account_dr: '1551',
    default_account_cr: '1541',
    status: 'Active',
    description: 'Nhập kho thành phẩm hoàn thành từ phân xưởng sản xuất vào sổ kho ct70'
  },
  {
    voucher_id: 'SO01',
    voucher_name: 'Đơn Đặt Hàng Bán (Sales Order)',
    voucher_name_en: 'Sales Order',
    module_code: 'SAL',
    master_table: 'ph01',
    detail_table: 'ct01',
    numbering_prefix: 'SO',
    numbering_length: 6,
    current_sequence: 520,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: false,
    post_to_stock: false,
    post_to_ar_ap: false,
    allow_edit_after_post: true,
    status: 'Active',
    description: 'Đơn hàng kinh doanh ký kết với khách hàng, chưa phát sinh xuất kho hay công nợ'
  },
  {
    voucher_id: 'PO01',
    voucher_name: 'Đơn Đặt Hàng Mua (Purchase Order)',
    voucher_name_en: 'Purchase Order',
    module_code: 'PUR',
    master_table: 'ph02',
    detail_table: 'ct02',
    numbering_prefix: 'PO',
    numbering_length: 6,
    current_sequence: 195,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: false,
    post_to_stock: false,
    post_to_ar_ap: false,
    allow_edit_after_post: true,
    status: 'Active',
    description: 'Đơn đặt mua nguyên vật liệu gởi nhà cung cấp'
  },
  {
    voucher_id: 'CA01',
    voucher_name: 'Phiếu Thu Tiền Mặt / Ngân Hàng',
    voucher_name_en: 'Cash / Bank Receipt Voucher',
    module_code: 'FIN',
    master_table: 'ph10',
    detail_table: 'ct10',
    numbering_prefix: 'PT',
    numbering_length: 6,
    current_sequence: 412,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: true,
    post_to_stock: false,
    post_to_ar_ap: true,
    allow_edit_after_post: false,
    default_account_dr: '1111',
    default_account_cr: '1311',
    status: 'Active',
    description: 'Ghi nhận thu tiền mặt, chuyển khoản ngân hàng từ khách hàng hoặc thanh lý'
  },
  {
    voucher_id: 'CA02',
    voucher_name: 'Phiếu Chi Tiền Mặt / Ngân Hàng',
    voucher_name_en: 'Cash / Bank Payment Voucher',
    module_code: 'FIN',
    master_table: 'ph10',
    detail_table: 'ct10',
    numbering_prefix: 'PC',
    numbering_length: 6,
    current_sequence: 305,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: true,
    post_to_stock: false,
    post_to_ar_ap: true,
    allow_edit_after_post: false,
    default_account_dr: '3311',
    default_account_cr: '1121',
    status: 'Active',
    description: 'Ghi nhận chi tiền thanh toán nhà cung cấp, chi phí quản lý, tạm ứng'
  }
];

export const INITIAL_SYS_GRID_COLUMNS: SysGridColumn[] = [
  // GRID_DM_VT (Danh mục Vật tư hàng hóa)
  {
    column_id: 'COL_VT_01',
    grid_code: 'GRID_DM_VT',
    field_name: 'ma_vt',
    label_vi: 'Mã Vật Tư / Hàng Hóa',
    label_en: 'Material Code',
    data_type: 'string',
    column_width: 140,
    column_order: 1,
    visible_yn: true,
    editable_yn: false,
    required_yn: true,
    alignment: 'left'
  },
  {
    column_id: 'COL_VT_02',
    grid_code: 'GRID_DM_VT',
    field_name: 'ten_vt',
    label_vi: 'Tên Vật Tư Nhãn Hiệu',
    label_en: 'Material Name',
    data_type: 'string',
    column_width: 260,
    column_order: 2,
    visible_yn: true,
    editable_yn: true,
    required_yn: true,
    alignment: 'left'
  },
  {
    column_id: 'COL_VT_03',
    grid_code: 'GRID_DM_VT',
    field_name: 'dvt',
    label_vi: 'Đơn Vị Tính',
    label_en: 'Unit of Measure',
    data_type: 'lookup',
    column_width: 100,
    column_order: 3,
    visible_yn: true,
    editable_yn: true,
    required_yn: true,
    alignment: 'center',
    lookup_table: 'sys_uom',
    lookup_value_field: 'ma_dvt',
    lookup_display_field: 'ten_dvt'
  },
  {
    column_id: 'COL_VT_04',
    grid_code: 'GRID_DM_VT',
    field_name: 'ma_kho',
    label_vi: 'Kho Mặc Định',
    label_en: 'Default Warehouse',
    data_type: 'lookup',
    column_width: 130,
    column_order: 4,
    visible_yn: true,
    editable_yn: true,
    required_yn: false,
    alignment: 'left',
    lookup_table: 'dm_kho',
    lookup_value_field: 'ma_kho',
    lookup_display_field: 'ten_kho'
  },
  {
    column_id: 'COL_VT_05',
    grid_code: 'GRID_DM_VT',
    field_name: 'gia_ban',
    label_vi: 'Giá Bán Quy Định',
    label_en: 'Selling Price',
    data_type: 'currency',
    column_width: 130,
    column_order: 5,
    visible_yn: true,
    editable_yn: true,
    required_yn: false,
    alignment: 'right',
    number_format: '#,##0'
  },
  {
    column_id: 'COL_VT_06',
    grid_code: 'GRID_DM_VT',
    field_name: 'ton_kho',
    label_vi: 'Tồn Kho Hiện Tại',
    label_en: 'Current Stock',
    data_type: 'number',
    column_width: 120,
    column_order: 6,
    visible_yn: true,
    editable_yn: false,
    required_yn: false,
    alignment: 'right',
    number_format: '#,##0.00'
  },

  // GRID_CT71_DETAIL (Chi tiết chứng từ kho ct71)
  {
    column_id: 'COL_CT71_01',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'stt',
    label_vi: 'STT',
    label_en: 'No.',
    data_type: 'number',
    column_width: 60,
    column_order: 1,
    visible_yn: true,
    editable_yn: false,
    required_yn: true,
    alignment: 'center'
  },
  {
    column_id: 'COL_CT71_02',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'ma_vt',
    label_vi: 'Mã Vật Tư',
    label_en: 'Item Code',
    data_type: 'lookup',
    column_width: 140,
    column_order: 2,
    visible_yn: true,
    editable_yn: true,
    required_yn: true,
    alignment: 'left',
    lookup_table: 'dm_vt',
    lookup_value_field: 'ma_vt',
    lookup_display_field: 'ten_vt'
  },
  {
    column_id: 'COL_CT71_03',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'ten_vt',
    label_vi: 'Tên Vật Tư Hàng Hóa',
    label_en: 'Item Description',
    data_type: 'string',
    column_width: 250,
    column_order: 3,
    visible_yn: true,
    editable_yn: false,
    required_yn: false,
    alignment: 'left'
  },
  {
    column_id: 'COL_CT71_04',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'so_luong',
    label_vi: 'Số Lượng',
    label_en: 'Quantity',
    data_type: 'number',
    column_width: 110,
    column_order: 4,
    visible_yn: true,
    editable_yn: true,
    required_yn: true,
    alignment: 'right',
    number_format: '#,##0.00'
  },
  {
    column_id: 'COL_CT71_05',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'don_gia',
    label_vi: 'Đơn Giá',
    label_en: 'Unit Price',
    data_type: 'currency',
    column_width: 130,
    column_order: 5,
    visible_yn: true,
    editable_yn: true,
    required_yn: true,
    alignment: 'right',
    number_format: '#,##0.00'
  },
  {
    column_id: 'COL_CT71_06',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'thanh_tien',
    label_vi: 'Thành Tiền Nguyên Tệ',
    label_en: 'Amount',
    data_type: 'currency',
    column_width: 150,
    column_order: 6,
    visible_yn: true,
    editable_yn: false,
    required_yn: false,
    alignment: 'right',
    number_format: '#,##0.00'
  },
  {
    column_id: 'COL_CT71_07',
    grid_code: 'GRID_CT71_DETAIL',
    field_name: 'ma_lo',
    label_vi: 'Số Lô Sản Xuất',
    label_en: 'Lot Number',
    data_type: 'string',
    column_width: 120,
    column_order: 7,
    visible_yn: true,
    editable_yn: true,
    required_yn: false,
    alignment: 'left'
  }
];

export const INITIAL_SYS_OPTIONS: SysOption[] = [
  {
    option_code: 'LOCK_DATE',
    option_name: 'Ngày Khóa Sổ Kế Toán & Sổ Kho Toàn Hệ Thống',
    option_value: '2025-12-31',
    data_type: 'DATE',
    module_code: 'GL',
    is_system: true,
    description: 'Mọi chứng từ có ngày hạch toán <= ngày này sẽ bị cấm thêm/sửa/xóa'
  },
  {
    option_code: 'VALUATION_METHOD',
    option_name: 'Phương Pháp Tính Giá Xuất Kho Mặc Định',
    option_value: 'FIFO',
    data_type: 'STRING',
    module_code: 'INV',
    is_system: true,
    description: 'Phương pháp: FIFO (Nhập trước xuất trước) hoặc AVERAGE (Bình quân gia quyền)'
  },
  {
    option_code: 'BASE_CURRENCY',
    option_name: 'Đồng Tiền Hạch Toán Hệ Thống',
    option_value: 'VND',
    data_type: 'STRING',
    module_code: 'FIN',
    is_system: true,
    description: 'Mã tiền tệ hạch toán chính (VND, USD)'
  },
  {
    option_code: 'DECIMAL_QTY',
    option_name: 'Số Chữ Số Thập Phân Cho Số Lượng',
    option_value: '2',
    data_type: 'NUMBER',
    module_code: 'INV',
    is_system: false,
    description: 'Định dạng số thập phân hiển thị cho số lượng (ví dụ: 1,250.50)'
  },
  {
    option_code: 'VAT_RATE_DEFAULT',
    option_name: 'Thuế Suất GTGT Mặc Định (%)',
    option_value: '10',
    data_type: 'NUMBER',
    module_code: 'SAL',
    is_system: false,
    description: 'Tỷ lệ VAT áp dụng mặc định cho các đơn hàng bán'
  }
];

export const INITIAL_SYS_COMPANY_UNITS: SysCompanyUnit[] = [
  {
    unit_code: 'DVCS01',
    unit_name: 'Trụ Sở Chính TP. Hồ Chí Minh',
    short_name: 'HO-HCMC',
    tax_code: '0318899201',
    address: 'Toà nhà S-ERP Tower, 120 Nguyễn Thị Minh Khai, Q.3, TP.HCM',
    phone: '028-3822-9900',
    director_name: 'Trần Thịnh',
    chief_accountant: 'Phạm Thanh Hương',
    is_active: true
  },
  {
    unit_code: 'DVCS02',
    unit_name: 'Chi Nhánh Khu Vực Hà Nội',
    short_name: 'BRANCH-HN',
    tax_code: '0318899201-001',
    address: 'Số 45 Trần Duy Hưng, Cầu Giấy, Hà Nội',
    phone: '024-3788-1122',
    director_name: 'Nguyễn Văn Anh',
    chief_accountant: 'Lê Thu Hà',
    is_active: true
  },
  {
    unit_code: 'DVCS03',
    unit_name: 'Chi Nhánh Miền Trung Đà Nẵng',
    short_name: 'BRANCH-DN',
    tax_code: '0318899201-002',
    address: 'KCN Hòa Cầm, Cẩm Lệ, Đà Nẵng',
    phone: '0236-3991-888',
    director_name: 'Hoàng Minh Đức',
    chief_accountant: 'Nguyễn Thị Hoa',
    is_active: true
  }
];

export const INITIAL_SYS_ROLES: SysRole[] = [
  {
    role_code: 'ADMIN',
    role_name: 'Toàn Quyền Quản Trị Hệ Thống (CEO / Admin)',
    description: 'Truy cập không giới hạn tất cả các phân hệ, sửa cấu hình và phân quyền',
    is_system_role: true
  },
  {
    role_code: 'ACCOUNTANT',
    role_name: 'Kế Toán Trưởng & Kế Toán Viên',
    description: 'Ghi sổ kế toán, duyệt chứng từ tài chính, theo dõi thu chi & công nợ',
    is_system_role: true
  },
  {
    role_code: 'STOREKEEPER',
    role_name: 'Thủ Kho & Quản Lý Kho Vận',
    description: 'Lập phiếu nhập/xuất kho ph71/ct71, theo dõi tồn kho thực tế, kiểm kê',
    is_system_role: true
  },
  {
    role_code: 'SALES_STAFF',
    role_name: 'Nhân Viên Kinh Doanh & Sales',
    description: 'Lập đơn đặt hàng SO, quản lý danh mục khách hàng và hợp đồng',
    is_system_role: false
  }
];

export const INITIAL_SYS_NUMBERING_RULES: SysNumberingRule[] = [
  {
    id: 'NR01',
    voucher_code: 'PN71',
    unit_code: 'DVCS01',
    fiscal_year: 2026,
    fiscal_period: 8,
    prefix: 'PN',
    last_number: 142,
    number_format: 'PN2608-000142'
  },
  {
    id: 'NR02',
    voucher_code: 'PX71',
    unit_code: 'DVCS01',
    fiscal_year: 2026,
    fiscal_period: 8,
    prefix: 'PX',
    last_number: 289,
    number_format: 'PX2608-000289'
  },
  {
    id: 'NR03',
    voucher_code: 'NK70',
    unit_code: 'DVCS01',
    fiscal_year: 2026,
    fiscal_period: 8,
    prefix: 'NK',
    last_number: 88,
    number_format: 'NK2608-000088'
  }
];

export const INITIAL_SYS_REPORTS: SysReport[] = [
  {
    report_code: 'BC_TON_KHO',
    report_name: 'Báo Cáo Bảng Tổng Hợp Tồn Kho Vật Tư Hàng Hóa',
    module_code: 'INV',
    query_template: 'SELECT ma_vt, ten_vt, dvt, dau_ky, nhập_trong_ky, xuất_trong_ky, cuoi_ky FROM view_inventory_summary WHERE ma_dvcs = @ma_dvcs',
    template_file: 'rpt_inventory_summary.rdlc',
    is_active: true
  },
  {
    report_code: 'BC_CT71_LOG',
    report_name: 'Sổ Chi Tiết Nhập Xuất Kho Theo Vật Tư (Sổ ct71/ct70)',
    module_code: 'INV',
    query_template: 'SELECT * FROM ct71 WHERE ma_vt = @ma_vt AND ngay_ct BETWEEN @tu_ngay AND @den_ngay ORDER BY ngay_ct, so_ct',
    template_file: 'rpt_ct71_ledger.rdlc',
    is_active: true
  },
  {
    report_code: 'BC_CONG_NO_KH',
    report_name: 'Báo Cáo Tổng Hợp Công Nợ Phải Thu Khách Hàng',
    module_code: 'SAL',
    query_template: 'SELECT ma_kh, ten_kh, dau_ky, no_phat_sinh, co_phat_sinh, cuoi_ky FROM view_ar_summary',
    template_file: 'rpt_ar_statement.rdlc',
    is_active: true
  }
];
