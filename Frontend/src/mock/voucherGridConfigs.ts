import { VoucherGridInfo } from '../types';

/**
 * CẤU TRÚC VOUCHER GRID METADATA LƯU TRONG DATABASE (Mô phỏng Database Table: `sys_voucher_grid_info` & `sys_voucher_column_config`)
 * Cho phép quản trị viên hoặc lập trình viên tùy biến cấu trúc cột, kiểu dữ liệu, bắt buộc, tiêu đề, độ rộng,...
 */

// 1. Cấu hình Lưới Chi tiết Nhập kho (Voucher PNK - Tab 1: Chi tiết hàng hóa / vật tư)
export const goodsReceiptItemsGridConfig: VoucherGridInfo = {
  voucherType: 'PNK',
  voucherName: 'Phiếu Nhập Kho Vật Tư / Hàng Hóa',
  gridId: 'PNK_ITEMS',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: {
    sku: '',
    productName: '',
    unit: '',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    batchNumber: '',
    warehouseId: 'KHO_TONG'
  },
  columns: [
    {
      field: 'sku',
      headerName: 'Mã VT / Code',
      headerNameEn: 'Item Code',
      type: 'lookup',
      width: 140,
      minWidth: 120,
      align: 'left',
      required: true,
      placeholder: 'Mã SKU...',
      lookupConfig: {
        lookupCode: 'MATERIAL',
        displayField: 'productName',
        codeField: 'sku',
        unitField: 'unit',
        priceField: 'unitPrice'
      }
    },
    {
      field: 'productName',
      headerName: 'Tên Vật Tư / Hàng Hóa',
      headerNameEn: 'Item Name',
      type: 'text',
      width: 240,
      minWidth: 180,
      align: 'left',
      required: true,
      placeholder: 'Tên vật tư...'
    },
    {
      field: 'purchaseOrderCode',
      headerName: 'Đơn Mua Hàng',
      headerNameEn: 'Purchase Order',
      type: 'text',
      width: 170,
      minWidth: 130,
      align: 'left',
      readOnly: true,
      placeholder: ''
    },
    {
      field: 'purchaseOrderDeliveryDate',
      headerName: 'Dự Kiến Nhận',
      headerNameEn: 'Expected Date',
      type: 'date',
      width: 120,
      minWidth: 100,
      align: 'center',
      readOnly: true
    },
    {
      field: 'unit',
      headerName: 'ĐVT',
      headerNameEn: 'UOM',
      type: 'uom',
      width: 80,
      align: 'center',
      required: false,
      placeholder: 'Cái'
    },
    {
      field: 'quantity',
      headerName: 'Số Lượng',
      headerNameEn: 'Quantity',
      type: 'quantity',
      width: 90,
      align: 'right',
      required: true,
      decimals: 2,
      summary: 'sum',
      summaryFormat: 'quantity'
    },
    {
      field: 'unitPrice',
      headerName: 'Đơn Giá',
      headerNameEn: 'Unit Price',
      type: 'currency',
      width: 110,
      align: 'right',
      required: true,
      decimals: 0
    },
    {
      field: 'amount',
      headerName: 'Thành Tiền',
      headerNameEn: 'Amount',
      type: 'currency',
      width: 130,
      align: 'right',
      readOnly: true,
      decimals: 0,
      summary: 'sum',
      summaryFormat: 'currency'
    },
    {
      field: 'batchNumber',
      headerName: 'Số Lô / Vị Trí',
      headerNameEn: 'Batch / Location',
      type: 'text',
      width: 150,
      minWidth: 120,
      align: 'left',
      placeholder: 'Lô sản xuất / Kệ'
    }
  ]
};

