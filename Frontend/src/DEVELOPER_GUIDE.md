# 📘 HƯỚNG DẪN PHÁT TRIỂN & ĐÓNG GÓI CHỨC NĂNG MỚI (DEVELOPER GUIDE)

Tài liệu này hướng dẫn bạn cách **tự nhân bản (copy-paste)** và phát triển thêm bất kỳ chức năng nào trong hệ thống S-ERP một cách nhanh chóng, đồng bộ và đúng kiến trúc chuẩn doanh nghiệp.

---

## 🏗️ 1. Kiến Trúc Cấu Trúc File & Đóng Gói (Modular Architecture)

Mỗi chức năng (feature) trong S-ERP được đóng gói theo dạng **Self-contained Feature Package** (Gói tính năng độc lập):

```
src/modules/[module-name]/[feature-name]/
├── [Feature]View.tsx    # Giao diện chính (Header Toolbar + Bộ lọc nâng cao + Bảng GridView + Modal Thêm/Sửa + Modal Xóa)
├── types.ts             # Kiểu dữ liệu TypeScript (Entity Model, FilterCriteria, FormData)
├── index.ts             # Export barrel giúp import gọn gàng: import { FeatureView } from './[feature-name]'
└── README.md            # Tài liệu ghi chú (tùy chọn)
```

### Ưu điểm của cấu trúc này:
1. **Dễ copy:** Chỉ cần copy 1 thư mục là có ngay 1 chức năng hoàn chỉnh.
2. **Không phân tán:** Logic, Modal, Bảng, Bộ lọc nằm chung trong 1 thư mục, không phải tìm kiếm rải rác.
3. **Độc lập:** Sửa chức năng này không làm ảnh hưởng đến chức năng khác.

---

## 📦 2. Hai Bộ Template Đóng Gói Sẵn Có Để Bạn Copy

Hệ thống đã chuẩn bị sẵn 2 thư mục mẫu hoàn chỉnh tại `src/modules/_templates/`:

| Thư mục mẫu | Nghiệp vụ phù hợp | Các tính năng đã tích hợp sẵn |
| :--- | :--- | :--- |
| **`category-feature-template/`** | Khai báo Danh mục Master Data (Nhà cung cấp, Dự án, Xe, Hợp đồng, Tài sản...) | • Header Toolbar (Đếm số lượng, Nạp lại, Xuất/Nhập Excel, Thêm mới)<br>• Bộ lọc nâng cao đóng/mở chuẩn màu sáng/tối<br>• Lưới GridView phân trang, tìm kiếm, sắp xếp<br>• Modal Thêm/Sửa có validation<br>• Modal xác nhận xóa an toàn<br>• Phân quyền CRUD theo vai trò người dùng |
| **`voucher-feature-template/`** | Chứng từ giao dịch Master-Detail (Hóa đơn, Phiếu đặt hàng, Đề nghị thanh toán, Phiếu thu/chi...) | • Danh sách chứng từ GridView<br>• Trạng thái (Lập phiếu, Chờ duyệt, Đã duyệt, Hủy)<br>• Modal lập chứng từ gồm Thông tin chung + Lưới chi tiết hàng hóa tự tính thành tiền<br>• Chức năng phê duyệt chứng từ |

---

## 🚀 3. Quy Trình 4 Bước Tạo Chức Năng Mới Bằng Cách Copy

Giả sử bạn muốn tạo chức năng mới: **"Danh Mục Nhà Cung Cấp"** (`suppliers`).

### 🔹 BƯỚC 1: Sao chép thư mục template
Copy toàn bộ thư mục `src/modules/_templates/category-feature-template/` sang module mong muốn:
```
src/modules/inventory/suppliers/
├── SupplierCategoryView.tsx   (đổi tên từ CategoryFeatureView.tsx)
├── types.ts
├── index.ts
└── README.md
```

### 🔹 BƯỚC 2: Tùy biến kiểu dữ liệu và giao diện
1. Mở `src/modules/inventory/suppliers/types.ts`:
   - Đổi tên interface thành `Supplier` hoặc giữ `SupplierItemModel`.
   - Bổ sung các trường cần thiết: `phone`, `taxCode`, `address`, `email`.
