# Cấu trúc module Kho

> Cập nhật: phiếu nhập kho, danh mục vật tư, vị trí lưu kho, lô và hạn sử dụng đã chạy trên backend; mọi phiếu ghi sổ qua **sổ kho** (`ServerService/.../Modules/Inventory/Stock/`, bảng `erp_stock_movement` và ba bảng tồn, script `34-inventory-stock-ledger.sql`). Giải thích chi tiết các bảng và luồng nhập kho: `docs/kho/so-kho-va-phieu-nhap-kho.md`. Phiếu xuất, điều chuyển, kiểm kê và năm báo cáo kho (`docs/kho/bao-cao-kho.md`) cũng đã chạy trên backend; chỉ còn tính giá trung bình tháng, tính tồn kho tức thời và định mức tồn dùng dữ liệu mẫu.

Mã nguồn Kho được chia theo `phân hệ → nhóm → chức năng` ở frontend và backend.

```text
Frontend/src/modules/inventory/
  InventoryModule.tsx
  categories/<chức năng>/       Danh mục: vật tư, kho, đơn vị tính...
  documents/<chức năng>/        Chứng từ và thao tác gắn với luồng kho
  reports/<chức năng>/          Báo cáo

ServerService/{Core,Core.Application,Core.Domain,Core.Infrastructure}/Modules/Inventory/
  Categories/<chức năng>/      Các danh mục đã có API và cơ sở dữ liệu
  Documents/GoodsReceipts/      Phiếu nhập kho: API, nghiệp vụ và SQL ghi sổ
```

Mỗi thư mục chức năng frontend giữ giao diện, `types.ts`, `api.ts` và các thành phần riêng khi cần. `InventoryModule.tsx` chỉ nối mã chức năng với màn hình. Phiếu điều chuyển và phê duyệt dùng chung một giao diện trong `documents/_shared/`; thư mục của từng mã chức năng có lớp nối mỏng để giữ điểm vào riêng. Tính giá và tính tồn có thư mục riêng dưới `documents/` cho đến khi có nhóm nghiệp vụ riêng.

Backend đã có API danh mục Kho và phiếu nhập kho trong `Documents/GoodsReceipts/`. Báo cáo kho nằm ở `Modules/Inventory/Reports/` (ba tầng) và `Frontend/src/modules/inventory/reports/`; các chứng từ khác có thư mục tương ứng ở từng tầng. Namespace C# của các lớp hiện có được giữ để không đổi hợp đồng mã nguồn; đường dẫn API, mã quyền, route và tên bảng cũng giữ nguyên.

Khi thêm chức năng, chọn nhóm theo trách nhiệm, tạo thư mục riêng cho mã chức năng và đăng ký tại `InventoryModule.tsx`. Các thành phần dùng chung giữa nhiều chức năng đặt tại cấp nhóm gần nhất. Hướng dẫn danh mục đầy đủ: [Thêm danh mục](../phat-trien/them-danh-muc.md).
