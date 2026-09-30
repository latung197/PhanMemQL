// Specification for S-ERP System Meta-Tables (sys_* prefix)

export interface SysVoucherHeader {
  voucher_id: string;         // ma_ct (e.g. 'PN71', 'PX71', 'NK70', 'SO1', 'AR01', 'AP01')
  voucher_name: string;       // ten_ct (e.g. 'Phiếu nhập kho mua hàng')
  voucher_name_en?: string;    // ten_ct_en
  module_code: string;        // ma_ph ('INV', 'SAL', 'PUR', 'FIN', 'GL')
  master_table: string;       // table_ph (e.g. 'ph71', 'ph70', 'ph10')
  detail_table: string;       // table_ct (e.g. 'ct71', 'ct70', 'ct10')
  numbering_prefix: string;   // prefix (e.g. 'PN', 'PX', 'SO')
  numbering_length: number;   // length (e.g. 6)
  current_sequence: number;   // stt_hien_tai
  number_pattern: string;     // so_ct_pattern (e.g. '{PREFIX}{YY}{MM}-{SEQ}')
  post_to_gl: boolean;        // post_gl_yn
  post_to_stock: boolean;     // post_stock_yn
  post_to_ar_ap: boolean;     // post_ap_ar_yn
  allow_edit_after_post: boolean; // sua_sau_post_yn
  default_account_dr?: string; // tk_no_df
  default_account_cr?: string; // tk_co_df
  status: 'Active' | 'Inactive';
  description?: string;
}

export interface SysGridColumn {
  column_id: string;
  grid_code: string;          // ma_grid (e.g. 'GRID_DM_VT', 'GRID_CT71_DETAIL')
  field_name: string;         // ten_truong (e.g. 'ma_vt', 'ten_vt', 'so_luong', 'don_gia')
  label_vi: string;           // nhan_vi
  label_en: string;           // nhan_en
  data_type: 'string' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'lookup' | 'enum';
  column_width: number;       // do_rong (px)
  column_order: number;       // stt_hien_thi
  visible_yn: boolean;        // hien_thi_yn
  editable_yn: boolean;       // sua_yn
  required_yn: boolean;       // bat_buoc_yn
  alignment: 'left' | 'center' | 'right';
  number_format?: string;     // dinh_dang_so (e.g. '#,##0.00')
  lookup_table?: string;      // bang_lookup (e.g. 'dm_vt', 'dm_kho')
  lookup_value_field?: string;// truong_tra_cuu_id
  lookup_display_field?: string; // truong_tra_cuu_ten
}

export interface SysOption {
  option_code: string;        // ma_ts (e.g. 'LOCK_DATE', 'VALUATION_METHOD', 'BASE_CURRENCY')
  option_name: string;        // ten_ts
  option_value: string;       // gia_tri
  data_type: 'DATE' | 'STRING' | 'NUMBER' | 'BOOLEAN';
  module_code: string;        // ma_ph
  is_system: boolean;         // system_yn
  description?: string;
}

export interface SysCompanyUnit {
  unit_code: string;          // ma_dvcs (e.g. 'DVCS01', 'DVCS02', 'HO')
  unit_name: string;          // ten_dvcs
  short_name: string;         // ten_tat
  tax_code: string;           // masothue
  address: string;            // dia_chi
  phone: string;              // dienthoai
  director_name: string;      // giam_doc
  chief_accountant: string;   // ke_toan_truong
  is_active: boolean;
}

export interface SysUser {
  user_id: string;
  username: string;           // ma_su_dung
  full_name: string;          // ten_nguoi_dung
  email: string;
  phone?: string;
  role_code: string;          // ma_vai_tro
  default_unit_code: string;  // ma_dvcs_df
  allowed_units: string[];    // ds_dvcs_cho_phep
  status: 'ACTIVE' | 'LOCKED';
}

export interface SysRole {
  role_code: string;          // ma_vai_tro ('ADMIN', 'ACCOUNTANT', 'STOREKEEPER', 'SALES')
  role_name: string;          // ten_vai_tro
  description: string;
  is_system_role: boolean;
}

export interface SysPermission {
  permission_id: string;
  role_code: string;          // ma_vai_tro
  module_code: string;        // ma_ph
  sub_key: string;            // ma_chuc_nang
  allow_access: boolean;      // xem_yn
  allow_create: boolean;      // them_yn
  allow_edit: boolean;        // sua_yn
  allow_delete: boolean;      // xoa_yn
  allow_print: boolean;       // in_yn
  allow_post: boolean;        // ghi_so_yn
  allow_approve: boolean;     // duyet_yn
}

export interface SysNumberingRule {
  id: string;
  voucher_code: string;       // ma_ct (FK to sys_voucher_headers)
  unit_code: string;          // ma_dvcs
  fiscal_year: number;        // nam
  fiscal_period: number;      // thang
  prefix: string;             // tien_to
  last_number: number;        // so_cuoi
  number_format: string;      // format string
}

export interface SysAuditLog {
  log_id: string;
  user_id: string;
  unit_code: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'UNPOST' | 'LOGIN';
  table_name: string;         // e.g. 'ph71', 'ct71', 'dm_vt'
  record_id: string;
  old_value_json?: string;
  new_value_json?: string;
  ip_address: string;
  created_at: string;
}

export interface SysReport {
  report_code: string;        // ma_bc (e.g. 'BC_TON_KHO', 'BC_SO_CHI_TIET_VT')
  report_name: string;        // ten_bc
  module_code: string;        // ma_ph
  query_template?: string;    // cau_truc_sql
  template_file?: string;     // mau_in
  is_active: boolean;
}
