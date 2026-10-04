import { ERPData, SystemNotification, Warehouse, GoodsVoucher, DeliveryNote, Product, SalesOrder, Transaction, Employee, Customer, ActivityLog, UserProfile, CompanyUnit } from '../types';

export const initialCompanyUnits: CompanyUnit[] = [
  { id: 'DVCS01', code: 'DVCS01', name: 'Trụ sở chính TP. Hồ Chí Minh', shortName: 'HCMC HO', address: 'Quận 1, TP. Hồ Chí Minh', phone: '028 3822 1111', email: 'ho@erp-enterprise.vn', taxCode: '0301234567', status: 'Hoạt động', isDefault: true },
  { id: 'DVCS02', code: 'DVCS02', name: 'Chi nhánh Hà Nội', shortName: 'HN Branch', address: 'Quận Cầu Giấy, Hà Nội', phone: '024 3755 2222', email: 'hanoi@erp-enterprise.vn', taxCode: '0301234567-001', status: 'Hoạt động', isDefault: false },
  { id: 'DVCS03', code: 'DVCS03', name: 'Chi nhánh Đà Nẵng', shortName: 'DN Branch', address: 'Quận Hải Châu, Đà Nẵng', phone: '0236 3888 333', email: 'danang@erp-enterprise.vn', taxCode: '0301234567-002', status: 'Hoạt động', isDefault: false },
  { id: 'DVCS04', code: 'DVCS04', name: 'Nhà máy Sản xuất Bình Dương', shortName: 'BD Factory', address: 'KCN VSIP 1, Thuận An, Bình Dương', phone: '0274 3766 444', email: 'factory@erp-enterprise.vn', taxCode: '0301234567-003', status: 'Hoạt động', isDefault: false }
];

export const initialWarehouses: Warehouse[] = [
  { id: 'KH001', code: 'KH-HCM-01', name: 'Kho Tổng TP. Hồ Chí Minh', address: 'Quận 9, TP. Thủ Đức, TP.HCM', manager: 'Trần Khoa', capacity: '5,000 m2', status: 'Đang hoạt động' },
  { id: 'KH002', code: 'KH-HN-01', name: 'Kho Chi Nhánh Hà Nội', address: 'KCN Bắc Thăng Long, Đông Anh, Hà Nội', manager: 'Lê Hoàng', capacity: '3,200 m2', status: 'Đang hoạt động' },
  { id: 'KH003', code: 'KH-DN-01', name: 'Kho Trung Luân Miền Trung', address: 'KCN Hòa Khánh, Q. Liên Chiểu, Đà Nẵng', manager: 'Phạm Bình', capacity: '2,000 m2', status: 'Đang hoạt động' }
];

export const initialDeliveryNotes: DeliveryNote[] = [
  { id: 'PGH001', orderId: 'DH001', customerName: 'Công ty TNHH Đầu Tư Công Nghệ Việt', deliveryDate: '2026-05-29', carrier: 'Giao Hàng Nhanh (GHN)', trackingNumber: 'GHN8849201', status: 'Đã giao hàng' },
  { id: 'PGH002', orderId: 'DH002', customerName: 'Tập đoàn Điện tử Viễn Thông Á Châu', deliveryDate: '2026-05-30', carrier: 'Viettel Post', trackingNumber: 'VTP9938102', status: 'Đang giao' }
];