// 2. Cấu hình Lưới Chi tiết NVL BOM (Voucher PNK - Tab 2: Cấu trúc SP / BOM)
export const goodsReceiptMaterialsGridConfig: VoucherGridInfo = {
  voucherType: 'PNK',
  voucherName: 'Phiếu Nhập Kho (Chi tiết BOM)',
  gridId: 'PNK_BOM',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: {
    materialSku: '',
    materialName: '',
    unit: 'Kg',
    normQuantity: 1,
    actualQuantity: 1,
    unitPrice: 0,
    amount: 0,
    note: ''
  },
  columns: [
    {
      field: 'materialSku',
      headerName: 'Mã NVL',
      headerNameEn: 'Material Code',
      type: 'lookup',
      width: 130,
      align: 'left',
      required: true,
      placeholder: 'Mã NVL...',
      lookupConfig: {
        lookupCode: 'MATERIAL',
        displayField: 'materialName',
        codeField: 'materialSku',
        unitField: 'unit',
        priceField: 'unitPrice'
      }
    },
    {
      field: 'materialName',
      headerName: 'Tên Nguyên Vật Liệu',
      headerNameEn: 'Material Name',
      type: 'text',
      width: 240,
      align: 'left',
      required: true
    },
    {
      field: 'unit',
      headerName: 'ĐVT',
      headerNameEn: 'UOM',
      type: 'uom',
      width: 80,
      align: 'center'
    },
    {
      field: 'normQuantity',
      headerName: 'Định Mức BOM',
      headerNameEn: 'BOM Norm Qty',
      type: 'quantity',
      width: 100,
      align: 'right',
      readOnly: true,
      decimals: 3,
      summary: 'sum',
      summaryFormat: 'quantity'
    },
    {
      field: 'actualQuantity',
      headerName: 'Thực Nhập',
      headerNameEn: 'Actual Qty',
      type: 'quantity',
      width: 100,
      align: 'right',
      required: true,
      decimals: 3,
      summary: 'sum',
      summaryFormat: 'quantity'
    },
    {
      field: 'unitPrice',
      headerName: 'Đơn Giá NVL',
      headerNameEn: 'Unit Price',
      type: 'currency',
      width: 110,
      align: 'right',
      decimals: 0
    },
    {
      field: 'amount',
      headerName: 'Thành Tiền',
      headerNameEn: 'Amount',
      type: 'currency',
      width: 130,
      align: 'right',
      readOnly: true,
      summary: 'sum',
      summaryFormat: 'currency'
    },
    {
      field: 'note',
      headerName: 'Ghi Chú Chi Tiết',
      headerNameEn: 'Note',
      type: 'text',
      width: 180,
      align: 'left',
      placeholder: 'Ghi chú...'
    }
  ]
};

// 3. Cấu hình Lưới Chi tiết Xuất kho (Voucher PXK - Tab 1: Chi tiết hàng hóa / vật tư xuất)
export const goodsIssueItemsGridConfig: VoucherGridInfo = {
  voucherType: 'PXK',
  voucherName: 'Phiếu Xuất Kho Vật Tư / Hàng Hóa',
  gridId: 'PXK_ITEMS',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: {
    sku: '',
    productName: '',
    unit: '',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    batchNumber: '',
    warehouseId: 'KHO_TONG'
  },
  columns: [
    {
      field: 'sku',
      headerName: 'Mã VT / Code',
      headerNameEn: 'Item Code',
      type: 'lookup',
      width: 140,
      minWidth: 120,
      align: 'left',
      required: true,
      placeholder: 'Mã SKU...',
      lookupConfig: {
        lookupCode: 'MATERIAL',
        displayField: 'productName',
        codeField: 'sku',
        unitField: 'unit',
        priceField: 'unitPrice'
      }
    },
    {
      field: 'productName',
      headerName: 'Tên Vật Tư / Hàng Hóa Xuất',
      headerNameEn: 'Item Name',
      type: 'text',
      width: 240,
      minWidth: 180,
      align: 'left',
      required: true,
      placeholder: 'Tên vật tư xuất...'
    },
    {
      field: 'issueRequestCode',
      headerName: 'Phiếu Yêu Cầu',
      headerNameEn: 'Request No.',
      type: 'text',
      width: 170,
      minWidth: 130,
      align: 'left',
      readOnly: true,
      placeholder: ''
    },
    {
      field: 'unit',
      headerName: 'ĐVT',
      headerNameEn: 'UOM',
      type: 'uom',
      width: 80,
      align: 'center',
      required: false,
      placeholder: 'Cái'
    },
    {
      field: 'quantity',
      headerName: 'Số Lượng Xuất',
      headerNameEn: 'Issued Quantity',
      type: 'quantity',
      width: 100,
      align: 'right',
      required: true,
      decimals: 2,
      summary: 'sum',
      summaryFormat: 'quantity'
    },
    {
      field: 'unitPrice',
      headerName: 'Đơn Giá Xuất',
      headerNameEn: 'Unit Price',
      type: 'currency',
      width: 110,
      align: 'right',
      required: true,
      decimals: 0
    },
    {
      field: 'amount',
      headerName: 'Thành Tiền',
      headerNameEn: 'Amount',
      type: 'currency',
      width: 130,
      align: 'right',
      readOnly: true,
      decimals: 0,
      summary: 'sum',
      summaryFormat: 'currency'
    },
    {
      field: 'batchNumber',
      headerName: 'Số Lô / Vị Trí Xuất',
      headerNameEn: 'Batch / Location',
      type: 'text',
      width: 150,
      minWidth: 120,
      align: 'left',
      placeholder: 'Lô sản xuất / Kệ'
    }
  ]
};

