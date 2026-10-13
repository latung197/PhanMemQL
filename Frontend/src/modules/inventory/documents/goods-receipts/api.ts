import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

const url = '/api/inventory/goods-receipts';

interface ReceiptLine {
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
  purchaseOrderLineId?: number | null;
  purchaseOrderCode?: string | null;
  orderDeliveryDate?: string | null;
}

interface ReceiptRecord {
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
  supplierCode?: string | null;
  supplierName?: string | null;
  delivererName?: string | null;
  purchaseOrderCode?: string | null;
  projectCode?: string | null;
  note?: string | null;
  status: 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';
  totalValue: number;
  createdBy: string;
  approvedBy?: string | null;
  items: ReceiptLine[];
  materialItems: ReceiptLine[];
  version: number;
}

const statusLabels: Record<ReceiptRecord['status'], string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved: 'Đã phê duyệt',
  Posted: 'Chuyển sổ kho',
  Cancelled: 'Hủy'
};

const toItem = (line: ReceiptLine): VoucherItem => ({
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
  purchaseOrderLineId: line.purchaseOrderLineId ?? undefined,
  purchaseOrderCode: line.purchaseOrderCode ?? undefined,
  purchaseOrderDeliveryDate: line.orderDeliveryDate ?? ''
});

const toVoucher = (row: ReceiptRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Nhập kho', code: row.code,
  date: row.date, createdDate: row.createdDate,
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  supplierCode: row.supplierCode ?? '', supplierName: row.supplierName ?? '', delivererName: row.delivererName ?? '',
  purchaseOrderCode: row.purchaseOrderCode ?? '', projectCode: row.projectCode ?? '',
  note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem), materialItems: row.materialItems.map(toItem)
});

const toLine = (item: VoucherItem, kind: 'ITEM' | 'MATERIAL') => ({
  kind, materialCode: item.sku || item.productId || '',
  uomCode: item.unit || '', quantity: item.quantity, unitPrice: item.unitPrice,
  lotNumber: item.lotNumber || null, position: item.position || null,
  purchaseOrderLineId: kind === 'ITEM' ? item.purchaseOrderLineId ?? null : null
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date, warehouseCode: voucher.warehouseId,
  voucherType: voucher.voucherType || 'Nhập mua mới',
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  supplierCode: voucher.supplierCode || null, supplierName: voucher.supplierName || null, delivererName: voucher.delivererName || null,
  projectCode: voucher.projectCode || null,
  note: voucher.note || null,
  items: voucher.items.map(item => toLine(item, 'ITEM')),
  materialItems: (voucher.materialItems || []).map(item => toLine(item, 'MATERIAL')),
  version: voucher.version
});

/** An approved purchase order with something left to receive (what "Lấy từ đơn mua hàng" of the goods receipt lists). */
export interface OpenPurchaseOrderLine {
  lineId: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  note?: string | null;
  /** Ngày dự kiến nhận hàng của dòng (theo đơn mua hàng). */
  deliveryDate?: string | null;
}

export interface OpenPurchaseOrder {
  id: number;
  code: string;
  date: string;
  deliveryDate?: string | null;
  warehouseCode: string;
  warehouseName: string;
  voucherType: string;
  supplierCode: string;
  supplierName?: string | null;
  paymentTerms?: string | null;
  currencyCode: string;
  exchangeRate: number;
  note?: string | null;
  projectCode?: string | null;
  lines: OpenPurchaseOrderLine[];
}

export const goodsReceiptsApi = {
  /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
  getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
    const page = await apiRequest<PagedResult<ReceiptRecord>>('GET', `${url}${pagedQueryString(query)}`);
    return { ...page, items: page.items.map(toVoucher) };
  },
  /** Excel file of every row the filters leave (not only the page), made by the server. */
  exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
    `PhieuNhapKho_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
  getOptions: () => apiRequest<{ warehouses: { code: string; name: string }[]; currencies: { code: string; name: string }[] }>('GET', `${url}/options`),
  getOpenOrders: (editingReceiptId?: string) =>
    apiRequest<OpenPurchaseOrder[]>('GET', `${url}/open-orders${editingReceiptId ? `?receiptId=${encodeURIComponent(editingReceiptId)}` : ''}`),
  create: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<ReceiptRecord>('POST', url, toRequest(voucher, targetStatus))),
  update: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<ReceiptRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel') =>
    toVoucher(await apiRequest<ReceiptRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