export const initialVouchers: GoodsVoucher[] = [
  {
    id: 'PNK001',
    type: 'Nhập kho',
    code: 'PNK-202605-01',
    date: '2026-05-20',
    createdDate: '2026-05-20',
    companyUnitId: 'DVCS01',
    companyUnitName: 'Trụ sở chính TP. Hồ Chí Minh',
    voucherType: 'Nhập mua mới',
    currencyCode: 'VND',
    exchangeRate: 1,
    supplierName: 'Công ty TNHH LG Electronics Việt Nam',
    delivererName: 'Trần Văn Nam (Nhà xe Fast Express)',
    warehouseId: 'KH001',
    warehouseName: 'Kho Tổng TP. Hồ Chí Minh',
    items: [
      { productId: 'PROD001', productName: 'Laptop Dell XPS 15 Ultra 2026', sku: 'LAP-DELL-XPS15', unit: 'Chiếc', quantity: 15, unitPrice: 28000000, totalPrice: 420000000, lotNumber: 'LÔ-2026-05A', position: 'Kệ A-01' },
      { productId: 'PROD002', productName: 'Màn Hình LG UltraFine 27 inch 4K', sku: 'MON-LG-274K', unit: 'Cái', quantity: 30, unitPrice: 8500000, totalPrice: 255000000, lotNumber: 'LÔ-2026-05B', position: 'Kệ A-05' }
    ],
    materialItems: [
      { productId: 'PROD006', productName: 'Ổ Cứng SSD NVMe Samsung 990 Pro 2TB', sku: 'SSD-SAM-990P', unit: 'Thỏi', quantity: 15, unitPrice: 3100000, totalPrice: 46500000, lotNumber: 'LÔ-NVL-01', position: 'Kệ C-01' }
    ],
    totalValue: 675000000,
    createdBy: 'Trần Thịnh (Admin)',
    approvedBy: 'Trần Thịnh (Admin)',
    status: 'Chuyển sổ kho',
    note: 'Nhập hàng đợt 1 từ nhà cung cấp LG Electronics'
  },
  {
    id: 'PNK002',
    type: 'Nhập kho',
    code: 'PNK-202606-02',
    date: '2026-06-01',
    createdDate: '2026-06-01',
    companyUnitId: 'DVCS02',
    companyUnitName: 'Chi Nhánh Hà Nội',
    voucherType: 'Nhập mua mới',
    currencyCode: 'USD',
    exchangeRate: 25400,
    supplierName: 'Logitech Asia Pacific Ltd',
    delivererName: 'DHL Global Forwarding',
    warehouseId: 'KH002',
    warehouseName: 'Kho Chi Nhánh Hà Nội',
    items: [
      { productId: 'PROD006', productName: 'Ổ Cứng SSD NVMe Samsung 990 Pro 2TB', sku: 'SSD-SAM-990P', unit: 'Thỏi', quantity: 40, unitPrice: 3100000, totalPrice: 124000000, lotNumber: 'LÔ-2026-06A', position: 'Kệ C-05' },
      { productId: 'PROD009', productName: 'Webcam 4K UltraHD Logitech Brio', sku: 'CAM-LOG-BRIO4K', unit: 'Chiếc', quantity: 20, unitPrice: 3700000, totalPrice: 74000000, lotNumber: 'LÔ-2026-06B', position: 'Kệ B-05' }
    ],
    materialItems: [],
    totalValue: 198000000,
    createdBy: 'Phạm Quốc Bảo',
    status: 'Chờ duyệt',
    note: 'Nhập kho thiết bị tin học đợt đầu tháng 6 (Nhập khẩu thanh toán USD)'
  },
  {
    id: 'PNK003',
    type: 'Nhập kho',
    code: 'PNK-202606-03',
    date: '2026-06-03',
    createdDate: '2026-06-03',
    companyUnitId: 'DVCS01',
    companyUnitName: 'Trụ sở chính TP. Hồ Chí Minh',
    voucherType: 'Nhập điều chuyển nội bộ',
    currencyCode: 'VND',
    exchangeRate: 1,
    supplierName: 'Kho Trung Luân Miền Trung',
    delivererName: 'Đội xe nội bộ ERP',
    warehouseId: 'KH001',
    warehouseName: 'Kho Tổng TP. Hồ Chí Minh',
    items: [
      { productId: 'PROD008', productName: 'Router Wi-Fi 6 Mesh Asus ZenWiFi AX', sku: 'NET-ASUS-AX6000', unit: 'Bộ', quantity: 15, unitPrice: 5200000, totalPrice: 78000000, position: 'Kệ D-04' }
    ],
    materialItems: [],
    totalValue: 78000000,
    createdBy: 'Nguyễn Văn Minh',
    status: 'Lập chứng từ',
    note: 'Nhập kho điều chuyển từ Kho Miền Trung'
  },
  {
    id: 'PXK001',
    type: 'Xuất kho',
    code: 'PXK-202605-02',
    date: '2026-05-28',
    createdDate: '2026-05-28',
    companyUnitId: 'DVCS01',
    companyUnitName: 'Trụ sở chính TP. Hồ Chí Minh',
    voucherType: 'Xuất bán hàng',
    warehouseId: 'KH001',
    warehouseName: 'Kho Tổng TP. Hồ Chí Minh',
    items: [
      { productId: 'PROD003', productName: 'Bàn Phím Cơ Keychron K8 Pro Wireless', sku: 'KEY-KC-K8PRO', unit: 'Cái', quantity: 10, unitPrice: 1800000, totalPrice: 18000000 }
    ],
    totalValue: 18000000,
    createdBy: 'Trần Thịnh (Admin)',
    approvedBy: 'Trần Thịnh (Admin)',
    status: 'Chuyển sổ kho',
    note: 'Xuất giao đơn hàng DH001'
  }
];

