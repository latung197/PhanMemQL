import { z } from 'zod';

// ==========================================
// 1. CHỨNG TỪ XUẤT KHO (GOODS ISSUE SCHEMA)
// ==========================================
export const issueItemSchema = z.object({
  productId: z.string().min(1, 'Vui lòng chọn sản phẩm'),
  productName: z.string(),
  sku: z.string().optional().default(''),
  unit: z.string().optional().default('Chiếc'),
  quantity: z.number({ message: 'Số lượng phải là số' }).gt(0, 'Số lượng xuất phải lớn hơn 0'),
  unitPrice: z.number({ message: 'Đơn giá phải là số' }).gte(0, 'Đơn giá không được âm'),
  lotNumber: z.string().optional().default(''),
  position: z.string().optional().default('')
});

export const goodsIssueSchema = z.object({
  voucherCode: z.string().min(3, 'Mã phiếu phải từ 3 ký tự trở lên'),
  voucherDate: z.string().min(1, 'Vui lòng chọn ngày lập phiếu'),
  warehouseId: z.string().min(1, 'Vui lòng chọn kho xuất'),
  partnerName: z.string().min(1, 'Vui lòng nhập tên đối tác/khách hàng'),
  issueReason: z.string().min(1, 'Vui lòng chọn hoặc nhập lý do xuất'),
  note: z.string().optional().default(''),
  items: z.array(issueItemSchema).min(1, 'Phiếu xuất phải có ít nhất 1 mặt hàng')
});

export type GoodsIssueFormData = z.infer<typeof goodsIssueSchema>;

// ==========================================
// 2. CHỨNG TỪ NHẬP KHO (GOODS RECEIPT SCHEMA)
// ==========================================
export const receiptItemSchema = z.object({
  productId: z.string().min(1, 'Vui lòng chọn sản phẩm'),
  productName: z.string(),
  sku: z.string().optional().default(''),
  unit: z.string().optional().default('Chiếc'),
  quantity: z.number({ message: 'Số lượng phải là số' }).gt(0, 'Số lượng nhập phải lớn hơn 0'),
  unitPrice: z.number({ message: 'Đơn giá phải là số' }).gte(0, 'Đơn giá không được âm'),
  lotNumber: z.string().optional().default(''),
  expirationDate: z.string().optional().default(''),
  position: z.string().optional().default('')
});

export const goodsReceiptSchema = z.object({
  voucherCode: z.string().min(3, 'Mã phiếu phải từ 3 ký tự trở lên'),
  voucherDate: z.string().min(1, 'Vui lòng chọn ngày lập phiếu'),
  warehouseId: z.string().min(1, 'Vui lòng chọn kho nhập'),
  supplierName: z.string().min(1, 'Vui lòng chọn hoặc nhập nhà cung cấp'),
  poNumber: z.string().optional().default(''),
  note: z.string().optional().default(''),
  items: z.array(receiptItemSchema).min(1, 'Phiếu nhập phải có ít nhất 1 mặt hàng')
});

export type GoodsReceiptFormData = z.infer<typeof goodsReceiptSchema>;

// ==========================================
// 3. VẬT TƯ / HÀNG HÓA (MATERIAL / PRODUCT SCHEMA)
// ==========================================
export const productSchema = z.object({
  code: z.string().min(2, 'Mã vật tư phải từ 2 ký tự'),
  name: z.string().min(2, 'Tên vật tư không được để trống'),
  category: z.string().min(1, 'Chọn nhóm vật tư'),
  unit: z.string().min(1, 'Chọn hoặc nhập đơn vị tính'),
  price: z.number({ message: 'Đơn giá phải là số' }).gte(0, 'Đơn giá không âm'),
  minStock: z.number().gte(0).optional().default(0),
  maxStock: z.number().gte(0).optional().default(1000),
  description: z.string().optional().default('')
});

export type ProductFormData = z.infer<typeof productSchema>;

// ==========================================
// 4. KHO HÀNG (WAREHOUSE SCHEMA)
// ==========================================
export const warehouseSchema = z.object({
  code: z.string().min(2, 'Mã kho tối thiểu 2 ký tự'),
  name: z.string().min(2, 'Tên kho không được trống'),
  location: z.string().min(1, 'Địa điểm kho không được trống'),
  manager: z.string().optional().default('')
});

export type WarehouseFormData = z.infer<typeof warehouseSchema>;
