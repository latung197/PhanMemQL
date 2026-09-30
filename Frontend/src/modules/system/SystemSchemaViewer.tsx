import React, { useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  Columns,
  Sliders,
  Building2,
  Shield,
  Hash,
  FileText,
  Copy,
  Check,
  Search,
  Plus,
  Table as TableIcon,
  Code,
  Info,
  CheckCircle2,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { showToast } from '../../utils/toast';
import {
  INITIAL_SYS_VOUCHER_HEADERS,
  INITIAL_SYS_GRID_COLUMNS,
  INITIAL_SYS_OPTIONS,
  INITIAL_SYS_COMPANY_UNITS,
  INITIAL_SYS_ROLES,
  INITIAL_SYS_NUMBERING_RULES,
  INITIAL_SYS_REPORTS
} from '../../mock/initialSystemSchemaData';
import {
  SysVoucherHeader,
  SysGridColumn,
  SysOption,
  SysCompanyUnit,
  SysRole,
  SysNumberingRule,
  SysReport
} from '../../types/systemSchema';

type SystemTabKey =
  | 'vouchers'
  | 'grid_columns'
  | 'options'
  | 'units'
  | 'roles'
  | 'numbering'
  | 'reports'
  | 'sql_ddl';

export const SystemSchemaViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SystemTabKey>('vouchers');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // States for system tables data
  const [voucherHeaders, setVoucherHeaders] = useState<SysVoucherHeader[]>(INITIAL_SYS_VOUCHER_HEADERS);
  const [gridColumns, setGridColumns] = useState<SysGridColumn[]>(INITIAL_SYS_GRID_COLUMNS);
  const [options, setOptions] = useState<SysOption[]>(INITIAL_SYS_OPTIONS);
  const [companyUnits] = useState<SysCompanyUnit[]>(INITIAL_SYS_COMPANY_UNITS);
  const [roles] = useState<SysRole[]>(INITIAL_SYS_ROLES);
  const [numberingRules] = useState<SysNumberingRule[]>(INITIAL_SYS_NUMBERING_RULES);
  const [reports] = useState<SysReport[]>(INITIAL_SYS_REPORTS);

  // Modal for adding new voucher type
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [newVoucher, setNewVoucher] = useState<Partial<SysVoucherHeader>>({
    voucher_id: '',
    voucher_name: '',
    module_code: 'INV',
    master_table: 'ph71',
    detail_table: 'ct71',
    numbering_prefix: 'VT',
    numbering_length: 6,
    current_sequence: 1,
    number_pattern: '{PREFIX}{YY}{MM}-{SEQ}',
    post_to_gl: true,
    post_to_stock: true,
    post_to_ar_ap: false,
    allow_edit_after_post: false,
    status: 'Active'
  });

  // Modal for adding new grid column definition
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [newColumn, setNewColumn] = useState<Partial<SysGridColumn>>({
    grid_code: 'GRID_DM_VT',
    field_name: '',
    label_vi: '',
    label_en: '',
    data_type: 'string',
    column_width: 150,
    column_order: gridColumns.length + 1,
    visible_yn: true,
    editable_yn: true,
    required_yn: false,
    alignment: 'left'
  });

  // Generate DDL SQL Script
  const generateSqlDdl = (): string => {
    return `-- =============================================================================
-- S-ERP ENTERPRISE SYSTEM METADATA TABLES (sys_* prefix)
-- Created for Core ERP Data Integrity, Vouchers & Dynamic Grid Definitions
-- Database Engine: PostgreSQL / SQL Server / MySQL Compatible
-- =============================================================================

-- 1. BẢNG KHAI BÁO CÁC LOẠI CHỨNG TỪ (sys_voucher_headers)
CREATE TABLE sys_voucher_headers (
    voucher_id VARCHAR(10) PRIMARY KEY,       -- Mã chứng từ (PN71, PX71, NK70, SO01...)
    voucher_name NVARCHAR(100) NOT NULL,       -- Tên chứng từ tiếng Việt
    voucher_name_en NVARCHAR(100),            -- Tên chứng từ tiếng Anh
    module_code VARCHAR(10) NOT NULL,          -- Phân hệ (INV, SAL, PUR, FIN, GL)
    master_table VARCHAR(30) NOT NULL,         -- Bảng Master (ph71, ph70, ph10...)
    detail_table VARCHAR(30) NOT NULL,         -- Bảng Detail (ct71, ct70, ct10...)
    numbering_prefix VARCHAR(10) NOT NULL,     -- Tiền tố số chứng từ (PN, PX, SO...)
    numbering_length INT DEFAULT 6,            -- Độ dài phần số nhảy
    current_sequence INT DEFAULT 0,            -- Số thứ tự hiện tại
    number_pattern VARCHAR(50) NOT NULL,       -- Quy tắc sinh số ({PREFIX}{YY}{MM}-{SEQ})
    post_to_gl BOOLEAN DEFAULT TRUE,           -- Ghi sổ nhật ký chung
    post_to_stock BOOLEAN DEFAULT TRUE,        -- Ghi sổ kho (ct70, ct71)
    post_to_ar_ap BOOLEAN DEFAULT FALSE,       -- Ghi sổ công nợ
    allow_edit_after_post BOOLEAN DEFAULT FALSE, -- Sửa sau khi ghi sổ
    default_account_dr VARCHAR(20),            -- Tài khoản Nợ mặc định
    default_account_cr VARCHAR(20),            -- Tài khoản Có mặc định
    status VARCHAR(10) DEFAULT 'Active',
    description NVARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG CẤU HÌNH CỘT HIỂN THỊ DANH MỤC & LƯỚI (sys_grid_columns)
CREATE TABLE sys_grid_columns (
    column_id VARCHAR(50) PRIMARY KEY,         -- ID cột
    grid_code VARCHAR(50) NOT NULL,            -- Mã lưới (GRID_DM_VT, GRID_CT71_DETAIL)
    field_name VARCHAR(50) NOT NULL,           -- Tên trường trong CSDL (ma_vt, ten_vt...)
    label_vi NVARCHAR(100) NOT NULL,           -- Nhãn hiển thị tiếng Việt
    label_en NVARCHAR(100),                    -- Nhãn hiển thị tiếng Anh
    data_type VARCHAR(20) NOT NULL,            -- string, number, currency, date, lookup
    column_width INT DEFAULT 120,              -- Độ rộng cột (px)
    column_order INT DEFAULT 1,                -- Thứ tự sắp xếp
    visible_yn BOOLEAN DEFAULT TRUE,           -- Hiển thị trên lưới
    editable_yn BOOLEAN DEFAULT TRUE,          -- Cho phép chỉnh sửa
    required_yn BOOLEAN DEFAULT FALSE,         -- Bắt buộc nhập
    alignment VARCHAR(10) DEFAULT 'left',      -- left, center, right
    number_format VARCHAR(30),                 -- Format số (#,##0.00)
    lookup_table VARCHAR(50),                  -- Bảng tra cứu (dm_vt, dm_kh)
    lookup_value_field VARCHAR(50),            -- Trường ID tra cứu
    lookup_display_field VARCHAR(50),          -- Trường tên tra cứu
    CONSTRAINT uk_grid_field UNIQUE (grid_code, field_name)
);

-- 3. BẢNG THAM SỐ HỆ THỐNG TOÀN CỤC (sys_options)
CREATE TABLE sys_options (
    option_code VARCHAR(50) PRIMARY KEY,       -- Mã tham số (LOCK_DATE, VALUATION_METHOD)
    option_name NVARCHAR(150) NOT NULL,        -- Tên mô tả tham số
    option_value NVARCHAR(255) NOT NULL,       -- Giá trị
    data_type VARCHAR(20) DEFAULT 'STRING',    -- DATE, STRING, NUMBER, BOOLEAN
    module_code VARCHAR(10) DEFAULT 'SYS',     -- Phân hệ áp dụng
    is_system BOOLEAN DEFAULT FALSE,           -- Tham số hệ thống cố định
    description NVARCHAR(255)
);

-- 4. BẢNG DANH MỤC ĐƠN VỊ CƠ SỞ / CHI NHÁNH (sys_company_units)
CREATE TABLE sys_company_units (
    unit_code VARCHAR(20) PRIMARY KEY,         -- Mã ĐVCS (DVCS01, DVCS02, HO)
    unit_name NVARCHAR(150) NOT NULL,          -- Tên ĐVCS
    short_name NVARCHAR(50),                   -- Tên viết tắt
    tax_code VARCHAR(20),                      -- Mã số thuế
    address NVARCHAR(255),                     -- Địa chỉ
    phone VARCHAR(30),                         -- Số điện thoại
    director_name NVARCHAR(100),               -- Giám đốc
    chief_accountant NVARCHAR(100),            -- Kế toán trưởng
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. BẢNG NGUYÊN TẮC SINH SỐ CHỨNG TỪ THEO KỲ & ĐVCS (sys_numbering_rules)
CREATE TABLE sys_numbering_rules (
    id VARCHAR(50) PRIMARY KEY,
    voucher_code VARCHAR(10) REFERENCES sys_voucher_headers(voucher_id),
    unit_code VARCHAR(20) REFERENCES sys_company_units(unit_code),
    fiscal_year INT NOT NULL,                  -- Năm hạch toán
    fiscal_period INT NOT NULL,                -- Tháng hạch toán
    prefix VARCHAR(10) NOT NULL,               -- Tiền tố
    last_number INT DEFAULT 0,                 -- Số thứ tự nhảy gần nhất
    number_format VARCHAR(50) NOT NULL
);

-- INDEXES FOR MAXIMUM ERP PERFORMANCE
CREATE INDEX idx_vouchers_module ON sys_voucher_headers(module_code);
CREATE INDEX idx_grid_code ON sys_grid_columns(grid_code);
CREATE INDEX idx_num_rules ON sys_numbering_rules(voucher_code, unit_code, fiscal_year, fiscal_period);
`;
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(generateSqlDdl());
    setCopied(true);
    showToast.success('Đã sao chép mã SQL DDL khởi tạo hệ thống!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucher.voucher_id || !newVoucher.voucher_name) {
      showToast.error('Vui lòng nhập Mã loại chứng từ và Tên chứng từ!');
      return;
    }
    const item: SysVoucherHeader = {
      voucher_id: newVoucher.voucher_id.toUpperCase(),
      voucher_name: newVoucher.voucher_name,
      voucher_name_en: newVoucher.voucher_name_en || '',
      module_code: newVoucher.module_code || 'INV',
      master_table: newVoucher.master_table || 'ph71',
      detail_table: newVoucher.detail_table || 'ct71',
      numbering_prefix: newVoucher.numbering_prefix || 'VT',
      numbering_length: Number(newVoucher.numbering_length) || 6,
      current_sequence: Number(newVoucher.current_sequence) || 1,
      number_pattern: newVoucher.number_pattern || '{PREFIX}{YY}{MM}-{SEQ}',
      post_to_gl: !!newVoucher.post_to_gl,
      post_to_stock: !!newVoucher.post_to_stock,
      post_to_ar_ap: !!newVoucher.post_to_ar_ap,
      allow_edit_after_post: !!newVoucher.allow_edit_after_post,
      status: 'Active',
      description: newVoucher.description || ''
    };

    setVoucherHeaders([item, ...voucherHeaders]);
    setShowVoucherModal(false);
    showToast.success(`Đã thêm cấu hình loại chứng từ [${item.voucher_id}] vào sys_voucher_headers!`);
  };

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumn.grid_code || !newColumn.field_name || !newColumn.label_vi) {
      showToast.error('Vui lòng điền đủ Mã Lưới, Tên Trường Dữ Liệu và Nhãn Cột!');
      return;
    }
    const col: SysGridColumn = {
      column_id: `COL_${Date.now()}`,
      grid_code: newColumn.grid_code,
      field_name: newColumn.field_name,
      label_vi: newColumn.label_vi,
      label_en: newColumn.label_en || newColumn.label_vi,
      data_type: newColumn.data_type || 'string',
      column_width: Number(newColumn.column_width) || 150,
      column_order: Number(newColumn.column_order) || gridColumns.length + 1,
      visible_yn: newColumn.visible_yn ?? true,
      editable_yn: newColumn.editable_yn ?? true,
      required_yn: newColumn.required_yn ?? false,
      alignment: newColumn.alignment || 'left',
      number_format: newColumn.number_format,
      lookup_table: newColumn.lookup_table,
      lookup_value_field: newColumn.lookup_value_field,
      lookup_display_field: newColumn.lookup_display_field
    };

    setGridColumns([...gridColumns, col]);
    setShowColumnModal(false);
    showToast.success(`Đã thêm cấu hình cột [${col.field_name}] vào sys_grid_columns!`);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Overview */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                Data Dictionary & Meta-Schema
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Từ Điển Cấu Trúc Bảng Hệ Thống (<code className="text-indigo-400 font-mono">sys_*</code>)
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Khai báo toàn bộ các bảng hệ thống quy định loại chứng từ (<code className="font-mono text-indigo-300">sys_voucher_headers</code>), 
              cấu hình cột động hiển thị danh mục (<code className="font-mono text-indigo-300">sys_grid_columns</code>), 
              tham số toàn cục (<code className="font-mono text-indigo-300">sys_options</code>) và danh mục ĐVCS phân quyền.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={<Code className="h-4 w-4" />}
              onClick={() => setActiveTab('sql_ddl')}
              className="text-white border-slate-700 hover:bg-slate-800 text-xs"
            >
              Mã DDL SQL Khởi Tạo CSDL
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1 custom-scrollbar">
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'vouchers'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Loại Chứng Từ (<code className="font-mono text-[11px]">sys_voucher_headers</code>)
        </button>

        <button
          onClick={() => setActiveTab('grid_columns')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'grid_columns'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Columns className="h-4 w-4" />
          Cột Hiển Thị Lưới (<code className="font-mono text-[11px]">sys_grid_columns</code>)
        </button>

        <button
          onClick={() => setActiveTab('options')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'options'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Tham Số Hệ Thống (<code className="font-mono text-[11px]">sys_options</code>)
        </button>

        <button
          onClick={() => setActiveTab('units')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'units'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Đơn Vị Cơ Sở (<code className="font-mono text-[11px]">sys_company_units</code>)
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'roles'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="h-4 w-4" />
          Vai Trò & Quyền (<code className="font-mono text-[11px]">sys_roles</code>)
        </button>

        <button
          onClick={() => setActiveTab('numbering')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'numbering'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Hash className="h-4 w-4" />
          Đánh Số Nhảy (<code className="font-mono text-[11px]">sys_numbering_rules</code>)
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'reports'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          Danh Mục Báo Cáo (<code className="font-mono text-[11px]">sys_reports</code>)
        </button>

        <button
          onClick={() => setActiveTab('sql_ddl')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'sql_ddl'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Code className="h-4 w-4" />
          Xuất SQL DDL
        </button>
      </div>

      {/* Filter / Action Toolbar */}
      {activeTab !== 'sql_ddl' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mã, tên trường, bảng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden dark:text-slate-100 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {activeTab === 'vouchers' && (
              <Button
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowVoucherModal(true)}
              >
                Khai Báo Loạt Chứng Từ Mới
              </Button>
            )}

            {activeTab === 'grid_columns' && (
              <Button
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowColumnModal(true)}
              >
                Cấu Hình Cột Mới
              </Button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: sys_voucher_headers */}
      {activeTab === 'vouchers' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-indigo-500" />
                Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_voucher_headers</span> (Khai Báo Chứng Từ & Bảng Dữ Liệu Master/Detail)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Tổng số loại chứng từ: {voucherHeaders.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã CT</th>
                  <th className="p-3">Tên Chứng Từ</th>
                  <th className="p-3">Phân Hệ</th>
                  <th className="p-3 font-mono">Bảng Master (ph)</th>
                  <th className="p-3 font-mono">Bảng Detail (ct)</th>
                  <th className="p-3">Tiền Tố & Quy Tắc</th>
                  <th className="p-3 text-center">Ghi Sổ GL</th>
                  <th className="p-3 text-center">Ghi Sổ Kho</th>
                  <th className="p-3 text-center">Công Nợ</th>
                  <th className="p-3">TK Nợ/Có Mặc Định</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {voucherHeaders
                  .filter(v =>
                    v.voucher_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.voucher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.master_table.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.detail_table.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((v) => (
                    <tr key={v.voucher_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                        {v.voucher_id}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {v.voucher_name}
                        {v.voucher_name_en && (
                          <div className="text-[10px] text-slate-400 font-normal">{v.voucher_name_en}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {v.module_code}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {v.master_table}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {v.detail_table}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{v.numbering_prefix}</span> ({v.number_pattern})
                      </td>
                      <td className="p-3 text-center">
                        {v.post_to_gl ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" /> Có
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {v.post_to_stock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" /> Có
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {v.post_to_ar_ap ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" /> Có
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {v.default_account_dr || v.default_account_cr ? (
                          <span>Nợ {v.default_account_dr || '...'} / Có {v.default_account_cr || '...'}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: sys_grid_columns */}
      {activeTab === 'grid_columns' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Columns className="h-4 w-4 text-indigo-500" />
                Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_grid_columns</span> (Cấu Hình Cột Lưới & CSDL Động)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Tổng số cột đã cấu hình: {gridColumns.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã Lưới (Grid Code)</th>
                  <th className="p-3 font-mono">Tên Trường (Field)</th>
                  <th className="p-3">Nhãn Hiển Thị (Việt/Anh)</th>
                  <th className="p-3">Kiểu Dữ Liệu</th>
                  <th className="p-3 text-center">Độ Rộng (px)</th>
                  <th className="p-3 text-center">STT</th>
                  <th className="p-3 text-center">Căn Lề</th>
                  <th className="p-3 text-center">Hiển Thị</th>
                  <th className="p-3 text-center">Cho Sửa</th>
                  <th className="p-3">Lookup Table</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {gridColumns
                  .filter(c =>
                    c.grid_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.field_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.label_vi.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((c) => (
                    <tr key={c.column_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                        {c.grid_code}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {c.field_name}
                      </td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        {c.label_vi}
                        <div className="text-[10px] text-slate-400 font-normal">{c.label_en}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {c.data_type}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">{c.column_width}</td>
                      <td className="p-3 text-center font-bold text-indigo-500">{c.column_order}</td>
                      <td className="p-3 text-center capitalize text-slate-500">{c.alignment}</td>
                      <td className="p-3 text-center">
                        {c.visible_yn ? (
                          <span className="text-emerald-600 font-bold">✓</span>
                        ) : (
                          <span className="text-slate-400">✗</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {c.editable_yn ? (
                          <span className="text-indigo-600 font-bold">✓</span>
                        ) : (
                          <span className="text-slate-400">✗</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {c.lookup_table ? `${c.lookup_table} (${c.lookup_value_field})` : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: sys_options */}
      {activeTab === 'options' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-500" />
              Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_options</span> (Tham Số Cấu Hình Toàn Cục)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã Tham Số</th>
                  <th className="p-3">Mô Tả Tham Số</th>
                  <th className="p-3">Giá Trị Cấu Hình</th>
                  <th className="p-3">Kiểu</th>
                  <th className="p-3">Phân Hệ</th>
                  <th className="p-3">Mục Đích Xử Lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {options.map((opt) => (
                  <tr key={opt.option_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                      {opt.option_code}
                    </td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                      {opt.option_name}
                    </td>
                    <td className="p-3 font-mono font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded w-fit">
                      {opt.option_value}
                    </td>
                    <td className="p-3 font-mono text-slate-500">{opt.data_type}</td>
                    <td className="p-3 font-bold text-indigo-500">{opt.module_code}</td>
                    <td className="p-3 text-slate-500 text-[11px]">{opt.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: sys_company_units */}
      {activeTab === 'units' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-500" />
              Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_company_units</span> (Danh Mục Đơn Vị Cơ Sở / Chi Nhánh)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã ĐVCS</th>
                  <th className="p-3">Tên Đơn Vị Cơ Sở</th>
                  <th className="p-3">Mã Số Thuế</th>
                  <th className="p-3">Địa Chỉ Chi Nhánh</th>
                  <th className="p-3">Giám Đốc</th>
                  <th className="p-3">Kế Toán Trưởng</th>
                  <th className="p-3 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {companyUnits.map((u) => (
                  <tr key={u.unit_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{u.unit_code}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{u.unit_name} ({u.short_name})</td>
                    <td className="p-3 font-mono">{u.tax_code}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{u.address}</td>
                    <td className="p-3">{u.director_name}</td>
                    <td className="p-3">{u.chief_accountant}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        Hoạt động
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: sys_roles */}
      {activeTab === 'roles' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" />
              Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_roles</span> (Vai Trò & Nhóm Quyền)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã Vai Trò (Role)</th>
                  <th className="p-3">Tên Vai Trò</th>
                  <th className="p-3">Mô Tả Chi Tiết</th>
                  <th className="p-3 text-center">Vai Trò Cố Định</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {roles.map((r) => (
                  <tr key={r.role_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{r.role_code}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{r.role_name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{r.description}</td>
                    <td className="p-3 text-center">
                      {r.is_system_role ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                          System Default
                        </span>
                      ) : (
                        <span className="text-slate-400">Custom</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 6: sys_numbering_rules */}
      {activeTab === 'numbering' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Hash className="h-4 w-4 text-indigo-500" />
              Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_numbering_rules</span> (Quy Tắc Đánh Số Nhảy Chứng Từ)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã Chứng Từ</th>
                  <th className="p-3">Đơn Vị Cơ Sở</th>
                  <th className="p-3">Kỳ Hạch Toán (Năm/Tháng)</th>
                  <th className="p-3">Tiền Tố</th>
                  <th className="p-3 font-mono">Số Nhảy Hiện Tại</th>
                  <th className="p-3 font-mono">Mẫu Số Sinh Tự Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {numberingRules.map((nr) => (
                  <tr key={nr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{nr.voucher_code}</td>
                    <td className="p-3 font-bold">{nr.unit_code}</td>
                    <td className="p-3">{nr.fiscal_year} / Tháng {nr.fiscal_period}</td>
                    <td className="p-3 font-mono text-indigo-500 font-bold">{nr.prefix}</td>
                    <td className="p-3 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{nr.last_number}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{nr.number_format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 7: sys_reports */}
      {activeTab === 'reports' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              Bảng <span className="font-mono text-indigo-600 dark:text-indigo-400">sys_reports</span> (Khai Báo Báo Cáo & SQL Query Engine)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Mã Báo Cáo</th>
                  <th className="p-3">Tên Báo Cáo</th>
                  <th className="p-3">Phân Hệ</th>
                  <th className="p-3">Mẫu In RDLC/Excel</th>
                  <th className="p-3 font-mono">Cấu Trúc Câu Truy Vấn (SQL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {reports.map((rpt) => (
                  <tr key={rpt.report_code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{rpt.report_code}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{rpt.report_name}</td>
                    <td className="p-3 font-bold text-indigo-500">{rpt.module_code}</td>
                    <td className="p-3 font-mono text-slate-500">{rpt.template_file}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-w-md truncate">
                      {rpt.query_template}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 8: SQL DDL */}
      {activeTab === 'sql_ddl' && (
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code className="h-4 w-4 text-indigo-500" />
                Mã Nguồn SQL DDL Khởi Tạo Tất Cả Các Bảng Hệ Thống (<code className="font-mono text-indigo-600 dark:text-indigo-400">sys_*</code>)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chép toàn bộ đoạn lệnh SQL DDL bên dưới và chạy trực tiếp trên PostgreSQL, SQL Server hoặc MySQL để khởi tạo cấu trúc CSDL chuẩn ERP.
              </p>
            </div>

            <Button
              size="sm"
              icon={copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              onClick={handleCopySql}
            >
              {copied ? 'Đã Copy!' : 'Sao Chép SQL'}
            </Button>
          </div>

          <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[500px] border border-slate-800 leading-relaxed custom-scrollbar">
            <pre>{generateSqlDdl()}</pre>
          </div>
        </Card>
      )}

      {/* MODAL ADD NEW VOUCHER HEADER */}
      {showVoucherModal && (
        <Modal
          title="Khai Báo Loại Chứng Từ Mới (sys_voucher_headers)"
          isOpen={showVoucherModal}
          onClose={() => setShowVoucherModal(false)}
        >
          <form onSubmit={handleAddVoucher} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Chứng Từ (Mã_ct)*</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: PN71, PX71, CA01"
                  value={newVoucher.voucher_id}
                  onChange={(e) => setNewVoucher({ ...newVoucher, voucher_id: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phân Hệ (ma_ph)*</label>
                <select
                  value={newVoucher.module_code}
                  onChange={(e) => setNewVoucher({ ...newVoucher, module_code: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold"
                >
                  <option value="INV">INV - Quản Lý Kho Vận</option>
                  <option value="SAL">SAL - Bán Hàng & CRM</option>
                  <option value="PUR">PUR - Mua Hàng & NCC</option>
                  <option value="FIN">FIN - Tài Chính Kế Toán</option>
                  <option value="GL">GL - Sổ Cái Nhật Ký</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Chứng Từ Tiếng Việt*</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Phiếu xuất kho bán hàng"
                value={newVoucher.voucher_name}
                onChange={(e) => setNewVoucher({ ...newVoucher, voucher_name: e.target.value })}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bảng Master (table_ph)*</label>
                <input
                  type="text"
                  required
                  placeholder="ph71, ph70, ph10..."
                  value={newVoucher.master_table}
                  onChange={(e) => setNewVoucher({ ...newVoucher, master_table: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bảng Detail (table_ct)*</label>
                <input
                  type="text"
                  required
                  placeholder="ct71, ct70, ct10..."
                  value={newVoucher.detail_table}
                  onChange={(e) => setNewVoucher({ ...newVoucher, detail_table: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tiền Tố Đánh Số (Prefix)</label>
                <input
                  type="text"
                  placeholder="PN, PX, SO, PC..."
                  value={newVoucher.numbering_prefix}
                  onChange={(e) => setNewVoucher({ ...newVoucher, numbering_prefix: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mẫu Sinh Số</label>
                <input
                  type="text"
                  value={newVoucher.number_pattern}
                  onChange={(e) => setNewVoucher({ ...newVoucher, number_pattern: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">Quy Tắc Tự Động Ghi Sổ S-ERP:</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newVoucher.post_to_gl}
                    onChange={(e) => setNewVoucher({ ...newVoucher, post_to_gl: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  Ghi Sổ Cái (GL)
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newVoucher.post_to_stock}
                    onChange={(e) => setNewVoucher({ ...newVoucher, post_to_stock: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  Ghi Sổ Kho (ct70/ct71)
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newVoucher.post_to_ar_ap}
                    onChange={(e) => setNewVoucher({ ...newVoucher, post_to_ar_ap: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  Ghi Sổ Công Nợ
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowVoucherModal(false)}>
                Hủy
              </Button>
              <Button type="submit">
                Lưu Khai Báo Chứng Từ
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL ADD NEW GRID COLUMN */}
      {showColumnModal && (
        <Modal
          title="Thêm Cấu Hình Cột Lưới (sys_grid_columns)"
          isOpen={showColumnModal}
          onClose={() => setShowColumnModal(false)}
        >
          <form onSubmit={handleAddColumn} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Lưới (Grid Code)*</label>
                <input
                  type="text"
                  required
                  placeholder="GRID_DM_VT, GRID_CT71_DETAIL..."
                  value={newColumn.grid_code}
                  onChange={(e) => setNewColumn({ ...newColumn, grid_code: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Trường CSDL (Field)*</label>
                <input
                  type="text"
                  required
                  placeholder="ma_vt, ten_vt, so_luong..."
                  value={newColumn.field_name}
                  onChange={(e) => setNewColumn({ ...newColumn, field_name: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nhãn Hiển Thị Tiếng Việt*</label>
                <input
                  type="text"
                  required
                  placeholder="Tên Vật Tư Hàng Hóa"
                  value={newColumn.label_vi}
                  onChange={(e) => setNewColumn({ ...newColumn, label_vi: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nhãn Hiển Thị Tiếng Anh</label>
                <input
                  type="text"
                  placeholder="Item Description"
                  value={newColumn.label_en}
                  onChange={(e) => setNewColumn({ ...newColumn, label_en: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kiểu Dữ Liệu</label>
                <select
                  value={newColumn.data_type}
                  onChange={(e) => setNewColumn({ ...newColumn, data_type: e.target.value as any })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="string">Chuỗi (string)</option>
                  <option value="number">Số (number)</option>
                  <option value="currency">Tiền tệ (currency)</option>
                  <option value="date">Ngày (date)</option>
                  <option value="lookup">Tra cứu (lookup)</option>
                  <option value="boolean">Check (boolean)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Độ Rộng (px)</label>
                <input
                  type="number"
                  value={newColumn.column_width}
                  onChange={(e) => setNewColumn({ ...newColumn, column_width: Number(e.target.value) })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Căn Lề</label>
                <select
                  value={newColumn.alignment}
                  onChange={(e) => setNewColumn({ ...newColumn, alignment: e.target.value as any })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="left">Trái (Left)</option>
                  <option value="center">Giữa (Center)</option>
                  <option value="right">Phải (Right)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={newColumn.visible_yn}
                  onChange={(e) => setNewColumn({ ...newColumn, visible_yn: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                Hiển thị trên lưới
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={newColumn.editable_yn}
                  onChange={(e) => setNewColumn({ ...newColumn, editable_yn: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                Cho phép sửa
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowColumnModal(false)}>
                Hủy
              </Button>
              <Button type="submit">
                Lưu Cột Mới
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