export const initialNotifications: SystemNotification[] = [
  {
    id: 'NOTIF001',
    title: 'Cảnh báo tồn kho tối thiểu!',
    message: 'Mặt hàng Chuột Logitech MX Master 3S còn lại 3 chiếc (dưới ngưỡng 5 chiếc). Vui lòng lập phiếu nhập kho gấp.',
    time: '10 phút trước',
    type: 'danger',
    read: false,
    linkModule: 'inventory'
  },
  {
    id: 'NOTIF002',
    title: 'Đơn hàng mới tạo',
    message: 'Khách hàng Công ty TNHH Đầu Tư Công Nghệ Việt vừa phát sinh đơn hàng DH003 trị giá 85.000.000 đ.',
    time: '45 phút trước',
    type: 'info',
    read: false,
    linkModule: 'sales'
  },
  {
    id: 'NOTIF003',
    title: 'Phát sinh phiếu thu',
    message: 'Hệ thống đã ghi sổ phiếu thu 120.000.000 đ từ thanh toán hợp đồng dịch vụ tư vấn.',
    time: '2 giờ trước',
    type: 'success',
    read: true,
    linkModule: 'finance'
  }
];

export const initialProducts: Product[] = [
  { id: 'PROD001', name: 'Laptop Dell XPS 15 Ultra 2026', sku: 'LAP-DELL-XPS15', category: 'Thiết bị Điện tử', quantity: 24, price: 35000000, costPrice: 28000000, unit: 'Chiếc', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minThreshold: 5, position: 'Kệ A-01' },
  { id: 'PROD002', name: 'Màn Hình LG UltraFine 27 inch 4K', sku: 'MON-LG-274K', category: 'Thiết bị Điện tử', quantity: 42, price: 11500000, costPrice: 8500000, unit: 'Chiếc', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minThreshold: 8, position: 'Kệ A-04' },
  { id: 'PROD003', name: 'Bàn Phím Cơ Keychron K8 Pro Wireless', sku: 'KB-KEY-K8PRO', category: 'Phụ kiện máy tính', quantity: 85, price: 2450000, costPrice: 1800000, unit: 'Chiếc', warehouseId: 'KH002', warehouseName: 'Kho Chi Nhánh Hà Nội', minThreshold: 15, position: 'Kệ B-02' },
  { id: 'PROD004', name: 'Chuột Logitech MX Master 3S Wireless', sku: 'MOU-LOG-MX3S', category: 'Phụ kiện máy tính', quantity: 3, price: 2890000, costPrice: 2100000, unit: 'Chiếc', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minThreshold: 5, position: 'Kệ B-03' },
  { id: 'PROD005', name: 'Tai Nghe Sony WH-1000XM5 ANC', sku: 'AUD-SNY-XM5', category: 'Thiết bị Âm thanh', quantity: 18, price: 7990000, costPrice: 6200000, unit: 'Cái', warehouseId: 'KH003', warehouseName: 'Kho Trung Luân Miền Trung', minThreshold: 6, position: 'Kệ C-01' },
  { id: 'PROD006', name: 'Ổ Cứng SSD NVMe Samsung 990 Pro 2TB', sku: 'SSD-SAM-990P', category: 'Linh kiện phần cứng', quantity: 50, price: 4200000, costPrice: 3100000, unit: 'Thỏi', warehouseId: 'KH002', warehouseName: 'Kho Chi Nhánh Hà Nội', minThreshold: 10, position: 'Kệ C-05' },
  { id: 'PROD007', name: 'Bàn Làm Việc Ergonomic Nâng Hạ Tự Động', sku: 'FURN-DESK-ERGO', category: 'Nội thất Văn phòng', quantity: 8, price: 8500000, costPrice: 6000000, unit: 'Bộ', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minThreshold: 2, position: 'Kệ D-01' },
  { id: 'PROD008', name: 'Router Wi-Fi 6 Mesh Asus ZenWiFi AX', sku: 'NET-ASUS-AX6000', category: 'Thiết bị Mạng', quantity: 30, price: 6800000, costPrice: 5200000, unit: 'Bộ', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minThreshold: 5, position: 'Kệ D-04' },
  { id: 'PROD009', name: 'Webcam 4K UltraHD Logitech Brio', sku: 'CAM-LOG-BRIO4K', category: 'Phụ kiện máy tính', quantity: 22, price: 4900000, costPrice: 3700000, unit: 'Chiếc', warehouseId: 'KH002', warehouseName: 'Kho Chi Nhánh Hà Nội', minThreshold: 4, position: 'Kệ B-05' },
  { id: 'PROD010', name: 'Ghế Công Thức Học Ergonomic Herman Miller', sku: 'FURN-CHAIR-HM', category: 'Nội thất Văn phòng', quantity: 6, price: 26500000, costPrice: 21000000, unit: 'Chiếc', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minThreshold: 2, position: 'Kệ E-01' }
];

