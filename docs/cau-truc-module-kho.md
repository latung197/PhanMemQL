# Cấu trúc module Kho

> Cập nhật: phiếu nhập kho đã có API và bảng PostgreSQL tại `ServerService/.../Modules/Inventory/Documents/GoodsReceipts/` và `ServerService/sql/postgresql/20-inventory-goods-receipts.sql`. Phần danh mục vật tư và các báo cáo tồn kho hiện vẫn dùng dữ liệu mẫu; dữ liệu nhập kho đã ghi sổ sẽ được dùng khi các chức năng đó chuyển sang backend.

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

Backend đã có API danh mục Kho và phiếu nhập kho trong `Documents/GoodsReceipts/`. Báo cáo và các chứng từ khác sẽ có thư mục tương ứng ở từng tầng khi triển khai. Namespace C# của các lớp hiện có được giữ để không đổi hợp đồng mã nguồn; đường dẫn API, mã quyền, route và tên bảng cũng giữ nguyên.

Khi thêm chức năng, chọn nhóm theo trách nhiệm, tạo thư mục riêng cho mã chức năng và đăng ký tại `InventoryModule.tsx`. Các thành phần dùng chung giữa nhiều chức năng đặt tại cấp nhóm gần nhất. Hướng dẫn danh mục đầy đủ: [Thêm danh mục](them-danh-muc.md).
