import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

const url = '/api/inventory/stock-counts';

interface CountLine {
  id: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  lotNumber?: string | null;
  position?: string | null;
  bookQuantity: number;
  countedQuantity: number;
  diffQuantity: number;
  unitCost: number;
  diffValue: number;
  note?: string | null;
}

interface CountRecord {
  id: number;
  code: string;
  date: string;
  createdDate: string;
  unitCode: string;
  unitName: string;
  warehouseCode: string;
  warehouseName: string;
  counterName?: string | null;
  reason?: string | null;
  note?: string | null;
  status: 'Draft' | 'Pending' | 'Approved1' | 'Approved2' | 'Approved' | 'Posted' | 'Cancelled';
  surplusValue: number;
  shortageValue: number;
  totalValue: number;
  createdBy: string;
  approvedBy?: string | null;
  items: CountLine[];
  version: number;
}

const statusLabels: Record<CountRecord['status'], string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved1: 'Duyệt cấp 1',
  Approved2: 'Duyệt cấp 2',
  Approved: 'Đã phê duyệt',
  Posted: 'Chuyển sổ kho',
  Cancelled: 'Hủy'
};

/** The counted quantity is `quantity` of the grid line; unitPrice is the cost per base unit and amount the value of the difference. */
const toItem = (line: CountLine): VoucherItem => ({
  productId: line.materialCode,
  sku: line.materialCode,
  productName: line.materialName,
  unit: line.uomCode,
  lotNumber: line.lotNumber ?? '',
  position: line.position ?? '',
  bookQuantity: line.bookQuantity,
  quantity: line.countedQuantity,
  diffQuantity: line.diffQuantity,
  unitPrice: line.unitCost,
  totalPrice: line.diffValue,
  amount: line.diffValue,
  note: line.note ?? ''
});

const toVoucher = (row: CountRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Phiếu kiểm kê', code: row.code,
  date: row.date, createdDate: row.createdDate,
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  counterName: row.counterName ?? '', countReason: row.reason ?? '',
  surplusValue: row.surplusValue, shortageValue: row.shortageValue,
  note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem)
});

const toLine = (item: VoucherItem) => ({
  materialCode: item.sku || item.productId || '', lotNumber: item.lotNumber || null, position: item.position || null,
  countedQuantity: Number(item.quantity) || 0, unitCost: Number(item.unitPrice) || 0, note: item.note || null
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date, warehouseCode: voucher.warehouseId,
  counterName: voucher.counterName || null, reason: voucher.countReason || null, note: voucher.note || null,
  items: voucher.items.map(toLine),
  version: voucher.version
});

export interface StockCountOptions {
  warehouses: { code: string; name: string }[];
  materialGroups: { code: string; name: string }[];
}

export interface BookStockQuery {
  warehouseCode: string;
  date?: string;
  group?: string;
  search?: string;
  includeZero?: boolean;
  cycleOnly?: boolean;
}

export interface BookStockLine {
  materialCode: string;
  materialName: string;
  uomCode: string;
  lotNumber?: string | null;
  position?: string | null;
  bookQuantity: number;
  unitCost: number;
}

export const stockCountsApi = {
  /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
  getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
    const page = await apiRequest<PagedResult<CountRecord>>('GET', `${url}${pagedQueryString(query)}`);
    return { ...page, items: page.items.map(toVoucher) };
  },
  /** Excel file of every row the filters leave (not only the page), made by the server. */
  exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
    `PhieuKiemKe_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
  getOptions: () => apiRequest<StockCountOptions>('GET', `${url}/options`),
  /** The book stock of a warehouse at a date (from the stock ledger): what a count starts from. */
  getBookStock: (query: BookStockQuery) => {
    const params = new URLSearchParams({ warehouseCode: query.warehouseCode });
    if (query.date) params.set('date', query.date);
    if (query.group) params.set('group', query.group);
    if (query.search) params.set('search', query.search);
    if (query.includeZero) params.set('includeZero', 'true');
    if (query.cycleOnly) params.set('cycleOnly', 'true');
    return apiRequest<BookStockLine[]>('GET', `${url}/book-stock?${params.toString()}`);
  },
  create: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<CountRecord>('POST', url, toRequest(voucher, targetStatus))),
  update: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<CountRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel' | 'reopen') =>
    toVoucher(await apiRequest<CountRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
