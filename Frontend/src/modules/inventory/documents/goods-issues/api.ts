import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';
import type { OpenIssueRequest } from '../issue-requests/api';

const url = '/api/inventory/goods-issues';

interface IssueLine {
  id: number;
  kind: 'ITEM' | 'MATERIAL';
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  lotNumber?: string | null;
  position?: string | null;
  issueRequestLineId?: number | null;
  issueRequestCode?: string | null;
}

interface IssueRecord {
  id: number;
  code: string;
  date: string;
  createdDate: string;
  unitCode: string;
  unitName: string;
  warehouseCode: string;
  warehouseName: string;
  voucherType: string;
  currencyCode: string;
  exchangeRate: number;
  customerName?: string | null;
  receiverName?: string | null;
  issueRequestCode?: string | null;
  projectCode?: string | null;
  note?: string | null;
  status: 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';
  totalValue: number;
  createdBy: string;
  approvedBy?: string | null;
  items: IssueLine[];
  materialItems: IssueLine[];
  version: number;
}

const statusLabels: Record<IssueRecord['status'], string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved: 'Đã phê duyệt',
  Posted: 'Chuyển sổ kho',
  Cancelled: 'Hủy'
};

const toItem = (line: IssueLine): VoucherItem => ({
  productId: line.materialCode,
  sku: line.materialCode,
  productName: line.materialName,
  unit: line.uomCode,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  totalPrice: line.amount,
  amount: line.amount,
  lotNumber: line.lotNumber ?? '',
  position: line.position ?? '',
  issueRequestLineId: line.issueRequestLineId ?? undefined,
  issueRequestCode: line.issueRequestCode ?? undefined
});

// GoodsVoucher keeps the partner in supplierName and the person handing over / taking over in delivererName for both
// receipts and issues; on an issue they are the customer and the receiver.
const toVoucher = (row: IssueRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Xuất kho', code: row.code,
  date: row.date, createdDate: row.createdDate,
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  supplierName: row.customerName ?? '', delivererName: row.receiverName ?? '', issueRequestCode: row.issueRequestCode ?? '',
  projectCode: row.projectCode ?? '', note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem), materialItems: row.materialItems.map(toItem)
});

const toLine = (item: VoucherItem, kind: 'ITEM' | 'MATERIAL') => ({
  kind, materialCode: item.sku || item.productId || '',
  uomCode: item.unit || '', quantity: item.quantity, unitPrice: item.unitPrice,
  lotNumber: item.lotNumber || null, position: item.position || null,
  issueRequestLineId: kind === 'ITEM' ? item.issueRequestLineId ?? null : null
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date, warehouseCode: voucher.warehouseId,
  voucherType: voucher.voucherType || 'Xuất bán hàng',
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  customerName: voucher.supplierName || null, receiverName: voucher.delivererName || null,
  issueRequestCode: voucher.issueRequestCode || null,
  projectCode: voucher.projectCode || null,
  note: voucher.note || null,
  items: voucher.items.map(item => toLine(item, 'ITEM')),
  materialItems: (voucher.materialItems || []).map(item => toLine(item, 'MATERIAL')),
  version: voucher.version
});

export const goodsIssuesApi = {
  /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
  getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
    const page = await apiRequest<PagedResult<IssueRecord>>('GET', `${url}${pagedQueryString(query)}`);
    return { ...page, items: page.items.map(toVoucher) };
  },
  /** Excel file of every row the filters leave (not only the page), made by the server. */
  exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
    `PhieuXuatKho_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
  /** Approved issue requests with something left to issue ("Lấy từ phiếu yêu cầu"). */
  getOpenRequests: (editingIssueId?: string) => apiRequest<OpenIssueRequest[]>('GET', `${url}/open-requests${editingIssueId ? `?issueId=${encodeURIComponent(editingIssueId)}` : ''}`),
  getOptions: () => apiRequest<{ warehouses: { code: string; name: string }[]; currencies: { code: string; name: string }[] }>('GET', `${url}/options`),
  create: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<IssueRecord>('POST', url, toRequest(voucher, targetStatus))),
  update: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<IssueRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel') =>
    toVoucher(await apiRequest<IssueRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
