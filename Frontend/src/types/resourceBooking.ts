export type CompanyResourceType = 
  | 'meeting_room'       // Phòng họp
  | 'vehicle'            // Xe ô tô
  | 'computer'           // Máy tính / Laptop / Workstation
  | 'special_equipment'  // Thiết bị chuyên dụng
  | 'other';             // Khác

export type RecurrenceFrequency = 
  | 'none'       // Không lặp lại
  | 'daily'      // Hàng ngày
  | 'weekly'     // Hàng tuần
  | 'monthly'    // Hàng tháng
  | 'yearly';    // Hàng năm

export type BookingStatus = 
  | 'pending'    // Chờ phê duyệt
  | 'confirmed'  // Đã xác nhận
  | 'in_use'     // Đang sử dụng
  | 'completed'  // Đã hoàn tất / Đã trả
  | 'cancelled'; // Đã hủy

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval?: number;              // Mỗi X ngày/tuần/tháng/năm (mặc định 1)
  daysOfWeek?: number[];          // 1: T2, 2: T3, ..., 7: CN (dành cho weekly)
  endCondition: 'never' | 'count' | 'until_date';
  endCount?: number;              // Kết thúc sau N lần lặp
  untilDate?: string;             // Kết thúc vào ngày YYYY-MM-DD
}

export interface CompanyResource {
  id: string;
  code: string;                   // Mã tài nguyên (PH-VIP01, XE-01, PC-WS01...)
  name: string;                   // Tên tài nguyên
  type: CompanyResourceType;      // Phân loại
  capacity?: string;              // Sức chứa (20 người, 7 chỗ, RAM 64GB...)
  location?: string;              // Vị trí (Tầng 5, Gara B2, IT Lab...)
  color: string;                  // Màu hiển thị trên lịch (blue, amber, emerald...)
  icon: string;                   // Icon identifier
  features?: string[];            // Trang bị đi kèm
  status: 'available' | 'maintenance' | 'reserved';
  description?: string;
  managedBy?: string;             // Người quản lý / BP quản lý
}

export interface ResourceBooking {
  id: string;
  bookingCode: string;            // Mã phiếu (ĐKTN-2026-001)
  title: string;                  // Mục đích / Nội dung đăng ký
  resourceId: string;             // ID tài nguyên
  resourceName: string;           // Tên tài nguyên
  resourceCode: string;           // Mã tài nguyên
  resourceType: CompanyResourceType;
  resourceLocation?: string;
  startDate: string;              // YYYY-MM-DD
  startTime: string;              // HH:mm (e.g. 08:30)
  endDate: string;                // YYYY-MM-DD
  endTime: string;                // HH:mm (e.g. 11:00)
  registrantId: string;           // ID nhân viên / Username
  registrantName: string;         // Họ tên người đăng ký
  registrantCode: string;         // Mã nhân viên (NV001...)
  department: string;             // Phòng ban
  registrantPhone?: string;
  registrantEmail?: string;
  projectName: string;            // Tên dự án đăng ký
  projectCode?: string;           // Mã dự án
  attendeeCount?: number;         // Số người tham gia / đi cùng
  recurrence: RecurrenceConfig;   // Cấu hình lặp lại
  status: BookingStatus;          // Trạng thái phiếu
  notes?: string;                 // Ghi chú / Yêu cầu riêng
  needDriver?: boolean;           // Cần tài xế lái xe (với xe ô tô)
  specialRequests?: string[];     // Yêu cầu đặc biệt: máy chiếu, trà nước, mic, mạng LAN...
  createdAt: string;
  updatedAt?: string;
}
