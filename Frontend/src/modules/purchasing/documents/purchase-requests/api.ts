import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

const url = '/api/purchasing/purchase-requests';

interface RequestLine {
  id: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note?: string | null;
  orderedQuantity: number;
}

interface RequestRecord {
  id: number;
  code: string;
  date: string;
  createdDate: string;
  requiredDate?: string | null;
  unitCode: string;
  unitName: string;
  warehouseCode: string;
  warehouseName: string;
  voucherType: string;
  departmentCode?: string | null;
  departmentName?: string | null;
  requesterName?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  currencyCode: string;
  exchangeRate: number;
  projectCode?: string | null;
  note?: string | null;
  status: 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';
  totalValue: number;
  createdBy: string;
  approvedBy?: string | null;
  items: RequestLine[];
  version: number;
}

/** A request is never posted: its statuses stop at Approved (the stock moves with the goods issues that carry it out). */
const statusLabels: Record<RequestRecord['status'], string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved: 'Đã phê duyệt',
  Posted: 'Đã phê duyệt',
  Cancelled: 'Hủy'
};

const toItem = (line: RequestLine): VoucherItem => ({
  productId: line.materialCode,
  sku: line.materialCode,
  productName: line.materialName,
  unit: line.uomCode,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  totalPrice: line.amount,
  amount: line.amount,
  note: line.note ?? '',
  orderedQuantity: line.orderedQuantity
});

// The requester is also kept in delivererName (the print form reads it).
const toVoucher = (row: RequestRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Yêu cầu mua hàng', code: row.code,
  date: row.date, createdDate: row.createdDate, requiredDate: row.requiredDate ?? '',
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  departmentCode: row.departmentCode ?? '', departmentName: row.departmentName ?? '',
  requesterName: row.requesterName ?? '', supplierCode: row.supplierCode ?? '', supplierName: row.supplierName ?? '', delivererName: row.requesterName ?? '',
  projectCode: row.projectCode ?? '', note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem)
});

const toLine = (item: VoucherItem) => ({
  materialCode: item.sku || item.productId || '', uomCode: item.unit || '',
  quantity: item.quantity, unitPrice: item.unitPrice, note: item.note || null
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date, requiredDate: voucher.requiredDate || null, warehouseCode: voucher.warehouseId,
  voucherType: voucher.voucherType || 'Mua hàng trong nước',
  departmentCode: voucher.departmentCode || null, requesterName: voucher.requesterName || null,
  supplierCode: voucher.supplierCode || null,
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  projectCode: voucher.projectCode || null,
  note: voucher.note || null,
  items: voucher.items.map(toLine),
  version: voucher.version
});

export const purchaseRequestsApi = {
  /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
  getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
    const page = await apiRequest<PagedResult<RequestRecord>>('GET', `${url}${pagedQueryString(query)}`);
    return { ...page, items: page.items.map(toVoucher) };
  },
  /** Excel file of every row the filters leave (not only the page), made by the server. */
  exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
    `PhieuYeuCauMuaHang_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
  getOptions: () => apiRequest<{ warehouses: { code: string; name: string }[]; currencies: { code: string; name: string }[]; departments: { code: string; name: string }[]; suppliers: { code: string; name: string }[] }>('GET', `${url}/options`),
  create: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<RequestRecord>('POST', url, toRequest(voucher, targetStatus))),
  update: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<RequestRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'cancel') =>
    toVoucher(await apiRequest<RequestRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