// Phiếu yêu cầu xuất kho (YCX): mã vật tư, tên, ĐVT, số lượng yêu cầu, đơn giá dự kiến, thành tiền, số đã xuất (chỉ đọc), ghi chú.
export const issueRequestItemsGridConfig: VoucherGridInfo = {
  voucherType: 'YCX',
  voucherName: 'Phiếu Yêu Cầu Xuất Kho',
  gridId: 'YCX_ITEMS',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: { sku: '', productName: '', unit: '', quantity: 1, unitPrice: 0, amount: 0, note: '' },
  columns: [
    {
      field: 'sku', headerName: 'Mã VT / Code', headerNameEn: 'Item Code', type: 'lookup', width: 140, minWidth: 120, align: 'left',
      required: true, placeholder: 'Mã SKU...',
      lookupConfig: { lookupCode: 'MATERIAL', displayField: 'productName', codeField: 'sku', unitField: 'unit', priceField: 'unitPrice' }
    },
    { field: 'productName', headerName: 'Tên Vật Tư / Hàng Hóa', headerNameEn: 'Item Name', type: 'text', width: 240, minWidth: 180, align: 'left', required: true, placeholder: 'Tên vật tư...' },
    { field: 'unit', headerName: 'ĐVT', headerNameEn: 'UOM', type: 'uom', width: 80, align: 'center', required: false, placeholder: 'Cái' },
    { field: 'quantity', headerName: 'Số Lượng Yêu Cầu', headerNameEn: 'Requested Quantity', type: 'quantity', width: 110, align: 'right', required: true, decimals: 2, summary: 'sum', summaryFormat: 'quantity' },
    { field: 'issuedQuantity', headerName: 'Đã Xuất', headerNameEn: 'Issued', type: 'quantity', width: 90, align: 'right', readOnly: true, decimals: 2, summary: 'sum', summaryFormat: 'quantity' },
    { field: 'unitPrice', headerName: 'Đơn Giá Dự Kiến', headerNameEn: 'Expected Price', type: 'currency', width: 110, align: 'right', required: false, decimals: 0 },
    { field: 'amount', headerName: 'Thành Tiền', headerNameEn: 'Amount', type: 'currency', width: 130, align: 'right', readOnly: true, decimals: 0, summary: 'sum', summaryFormat: 'currency' },
    { field: 'note', headerName: 'Ghi Chú', headerNameEn: 'Note', type: 'text', width: 170, minWidth: 120, align: 'left', placeholder: 'Ghi chú dòng...' }
  ]
};

