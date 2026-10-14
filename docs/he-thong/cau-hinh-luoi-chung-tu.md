# Cấu hình lưới chi tiết chứng từ

Lưới chi tiết dưới mỗi chứng từ (các dòng hàng, tab NVL...) được cấu hình **dùng chung toàn hệ thống** trong bảng `sys_voucher_grid` và `sys_voucher_grid_column`, sửa ở **Cài đặt › Cấu hình lưới chứng từ** (chức năng `sys_voucher_grid`). Tài liệu này mô tả cái gì cấu hình được, cái gì vẫn do code quyết định, cách hoạt động từ cơ sở dữ liệu đến màn hình, và cách thêm cột mới.

## 1. Cấu hình được những gì

| Việc | Ở đâu | Ghi chú |
|---|---|---|
| **Thứ tự cột** | nút lên / xuống trên mỗi dòng | |
| **Tiêu đề** tiếng Việt và tiếng Anh | ô nhập | Người dùng ngôn ngữ English thấy tiêu đề tiếng Anh nếu có |
| **Độ rộng** (px, 40–800) | ô nhập | Để trống = theo khai báo của code |
| **Số chữ số thập phân** (0–6) | ô nhập, chỉ cột số | |
| **Ẩn / hiện** cột | ô chọn | **Cột bắt buộc không ẩn được** (mã vật tư, số lượng...) |
| **Gim cột** | ô "Gim số cột đầu" (0–5) | N cột đầu đang hiện đứng yên khi cuộn ngang; cột `#` đi cùng. Gim cột 1 và 2 = nhập 2 |

**Không cấu hình ở đây** (do code quy định vì gắn với dữ liệu và nghiệp vụ): tên trường dữ liệu (`field`), kiểu cột (chữ, số lượng, tiền, tra cứu, đơn vị tính...), cấu hình tra cứu, cột bắt buộc, cột chỉ đọc, cách tính tổng. Muốn **thêm một cột mới** (một trường dữ liệu mới) thì phải sửa code (mục 5).

Thay đổi áp dụng cho **mọi người dùng** sau khi họ tải lại trang. Việc mỗi người tự đổi cột của mình (như nút **Cột** của danh mục) là bước sau.

## 2. Một chứng từ có nhiều tab

Mỗi **tab** của chứng từ là **một lưới riêng** với mã riêng, cùng thuộc một loại chứng từ:

| Chứng từ | Lưới (tab) |
|---|---|
| Phiếu nhập kho (`PNK`) | `PNK_ITEMS` Chi tiết mặt hàng, `PNK_BOM` Nguyên vật liệu (BOM) |
| Phiếu xuất kho (`PXK`) | `PXK_ITEMS`, `PXK_BOM` |
| Phiếu yêu cầu xuất kho, yêu cầu mua hàng, đơn mua hàng | `YCX_ITEMS`, `YCM_ITEMS`, `DMH_ITEMS` |
| Lệnh điều chuyển, phiếu xuất / nhập điều chuyển | `LDC_ITEMS`, `PXDC_ITEMS`, `PNDC_ITEMS` |

Bảng `sys_voucher_grid` có cột `voucher_type` (chứng từ), `tab_key` (`items`, `materials`) và `tab_order` (thứ tự tab); mỗi lưới có thứ tự cột, độ rộng và **số cột gim riêng**. Trên màn cấu hình, chọn lưới theo dạng "Phiếu nhập kho › Chi tiết mặt hàng (PNK_ITEMS)". Sửa tab này **không** ảnh hưởng tab kia.

## 3. Cơ sở dữ liệu

Script `ServerService/sql/postgresql/49-voucher-grids.sql` (chạy lại được):

**`sys_voucher_grid`** (một dòng một lưới): `code` (khóa chính, ví dụ `PNK_ITEMS`), `voucher_type`, `name`, `name_en`, `tab_key`, `tab_order`, `allow_add_row`, `allow_delete_row`, `pin_count` (0–5, CHECK) và 4 cột dấu bản ghi. `Version` (chống ghi đè) dùng `xmin`.

**`sys_voucher_grid_column`** (một dòng một cột): `voucher_grid_code`, `field` (duy nhất trong lưới), `header`, `header_en`, `col_type`, `width`, `min_width` (CHECK 40–800), `align`, `decimals` (CHECK 0–6), `is_required`, `is_read_only`, `is_visible`, `summary`, `summary_format`, `sort_order` và 4 cột dấu bản ghi.

Không khóa ngoại; `voucher_grid_code` khai `[References<VoucherGrid>]` và có chỉ mục.

