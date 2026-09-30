import { CompanyResource, ResourceBooking, RecurrenceConfig } from '../types/resourceBooking';

const STORAGE_KEY_RESOURCES = 'serp_company_resources';
const STORAGE_KEY_BOOKINGS = 'serp_resource_bookings';

export const INITIAL_RESOURCES: CompanyResource[] = [
  // 1. PHÒNG HỌP
  {
    id: 'RES_ROOM_01',
    code: 'PH-VIP-01',
    name: 'Phòng Họp VIP Kim Cương (Diamond)',
    type: 'meeting_room',
    capacity: '24 chỗ ngồi',
    location: 'Tầng 5 - Khu VIP Trụ sở chính',
    color: '#3b82f6', // blue
    icon: 'Building2',
    features: ['Màn hình LED 98 inch', 'Hệ thống Polycom họp trực tuyến', 'Mic hội nghị không dây', 'Bảng kính thông minh', 'Hệ thống âm thanh vòm'],
    status: 'available',
    description: 'Phòng họp cao cấp tiếp đối tác, họp Ban Giám Đốc và ký kết hợp đồng chiến lược.',
    managedBy: 'Ban Thư ký / Lễ tân'
  },
  {
    id: 'RES_ROOM_02',
    code: 'PH-CREATIVE-02',
    name: 'Phòng Họp Sáng Tạo & Đổi Mới (Innovation Hub)',
    type: 'meeting_room',
    capacity: '14 chỗ ngồi',
    location: 'Tầng 3 - Cụm R&D và Dự Án',
    color: '#8b5cf6', // purple
    icon: 'Users',
    features: ['Máy chiếu 4K Laser', 'Bảng trắng 360 độ', 'Ghế Ergonomic linh hoạt', 'Cổng kết nối Type-C đa năng'],
    status: 'available',
    description: 'Không gian họp động não (brainstorming), đào tạo nội bộ và họp sprint hàng tuần.',
    managedBy: 'Phòng Kỹ thuật & R&D'
  },
  {
    id: 'RES_ROOM_03',
    code: 'PH-MEET-03',
    name: 'Phòng Họp Nhanh Sapphire (Huddle Room)',
    type: 'meeting_room',
    capacity: '8 chỗ ngồi',
    location: 'Tầng 2 - Phòng Kinh Doanh & Marketing',
    color: '#06b6d4', // cyan
    icon: 'DoorClosed',
    features: ['TV Sony 65 inch', 'Webcam họp nhóm Ultra HD', 'Bảng viết dạ'],
    status: 'available',
    description: 'Phòng họp nhóm nhanh, họp phỏng vấn tuyển dụng và trao đổi ngắn hạn.',
    managedBy: 'Phòng Hành chính'
  },
  {
    id: 'RES_ROOM_04',
    code: 'PH-HALL-04',
    name: 'Hội Trường Lớn Grand Hall',
    type: 'meeting_room',
    capacity: '100 chỗ ngồi',
    location: 'Tầng 1 - Cụm Sự kiện',
    color: '#f59e0b', // amber
    icon: 'Presentation',
    features: ['Màn hình LED P2 300 inch', 'Sân khấu & Bục phát biểu', 'Dàn âm thanh biểu diễn', 'Hệ thống ánh sáng hội thảo'],
    status: 'available',
    description: 'Dành cho hội nghị khách hàng, tổng kết năm và đào tạo toàn thể CBNV.',
    managedBy: 'Ban Quản trị Cơ sở'
  },

  // 2. XE Ô TÔ CÔNG TY
  {
    id: 'RES_CAR_01',
    code: 'XE-7C-EVEREST',
    name: 'Xe Ô Tô 7 Chỗ Ford Everest Titanium (29A-888.99)',
    type: 'vehicle',
    capacity: '7 người (Gồm lái xe)',
    location: 'Gara Tầng Hầm B2 - Vị trí 01',
    color: '#10b981', // emerald
    icon: 'Car',
    features: ['Nội thất da cao cấp', 'Dẫn động 2 cầu (4WD)', 'Cửa sổ trời toàn cảnh', 'Thẻ thu phí không dừng ETC', 'Bảo hiểm thân vỏ toàn diện'],
    status: 'available',
    description: 'Phục vụ các chuyến công tác ngoại tỉnh, đưa đón lãnh đạo và chuyên gia kỹ thuật.',
    managedBy: 'Đội xe - Phòng Hành chính Quản trị'
  },
  {
    id: 'RES_CAR_02',
    code: 'XE-7C-SEDONA',
    name: 'Xe Ô Tô 7 Chỗ Kia Carnival / Sedona (29B-666.88)',
    type: 'vehicle',
    capacity: '7 người rộng rãi',
    location: 'Gara Tầng Hầm B2 - Vị trí 02',
    color: '#14b8a6', // teal
    icon: 'Car',
    features: ['Ghế cơ trưởng bọc da', 'Cửa trượt điện 2 bên', 'Màn hình giải trí trần xe', 'Wifi 4G tốc độ cao trên xe'],
    status: 'available',
    description: 'Ưu tiên đón tiếp đối tác quan trọng, khách hàng VIP và sự kiện thương mại.',
    managedBy: 'Đội xe - Phòng Hành chính Quản trị'
  },
  {
    id: 'RES_CAR_03',
    code: 'XE-PICKUP-RANGER',
    name: 'Xe Bán Tải Ford Ranger Wildtrak (29C-999.33)',
    type: 'vehicle',
    capacity: '5 người + Thùng hàng 1 tấn',
    location: 'Gara Tầng Hầm B2 - Vị trí 03',
    color: '#d97706', // amber-600
    icon: 'Truck',
    features: ['Thùng chở hàng nắp cuộn điện', 'Cầu phụ vượt địa hình', 'Thanh giằng cứu hộ', 'Chuyên chở mẫu máy và thiết bị triển khai'],
    status: 'available',
    description: 'Dành cho đội kỹ thuật đi khảo sát công trình, vận chuyển thiết bị máy móc dự án.',
    managedBy: 'Đội xe - Phòng Hành chính Quản trị'
  },

  // 3. MÁY TÍNH & THIẾT BỊ CNTT
  {
    id: 'RES_PC_01',
    code: 'PC-WS-RTX4090',
    name: 'Máy Trạm Render & AI Dell Precision 7920',
    type: 'computer',
    capacity: 'Dual Xeon 48 Cores - RAM 128GB - 2x RTX 4090 24GB',
    location: 'Phòng Máy Chủ Server / AI Lab Tầng 3',
    color: '#ec4899', // pink
    icon: 'Cpu',
    features: ['GPU Tensor Core chuyên sâu AI/ML', 'NVMe SSD 4TB', 'Mạng cáp quang nội bộ 10Gbps', 'Cài sẵn CUDA & Docker AI Engine'],
    status: 'available',
    description: 'Dành cho các đội phát triển huấn luyện mô hình AI, render mô phỏng 3D công nghiệp.',
    managedBy: 'Phòng IT Hạ Tầng'
  },
  {
    id: 'RES_PC_02',
    code: 'LAPTOP-DEV-01',
    name: 'Laptop Trạm Dell Precision 7780 (Mobile Workstation)',
    type: 'computer',
    capacity: 'Core i9 13950HX - RAM 64GB - RTX 4080',
    location: 'Tủ Thiết Bị Di Động - Phòng IT Tầng 3',
    color: '#6366f1', // indigo
    icon: 'Laptop',
    features: ['Màn hình 17.3 inch UHD 4K 100% DCI-P3', 'Cổng sạc 240W', 'Túi chống sốc & chuột công thái học'],
    status: 'available',
    description: 'Mượn đi demo sản phẩm tại hội chợ công nghệ hoặc công tác kỹ thuật tại hiện trường.',
    managedBy: 'Phòng IT Quản trị'
  },
  {
    id: 'RES_PC_03',
    code: 'LAPTOP-PRO-MACBOOK',
    name: 'MacBook Pro 16 inch M3 Max (36GB Unified Memory)',
    type: 'computer',
    capacity: 'Apple M3 Max 14-core CPU / 30-core GPU',
    location: 'Tủ Thiết Bị Di Động - Phòng IT Tầng 3',
    color: '#64748b', // slate
    icon: 'Laptop',
    features: ['Màn Liquid Retina XDR', 'Pin thời lượng 18 tiếng', 'Bao da bảo vệ & Cáp sạc MagSafe 3'],
    status: 'available',
    description: 'Phục vụ thiết kế đồ họa sự kiện, biên tập video giới thiệu sản phẩm và kiểm thử iOS/macOS.',
    managedBy: 'Phòng IT Quản trị'
  },

  // 4. THIẾT BỊ CHUYÊN DỤNG KHÁC
  {
    id: 'RES_EQ_01',
    code: 'EQ-DRONE-MAVIC3',
    name: 'Flycam Khảo Sát Fly Drone DJI Mavic 3 Pro Enterprise',
    type: 'special_equipment',
    capacity: 'Quay video 5.1K - Cảm biến nhiệt & đo đạc địa hình',
    location: 'Kho Thiết Bị Khảo Sát Tầng 2',
    color: '#0284c7', // light blue
    icon: 'Camera',
    features: ['3 Camera Hasselblad', 'Pin bay 45 phút x 3 cục', 'Bộ tay cầm điều khiển thông minh RC Pro', 'Hệ thống cảm biến vật cản đa hướng'],
    status: 'available',
    description: 'Chuyên phục vụ khảo sát vị trí kho bãi, quay tư liệu tiến độ dự án nhà máy.',
    managedBy: 'Phòng Dự Án Công Trình'
  },
  {
    id: 'RES_EQ_02',
    code: 'EQ-POLYCOM-STUDIO',
    name: 'Bộ Họp Trực Tuyến Di Động Poly Studio X50 + TC8',
    type: 'special_equipment',
    capacity: 'Phục vụ phòng họp lên đến 15 người',
    location: 'Tủ Thiết Bị Hội Nghị Tầng 2',
    color: '#84cc16', // lime
    icon: 'Video',
    features: ['Camera 4K tự động zoom theo người nói (Auto-framing)', 'Công nghệ lọc tiếng ồn NoiseBlockAI', 'Màn hình cảm ứng điều khiển TC8'],
    status: 'available',
    description: 'Thiết bị họp trực tuyến lưu động, lắp đặt nhanh cho bất kỳ phòng ban nào khi cần kết nối đa điểm.',
    managedBy: 'Phòng IT'
  }
];

