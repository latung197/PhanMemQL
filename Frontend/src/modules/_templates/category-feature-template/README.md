# HƯỚNG DẪN TỰ PHÁT TRIỂN CHỨC NĂNG DANH MỤC MỚI (CATEGORY TEMPLATE)

Thư mục này được đóng gói độc lập chuẩn ERP để bạn có thể **copy sang bất kỳ module nào** và tạo chức năng mới trong 4 bước đơn giản.

**Lưu ý:** đây là bản minh họa trên dữ liệu mẫu. Danh mục lưu database phải dùng `CatalogScreen` như `src/modules/inventory/categories/uom/` và làm đủ SQL, API, quyền, dịch vi/en, Excel, lookup theo [quy trình chuẩn](../../../../../docs/them-danh-muc.md). Không dùng state và dữ liệu mẫu dưới đây làm nguồn dữ liệu cho danh mục thật.

---

## 📁 Cấu trúc đóng gói:
```
my-new-category/
├── CategoryFeatureView.tsx  # Giao diện chính (Toolbar + Filter + GridView + Modal Thêm/Sửa/Xóa)
├── types.ts                 # Định nghĩa kiểu dữ liệu (Model, FilterCriteria, FormData)
├── index.ts                 # Export barrel
└── README.md                # Tài liệu hướng dẫn
```

---

## 🚀 4 Bước Tự Tạo Chức Năng Mới Bằng Cách Copy:

### Bước 1: Sao chép thư mục
Copy nguyên thư mục `src/modules/_templates/category-feature-template/` sang phân hệ đích và đổi tên thư mục.  
*Ví dụ:* Tạo danh mục Nhà Cung Cấp:
```bash
src/modules/inventory/categories/suppliers/
├── SupplierCategoryView.tsx
├── types.ts
└── index.ts
```

### Bước 2: Tùy biến trường dữ liệu trong `types.ts`
Mở `types.ts` và đổi tên/bổ sung các trường cần quản lý (ví dụ: `phone`, `taxCode`, `address`, `contactPerson`).

### Bước 3: Đổi tên Component & Tiêu đề trong View
Trong file `SupplierCategoryView.tsx`:
- Đổi tên Component thành `SupplierCategoryView`.
- Cập nhật tiêu đề tại `CategoryHeaderToolbar` (VD: `Danh Mục Nhà Cung Cấp`).
- Bổ sung/điều chỉnh các cột hiển thị trong mảng `columns: GridViewColumn<Supplier>[]`.
- Điều chỉnh các ô nhập liệu trong `<form>` của Modal.

### Bước 4: Khai báo vào Menu & Router
1. **Đăng ký subKey trong `src/types/index.ts`:**
   ```typescript
   export type SubMenuKey = ... | 'inv_supplier_cat';
   ```
2. **Khai báo mục menu trong DB:**
   Cập nhật dòng `sys_command` có `menuid0 = 'inv_supplier_cat'`: đặt `menu_kind = 'function'`, `menu_parent_id` là ID nhóm, `menu_icon` và `menu_order_no`. Tên các ngôn ngữ nằm trong `sys_command_translation`; route ở `src/config/functions.ts`.
3. **Mount vào Module cha (VD: `InventoryModule.tsx`):**
   ```typescript
   import { SupplierCategoryView } from './suppliers';

   // Trong switch (subKey):
   case 'inv_supplier_cat':
     return <SupplierCategoryView currentUser={currentUser} />;
   ```

Xong! Chức năng mới đã có đầy đủ:
- Thanh công cụ HeaderToolbar
- Nút Thêm mới, Nạp lại, Xuất Excel, Nhập Excel
- Bộ lọc nâng cao đóng/mở được, màu sáng chuẩn
- Bảng GridView phân trang, tìm kiếm, sắp xếp cột
- Phân quyền (Xem, Thêm, Sửa, Xóa, Xuất Excel) tự động áp dụng theo User
- Modal Thêm/Sửa kiểm tra dữ liệu
- Modal Xác nhận xóa từng dòng hoặc xóa hàng loạt.
