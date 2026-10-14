// Kho › Điều chuyển kho: lệnh điều chuyển (inv_transfer_order), phiếu xuất điều chuyển (inv_transfer_issue) và phiếu nhập điều chuyển
// (inv_transfer_receipt). The three vouchers share one shape (backend TransferDto), so one api factory serves them all:
// /api/inventory/transfer-orders, /transfer-issues, /transfer-receipts.
import { apiDownload, apiRequest } from '../../../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../../../services/paging';
import type { GoodsVoucher, VoucherItem } from '../../../../types';

export type TransferKind = 'order' | 'issue' | 'receipt';

interface TransferLine {
  id: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  lotNumber?: string | null;
  position?: string | null;
  note?: string | null;
  doneQuantity: number;
  sourceLineId?: number | null;
  sourceCode?: string | null;
}

interface TransferRecord {
  id: number;
  code: string;
  date: string;
  createdDate: string;
  requiredDate?: string | null;
  unitCode: string;
  unitName: string;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  reason: string;
  personName?: string | null;
  sourceCode?: string | null;
  note?: string | null;
  status: 'Draft' | 'Pending' | 'Approved' | 'Posted' | 'Cancelled';
  totalValue: number;
  createdBy: string;
  approvedBy?: string | null;
  items: TransferLine[];
  version: number;
}

const statusLabels: Record<TransferRecord['status'], string> = {
  Draft: 'Lập chứng từ', Pending: 'Chờ duyệt', Approved: 'Đã phê duyệt', Posted: 'Chuyển sổ kho', Cancelled: 'Hủy'
};

const voucherTypes: Record<TransferKind, GoodsVoucher['type']> = {
  order: 'Lệnh điều chuyển kho', issue: 'Xuất điều chuyển kho', receipt: 'Nhập điều chuyển kho'
};

const toItem = (line: TransferLine): VoucherItem => ({
  productId: line.materialCode, sku: line.materialCode, productName: line.materialName, unit: line.uomCode,
  quantity: line.quantity, unitPrice: line.unitPrice, totalPrice: line.amount, amount: line.amount,
  lotNumber: line.lotNumber ?? '', position: line.position ?? '', note: line.note ?? '', doneQuantity: line.doneQuantity,
  transferSourceLineId: line.sourceLineId ?? undefined, transferSourceCode: line.sourceCode ?? undefined
});

// GoodsVoucher keeps the source warehouse in warehouseId / warehouseName, the reason in voucherType and the person in delivererName
// (the print form reads them); the destination is toWarehouseId / toWarehouseName.
const toVoucher = (kind: TransferKind) => (row: TransferRecord): GoodsVoucher => ({
  id: String(row.id), version: row.version, type: voucherTypes[kind], code: row.code,
  date: row.date, createdDate: row.createdDate, requiredDate: row.requiredDate ?? '',
  companyUnitId: row.unitCode, companyUnitName: row.unitName,
  warehouseId: row.fromWarehouseCode, warehouseName: row.fromWarehouseName,
  toWarehouseId: row.toWarehouseCode, toWarehouseName: row.toWarehouseName,
  voucherType: row.reason, delivererName: row.personName ?? '', requesterName: row.personName ?? '',
  transferSourceCode: row.sourceCode ?? '', note: row.note ?? '', status: statusLabels[row.status], totalValue: row.totalValue,
  createdBy: row.createdBy, approvedBy: row.approvedBy ?? undefined, items: row.items.map(toItem)
});

const toRequest = (voucher: GoodsVoucher, targetStatus?: string) => ({
  targetStatus: targetStatus && targetStatus !== 'Draft' ? targetStatus : undefined,
  date: voucher.date, requiredDate: voucher.requiredDate || null,
  fromWarehouseCode: voucher.warehouseId, toWarehouseCode: voucher.toWarehouseId || '',
  reason: voucher.voucherType || '', personName: voucher.delivererName || null, note: voucher.note || null,
  items: voucher.items.map(item => ({
    materialCode: item.sku || item.productId || '', uomCode: item.unit || '', quantity: item.quantity,
    lotNumber: item.lotNumber || null, position: item.position || null, note: item.note || null,
    sourceLineId: item.transferSourceLineId ?? null
  })),
  version: voucher.version
});

/** An approved order (to issue) or a posted issue (to receive) with something left: what the "Lấy từ ..." window lists. */
export interface OpenTransferLine {
  lineId: number;
  materialCode: string;
  materialName: string;
  uomCode: string;
  quantity: number;
  doneQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  lotNumber?: string | null;
  position?: string | null;
  note?: string | null;
}

export interface OpenTransfer {
  id: number;
  code: string;
  date: string;
  requiredDate?: string | null;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  reason: string;
  personName?: string | null;
  note?: string | null;
  lines: OpenTransferLine[];
}

const urls: Record<TransferKind, string> = {
  order: '/api/inventory/transfer-orders', issue: '/api/inventory/transfer-issues', receipt: '/api/inventory/transfer-receipts'
};
const fileNames: Record<TransferKind, string> = {
  order: 'LenhDieuChuyenKho', issue: 'PhieuXuatDieuChuyenKho', receipt: 'PhieuNhapDieuChuyenKho'
};

const createTransferApi = (kind: TransferKind) => {
  const url = urls[kind];
  const map = toVoucher(kind);
  return {
    /** One page of the list: the server filters, sorts and cuts it (services/paging.ts). */
    getPage: async (query: PagedQuery): Promise<PagedResult<GoodsVoucher>> => {
      const page = await apiRequest<PagedResult<TransferRecord>>('GET', `${url}${pagedQueryString(query)}`);
      return { ...page, items: page.items.map(map) };
    },
    /** Excel file of every row the filters leave (not only the page), made by the server. */
    exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`,
      `${fileNames[kind]}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`),
    getOptions: () => apiRequest<{ warehouses: { code: string; name: string }[] }>('GET', `${url}/options`),
    create: async (voucher: GoodsVoucher, targetStatus?: string) => map(await apiRequest<TransferRecord>('POST', url, toRequest(voucher, targetStatus))),
    update: async (voucher: GoodsVoucher, targetStatus?: string) => map(await apiRequest<TransferRecord>('PUT', `${url}/${voucher.id}`, toRequest(voucher, targetStatus))),
    changeStatus: async (id: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel' | 'reopen') =>
      map(await apiRequest<TransferRecord>('POST', `${url}/${id}/${action}`)),
    remove: (id: string) => apiRequest<void>('DELETE', `${url}/${id}`),
    /** Issue screen: approved orders with something left to issue (the issue being edited does not count against itself). */
    getOpenOrders: (issueId?: string) => apiRequest<OpenTransfer[]>('GET', `${url}/open-orders${issueId ? `?issueId=${issueId}` : ''}`),
    /** Receipt screen: posted issues with something left to receive. */
    getOpenIssues: (receiptId?: string) => apiRequest<OpenTransfer[]>('GET', `${url}/open-issues${receiptId ? `?receiptId=${receiptId}` : ''}`)
  };
};

export const transferApis = {
  order: createTransferApi('order'),
  issue: createTransferApi('issue'),
  receipt: createTransferApi('receipt')
};