**Dữ liệu ban đầu:** khi backend khởi động, `DatabaseSeeder.EnsureVoucherGridsAsync` đọc `Core/SeedData/voucher-grids.json` (sinh từ code frontend bằng `npm run export-voucher-grids`) và **chỉ thêm cái còn thiếu**: lưới chưa có, hoặc cột chưa có (cột mới đi xuống **cuối** lưới). Cái đã có **không bao giờ bị ghi đè**, nên chỉnh sửa của quản trị viên được giữ.

## 4. Backend và frontend

| Lớp | Tệp |
|---|---|
| Thực thể | `Core.Domain/Modules/VoucherGrids/VoucherGrid.cs` (`[Audited("sys_voucher_grid", ...)]`) |
| Hợp đồng, luật kiểm | `Core.Application/Modules/VoucherGrids/VoucherGridContracts.cs` (`VoucherGridRules`) |
| Dịch vụ | `Core.Infrastructure/Modules/VoucherGrids/VoucherGridService.cs` (đệm trong bộ nhớ, xóa khi hai bảng bị ghi) |
| API | `Core/Modules/VoucherGrids/VoucherGridsController.cs` |
| Màn cấu hình | `Frontend/src/modules/settings/VoucherGridSettingsView.tsx` |
| Nạp và áp dụng | `Frontend/src/services/voucherGridService.ts` (`applyVoucherGrid`) |
| Lưới | `Frontend/src/components/common/VoucherDetailGrid.tsx` (áp cấu hình, gim cột) |

**API**
- `GET /api/voucher-grids`: mọi lưới kèm cột theo thứ tự. **Mở cho mọi người đã đăng nhập** (màn chứng từ đọc một lần sau đăng nhập).
- `PUT /api/voucher-grids/{mã lưới}`: lưu. Cần quyền **Sửa** của `sys_voucher_grid`. Body: `{ "pinCount": 2, "version": 7, "columns": [ { "field": "sku", "header": "...", "headerEn": "...", "width": 140, "minWidth": 120, "decimals": null, "visible": true }, ... ] }` — danh sách **theo thứ tự mới**, đủ mọi cột, mỗi cột một lần.

**Luật kiểm** (`VoucherGridRules`, có test): đủ mọi cột mỗi cột một lần; tiêu đề không trống, tối đa 200 ký tự; độ rộng 40–800; số lẻ chỉ cho cột số, 0–6; **không ẩn cột bắt buộc**; số cột gim từ 0 đến 5 và không quá số cột đang hiện; sửa bằng `version` cũ → 409. Mọi thay đổi ghi nhật ký (`voucherGrid`, trường `columns`: gim, thứ tự, ẩn, độ rộng).

**Cách màn hình dùng:** `VoucherDetailGrid` lấy khai báo của code (`voucherGridConfigs.ts`) rồi `applyVoucherGrid` xếp lại cột theo bảng, bỏ cột ẩn (cột bắt buộc luôn hiện), đặt tiêu đề, độ rộng, số lẻ và `pinCount`. Cột code có mà bảng chưa có thì nằm cuối. **Nếu chưa nạp được cấu hình (lỗi mạng), lưới vẫn hiện đúng theo khai báo của code.**

**Gim cột:** các cột đầu dùng `position: sticky` với `left` cộng dồn từ độ rộng các cột gim đứng trước (cộng 32px của cột `#`); vì vậy cột gim nên có **độ rộng cố định** (không thì dùng độ rộng tối thiểu, hoặc 120px). Cột gim có nền đặc và đường kẻ đậm ở mép phải để phân biệt khi cuộn.

## 5. Thêm cột mới vào một lưới

1. Thêm cột vào mảng `columns` của lưới trong `Frontend/src/mock/voucherGridConfigs.ts` (tên `field` khớp dữ liệu dòng, kiểu, tra cứu nếu có) và dùng nó trong màn chứng từ / API như thường lệ.
2. `npm run export-voucher-grids` sinh lại `Core/SeedData/voucher-grids.json`.
3. Khởi động lại backend: cột mới tự thêm vào cuối lưới (`sys_voucher_grid_column`).
4. Vào **Cài đặt › Cấu hình lưới chứng từ**, kéo cột lên vị trí mong muốn và lưu.

**Thêm một lưới mới** (tab mới của một chứng từ): khai báo trong `systemVoucherGridRegistry` rồi làm lại bước 2–4; mã lưới có dạng `<LOẠI>_<TAB>` (`ITEMS` thành tab `items`, `BOM` thành tab `materials`).

## 6. Quyền

- **Xem cấu hình** (`GET`): mọi người đã đăng nhập (để vẽ lưới).
- **Mở màn Cấu hình lưới chứng từ** và **lưu**: quyền Xem / Sửa của chức năng `sys_voucher_grid` ở Cài đặt › Người dùng & phân quyền (quản trị viên luôn có).

## 7. Kiểm tra