2. Mở `SupplierCategoryView.tsx`:
   - Đổi tên Component thành `SupplierCategoryView`.
   - Cập nhật tiêu đề tại `CategoryHeaderToolbar`: `title="Khai Báo Danh Mục Nhà Cung Cấp"`.
   - Khai báo các cột trong `columns: GridViewColumn<Supplier>[]` (ví dụ thêm cột Mã số thuế, Số điện thoại).
   - Thêm các ô nhập liệu tương ứng trong `<form>` của Modal Thêm/Sửa.
3. Mở `index.ts`:
   ```typescript
   export * from './SupplierCategoryView';
   export * from './types';
   ```

### 🔹 BƯỚC 3: Đăng ký Menu & Phân Quyền
1. Mở `src/types/index.ts`, thêm mã định danh menu mới vào `SubMenuKey`:
   ```typescript
   export type SubMenuKey =
     | 'overview_main'
     | 'inv_material_cat'
     // ... các menu hiện có ...
     | 'inv_supplier_cat'; // <-- Thêm mã menu mới tại đây
   ```
2. Mở `src/config/functions.ts`, thêm một dòng (đường dẫn, nhãn, loại chức năng). Route, tiêu đề và ma trận phân quyền tự lấy từ đây; thiếu dòng này TypeScript báo lỗi:
   ```typescript
   inv_supplier_cat: fn('inventory', '/inventory/suppliers', 'Nhà cung cấp', 'catalog'),
   ```
3. Mở `src/mock/initialMenuData.ts`, khai báo mục hiển thị trên cây Menu:
   ```typescript
   {
     id: 'ITEM_INV_SUPPLIERS',
     subKey: 'inv_supplier_cat',
     titleVi: 'Danh Mục Nhà Cung Cấp',
     titleEn: 'Suppliers Category',
     icon: 'Truck', // Tên icon Lucide, phải có trong components/common/DynamicIcon.tsx
     orderNo: 90,
     isActive: true
   }
   ```
4. Backend: thêm mã vào `ServerService/Core.Application/Common/Permissions/FunctionCatalog.cs` (xem README gốc, mục "Thêm một chức năng mới").

> Danh mục có dữ liệu thật trên backend: copy `src/modules/settings/DepartmentCategoryView.tsx` (dùng hook `useCatalog`) thay cho template dữ liệu mẫu.

### 🔹 BƯỚC 4: Hiển thị Component trong Module cha
Mở `src/modules/inventory/InventoryModule.tsx`:
1. Import Component mới:
   ```typescript
   import { SupplierCategoryView } from './suppliers';
   ```
2. Thêm trường hợp trong `switch (subKey)`:
   ```typescript
   case 'inv_supplier_cat':
     return <SupplierCategoryView currentUser={currentUser} subKey={subKey} />;
   ```

🎉 **XONG!** Chức năng mới đã hoạt động hoàn hảo với đầy đủ menu, điều hướng router, bộ lọc, bảng dữ liệu, modal thêm/sửa/xóa và phân quyền!

---

## 🧩 4. Các Khối Giao Diện Dùng Chung Đã Đóng Gói (Re-usable Components)

Bạn có thể tận dụng ngay các linh kiện ERP mạnh mẽ trong `src/components/common/`:

| Component | Mô tả công dụng |
| :--- | :--- |
| `GridView<T>` | Bảng ERP tiêu chuẩn: phân trang, tìm kiếm tức thì, sắp xếp theo cột, chọn nhiều dòng, hành động hàng loạt, tùy chọn hiển thị cột |
| `CategoryHeaderToolbar` | Thanh công cụ đỉnh trang: Tiêu đề, badge số lượng, nút Bộ Lọc, Nạp lại, Xuất Excel, Nhập Excel, Tạo mới |
| `Modal` | Cửa sổ popup chuẩn ERP có backdrop làm mờ, hỗ trợ kích thước: `sm`, `md`, `lg`, `xl`, `3xl`, `5xl`, `fullScreen` |
| `DeleteConfirmModal` | Modal cảnh báo xác nhận xóa bản ghi an toàn với màu cảnh báo đỏ chuẩn |
| `LookupField` | Ô tìm kiếm tra cứu dạng ERP (nhấn F4 hoặc click kính lúp để bật bảng chọn nhanh) |
| `MasterLookupModal` | Cửa sổ tra cứu danh mục nhanh (hỗ trợ phím Enter, nhấp đúp để chọn) |
| `NumberInput` / `CurrencyInput` | Ô nhập tiền tệ / số lượng tự format hàng nghìn (1.000.000 đ) và căn phải |
| `DateTimePicker` | Bộ chọn ngày giờ chuyên nghiệp |
| `Badge` | Huy hiệu trạng thái với các màu: `emerald`, `amber`, `rose`, `indigo`, `slate`, `blue` |
| `showToast` | Thông báo nổi góc màn hình: `showToast.success()`, `showToast.error()`, `showToast.info()`, `showToast.warning()` |