export const initialOrders: SalesOrder[] = [
  {
    id: 'DH001',
    customerName: 'Công ty TNHH Đầu Tư Công Nghệ Việt',
    customerPhone: '0908123456',
    date: '2026-05-28',
    items: [
      { productId: 'PROD001', productName: 'Laptop Dell XPS 15 Ultra 2026', quantity: 2, price: 35000000 },
      { productId: 'PROD003', productName: 'Bàn Phím Cơ Keychron K8 Pro Wireless', quantity: 5, price: 2450000 }
    ],
    totalAmount: 82250000,
    status: 'Hoàn thành',
    paymentMethod: 'Chuyển khoản',
    deliveryNoteId: 'PGH001'
  },
  {
    id: 'DH002',
    customerName: 'Tập đoàn Điện tử Viễn Thông Á Châu',
    customerPhone: '0912987654',
    date: '2026-05-29',
    items: [
      { productId: 'PROD002', productName: 'Màn Hình LG UltraFine 27 inch 4K', quantity: 4, price: 11500000 },
      { productId: 'PROD006', productName: 'Ổ Cứng SSD NVMe Samsung 990 Pro 2TB', quantity: 10, price: 4200000 }
    ],
    totalAmount: 88000000,
    status: 'Đang xử lý',
    paymentMethod: 'Chuyển khoản',
    deliveryNoteId: 'PGH002'
  },
  {
    id: 'DH003',
    customerName: 'Viện Nghiên Cứu & Phát Triển Phần Mềm',
    customerPhone: '0983555777',
    date: '2026-05-30',
    items: [
      { productId: 'PROD005', productName: 'Tai Nghe Sony WH-1000XM5 ANC', quantity: 3, price: 7990000 }
    ],
    totalAmount: 23970000,
    status: 'Đang xử lý',
    paymentMethod: 'Tiền mặt'
  },
  {
    id: 'DH004',
    customerName: 'Công ty Cổ Phần Giải Pháp Phần Mềm Toàn Cầu',
    customerPhone: '0938112233',
    date: '2026-06-01',
    items: [
      { productId: 'PROD001', productName: 'Laptop Dell XPS 15 Ultra 2026', quantity: 3, price: 35000000 },
      { productId: 'PROD010', productName: 'Ghế Công Thức Học Ergonomic Herman Miller', quantity: 2, price: 26500000 }
    ],
    totalAmount: 158000000,
    status: 'Hoàn thành',
    paymentMethod: 'Chuyển khoản'
  },
  {
    id: 'DH005',
    customerName: 'Ngân Hàng TMCP Ngoại Thương Chi Nhánh Nam Sài Gòn',
    customerPhone: '0977889900',
    date: '2026-06-02',
    items: [
      { productId: 'PROD008', productName: 'Router Wi-Fi 6 Mesh Asus ZenWiFi AX', quantity: 5, price: 6800000 },
      { productId: 'PROD009', productName: 'Webcam 4K UltraHD Logitech Brio', quantity: 4, price: 4900000 }
    ],
    totalAmount: 53600000,
    status: 'Chờ xử lý',
    paymentMethod: 'Chuyển khoản'
  }
];

export const initialEmployees: Employee[] = [
  { id: 'NV001', name: 'Trần Thịnh', department: 'Ban Giám Đốc', role: 'Giám đốc Điều hành (CEO)', email: 'thinh.tran@erp-enterprise.vn', phone: '0901112233', salary: 45000000, status: 'Chính thức', hireDate: '2022-01-15' },
  { id: 'NV002', name: 'Nguyễn Văn Minh', department: 'Kỹ thuật', role: 'Kỹ sư Trưởng Hệ thống', email: 'minh.nguyen@erp-enterprise.vn', phone: '0902223344', salary: 32000000, status: 'Chính thức', hireDate: '2022-04-01' },
  { id: 'NV003', name: 'Lê Thị Thu Thảo', department: 'Kế toán', role: 'Kế toán Trưởng', email: 'thao.le@erp-enterprise.vn', phone: '0903334455', salary: 28000000, status: 'Chính thức', hireDate: '2023-02-10' },
  { id: 'NV004', name: 'Phạm Quốc Bảo', department: 'Kho vận', role: 'Quản lý Kho Tổng', email: 'bao.pham@erp-enterprise.vn', phone: '0904445566', salary: 22000000, status: 'Chính thức', hireDate: '2023-08-20' },
  { id: 'NV005', name: 'Vũ Ngọc Khánh', department: 'Nhân sự', role: 'Trưởng Phòng HR', email: 'khanh.vu@erp-enterprise.vn', phone: '0905556677', salary: 25000000, status: 'Nghỉ phép', hireDate: '2024-03-05' },
  { id: 'NV006', name: 'Phạm Hương Lan', department: 'Kế toán', role: 'Kế Toán Viên', email: 'lan.pham@erp-enterprise.vn', phone: '0906661122', salary: 18000000, status: 'Chính thức', hireDate: '2024-05-10' },
  { id: 'NV007', name: 'Đặng Quốc Hùng', department: 'Kho vận', role: 'Thủ Kho Chi Nhánh', email: 'hung.dang@erp-enterprise.vn', phone: '0907772233', salary: 16500000, status: 'Chính thức', hireDate: '2024-06-01' },
  { id: 'NV008', name: 'Trịnh Tuyết Mai', department: 'Nhân sự', role: 'Chuyên Viên HR', email: 'mai.trinh@erp-enterprise.vn', phone: '0908883344', salary: 16000000, status: 'Chính thức', hireDate: '2024-07-15' }
];

