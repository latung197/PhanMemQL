/**
 * TEMPLATE: ĐỊNH NGHĨA KIỂU DỮ LIỆU CHỨNG TỪ NGHIỆP VỤ MASTER-DETAIL (VOUCHER FEATURE)
 * Dùng cho các chức năng: Đơn hàng, Phiếu nhập, Phiếu xuất, Hóa đơn, Đề nghị thanh toán...
 */

export interface VoucherDetailItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  note?: string;
}

export interface VoucherMasterModel {
  id: string;
  voucherNumber: string;    // Số chứng từ (VD: HD-2026-001, PNK-001...)
  voucherDate: string;      // Ngày chứng từ (YYYY-MM-DD)
  companyUnitId: string;    // Đơn vị cơ sở
  partnerId?: string;       // Mã Đối tác / Khách hàng / Nhà cung cấp
  partnerName?: string;     // Tên đối tác
  warehouseId?: string;     // Mã kho (nếu có)
  warehouseName?: string;   // Tên kho (nếu có)
  description: string;      // Diễn giải lý do
  status: 'Lập chứng từ' | 'Chờ duyệt' | 'Đã phê duyệt' | 'Hủy';
  totalQuantity: number;    // Tổng số lượng
  totalAmount: number;      // Tổng tiền (VND)
  creator: string;          // Người lập phiếu
  details: VoucherDetailItem[]; // Danh sách dòng chi tiết
}

export interface VoucherFilterCriteria {
  voucherNumber: string;
  companyUnitId: string;
  status: string;
  fromDate: string;
  toDate: string;
  partnerKeyword: string;
}
