export type VoucherColumnType = 
  | 'text'
  | 'number'
  | 'quantity'
  | 'currency'
  | 'percentage'
  | 'select'
  | 'lookup'
  | 'uom'
  | 'date'
  | 'checkbox'
  | 'readonly';

export interface VoucherColumnOption {
  value: string;
  label: string;
}

export interface VoucherLookupConfig {
  lookupCode: string;          // Mã danh mục tra cứu (VD: 'MATERIAL', 'WAREHOUSE', 'ACCOUNT', 'CUSTOMER')
  displayField?: string;       // Field tên tự động điền khi chọn (VD: 'productName')
  codeField?: string;          // Field mã tự động điền khi chọn (VD: 'sku')
  unitField?: string;          // Field đơn vị tính tự động điền (VD: 'unit')
  priceField?: string;         // Field đơn giá tự động điền (VD: 'unitPrice')
}

export interface VoucherColumnConfig {
  field: string;               // Field ID trong object dòng (VD: 'sku', 'productName', 'quantity', 'unitPrice', 'amount', 'batchNumber', 'warehouseId')
  headerName: string;          // Tên cột hiển thị (Tiếng Việt)
  headerNameEn?: string;       // Tên cột hiển thị (Tiếng Anh - Đa ngôn ngữ)
  type: VoucherColumnType;     // Loại control/kieu du lieu
  width?: string | number;     // Kích thước cố định (px hoac %)
  minWidth?: string | number;  // Độ rộng tối thiểu
  align?: 'left' | 'right' | 'center'; // Căn lề
  required?: boolean;          // Bắt buộc
  readOnly?: boolean;          // Chỉ đọc
  placeholder?: string;        // Placeholder text
  decimals?: number;           // Số chữ số thập phân cho kiểu số
  
  // Options cho dạng Select
  selectOptions?: VoucherColumnOption[];
  
  // Config cho dạng Lookup (F2 / Modal tra cứu)
  lookupConfig?: VoucherLookupConfig;

  // Tính tổng ở footer dòng tổng cộng
  summary?: 'sum' | 'count' | 'avg' | 'none';
  summaryFormat?: 'currency' | 'quantity' | 'number';
}

export interface VoucherGridInfo {
  voucherType: string;         // Mã loại chứng từ (VD: 'PNK', 'PXK', 'HDM')
  voucherName: string;         // Tên chứng từ (VD: 'Phiếu Nhập Kho')
  gridId: string;              // ID duy nhất của lưới (VD: 'PNK_ITEMS', 'PNK_BOM')
  columns: VoucherColumnConfig[]; // Danh sách các cột khai báo từ Database / Metadata
  allowAddRow?: boolean;       // Cho phép thêm dòng mới
  allowDeleteRow?: boolean;    // Cho phép xóa dòng
  defaultNewRow?: Record<string, any>; // Giá trị mặc định khi bấm thêm dòng
}