export const initialCustomers: Customer[] = [
  { id: 'KH-CUST01', name: 'Trần Minh Hoàng', company: 'Công ty TNHH Đầu Tư Công Nghệ Việt', email: 'hoang.tran@viettech.com', phone: '0908123456', totalSpent: 285000000, lastPurchaseDate: '2026-05-28' },
  { id: 'KH-CUST02', name: 'Phan Anh Dũng', company: 'Tập đoàn Điện tử Viễn Thông Á Châu', email: 'dung.phan@asiatel.vn', phone: '0912987654', totalSpent: 412000000, lastPurchaseDate: '2026-05-29' },
  { id: 'KH-CUST03', name: 'Nguyễn Thị Hồng', company: 'Viện Nghiên Cứu & Phát Triển Phần Mềm', email: 'hong.nguyen@sw-institute.org', phone: '0983555777', totalSpent: 98000000, lastPurchaseDate: '2026-05-30' },
  { id: 'KH-CUST04', name: 'Lê Hoàng Nam', company: 'Công ty Cổ Phần Giải Pháp Phần Mềm Toàn Cầu', email: 'nam.le@globalsolutions.vn', phone: '0938112233', totalSpent: 158000000, lastPurchaseDate: '2026-06-01' },
  { id: 'KH-CUST05', name: 'Trần Thị Thu Hà', company: 'Ngân Hàng TMCP Ngoại Thương Chi Nhánh Nam Sài Gòn', email: 'ha.ttt@vietcombank.com.vn', phone: '0977889900', totalSpent: 215000000, lastPurchaseDate: '2026-06-02' }
];

export const initialTransactions: Transaction[] = [
  { id: 'TX001', type: 'Thu', category: 'Doanh thu đơn hàng', amount: 82250000, date: '2026-05-28', description: 'Thu tiền chuyển khoản thanh toán đơn hàng DH001', refId: 'DH001', account: 'Ngân hàng VCB' },
  { id: 'TX002', type: 'Chi', category: 'Nhập kho hàng', amount: 675000000, date: '2026-05-20', description: 'Chi chuyển khoản cho LG Electronics theo phiếu PNK001', refId: 'PNK001', account: 'Ngân hàng TCB' },
  { id: 'TX003', type: 'Chi', category: 'Chi trả lương', amount: 152000000, date: '2026-05-25', description: 'Chi trả quỹ lương toàn bộ cán bộ công nhân viên Tháng 5', refId: 'BANG-LUONG-T05', account: 'Ngân hàng VCB' },
  { id: 'TX004', type: 'Chi', category: 'Chi thuê văn phòng', amount: 45000000, date: '2026-05-01', description: 'Thanh toán tiền mặt thuê mặt bằng trụ sở chính', refId: 'HD-THUE-05', account: 'Tiền mặt' },
  { id: 'TX005', type: 'Thu', category: 'Doanh thu đơn hàng', amount: 158000000, date: '2026-06-01', description: 'Thu tiền chuyển khoản thanh toán đơn hàng DH004', refId: 'DH004', account: 'Ngân hàng VCB' }
];

export const initialActivities: ActivityLog[] = [
  { id: 'ACT001', timestamp: '2026-05-30 09:15', user: 'Trần Thịnh (Admin)', action: 'Đăng nhập hệ thống S-ERP thành công từ địa chỉ IP 118.69.15.22', module: 'Tổng quan' },
  { id: 'ACT002', timestamp: '2026-05-29 14:30', user: 'Trần Thịnh (Admin)', action: 'Lập phiếu xuất kho PXK-202605-02 và phiếu giao hàng PGH002 cho đơn hàng DH002', module: 'Kho hàng' },
  { id: 'ACT003', timestamp: '2026-05-28 16:45', user: 'Trần Thịnh (Admin)', action: 'Xác nhận thu đủ tiền chuyển khoản đơn hàng DH001 số tiền 82.250.000 đ', module: 'Tài chính' }
];

