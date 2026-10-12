import { apiRequest } from '../../../../services/apiClient';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

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
  lotNumber: line.lotNumber ?? '',
  position: line.position ?? ''
});

// GoodsVoucher keeps the partner in supplierName and the person handing over / taking over in delivererName for both
// receipts and issues; on an issue they are the customer and the receiver.
const toVoucher = (row: IssueRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: 'Xuất kho', code: row.code,
  date: row.date, createdDate: row.createdDate,
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.warehouseCode, warehouseName: row.warehouseName,
  voucherType: row.voucherType, currencyCode: row.currencyCode, exchangeRate: row.exchangeRate,
  supplierName: row.customerName ?? '', delivererName: row.receiverName ?? '',
  note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined,
  items: row.items.map(toItem), materialItems: row.materialItems.map(toItem)
});

const toLine = (item: VoucherItem, kind: 'ITEM' | 'MATERIAL') => ({
  kind, materialCode: item.sku || item.productId || '',
  uomCode: item.unit || '', quantity: item.quantity, unitPrice: item.unitPrice,
  lotNumber: item.lotNumber || null, position: item.position || null
});

const toRequest = (voucher: GoodsVoucher) => ({
  date: voucher.date, warehouseCode: voucher.warehouseId,
  voucherType: voucher.voucherType || 'Xuất bán hàng',
  currencyCode: voucher.currencyCode || 'VND', exchangeRate: voucher.exchangeRate || 1,
  customerName: voucher.supplierName || null, receiverName: voucher.delivererName || null,
  note: voucher.note || null,
  items: voucher.items.map(item => toLine(item, 'ITEM')),
  materialItems: (voucher.materialItems || []).map(item => toLine(item, 'MATERIAL')),
  version: voucher.version
});

export const goodsIssuesApi = {
  getAll: async () => (await apiRequest<IssueRecord[]>('GET', url)).map(toVoucher),
  getOptions: () => apiRequest<{ warehouses: { code: string; name: string }[]; currencies: { code: string; name: string }[] }>('GET', `${url}/options`),
  create: async (voucher: GoodsVoucher) => toVoucher(await apiRequest<IssueRecord>('POST', url, toRequest(voucher))),
  update: async (voucher: GoodsVoucher) => toVoucher(await apiRequest<IssueRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher))),
  changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel') =>
    toVoucher(await apiRequest<IssueRecord>('POST', `${url}/${id}/${action}`)),
  remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`)
};
