// Kho › báo cáo đọc từ sổ kho (backend StockReportsController, hàm rpt_* của script 55-inventory-reports.sql). Giá trị là null khi người dùng
// không có quyền đặc biệt "Xem giá vốn" của báo cáo.
import { apiDownload, apiRequest } from '../../../services/apiClient';

const url = '/api/inventory/reports';

export interface StockRow {
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  groupCode?: string | null;
  quantity: number;
  value: number | null;
  averageCost: number | null;
  minStock: number | null;
  maxStock: number | null;
  /** below, over, ok or none (the material declares no limits). */
  level: 'below' | 'over' | 'ok' | 'none';
}

export interface NxtRow {
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  openingQuantity: number;
  inQuantity: number;
  outQuantity: number;
  closingQuantity: number;
  openingValue: number | null;
  inValue: number | null;
  outValue: number | null;
  closingValue: number | null;
}

export interface MonthlyCostRow {
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  openingQuantity: number;
  openingValue: number | null;
  inQuantity: number;
  inValue: number | null;
  outQuantity: number;
  outValue: number | null;
  closingQuantity: number;
  closingValue: number | null;
  /** (opening value + value in) / (opening quantity + quantity in); null when there is nothing to average. */
  monthAverageCost: number | null;
  /** The moving average the ledger holds at the end of the month. */
  closingCost: number | null;
}

export interface AvailabilityRow {
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  groupCode?: string | null;
  quantity: number;
  reservedByRequests: number;
  reservedByOrders: number;
  /** quantity - reservedByRequests - reservedByOrders; negative when more was promised than is in stock. */
  available: number;
}

/** A difference between the stock ledger and a balance table (level = warehouse, lot or location). */
export interface StockDiscrepancy {
  level: string;
  unitCode: string;
  warehouseCode: string;
  materialCode: string;
  lotCode: string;
  locationCode: string;
  ledgerQuantity: number;
  balanceQuantity: number;
  ledgerValue: number;
  balanceValue: number;
}

export interface MovementDetailRow {
  date: string;
  sourceFunction: string;
  voucherCode?: string | null;
  voucherType?: string | null;
  partner?: string | null;
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  lotCode?: string | null;
  quantity: number;
  value: number | null;
  unitPrice: number | null;
}

export interface MovementSummaryRow {
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  voucherCount: number;
  quantity: number;
  value: number | null;
}

export interface MovementReport {
  mode: 'detail' | 'summary';
  detail: MovementDetailRow[];
  summary: MovementSummaryRow[];
}

export interface AgingRow {
  warehouseCode: string;
  warehouseName?: string | null;
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  qty0To30: number;
  qty31To60: number;
  qty61To90: number;
  qty91To180: number;
  qtyOver180: number;
  value: number | null;
  value0To30: number | null;
  value31To60: number | null;
  value61To90: number | null;
  value91To180: number | null;
  valueOver180: number | null;
}

export type ReportFilters = Record<string, string | boolean | undefined>;

/** "?a=1&b=2" from the filters that have a value (false and empty text are left out). */
export const reportQuery = (filters: ReportFilters): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === false || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export const stockReportsApi = {
  stock: (filters: ReportFilters) => apiRequest<StockRow[]>('GET', `${url}/stock${reportQuery(filters)}`),
  nxt: (filters: ReportFilters) => apiRequest<NxtRow[]>('GET', `${url}/nxt${reportQuery(filters)}`),
  inward: (filters: ReportFilters) => apiRequest<MovementReport>('GET', `${url}/inward${reportQuery(filters)}`),
  outward: (filters: ReportFilters) => apiRequest<MovementReport>('GET', `${url}/outward${reportQuery(filters)}`),
  aging: (filters: ReportFilters) => apiRequest<AgingRow[]>('GET', `${url}/aging${reportQuery(filters)}`),
  availability: (filters: ReportFilters) => apiRequest<AvailabilityRow[]>('GET', `${url}/availability${reportQuery(filters)}`),
  monthlyCost: (filters: ReportFilters) => apiRequest<MonthlyCostRow[]>('GET', `${url}/monthly-cost${reportQuery(filters)}`),
  /** The Excel file of the same report (made by the server; needs the Export right). */
  exportFile: (report: 'stock' | 'nxt' | 'inward' | 'outward' | 'aging' | 'monthly-cost' | 'availability', filters: ReportFilters) => {
    const names = { stock: 'TonKho', nxt: 'NhapXuatTon', inward: 'HangNhapKho', outward: 'HangXuatKho', aging: 'TuoiHangTon', 'monthly-cost': 'GiaTrungBinhThang', availability: 'TonKhoTucThoi' };
    return apiDownload(`${url}/${report}/export${reportQuery(filters)}`, `${names[report]}_${stamp()}.xlsx`);
  }
};

/** Kho › Tính tồn kho tức thời: check the balance tables against the ledger and rebuild them (needs the Edit right). */
export const stockProcessApi = {
  verify: () => apiRequest<StockDiscrepancy[]>('GET', '/api/inventory/stock/verify'),
  rebuild: () => apiRequest<{ rows: number }>('POST', '/api/inventory/stock/rebuild')
};

/** What a stock line of a voucher is called on the screens. */
export const SOURCE_LABELS: Record<string, string> = {
  inv_receipt: 'Nhập kho',
  inv_issue: 'Xuất kho',
  inv_transfer_issue: 'Xuất điều chuyển',
  inv_transfer_receipt: 'Nhập điều chuyển',
  inv_audit_count: 'Kiểm kê (thừa)',
  inv_audit_count_out: 'Kiểm kê (thiếu)'
};