export const initialUsers: UserProfile[] = [
  {
    id: 'USR001',
    username: 'admin',
    password: 'admin',
    fullName: 'Trần Thịnh (Admin)',
    email: 'admin@erp-enterprise.vn',
    role: 'Giám đốc Điều hành (CEO)',
    department: 'Ban Giám Đốc',
    phone: '0901112233',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    themePref: 'light',
    notificationsEnabled: true,
    isSystemAdmin: true
  },
  {
    id: 'USR002',
    username: 'minh.nguyen',
    password: '123',
    fullName: 'Nguyễn Văn Minh (Thủ Kho & Kế Toán)',
    email: 'minh.nguyen@erp-enterprise.vn',
    role: 'Chuyên viên Kho & Kế Toán Quỹ',
    department: 'Phòng Kế Toán - Kho Vận',
    phone: '0902223344',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    themePref: 'light',
    notificationsEnabled: true,
    isSystemAdmin: false,
    permissions: {
      overview_main: true,
      inv_company_unit_cat: true,
      inv_material_cat: true,
      inv_material_type_cat: true,
      inv_uom_cat: true,
      inv_uom_conversion_cat: true,
      inv_stock_norm_cat: true,
      inv_lot_cat: true,
      inv_location_cat: true,
      inv_warehouse_cat: true,
      inv_warehouse_type_cat: true,
      inv_receipt: true,
      inv_issue: true,
      inv_report_stock: true,
      inv_report_nxt: true,
      sales_customers: true,
      sales_orders: true,
      sales_delivery: true,
      sales_report: false,
      fin_categories: true,
      fin_receipt_voucher: true,
      fin_payment_voucher: true,
      fin_report: true,
      hr_list: true,
      hr_payroll: false,
      hr_report: false,
      reports_main: true,
      ai_main: true,
      settings_main: false
    }
  },
  {
    id: 'USR003',
    username: 'thao.le',
    password: '123',
    fullName: 'Lê Thị Thu Thảo (Kinh Doanh & CRM)',
    email: 'thao.le@erp-enterprise.vn',
    role: 'Nhân Viên Kinh Doanh (Sales Executive)',
    roleId: 'ROLE_SALES_EXEC',
    department: 'Phòng Kinh Doanh',
    phone: '0903334455',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    themePref: 'light',
    notificationsEnabled: true,
    isSystemAdmin: false,
    permissions: {
      overview_main: true,
      inv_company_unit_cat: true,
      inv_material_cat: true,
      inv_material_type_cat: true,
      inv_uom_cat: true,
      inv_uom_conversion_cat: false,
      inv_stock_norm_cat: false,
      inv_lot_cat: false,
      inv_location_cat: false,
      inv_warehouse_cat: false,
      inv_warehouse_type_cat: false,
      inv_receipt: false,
      inv_issue: false,
      inv_report_stock: true,
      inv_report_nxt: false,
      sales_customers: true,
      sales_orders: true,
      sales_delivery: true,
      sales_report: true,
      fin_categories: false,
      fin_receipt_voucher: false,
      fin_payment_voucher: false,
      fin_report: false,
      hr_list: true,
      hr_payroll: false,
      hr_report: false,
      reports_main: false,
      ai_main: true,
      settings_main: false
    }
  },
  {
    id: 'USR004',
    username: 'lan.pham',
    password: '123',
    fullName: 'Phạm Hương Lan (Kế Toán Trưởng)',
    email: 'lan.pham@erp-enterprise.vn',
    role: 'Kế Toán Trưởng (Chief Accountant)',
    roleId: 'ROLE_CHIEF_ACCOUNTANT',
    department: 'Phòng Kế Toán',
    phone: '0904445566',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    themePref: 'light',
    notificationsEnabled: true,
    isSystemAdmin: false,
    permissions: {
      overview_main: true,
      inv_company_unit_cat: true,
      inv_material_cat: true,
      inv_material_type_cat: true,
      inv_uom_cat: true,
      inv_uom_conversion_cat: true,
      inv_stock_norm_cat: true,
      inv_lot_cat: true,
      inv_location_cat: true,
      inv_warehouse_cat: true,
      inv_warehouse_type_cat: true,
      inv_receipt: true,
      inv_issue: true,
      inv_report_stock: true,
      inv_report_nxt: true,
      sales_customers: true,
      sales_orders: true,
      sales_delivery: true,
      sales_report: true,
      fin_categories: true,
      fin_receipt_voucher: true,
      fin_payment_voucher: true,
      fin_report: true,
      hr_list: true,
      hr_payroll: true,
      hr_report: true,
      reports_main: true,
      ai_main: true,
      settings_main: false
    }
  },
  {
    id: 'USR005',
    username: 'hung.dang',
    password: '123',
    fullName: 'Đặng Quốc Hùng (Thủ Kho)',
    email: 'hung.dang@erp-enterprise.vn',
    role: 'Thủ Kho (Warehouse Master)',
    roleId: 'ROLE_WAREHOUSE_MASTER',
    department: 'Phòng Kho Vận',
    phone: '0905556677',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    themePref: 'light',
    notificationsEnabled: true,
    isSystemAdmin: false,
    permissions: {
      overview_main: true,
      inv_company_unit_cat: true,
      inv_material_cat: true,
      inv_material_type_cat: true,
      inv_uom_cat: true,
      inv_uom_conversion_cat: true,
      inv_stock_norm_cat: true,
      inv_lot_cat: true,
      inv_location_cat: true,
      inv_warehouse_cat: true,
      inv_warehouse_type_cat: true,
      inv_receipt: true,
      inv_issue: true,
      inv_report_stock: true,
      inv_report_nxt: true,
      sales_customers: false,
      sales_orders: false,
      sales_delivery: true,
      sales_report: false,
      fin_categories: false,
      fin_receipt_voucher: false,
      fin_payment_voucher: false,
      fin_report: false,
      hr_list: false,
      hr_payroll: false,
      hr_report: false,
      reports_main: true,
      ai_main: true,
      settings_main: false
    }
  },
  {
    id: 'USR006',
    username: 'mai.trinh',
    password: '123',
    fullName: 'Trịnh Tuyết Mai (Chuyên Viên HR)',
    email: 'mai.trinh@erp-enterprise.vn',
    role: 'Chuyên Viên Nhân Sự (HR Specialist)',
    roleId: 'ROLE_HR_OFFICER',
    department: 'Phòng Nhân Sự',
    phone: '0906667788',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    themePref: 'light',
    notificationsEnabled: true,
    isSystemAdmin: false,
    permissions: {
      overview_main: true,
      inv_company_unit_cat: false,
      inv_material_cat: false,
      inv_material_type_cat: false,
      inv_uom_cat: false,
      inv_uom_conversion_cat: false,
      inv_stock_norm_cat: false,
      inv_lot_cat: false,
      inv_location_cat: false,
      inv_warehouse_cat: false,
      inv_warehouse_type_cat: false,
      inv_receipt: false,
      inv_issue: false,
      inv_report_stock: false,
      inv_report_nxt: false,
      sales_customers: false,
      sales_orders: false,
      sales_delivery: false,
      sales_report: false,
      fin_categories: false,
      fin_receipt_voucher: false,
      fin_payment_voucher: false,
      fin_report: false,
      hr_list: true,
      hr_payroll: true,
      hr_report: true,
      reports_main: true,
      ai_main: true,
      settings_main: false
    }
  }
];