---

## 🔒 5. Cơ Chế Phân Quyền Tự Động (Role-Based Action Permission)

Mọi chức năng đều có thể tự động kiểm tra quyền của tài khoản đang đăng nhập chỉ với 1 dòng code:

```typescript
import { getActionPermission } from '../../../mock/initialRoles';

const perms = getActionPermission(currentUser, 'mã_chức_năng');
// perms.view    -> Xem chức năng
// perms.create  -> Thêm mới (cả sao chép, nhập từ Excel): nút Thêm, Nhập Excel
// perms.edit    -> Sửa bản ghi đã lưu: nút Sửa, lưu form đang sửa
// perms.delete  -> Xóa
// perms.approve -> Duyệt chứng từ
// perms.print   -> In phiếu / báo cáo
// perms.export  -> Xuất dữ liệu ra file (Excel): chỉ truyền onExportExcel khi có quyền
```

Chỉ cần gán các cờ này vào nút tương ứng (ví dụ: `canCreate={perms.create}`, `onExportExcel={perms.export ? handleExport : undefined}`) là hệ thống tự động bảo vệ dữ liệu theo đúng phân quyền admin/nhân viên!

## Control dùng chung (components/common)

Dùng các control sau thay vì tự viết `<input>`, `<select>`, nút tab hay `window.confirm`, để giao diện thống nhất (bo góc, màu viền, chế độ tối, dấu `*` bắt buộc, dòng lỗi).

| Control | Dùng cho | Ví dụ |
| --- | --- | --- |
| `TextInput`, `SelectInput`, `TextArea` | Ô nhập có nhãn, gợi ý, lỗi | `<TextInput label="Mã số thuế" required value={v} onChange={e => setV(e.target.value)} hint="10 hoặc 13 số" />` |
| `FormField` | Bọc control đặc biệt (ComboBox, NumberInput…) cùng nhãn | `<FormField label="Số lượng">{id => <NumberInput id={id} ... />}</FormField>` |
| `Tabs` | Thanh tab | `<Tabs value={tab} onChange={setTab} items={[{ key: 'a', label: 'Chung', icon: <Settings /> }]} />` |
| `useConfirm()` | Hộp xác nhận (xóa, khóa, khôi phục) | `if (!(await confirm({ title: 'Xóa phiếu?', tone: 'danger' }))) return;` |
| `LoadingState`, `EmptyState`, `ErrorState`, `Spinner` | Trạng thái khi gọi API | `{error ? <ErrorState message={error} onRetry={load} /> : <LoadingState />}` |
| `saveWithFeedback` (utils/toast) | Lưu qua API, báo thành công/lỗi | `saveWithFeedback(api.save(x), () => showToast.success('Đã lưu'))` |

`useConfirm()` cần `ConfirmProvider`, đã gắn sẵn trong `App.tsx`.
## Màu sắc giao diện

Bảng màu khai báo một chỗ trong `src/index.css`:

- **Màu thương hiệu** `brand-50` … `brand-950` (xanh nhạt): nút chính, tab đang chọn, icon, viền nhấn. Các tên cũ `indigo`, `violet`, `purple`, `blue`, `sky`, `cyan` đều trỏ về màu này, nên code cũ vẫn đúng tông; code mới viết thẳng `brand-*`.
- **Màu trung tính** `slate-*`: chữ, viền, nền phụ. Ở giao diện tối, `slate` và `gray` tự đổi sang xám trung tính (đen xám).
- **Màu có ý nghĩa**, chỉ dùng khi đúng nghĩa: `emerald` = thành công / đã duyệt, `amber` = cảnh báo / chờ, `rose` = lỗi / xóa.
- Không dùng dải màu chuyển (gradient), không tô mỗi tab một màu. Nền trang dùng `bg-background`, thẻ dùng `bg-white dark:bg-slate-900`.
- Muốn đổi tông thương hiệu cả hệ thống: chỉ sửa 11 giá trị `--color-brand-*` trong `index.css`.