- Test: `VoucherGridRulesTests` (luật kiểm, tệp seed nhất quán), các test khung (`TableReferenceTests`, `ReadAccessContractTests`, `MessagesTests`, `MenuSeedFileTests`).
- Thử tay: ẩn cột bắt buộc (bị từ chối), gim 6 cột (bị từ chối), đổi thứ tự rồi mở chứng từ (cột đổi theo), gim 2 cột rồi cuộn ngang (hai cột đứng yên), tài khoản không có quyền Sửa gọi `PUT` (403).

## 8. Giới hạn

- Cấu hình chung toàn hệ thống; chưa có bố cục riêng từng người dùng hay từng đơn vị cơ sở.
- Gim cột tính theo **thứ tự cột đang hiện** (cột ẩn không tính).
- Không đổi được kiểu cột, cột bắt buộc, cột chỉ đọc hay cách tính tổng ở đây (cần sửa code).

## 9. Lưới lấy cấu hình từ đâu: bảng hay code

Lưới chi tiết của chứng từ ghép từ **hai nguồn**. Bảng quyết định phần **trình bày**; code quyết định phần **ý nghĩa dữ liệu**.

| Thuộc tính của cột | Nguồn | Sửa ở đâu |
|---|---|---|
| Thứ tự cột | `sys_voucher_grid_column.sort_order` | Cài đặt › Cấu hình lưới chứng từ |
| Tiêu đề (vi / en) | `header`, `header_en` | cùng màn |
| Độ rộng, số lẻ | `width`, `decimals` | cùng màn |
| Ẩn / hiện | `is_visible` (cột bắt buộc không ẩn được) | cùng màn |
| Số cột gim | `sys_voucher_grid.pin_count` | cùng màn |
| Cột nào tồn tại (`field`) | code, `mock/voucherGridConfigs.ts` | sửa code |
| Kiểu cột (chữ, số lượng, tiền, tra cứu, đơn vị tính) | code | sửa code |
| Cấu hình tra cứu | code | sửa code |
| Bắt buộc, chỉ đọc | code | sửa code |
| Cách tính tổng cuối lưới | code | sửa code |

Lý do để phần sau ở code: nó gắn với dữ liệu và nghiệp vụ của từng phiếu (tên trường của dòng phiếu, kiểm tra khi lưu, tra cứu danh mục). Đổi trong bảng mà code không biết thì lưới hỏng.

### Luồng từ database đến màn hình

1. Đăng nhập xong, `App.tsx` gọi `voucherGridService.load()` → `GET /api/voucher-grids` (một lần, đưa vào bộ nhớ, đăng xuất thì xóa).
2. Màn chứng từ dựng `VoucherDetailGrid` với mã lưới (`PNK_ITEMS`...). Lưới lấy **khai báo của code** làm gốc.
3. `applyVoucherGrid(khai báo, ngôn ngữ)` ghép cấu hình từ bảng lên khai báo: xếp lại cột, bỏ cột ẩn, đặt tiêu đề (tiếng Anh nếu người dùng chọn English và có), độ rộng, số lẻ và `pinCount`.
4. Lưới vẽ cột; các cột gim dùng `position: sticky`.
5. Quản trị viên lưu ở màn cấu hình → `PUT /api/voucher-grids/{mã}` → `voucherGridService.load()` nạp lại. Người dùng khác thấy sau khi tải lại trang.

### Các trường hợp biên

- **Chưa nạp được cấu hình** (lỗi mạng, backend chưa chạy script 49): lưới vẫn hiện đúng theo khai báo của code.
- **Code có cột mà bảng chưa có**: cột nằm cuối lưới cho đến khi backend khởi động lại (seeder thêm cột thiếu vào cuối) rồi được kéo lên vị trí mong muốn.
- **Bảng có cột mà code không còn**: cột đó bị bỏ qua khi vẽ (code là nguồn xác định cột tồn tại).
- **Bảng đã chỉnh, seed chạy lại**: seeder chỉ thêm cái thiếu, **không ghi đè**, nên chỉnh sửa của quản trị viên được giữ.

### Hướng phát triển (chưa làm)

- Bố cục riêng từng người dùng, từng đơn vị cơ sở (giống nút **Cột** của danh mục, bảng `sys_grid_layout`).
- Đưa **kiểu cột và tra cứu** vào bảng để code không còn là nguồn khai báo cột. Việc này lớn hơn nhiều: cần danh mục kiểu dữ liệu dùng chung (domain: mã, tên, số lượng, tiền, đơn giá, tỷ giá, phần trăm) để `col_type`, độ chính xác và căn lề đi cùng một chuẩn với kiểu cột trong cơ sở dữ liệu, và cần cách khai báo cấu hình tra cứu trong bảng.