// Phiếu yêu cầu mua hàng (YCM): đề nghị mua; "Đã đặt" là số các đơn mua hàng đã đặt (chỉ đọc).
export const purchaseRequestItemsGridConfig: VoucherGridInfo = {
  voucherType: 'YCM',
  voucherName: 'Phiếu Yêu Cầu Mua Hàng',
  gridId: 'YCM_ITEMS',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: { sku: '', productName: '', unit: '', quantity: 1, unitPrice: 0, amount: 0, note: '' },
  columns: [
    {
      field: 'sku', headerName: 'Mã VT / Code', headerNameEn: 'Item Code', type: 'lookup', width: 140, minWidth: 120, align: 'left',
      required: true, placeholder: 'Mã SKU...',
      lookupConfig: { lookupCode: 'MATERIAL', displayField: 'productName', codeField: 'sku', unitField: 'unit', priceField: 'unitPrice' }
    },
    { field: 'productName', headerName: 'Tên Vật Tư / Hàng Hóa', headerNameEn: 'Item Name', type: 'text', width: 240, minWidth: 180, align: 'left', required: true, placeholder: 'Tên vật tư...' },
    { field: 'unit', headerName: 'ĐVT', headerNameEn: 'UOM', type: 'uom', width: 80, align: 'center', required: false, placeholder: 'Cái' },
    { field: 'quantity', headerName: 'Số Lượng Yêu Cầu', headerNameEn: 'Requested Quantity', type: 'quantity', width: 110, align: 'right', required: true, decimals: 2, summary: 'sum', summaryFormat: 'quantity' },
    { field: 'orderedQuantity', headerName: 'Đã Đặt Mua', headerNameEn: 'Ordered', type: 'quantity', width: 90, align: 'right', readOnly: true, decimals: 2, summary: 'sum', summaryFormat: 'quantity' },
    { field: 'unitPrice', headerName: 'Đơn Giá Dự Kiến', headerNameEn: 'Expected Price', type: 'currency', width: 110, align: 'right', required: false, decimals: 0 },
    { field: 'amount', headerName: 'Thành Tiền', headerNameEn: 'Amount', type: 'currency', width: 130, align: 'right', readOnly: true, decimals: 0, summary: 'sum', summaryFormat: 'currency' },
    { field: 'note', headerName: 'Ghi Chú', headerNameEn: 'Note', type: 'text', width: 170, minWidth: 120, align: 'left', placeholder: 'Ghi chú dòng...' }
  ]
};

// Đơn mua hàng (DMH): "Phiếu yêu cầu" là số phiếu yêu cầu mua hàng mà dòng thực hiện, "Đã nhập" là số các phiếu nhập kho đã nhận (cả hai chỉ đọc).
export const purchaseOrderItemsGridConfig: VoucherGridInfo = {
  voucherType: 'DMH',
  voucherName: 'Đơn Mua Hàng',
  gridId: 'DMH_ITEMS',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: { sku: '', productName: '', unit: '', quantity: 1, unitPrice: 0, amount: 0, note: '' },
  columns: [
    {
      field: 'sku', headerName: 'Mã VT / Code', headerNameEn: 'Item Code', type: 'lookup', width: 140, minWidth: 120, align: 'left',
      required: true, placeholder: 'Mã SKU...',
      lookupConfig: { lookupCode: 'MATERIAL', displayField: 'productName', codeField: 'sku', unitField: 'unit', priceField: 'unitPrice' }
    },
    { field: 'productName', headerName: 'Tên Vật Tư / Hàng Hóa', headerNameEn: 'Item Name', type: 'text', width: 240, minWidth: 180, align: 'left', required: true, placeholder: 'Tên vật tư...' },
    { field: 'purchaseRequestCode', headerName: 'Phiếu Yêu Cầu', headerNameEn: 'Request No.', type: 'text', width: 170, minWidth: 130, align: 'left', readOnly: true, placeholder: '' },
    { field: 'unit', headerName: 'ĐVT', headerNameEn: 'UOM', type: 'uom', width: 80, align: 'center', required: false, placeholder: 'Cái' },
    { field: 'quantity', headerName: 'Số Lượng Đặt', headerNameEn: 'Ordered Quantity', type: 'quantity', width: 110, align: 'right', required: true, decimals: 2, summary: 'sum', summaryFormat: 'quantity' },
    { field: 'receivedQuantity', headerName: 'Đã Nhập', headerNameEn: 'Received', type: 'quantity', width: 90, align: 'right', readOnly: true, decimals: 2, summary: 'sum', summaryFormat: 'quantity' },
    { field: 'unitPrice', headerName: 'Đơn Giá', headerNameEn: 'Unit Price', type: 'currency', width: 110, align: 'right', required: true, decimals: 0 },
    { field: 'amount', headerName: 'Thành Tiền', headerNameEn: 'Amount', type: 'currency', width: 130, align: 'right', readOnly: true, decimals: 0, summary: 'sum', summaryFormat: 'currency' },
    { field: 'note', headerName: 'Ghi Chú', headerNameEn: 'Note', type: 'text', width: 170, minWidth: 120, align: 'left', placeholder: 'Ghi chú dòng...' }
  ]
};