export const INITIAL_BOOKINGS: ResourceBooking[] = [
  {
    id: 'BK_2026_001',
    bookingCode: 'ĐKTN-2026-001',
    title: 'Họp Điều Hành Ban Giám Đốc Định Kỳ & Đánh Giá KPIs Tháng',
    resourceId: 'RES_ROOM_01',
    resourceName: 'Phòng Họp VIP Kim Cương (Diamond)',
    resourceCode: 'PH-VIP-01',
    resourceType: 'meeting_room',
    resourceLocation: 'Tầng 5 - Khu VIP Trụ sở chính',
    startDate: new Date().toISOString().slice(0, 10),
    startTime: '08:30',
    endDate: new Date().toISOString().slice(0, 10),
    endTime: '11:30',
    registrantId: 'NV001',
    registrantName: 'Trần Thịnh',
    registrantCode: 'NV001',
    department: 'Ban Giám Đốc',
    registrantPhone: '0901112233',
    registrantEmail: 'thinh.tran@erp-enterprise.vn',
    projectName: 'Dự án Nâng Cấp Hệ Thống ERP Doanh Nghiệp Toàn Diện',
    projectCode: 'DA-ERP-2026',
    attendeeCount: 16,
    recurrence: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1], // Thứ Hai
      endCondition: 'never'
    },
    status: 'confirmed',
    notes: 'Chuẩn bị nước trà thảo mộc, tài liệu in sẵn 16 bản và kết nối sẵn màn hình chiếu.',
    specialRequests: ['Trà nước hội nghị', 'Bảng trắng', 'Micro không dây'],
    createdAt: '2026-09-01 08:00'
  },
  {
    id: 'BK_2026_002',
    bookingCode: 'ĐKTN-2026-002',
    title: 'Đưa Đón Chuyên Gia Kỹ Thuật Hàn Quốc Khảo Sát Nhà Máy Bình Dương',
    resourceId: 'RES_CAR_01',
    resourceName: 'Xe Ô Tô 7 Chỗ Ford Everest Titanium (29A-888.99)',
    resourceCode: 'XE-7C-EVEREST',
    resourceType: 'vehicle',
    resourceLocation: 'Gara Tầng Hầm B2 - Vị trí 01',
    startDate: new Date().toISOString().slice(0, 10),
    startTime: '13:00',
    endDate: new Date().toISOString().slice(0, 10),
    endTime: '17:30',
    registrantId: 'NV002',
    registrantName: 'Nguyễn Văn Minh',
    registrantCode: 'NV002',
    department: 'Kỹ thuật',
    registrantPhone: '0902223344',
    registrantEmail: 'minh.nguyen@erp-enterprise.vn',
    projectName: 'Dự án Mở Rộng Dây Chuyền Sản Xuất Tự Động Hóa 2026',
    projectCode: 'DA-ROBOTICS-BD',
    attendeeCount: 5,
    recurrence: {
      frequency: 'none',
      endCondition: 'never'
    },
    status: 'in_use',
    notes: 'Lộ trình: Xuất phát từ Trụ sở chính Q1 đi KCN VSIP 1 Bình Dương và quay về trong ngày.',
    needDriver: true,
    createdAt: '2026-09-10 14:20'
  },
  {
    id: 'BK_2026_003',
    bookingCode: 'ĐKTN-2026-003',
    title: 'Chạy Huấn Luyện Mô Hình Nhận Diện OCR & Đọc Hóa Đơn Tự Động',
    resourceId: 'RES_PC_01',
    resourceName: 'Máy Trạm Render & AI Dell Precision 7920',
    resourceCode: 'PC-WS-RTX4090',
    resourceType: 'computer',
    resourceLocation: 'Phòng Máy Chủ Server / AI Lab Tầng 3',
    startDate: new Date().toISOString().slice(0, 10),
    startTime: '18:00',
    endDate: new Date().toISOString().slice(0, 10),
    endTime: '23:00',
    registrantId: 'NV002',
    registrantName: 'Nguyễn Văn Minh',
    registrantCode: 'NV002',
    department: 'Kỹ thuật',
    registrantPhone: '0902223344',
    registrantEmail: 'minh.nguyen@erp-enterprise.vn',
    projectName: 'Dự án Trợ Lý Ảo Phân Tích Dữ Liệu Bán Hàng AI',
    projectCode: 'DA-AI-ANALYTICS',
    attendeeCount: 1,
    recurrence: {
      frequency: 'daily',
      interval: 1,
      endCondition: 'count',
      endCount: 14
    },
    status: 'confirmed',
    notes: 'Huấn luyện mạng nơ-ron qua đêm trên 2 GPU RTX 4090. Vui lòng không tắt nguồn hoặc khởi động lại máy.',
    createdAt: '2026-09-12 11:00'
  },
  {
    id: 'BK_2026_004',
    bookingCode: 'ĐKTN-2026-004',
    title: 'Họp Sprint Review & Kế Hoạch Bán Hàng Quý IV',
    resourceId: 'RES_ROOM_02',
    resourceName: 'Phòng Họp Sáng Tạo & Đổi Mới (Innovation Hub)',
    resourceCode: 'PH-CREATIVE-02',
    resourceType: 'meeting_room',
    resourceLocation: 'Tầng 3 - Cụm R&D và Dự Án',
    startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Ngày mai
    startTime: '09:00',
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    endTime: '11:00',
    registrantId: 'NV003',
    registrantName: 'Lê Thị Thu Thảo',
    registrantCode: 'NV003',
    department: 'Kế toán',
    registrantPhone: '0903334455',
    registrantEmail: 'thao.le@erp-enterprise.vn',
    projectName: 'Chiến Dịch Tăng Trưởng Doanh Số Phân Hệ Khách Hàng Doanh Nghiệp',
    projectCode: 'DA-SALES-Q4',
    attendeeCount: 12,
    recurrence: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [5], // Thứ Sáu
      endCondition: 'never'
    },
    status: 'confirmed',
    notes: 'Cần bút dạ và bảng viết 360 độ.',
    createdAt: '2026-09-14 09:30'
  },
  {
    id: 'BK_2026_005',
    bookingCode: 'ĐKTN-2026-005',
    title: 'Chở Mẫu Máy Đo Điện Quang & Công Cụ Khảo Sát Dự Án Khách Hàng Viettel',
    resourceId: 'RES_CAR_03',
    resourceName: 'Xe Bán Tải Ford Ranger Wildtrak (29C-999.33)',
    resourceCode: 'XE-PICKUP-RANGER',
    resourceType: 'vehicle',
    resourceLocation: 'Gara Tầng Hầm B2 - Vị trí 03',
    startDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), // Ngày kia
    startTime: '07:30',
    endDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    endTime: '16:00',
    registrantId: 'NV004',
    registrantName: 'Phạm Quốc Bảo',
    registrantCode: 'NV004',
    department: 'Kho vận',
    registrantPhone: '0904445566',
    registrantEmail: 'bao.pham@erp-enterprise.vn',
    projectName: 'Dự án Cung Cấp Thiết Bị Mạng & Viễn Thông Công Nghiệp',
    projectCode: 'DA-TELECOM-VT',
    attendeeCount: 3,
    recurrence: {
      frequency: 'none',
      endCondition: 'never'
    },
    status: 'pending',
    notes: 'Cần mượn bạt phủ chống nước cho thùng xe hàng.',
    needDriver: false,
    createdAt: '2026-09-15 15:45'
  },
  {
    id: 'BK_2026_006',
    bookingCode: 'ĐKTN-2026-006',
    title: 'Phỏng Vấn Ứng Viên Vị Trí Trưởng Nhóm Phát Triển Phần Mềm ERP',
    resourceId: 'RES_ROOM_03',
    resourceName: 'Phòng Họp Nhanh Sapphire (Huddle Room)',
    resourceCode: 'PH-MEET-03',
    resourceType: 'meeting_room',
    resourceLocation: 'Tầng 2 - Phòng Kinh Doanh & Marketing',
    startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    startTime: '14:00',
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    endTime: '16:30',
    registrantId: 'NV005',
    registrantName: 'Vũ Ngọc Khánh',
    registrantCode: 'NV005',
    department: 'Nhân sự',
    registrantPhone: '0905556677',
    registrantEmail: 'khanh.vu@erp-enterprise.vn',
    projectName: 'Tuyển Dụng & Phát Triển Đội Ngũ Nhân Lực CNTT Chiến Lược',
    projectCode: 'DA-HR-RECRUIT',
    attendeeCount: 4,
    recurrence: {
      frequency: 'none',
      endCondition: 'never'
    },
    status: 'confirmed',
    notes: 'Phỏng vấn 3 ứng viên liên tiếp, mỗi lượt 45 phút.',
    createdAt: '2026-09-15 16:00'
  }
];

