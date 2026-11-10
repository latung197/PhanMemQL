import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

const url = '/api/purchasing/purchase-invoices';

interface InvoiceLine {
  id: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note?: string | null;
  purchaseOrderLineId?: number | null;
  purchaseOrderCode?: string | null;
  goodsReceiptLineId?: number | null;
  goodsReceiptCode?: string | null;
}

interface InvoiceRecord {
  id: number;
  code: string;
  date: string;
  createdDate: string;
  unitCode: string;
  unitName: string;
  voucherType: string;
  supplierCode: string;
  supplierName?: string | null;
  invoiceNo: string;
  invoiceSeries?: string | null;
  invoiceDate: string;
  dueDate: string;
  paymentTerms?: string | null;
  paymentTermCode?: string | null;
  projectCode?: string | null;
  currencyCode: string;
  exchangeRate: number;
  taxRateCode?: string | null;
  taxRate: number;
  subTotal: number;
  taxAmount: number;
  note?: string | null;
  status: 'Draft' | 'Pending' | 'Approved1' | 'Approved2' | 'Approved' | 'Posted' | 'Cancelled';
  totalValue: number;
  purchaseOrderCode?: string | null;
  goodsReceiptCode?: string | null;
  createdBy: string;
  approvedBy?: string | null;
  items: InvoiceLine[];
  version: number;
}

/** An invoice is never posted to a ledger yet: its statuses stop at Approved (the payables report adds up the approved ones). */
const statusLabels: Record<InvoiceRecord['status'], string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved1: 'Duyệt cấp 1',
  Approved2: 'Duyệt cấp 2',
  Approved: 'Đã phê duyệt',
  Posted: 'Đã phê duyệt',
  Cancelled: 'Hủy'
};

const toItem = (line: InvoiceLine): VoucherItem => ({
  productId: line.materialCode,
  sku: line.materialCode,
  productName: line.materialName,
  unit: line.uomCode,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  totalPrice: line.amount,
  amount: line.amount,
  note: line.note ?? '',
  purchaseOrderLineId: line.purchaseOrderLineId ?? undefined,
  purchaseOrderCode: line.purchaseOrderCode ?? undefined,
  goodsReceiptLineId: line.goodsReceiptLineId ?? undefined,
  goodsReceiptCode: line.goodsReceiptCode ?? undefined
});

const toVoucher = (row: InvoiceRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Hóa đơn mua hàng', code: row.code,
  date: row.date, createdDate: row.createdDate,
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: '', warehouseName: '',
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  supplierCode: row.supplierCode, supplierName: row.supplierName ?? '',
  invoiceNo: row.invoiceNo, invoiceSeries: row.invoiceSeries ?? '', invoiceDate: row.invoiceDate, dueDate: row.dueDate,
  paymentTerms: row.paymentTerms ?? '', paymentTermCode: row.paymentTermCode ?? '', projectCode: row.projectCode ?? '',
  taxRateCode: row.taxRateCode ?? '', taxRate: row.taxRate, subTotal: row.subTotal, taxAmount: row.taxAmount,
  purchaseOrderCode: row.purchaseOrderCode ?? '', goodsReceiptCode: row.goodsReceiptCode ?? '',
  note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem)
});

const toLine = (item: VoucherItem) => ({
  materialCode: item.sku || item.productId || '', uomCode: item.unit || '',
  quantity: item.quantity, unitPrice: item.unitPrice, note: item.note || null,
  purchaseOrderLineId: item.purchaseOrderLineId ?? null,
  goodsReceiptLineId: item.goodsReceiptLineId ?? null
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date,
  voucherType: voucher.voucherType || 'Hóa đơn hàng hóa',
  supplierCode: voucher.supplierCode || '',
  invoiceNo: voucher.invoiceNo || '', invoiceSeries: voucher.invoiceSeries || null,
  invoiceDate: voucher.invoiceDate || voucher.date, dueDate: voucher.dueDate || null,
  paymentTerms: voucher.paymentTerms || null, paymentTermCode: voucher.paymentTermCode || null,
  projectCode: voucher.projectCode || null,
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  taxRateCode: voucher.taxRateCode || null,
  note: voucher.note || null,
  items: voucher.items.map(toLine),
  version: voucher.version
});

/** A line of an approved or posted goods receipt that an invoice may still bill (what "Lấy từ phiếu nhập kho" lists). */
export interface OpenInvoiceReceiptLine {
  lineId: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  receivedQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  note?: string | null;
  purchaseOrderLineId?: number | null;
  purchaseOrderCode?: string | null;
}

export interface OpenInvoiceReceipt {
  id: number;
  code: string;
  date: string;
  warehouseCode: string;
  warehouseName: string;
  supplierCode: string;
  supplierName?: string | null;
  currencyCode: string;
  exchangeRate: number;
  note?: string | null;
  lines: OpenInvoiceReceiptLine[];
  projectCode?: string | null;
  taxRateCode?: string | null;
  paymentTermCode?: string | null;
}

/** A line of an approved order that an invoice may still bill (what "Lấy từ đơn mua hàng" lists). */
export interface OpenInvoiceOrderLine {
  lineId: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  orderedQuantity: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  note?: string | null;
}

export interface OpenInvoiceOrder {
  id: number;
  code: string;
  date: string;
  supplierCode: string;
  supplierName?: string | null;
  currencyCode: string;
  exchangeRate: number;
  taxRateCode?: string | null;
  paymentTermCode?: string | null;
  paymentTerms?: string | null;
  note?: string | null;
  lines: OpenInvoiceOrderLine[];
  projectCode?: string | null;
}

export interface PurchaseInvoiceOptions {
  currencies: { code: string; name: string }[];
  suppliers: { code: string; name: string }[];
  taxRates: { code: string; name: string; rate: number }[];
}

const openQuery = (supplier?: string, editingInvoiceId?: string) => {
  const params = new URLSearchParams();
  if (supplier) params.set('supplier', supplier);
  if (editingInvoiceId) params.set('invoiceId', editingInvoiceId);
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const purchaseInvoicesApi = {
  /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
  getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
    const page = await apiRequest<PagedResult<InvoiceRecord>>('GET', `${url}${pagedQueryString(query)}`);
    return { ...page, items: page.items.map(toVoucher) };
  },
  /** Excel file of every row the filters leave (not only the page), made by the server. */
  exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
    `HoaDonMuaHang_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
  getOptions: () => apiRequest<PurchaseInvoiceOptions>('GET', `${url}/options`),
  getOpenReceipts: (supplier?: string, editingInvoiceId?: string) =>
    apiRequest<OpenInvoiceReceipt[]>('GET', `${url}/open-receipts${openQuery(supplier, editingInvoiceId)}`),
  getOpenOrders: (supplier?: string, editingInvoiceId?: string) =>
    apiRequest<OpenInvoiceOrder[]>('GET', `${url}/open-orders${openQuery(supplier, editingInvoiceId)}`),
  create: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<InvoiceRecord>('POST', url, toRequest(voucher, targetStatus))),
  update: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<InvoiceRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'cancel' | 'reopen') =>
    toVoucher(await apiRequest<InvoiceRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