export const initialMaterialTypes: any[] = [
  { id: 'MT001', code: 'NVL', name: 'Nguyên vật liệu chính', group: 'Vật tư sản xuất', description: 'Thép, Nhôm, Linh kiện vi mạch bán thành phẩm', status: 'Hoạt động' },
  { id: 'MT002', code: 'LKC', name: 'Linh kiện điện tử', group: 'Phụ kiện & Linh kiện', description: 'Màn hình, Chip, RAM, Ổ cứng', status: 'Hoạt động' },
  { id: 'MT003', code: 'BTP', name: 'Bán thành phẩm', group: 'Vật tư sản xuất', description: 'Cụm bo mạch đã lắp ráp', status: 'Hoạt động' },
  { id: 'MT004', code: 'TP', name: 'Thành phẩm hoàn chỉnh', group: 'Sản phẩm thương mại', description: 'Laptop, Màn hình, Bàn phím hoàn chỉnh', status: 'Hoạt động' },
  { id: 'MT005', code: 'CCDC', name: 'Công cụ dụng cụ & Vật tư phụ', group: 'Vật tư phụ', description: 'Thùng carton, Nhãn mác, Dụng cụ đóng gói', status: 'Hoạt động' }
];

export const initialUnitsOfMeasure: any[] = [
  { id: 'UOM001', code: 'CAI', name: 'Cái', symbol: 'cái', note: 'Đơn vị đếm tiêu chuẩn', status: 'Hoạt động' },
  { id: 'UOM002', code: 'CHIEC', name: 'Chiếc', symbol: 'chiếc', note: 'Dùng cho thiết bị điện tử hoàn chỉnh', status: 'Hoạt động' },
  { id: 'UOM003', code: 'THUNG', name: 'Thùng', symbol: 'thùng', note: 'Quy cách đóng gói xuất nhập kho lớn', status: 'Hoạt động' },
  { id: 'UOM004', code: 'HOP', name: 'Hộp', symbol: 'hộp', note: 'Đóng gói quy cách vừa', status: 'Hoạt động' },
  { id: 'UOM005', code: 'BO', name: 'Bộ', symbol: 'bộ', note: 'Bộ phụ kiện đi kèm', status: 'Hoạt động' },
  { id: 'UOM006', code: 'KG', name: 'Kilogram', symbol: 'kg', note: 'Đơn vị cân khối lượng', status: 'Hoạt động' },
  { id: 'UOM007', code: 'MET', name: 'Mét', symbol: 'm', Note: 'Đơn vị đo chiều dài cuộn cáp', status: 'Hoạt động' }
];

