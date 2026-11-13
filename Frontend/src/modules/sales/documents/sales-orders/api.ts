import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

const url = '/api/sales/sales-orders';

interface OrderLine {
  id: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note?: string | null;
  issuedQuantity: number;
}

interface OrderRecord {
  id: number;
  code: string;
  date: string;
  createdDate: string;
  deliveryDate?: string | null;
  unitCode: string;
  unitName: string;
  warehouseCode: string;
  warehouseName: string;
  voucherType: string;
  customerCode: string;
  customerName?: string | null;
  deliveryAddress?: string | null;
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
  createdBy: string;
  approvedBy?: string | null;
  items: OrderLine[];
  version: number;
}

/** An order is never posted: its statuses stop at Approved (the stock moves with the goods issues that deliver it). */
const statusLabels: Record<OrderRecord['status'], string> = {
  Draft: 'Lập chứng từ',
  Pending: 'Chờ duyệt',
  Approved1: 'Duyệt cấp 1',
  Approved2: 'Duyệt cấp 2',
  Approved: 'Đã phê duyệt',
  Posted: 'Đã phê duyệt',
  Cancelled: 'Hủy'
};

const toItem = (line: OrderLine): VoucherItem => ({
  productId: line.materialCode,
  sku: line.materialCode,
  productName: line.materialName,
  unit: line.uomCode,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  totalPrice: line.amount,
  amount: line.amount,
  note: line.note ?? '',
  issuedQuantity: line.issuedQuantity
});

const toVoucher = (row: OrderRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Đơn bán hàng', code: row.code,
  date: row.date, createdDate: row.createdDate, deliveryDate: row.deliveryDate ?? '',
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  customerCode: row.customerCode, supplierName: row.customerName ?? '', deliveryAddress: row.deliveryAddress ?? '',
  paymentTerms: row.paymentTerms ?? '', paymentTermCode: row.paymentTermCode ?? '', projectCode: row.projectCode ?? '',
  taxRateCode: row.taxRateCode ?? '', taxRate: row.taxRate, subTotal: row.subTotal, taxAmount: row.taxAmount,
  note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem)
});

const toLine = (item: VoucherItem) => ({
  materialCode: item.sku || item.productId || '', uomCode: item.unit || '',
  quantity: item.quantity, unitPrice: item.unitPrice, note: item.note || null
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date, deliveryDate: voucher.deliveryDate || null, warehouseCode: voucher.warehouseId,
  voucherType: voucher.voucherType || 'Bán hàng trong nước',
  customerCode: voucher.customerCode || '', deliveryAddress: voucher.deliveryAddress || null,
  paymentTermCode: voucher.paymentTermCode || null, projectCode: voucher.projectCode || null,
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  taxRateCode: voucher.taxRateCode || null,
  note: voucher.note || null,
  items: voucher.items.map(toLine),
  version: voucher.version
});

export interface SalesOrderOptions {
  warehouses: { code: string; name: string }[];
  currencies: { code: string; name: string }[];
  taxRates: { code: string; name: string; rate: number }[];
}

export const salesOrdersApi = {
  /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
  getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
    const page = await apiRequest<PagedResult<OrderRecord>>('GET', `${url}${pagedQueryString(query)}`);
    return { ...page, items: page.items.map(toVoucher) };
  },
  /** Excel file of every row the filters leave (not only the page), made by the server. */
  exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
    `DonBanHang_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
  getOptions: () => apiRequest<SalesOrderOptions>('GET', `${url}/options`),
  create: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<OrderRecord>('POST', url, toRequest(voucher, targetStatus))),
  update: async (voucher: GoodsVoucher, targetStatus?: string) => toVoucher(await apiRequest<OrderRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'cancel' | 'reopen') =>
    toVoucher(await apiRequest<OrderRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