export const resourceBookingService = {
  // 1. Quản lý danh mục tài nguyên
  getResources(): CompanyResource[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RESOURCES);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse resources from storage:', e);
    }
    localStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(INITIAL_RESOURCES));
    return INITIAL_RESOURCES;
  },

  saveResources(resources: CompanyResource[]): void {
    localStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(resources));
  },

  upsertResource(resource: CompanyResource): CompanyResource[] {
    const list = this.getResources();
    const index = list.findIndex(r => r.id === resource.id);
    let updated: CompanyResource[];
    if (index >= 0) {
      updated = [...list];
      updated[index] = resource;
    } else {
      updated = [resource, ...list];
    }
    this.saveResources(updated);
    return updated;
  },

  deleteResource(id: string): CompanyResource[] {
    const list = this.getResources();
    const filtered = list.filter(r => r.id !== id);
    this.saveResources(filtered);
    return filtered;
  },

  // 2. Quản lý phiếu đăng ký tài nguyên
  getBookings(): ResourceBooking[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse bookings from storage:', e);
    }
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(INITIAL_BOOKINGS));
    return INITIAL_BOOKINGS;
  },

  saveBookings(bookings: ResourceBooking[]): void {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(bookings));
  },

  upsertBooking(booking: ResourceBooking): { success: boolean; message: string; bookings: ResourceBooking[] } {
    // Conflict check
    const conflict = this.checkConflict(
      booking.resourceId,
      booking.startDate,
      booking.startTime,
      booking.endDate,
      booking.endTime,
      booking.id
    );

    if (conflict.hasConflict && conflict.conflictingBooking) {
      return {
        success: false,
        message: `Xung đột lịch! Tài nguyên "${booking.resourceName}" đã có lịch đặt từ ${conflict.conflictingBooking.startTime} đến ${conflict.conflictingBooking.endTime} ngày ${conflict.conflictingBooking.startDate} bởi ${conflict.conflictingBooking.registrantName} (Dự án: ${conflict.conflictingBooking.projectName}).`,
        bookings: this.getBookings()
      };
    }

    const list = this.getBookings();
    const index = list.findIndex(b => b.id === booking.id);
    let updated: ResourceBooking[];
    if (index >= 0) {
      updated = [...list];
      updated[index] = { ...booking, updatedAt: new Date().toISOString() };
    } else {
      updated = [booking, ...list];
    }
    this.saveBookings(updated);
    return {
      success: true,
      message: 'Đăng ký sử dụng tài nguyên thành công!',
      bookings: updated
    };
  },

  deleteBooking(id: string): ResourceBooking[] {
    const list = this.getBookings();
    const filtered = list.filter(b => b.id !== id);
    this.saveBookings(filtered);
    return filtered;
  },

  updateBookingStatus(id: string, status: ResourceBooking['status']): ResourceBooking[] {
    const list = this.getBookings();
    const updated = list.map(b => b.id === id ? { ...b, status, updatedAt: new Date().toISOString() } : b);
    this.saveBookings(updated);
    return updated;
  },

  // 3. Kiểm tra xung đột lịch (Conflict Detection)
  checkConflict(
    resourceId: string,
    startDate: string,
    startTime: string,
    endDate: string,
    endTime: string,
    excludeBookingId?: string
  ): { hasConflict: boolean; conflictingBooking?: ResourceBooking } {
    const bookings = this.getBookings();

    const newStart = new Date(`${startDate}T${startTime}:00`).getTime();
    const newEnd = new Date(`${endDate}T${endTime}:00`).getTime();

    for (const b of bookings) {
      if (b.id === excludeBookingId) continue;
      if (b.resourceId !== resourceId) continue;
      if (b.status === 'cancelled') continue;

      const existingStart = new Date(`${b.startDate}T${b.startTime}:00`).getTime();
      const existingEnd = new Date(`${b.endDate}T${b.endTime}:00`).getTime();

      // Check date overlap
      if (newStart < existingEnd && newEnd > existingStart) {
        return {
          hasConflict: true,
          conflictingBooking: b
        };
      }
    }

    return { hasConflict: false };
  },

  // 4. Sinh mã phiếu tự động
  generateBookingCode(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(100 + Math.random() * 900);
    return `ĐKTN-${year}-${random}`;
  },

  // 5. Reset dữ liệu về ban đầu
  resetToDefault(): { resources: CompanyResource[]; bookings: ResourceBooking[] } {
    localStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(INITIAL_RESOURCES));
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(INITIAL_BOOKINGS));
    return {
      resources: INITIAL_RESOURCES,
      bookings: INITIAL_BOOKINGS
    };
  }
};