// 4. Cấu hình Lưới Chi tiết NVL BOM (Voucher PXK - Tab 2: Cấu trúc SP / BOM)
export const goodsIssueMaterialsGridConfig: VoucherGridInfo = {
  voucherType: 'PXK',
  voucherName: 'Phiếu Xuất Kho (Chi tiết BOM NVL)',
  gridId: 'PXK_BOM',
  allowAddRow: true,
  allowDeleteRow: true,
  defaultNewRow: {
    materialSku: '',
    materialName: '',
    unit: 'Kg',
    normQuantity: 1,
    actualQuantity: 1,
    unitPrice: 0,
    amount: 0,
    note: ''
  },
  columns: [
    {
      field: 'materialSku',
      headerName: 'Mã NVL',
      headerNameEn: 'Material Code',
      type: 'lookup',
      width: 130,
      align: 'left',
      required: true,
      placeholder: 'Mã NVL...',
      lookupConfig: {
        lookupCode: 'MATERIAL',
        displayField: 'materialName',
        codeField: 'materialSku',
        unitField: 'unit',
        priceField: 'unitPrice'
      }
    },
    {
      field: 'materialName',
      headerName: 'Tên Nguyên Vật Liệu',
      headerNameEn: 'Material Name',
      type: 'text',
      width: 240,
      align: 'left',
      required: true
    },
    {
      field: 'unit',
      headerName: 'ĐVT',
      headerNameEn: 'UOM',
      type: 'uom',
      width: 80,
      align: 'center'
    },
    {
      field: 'normQuantity',
      headerName: 'Định Mức BOM',
      headerNameEn: 'BOM Norm Qty',
      type: 'quantity',
      width: 100,
      align: 'right',
      readOnly: true,
      decimals: 3,
      summary: 'sum',
      summaryFormat: 'quantity'
    },
    {
      field: 'actualQuantity',
      headerName: 'Thực Xuất',
      headerNameEn: 'Actual Qty',
      type: 'quantity',
      width: 100,
      align: 'right',
      required: true,
      decimals: 3,
      summary: 'sum',
      summaryFormat: 'quantity'
    },
    {
      field: 'unitPrice',
      headerName: 'Đơn Giá NVL',
      headerNameEn: 'Unit Price',
      type: 'currency',
      width: 110,
      align: 'right',
      decimals: 0
    },
    {
      field: 'amount',
      headerName: 'Thành Tiền',
      headerNameEn: 'Amount',
      type: 'currency',
      width: 130,
      align: 'right',
      readOnly: true,
      summary: 'sum',
      summaryFormat: 'currency'
    },
    {
      field: 'note',
      headerName: 'Ghi Chú Chi Tiết',
      headerNameEn: 'Note',
      type: 'text',
      width: 180,
      align: 'left',
      placeholder: 'Ghi chú...'
    }
  ]
};

// Tổng hợp tất cả cấu hình Lưới chứng từ hệ thống
export const systemVoucherGridRegistry: Record<string, VoucherGridInfo> = {
  'PNK_ITEMS': goodsReceiptItemsGridConfig,
  'PNK_BOM': goodsReceiptMaterialsGridConfig,
  'PXK_ITEMS': goodsIssueItemsGridConfig,
  'PXK_BOM': goodsIssueMaterialsGridConfig,
  'YCX_ITEMS': issueRequestItemsGridConfig,
  'YCM_ITEMS': purchaseRequestItemsGridConfig,
  'DMH_ITEMS': purchaseOrderItemsGridConfig,
};

export const getVoucherGridConfig = (gridId: string): VoucherGridInfo => {
  return systemVoucherGridRegistry[gridId] || goodsReceiptItemsGridConfig;
};
