import { apiRequest } from '../../../../services/apiClient';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

const url = '/api/inventory/goods-receipts';

interface ReceiptLine {
  id: number;
  kind: 'ITEM' | 'MATERIAL';
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  lotNumber?: string | null;
  position?: string | null;
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
  supplierName?: string | null;
  delivererName?: string | null;
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
  productId: line.productCode,
  sku: line.productCode,
  productName: line.productName,
  unit: line.unit,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  totalPrice: line.amount,
  lotNumber: line.lotNumber ?? '',
  position: line.position ?? ''
});

const toVoucher = (row: ReceiptRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Nhập kho', code: row.code,
  date: row.date, createdDate: row.createdDate,
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  supplierName: row.supplierName ?? '', delivererName: row.delivererName ?? '',
  note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem), materialItems: row.materialItems.map(toItem)
});

const toLine = (item: VoucherItem, kind: 'ITEM' | 'MATERIAL') => ({
  kind, productCode: item.sku || item.productId || '', productName: item.productName,
  unit: item.unit || '', quantity: item.quantity, unitPrice: item.unitPrice,
  lotNumber: item.lotNumber || null, position: item.position || null
});

const toRequest = (voucher: GoodsVoucher) => ({
  date: voucher.date, warehouseCode: voucher.warehouseId,
  voucherType: voucher.voucherType || 'Nhập mua mới',
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  supplierName: voucher.supplierName || null, delivererName: voucher.delivererName || null,
  note: voucher.note || null,
  items: voucher.items.map(item => toLine(item, 'ITEM')),
  materialItems: (voucher.materialItems || []).map(item => toLine(item, 'MATERIAL')),
  version: voucher.version
});

export const goodsReceiptsApi = {
  getAll: async () => (await apiRequest<ReceiptRecord[]>('GET', url)).map(toVoucher),
  getOptions: () => apiRequest<{ warehouses: { code: string; name: string }[]; currencies: { code: string; name: string }[] }>('GET', `${url}/options`),
  create: async (voucher: GoodsVoucher) => toVoucher(await apiRequest<ReceiptRecord>('POST', url, toRequest(voucher))),
  update: async (voucher: GoodsVoucher) => toVoucher(await apiRequest<ReceiptRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel') =>
    toVoucher(await apiRequest<ReceiptRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
