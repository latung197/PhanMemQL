/**
 * TEMPLATE: ĐỊNH NGHĨA KIỂU DỮ LIỆU CHỨC NĂNG DANH MỤC (CATEGORY FEATURE)
 * Hãy sao chép thư mục này và đổi tên trường theo nghiệp vụ của bạn (VD: Khách hàng, Nhà cung cấp, Dự án...)
 */

export interface CategoryItemModel {
  id: string;
  code: string;            // Mã định danh (VD: NCC001, PRJ001...)
  name: string;            // Tên danh mục
  categoryGroup?: string;  // Nhóm phân loại (tùy chọn)
  description?: string;    // Diễn giải / ghi chú
  status: 'Hoạt động' | 'Tạm dừng'; // Trạng thái
  createdDate?: string;    // Ngày tạo
  companyUnitId?: string;  // Đơn vị cơ sở phụ trách (nếu có)
}

export interface CategoryFilterCriteria {
  multiCodes: string;      // Tìm theo nhiều mã (phân cách dấu phẩy)
  keyword: string;         // Tìm theo tên hoặc mô tả
  group: string;           // Lọc theo nhóm
  status: string;          // Lọc theo trạng thái ('ALL' | 'Hoạt động' | 'Tạm dừng')
}

export type CategoryFormData = Omit<CategoryItemModel, 'id'> & {
  id?: string;
};