export const initialStockNorms: any[] = [
  { id: 'NORM001', code: 'ĐM-PROD001-KH001', materialId: 'PROD001', materialName: 'Laptop Dell XPS 15 Ultra 2026', materialSku: 'LAP-DELL-XPS15', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minQuantity: 5, maxQuantity: 50, safetyStock: 10, reorderPoint: 8, status: 'Bình thường' },
  { id: 'NORM002', code: 'ĐM-PROD004-KH001', materialId: 'PROD004', materialName: 'Chuột Logitech MX Master 3S Wireless', materialSku: 'MOU-LOG-MX3S', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', minQuantity: 10, maxQuantity: 100, safetyStock: 15, reorderPoint: 12, status: 'Thiếu hàng' },
  { id: 'NORM003', code: 'ĐM-PROD003-KH002', materialId: 'PROD003', materialName: 'Bàn Phím Cơ Keychron K8 Pro Wireless', materialSku: 'KB-KEY-K8PRO', warehouseId: 'KH002', warehouseName: 'Kho Chi Nhánh Hà Nội', minQuantity: 15, maxQuantity: 120, safetyStock: 25, reorderPoint: 20, status: 'Bình thường' }
];

export const initialLots: any[] = [
  { id: 'LOT001', lotNumber: 'LÔ-2026-05A', materialId: 'PROD001', materialName: 'Laptop Dell XPS 15 Ultra 2026', mfgDate: '2026-05-01', expDate: '2028-05-01', initialQuantity: 30, currentQuantity: 24, qualityStatus: 'Đạt chuẩn', supplierName: 'Dell Vietnam Co., Ltd' },
  { id: 'LOT002', lotNumber: 'LÔ-2026-05B', materialId: 'PROD002', materialName: 'Màn Hình LG UltraFine 27 inch 4K', mfgDate: '2026-05-10', expDate: '2029-05-10', initialQuantity: 50, currentQuantity: 42, qualityStatus: 'Đạt chuẩn', supplierName: 'LG Electronics' },
  { id: 'LOT003', lotNumber: 'LÔ-2026-04C', materialId: 'PROD004', materialName: 'Chuột Logitech MX Master 3S Wireless', mfgDate: '2026-04-15', expDate: '2027-04-15', initialQuantity: 20, currentQuantity: 3, qualityStatus: 'Cảnh báo hạn', supplierName: 'Logitech Asia' }
];

export const initialStorageLocations: any[] = [
  { id: 'LOC001', code: 'VT-A1-T1', name: 'Kệ A1 - Tầng 1 (Khu Điện tử)', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', zone: 'Khu A', rack: 'A1', shelf: 'Tầng 1', capacity: 100, currentOccupancy: 24, status: 'Còn chỗ' },
  { id: 'LOC002', code: 'VT-A1-T4', name: 'Kệ A1 - Tầng 4 (Khu Màn hình)', warehouseId: 'KH001', warehouseName: 'Kho Tổng TP. Hồ Chí Minh', zone: 'Khu A', rack: 'A1', shelf: 'Tầng 4', capacity: 80, currentOccupancy: 42, status: 'Còn chỗ' },
  { id: 'LOC003', code: 'VT-B2-T2', name: 'Kệ B2 - Tầng 2 (Khu Phụ kiện HN)', warehouseId: 'KH002', warehouseName: 'Kho Chi Nhánh Hà Nội', zone: 'Khu B', rack: 'B2', shelf: 'Tầng 2', capacity: 150, currentOccupancy: 85, status: 'Còn chỗ' },
  { id: 'LOC004', code: 'VT-C1-T1', name: 'Kệ C1 - Tầng 1 (Kho Đà Nẵng)', warehouseId: 'KH003', warehouseName: 'Kho Trung Luân Miền Trung', zone: 'Khu C', rack: 'C1', shelf: 'Tầng 1', capacity: 50, currentOccupancy: 18, status: 'Còn chỗ' }
];

export const getInitialERPData = (): ERPData => {
  const data: ERPData = {
    companyUnits: initialCompanyUnits,
    warehouses: initialWarehouses,
    products: initialProducts,
    materialTypes: initialMaterialTypes,
    unitsOfMeasure: initialUnitsOfMeasure,
    stockNorms: initialStockNorms,
    lots: initialLots,
    storageLocations: initialStorageLocations,
    orders: initialOrders,
    deliveryNotes: initialDeliveryNotes,
    vouchers: initialVouchers,
    employees: initialEmployees,
    customers: initialCustomers,
    transactions: initialTransactions,
    activities: initialActivities,
    notifications: initialNotifications,
    users: initialUsers
  };
  return JSON.parse(JSON.stringify(data));
};

export const initialERPData: ERPData = getInitialERPData();
