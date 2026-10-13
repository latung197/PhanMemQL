# Mô tả cơ sở dữ liệu S-ERP

Tài liệu này mô tả toàn bộ cơ sở dữ liệu PostgreSQL của S-ERP: **63 bảng**, 1 view, 798 cột, 204 chỉ mục. Kiểu dữ liệu, độ dài, ràng buộc, chỉ mục, trigger và tham chiếu được **sinh tự động từ database thật** (`erp_dev`) bằng `docs/cong-cu/gen-database-doc.cjs`; phần mô tả bảng và cột viết tay trong `docs/cong-cu/database-notes.cjs` và công cụ. Nhờ vậy khớp với cấu trúc đang chạy. Khi đổi cấu trúc: chạy script SQL, rồi chạy lại công cụ để sinh lại tài liệu.

## 1. Quy ước chung

### 1.1. Đặt tên

- Bảng `sys_*` là **bảng hệ thống** (người dùng, quyền, cài đặt, phê duyệt, nhật ký...); bảng `erp_*` là **bảng nghiệp vụ** (danh mục và chứng từ Kho, Mua hàng...).
- Tên bảng và cột viết `snake_case`, chữ thường. Tên tiếng Việt hiển thị nằm ở giao diện (`locales/*`), **không** đặt vào tên cột.
- Khóa và tên của một **danh mục** luôn là `code` và `name`. Cột trỏ sang danh mục khác đặt `<tên bảng đích bỏ erp_/sys_>_code` (`uom_code`, `warehouse_code`, `supplier_code`...); riêng đơn vị cơ sở là `unit_code` (tên cũ). Mã số thuế là `tax_code`, còn mã thuế suất là `tax_rate_code`.
- Chứng từ có `id` (bigint tự tăng) làm khóa chính và `code` là **số chứng từ** duy nhất toàn hệ thống; dòng chứng từ nằm ở bảng `*_line` với `(mã đầu phiếu, line_no)` duy nhất.

### 1.2. Không dùng khóa ngoại

Dự án **không dùng ràng buộc khóa ngoại**. Các bảng liên kết bằng cột mã hoặc id **có chỉ mục** (chỉ mục bắt đầu bằng chính cột đó). Việc kiểm tra do dịch vụ backend làm: khi lưu kiểm mã tham chiếu có thật; khi xóa từ chối nếu còn bản ghi khác đang dùng. Quan hệ được khai trên thực thể bằng `[References<Bảng đích>]` và ghi vào bảng `sys_table_ref` mỗi lần backend khởi động (mục 4). Vì vậy **xóa trực tiếp bằng SQL có thể để lại dòng mồ côi**; luôn xóa qua API hoặc dọn cả bảng con.

### 1.3. Các cột dùng chung

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `created_at`, `created_by`, `updated_at`, `updated_by` | timestamptz, integer | **Dấu bản ghi** của mọi bảng `erp_*` (và các bảng `sys_*` đã chuyển khung): thời điểm UTC và mã người dùng; do `CoreContext` điền khi lưu, không do code nghiệp vụ gán |
| `createtime`, `createid`, `updatetime`, `updateid` | timestamp, varchar | Dấu bản ghi **kiểu cũ** của một số bảng `sys_*` chưa chuyển |
| *(không có cột)* `Version` | xmin | **Chống ghi đè**: EF ánh xạ cột hệ thống `xmin` của PostgreSQL làm phiên bản; DTO trả `version`, lưu kèm `version`, lệch thì HTTP 409. Không cần cột trong bảng |
| `is_active`, `sort_order` | boolean, integer | Danh mục: đang sử dụng / ngừng dùng và thứ tự hiển thị |
| `status` | varchar(20) | Trạng thái chứng từ: `Draft` (lập chứng từ), `Pending` (chờ duyệt), `Approved` (đã duyệt), `Posted` (đã ghi sổ), `Cancelled` (hủy); có CHECK ở các bảng chứng từ |

### 1.4. Tiền, số lượng, ngày

- **Số lượng** `numeric(18,4)`; **đơn giá** `numeric(18,4)`; **thành tiền** và **tổng giá trị** `numeric(18,2)`; **tỷ giá** `numeric(18,6)`, có CHECK `> 0`.
- `total_value` của chứng từ luôn là **tiền hạch toán** (đã nhân tỷ giá); đơn giá và thành tiền của dòng theo **loại tiền của chứng từ**. Đơn mua hàng lưu thêm `sub_total`, `tax_amount` theo loại tiền của đơn.
- **Ngày chứng từ** `document_date` kiểu `date` (không múi giờ); **thời điểm** hệ thống (`*_at`) kiểu `timestamptz` lưu UTC. Ngày lập `created_date` là ngày hệ thống theo UTC.
- Tên vật tư, tên nhà cung cấp, điều khoản thanh toán trên chứng từ là **chữ chép lúc lưu**, để chứng từ cũ không đổi khi danh mục đổi tên.

### 1.5. Cách làm việc với cơ sở dữ liệu

- Chạy **mọi script** trong `ServerService/sql/postgresql/` theo thứ tự tên file (`00-helpers.sql` trước); mỗi script chạy lại được và tự chuyển dữ liệu cũ. Không có EF migration.
- Thao tác thêm, sửa, xóa dữ liệu nghiệp vụ đi qua EF Core; **báo cáo, tính toán, ghi sổ kho** dùng SQL thuần qua `ISqlExecutor` (tệp `Core.Infrastructure/Modules/<Module>/Sql/*.sql`, luôn tham số hóa `@tên`).
- Ghi sổ kho chỉ qua `IStockLedger`, **không** viết SQL riêng vào bảng `erp_stock_*`.
- Không chạy script trên database khác `erp_dev` khi phát triển trên máy này.

## 2. Danh sách bảng

| Nhóm | Bảng | Số cột | Mô tả ngắn |
|---|---|---|---|
| Người dùng và phân quyền | `sys_command` | 27 | Danh mục **chức năng và nút menu** (cây module → nhóm → chức năng) |
| Người dùng và phân quyền | `sys_command_translation` | 3 | Tên chức năng / menu theo từng ngôn ngữ |
| Người dùng và phân quyền | `sys_role` | 10 | Vai trò (nhóm quyền) |
| Người dùng và phân quyền | `sys_role_command` | 18 | Ma trận quyền của **vai trò** theo chức năng (xem, thêm, sửa, xóa, duyệt, in, xuất; vẫn lưu dạng 11 cờ cũ) |
| Người dùng và phân quyền | `sys_role_right` | 8 | Quyền đặc biệt của vai trò, dạng `{chức năng}:{MÃ}` (ví dụ `inv_receipt:VIEW_PRICE`); quyền trạng thái theo đơn vị có đuôi `@DVCS` |
| Người dùng và phân quyền | `sys_user_command` | 18 | Quyền **ngoại lệ** của người dùng: mỗi dòng thay thế quyền của vai trò cho đúng một chức năng; hệ thống chỉ lưu phần chênh lệch |
| Người dùng và phân quyền | `sys_user_company_unit` | 2 | Các đơn vị cơ sở mà người dùng được làm việc (đổi đơn vị bằng `POST /api/auth/switch-unit`) |
| Người dùng và phân quyền | `sys_user_right` | 9 | Quyền đặc biệt của riêng người dùng: `is_granted` = true cấp thêm, false thu hồi so với vai trò |
| Người dùng và phân quyền | `sys_user_role` | 7 | Gán vai trò cho người dùng |
| Người dùng và phân quyền | `sys_users` | 25 | Tài khoản người dùng |
| Cài đặt hệ thống | `sys_banner` | 13 | Thanh thông báo hệ thống dưới header: mức INFO / WARNING / URGENT, khoảng giờ UTC, đơn vị áp dụng |
| Cài đặt hệ thống | `sys_fiscal_period` | 6 | Khóa sổ theo **tháng và đơn vị cơ sở**: tháng đã khóa không lập, sửa, xóa chứng từ có ngày thuộc tháng đó |
| Cài đặt hệ thống | `sys_grid_layout` | 7 | Bố cục lưới của từng người dùng (cột ẩn, thứ tự, độ rộng, sắp xếp, cỡ trang) và bố cục mặc định của công ty, theo chức năng + tên lưới |
| Cài đặt hệ thống | `sys_login_image` | 8 | Ảnh của thông báo đăng nhập (đã thu nhỏ, lưu dạng base64), đọc qua API mở `GET /api/auth/notice-images/{mã}` |
| Cài đặt hệ thống | `sys_login_notice` | 16 | Thông báo hiện ở bảng bên trái màn đăng nhập (đang dùng, khoảng ngày, nội dung vi / en, ghim, loại nền) |
| Cài đặt hệ thống | `sys_setting` | 7 | Cấu hình dạng JSON theo mục (`section`) và đơn vị: mặc định, năm làm việc, hồ sơ doanh nghiệp, định dạng số, ẩn / hiện menu, thời hạn giữ nhật ký. |
| Cài đặt hệ thống | `sys_voucher_numbering` | 8 | Mẫu số chứng từ theo loại chứng từ và đơn vị (có `{DVCS}`, năm, tháng, số thứ tự) |
| Cài đặt hệ thống | `sys_voucher_sequence` | 4 | Bộ đếm số chứng từ theo loại + đơn vị + kỳ (`period_key`); cấp số nguyên tử trong giao dịch lưu phiếu |
| Cài đặt hệ thống | `sys_voucher_status` | 11 | Tên trạng thái chứng từ đổi theo đơn vị và việc bật / tắt bước **Chờ duyệt**; chỉ lưu trạng thái đã đổi so với mặc định |
| Danh mục hệ thống | `sys_company_unit` | 14 | Đơn vị cơ sở (DVCS): chi nhánh / công ty con mà chứng từ và kho thuộc về |
| Danh mục hệ thống | `sys_company_unit_translation` | 7 | Tên đơn vị cơ sở theo ngôn ngữ |
| Danh mục hệ thống | `sys_currency` | 11 | Danh mục loại tiền; đúng một đồng tiền hạch toán (`is_base`) |
| Danh mục hệ thống | `sys_department` | 9 | Danh mục phòng ban; người dùng và quy tắc duyệt trỏ tới bằng `department_code` |
| Danh mục hệ thống | `sys_exchange_rate` | 13 | Tỷ giá theo loại tiền và ngày; mã danh mục dạng `USD@2026-10-08` |
| Danh mục hệ thống | `sys_language` | 10 | Danh mục ngôn ngữ giao diện (mã chữ thường như `vi`, `en`); một dòng là mặc định |
| Danh mục hệ thống | `sys_tax_rate` | 12 | Danh mục mã thuế (VAT, nhập khẩu, khác), thuế suất theo phần trăm, cờ miễn thuế |
| Phê duyệt, thông báo, nhật ký | `sys_approval_rule` | 13 | Quy tắc phê duyệt: chức năng, điều kiện (giá trị, phòng ban), các cấp duyệt và người duyệt |
| Phê duyệt, thông báo, nhật ký | `sys_audit_log` | 14 | **Nhật ký thay đổi** dùng chung mọi chức năng, tự ghi khi lưu (trường, giá trị trước → sau, người, đơn vị, địa chỉ IP); dọn tự động theo thời hạn giữ |
| Phê duyệt, thông báo, nhật ký | `sys_document_approval` | 16 | Các cấp phê duyệt của từng chứng từ (khóa theo mã chức năng + số chứng từ): cấp, người duyệt hợp lệ, trạng thái, người và thời điểm xử lý, lý do |
| Phê duyệt, thông báo, nhật ký | `sys_notification` | 12 | Thông báo gửi cho người dùng (cá nhân hoặc toàn đơn vị), có liên kết mở thẳng chứng từ |
| Phê duyệt, thông báo, nhật ký | `sys_notification_read` | 4 | Người dùng nào đã đọc thông báo nào |
| Danh mục Kho | `erp_location` | 14 | Vị trí lưu kho (kệ, ô...) thuộc đúng một kho; mã duy nhất toàn hệ thống |
| Danh mục Kho | `erp_lot` | 14 | Lô hàng của vật tư có theo dõi lô; khóa gộp vật tư + số lô, ngày hết hạn, trạng thái chặn |
| Danh mục Kho | `erp_material` | 30 | Danh mục **vật tư / hàng hóa**: đơn vị tính gốc, loại, nhóm, các cờ `track_lot`, `has_expiry`, `track_location`, `is_stock_item`, phương pháp tính giá (AVERAGE / FIFO), tồn tối thiểu.. |
| Danh mục Kho | `erp_material_group` | 9 | Nhóm vật tư |
| Danh mục Kho | `erp_material_type` | 10 | Loại vật tư, thuộc một nhóm |
| Danh mục Kho | `erp_supplier` | 13 | Danh mục nhà cung cấp (mã số thuế, điện thoại, địa chỉ, nhóm) |
| Danh mục Kho | `erp_uom` | 10 | Đơn vị tính (cái, kg, thùng...) |
| Danh mục Kho | `erp_uom_conversion` | 13 | Quy đổi đơn vị tính (có thể riêng cho một vật tư): hệ số từ đơn vị này sang đơn vị kia |
| Danh mục Kho | `erp_uom_translation` | 7 | Tên đơn vị tính theo ngôn ngữ |
| Danh mục Kho | `erp_warehouse` | 13 | Danh mục kho |
| Danh mục Kho | `erp_warehouse_type` | 9 | Loại kho |
| Danh mục Kho | `erp_warehouse_type_translation` | 7 | Tên loại kho theo ngôn ngữ |
| Danh mục Kho | `erp_warehouse_unit` | 6 | Đơn vị cơ sở được dùng một kho (không có dòng = kho dùng chung mọi đơn vị) |
| Chứng từ Kho | `erp_goods_issue` | 21 | Đầu **phiếu xuất kho** (ghi sổ giảm tồn, tính giá bình quân): khách hàng, người nhận, dự án, các số phiếu yêu cầu đã lấy |
| Chứng từ Kho | `erp_goods_issue_line` | 17 | Dòng phiếu xuất kho (ITEM / MATERIAL), dòng yêu cầu xuất kho đã thực hiện |
| Chứng từ Kho | `erp_goods_receipt` | 22 | Đầu **phiếu nhập kho** (ghi sổ tăng tồn): ngày, kho, loại nhập, nhà cung cấp, loại tiền, trạng thái, dự án, các số đơn mua đã lấy |
| Chứng từ Kho | `erp_goods_receipt_line` | 17 | Dòng phiếu nhập kho: `kind` = ITEM (hàng nhập) hoặc MATERIAL (nguyên vật liệu); số lượng, giá, lô, vị trí, dòng đơn mua đã nhận |
| Chứng từ Kho | `erp_issue_request` | 22 | Đầu **phiếu yêu cầu xuất kho** (duyệt, không ghi sổ) |
| Chứng từ Kho | `erp_issue_request_line` | 14 | Dòng phiếu yêu cầu xuất kho |
| Sổ kho và tồn kho | `erp_stock_balance` | 9 | Tồn theo đơn vị + kho + vật tư (số lượng, giá trị); luôn bằng tổng sổ kho |
| Sổ kho và tồn kho | `erp_stock_location_balance` | 10 | Tồn theo thêm vị trí (chỉ vật tư theo dõi vị trí) |
| Sổ kho và tồn kho | `erp_stock_lot_balance` | 9 | Tồn theo thêm lô (chỉ vật tư theo dõi lô) |
| Sổ kho và tồn kho | `erp_stock_movement` | 21 | **Sổ kho**: nhật ký chỉ-thêm các lần nhập xuất (số lượng có dấu theo đơn vị tính gốc, giá trị theo tiền hạch toán) |
| Danh mục Mua hàng | `erp_payment_term` | 10 | Danh mục điều khoản thanh toán (số ngày công nợ) |
| Danh mục Mua hàng | `erp_project` | 16 | Danh mục **dự án**: chiều theo dõi chi phí (và sau này doanh thu) trên chứng từ mua hàng và kho |
| Danh mục Mua hàng | `erp_supplier_group` | 9 | Danh mục nhóm nhà cung cấp |
| Chứng từ Mua hàng | `erp_purchase_order` | 28 | Đầu **đơn mua hàng** (duyệt, không ghi sổ): nhà cung cấp, điều khoản, thuế, ngày giao dự kiến, dự án |
| Chứng từ Mua hàng | `erp_purchase_order_line` | 16 | Dòng đơn mua hàng: dòng yêu cầu mua đã đặt, ngày dự kiến nhận của từng dòng |
| Chứng từ Mua hàng | `erp_purchase_request` | 23 | Đầu **phiếu yêu cầu mua hàng** (duyệt, không ghi sổ) |
| Chứng từ Mua hàng | `erp_purchase_request_line` | 14 | Dòng phiếu yêu cầu mua hàng |
| Kỹ thuật (hạ tầng của khung) | `sys_migration` | 2 | Dấu các script SQL đã chạy (nếu dùng); không chứa dữ liệu nghiệp vụ |
| Kỹ thuật (hạ tầng của khung) | `sys_table_ref` | 9 | Bản đồ tham chiếu giữa các bảng (không có khóa ngoại): mỗi cột `*_code` / `*_id` trỏ tới bảng nào, có chặn xóa không, có thể rỗng không |
| Kỹ thuật (hạ tầng của khung) | `sys_v_columns` | 12 | View: mọi cột của các bảng `erp_*` / `sys_*` ghép với bản đồ tham chiếu để thấy cột nào trỏ sang bảng nào |

## 3. Quan hệ giữa các nhóm bảng

```
sys_company_unit ──< sys_users (ma_dvcs) ──< sys_user_role >── sys_role ──< sys_role_command / sys_role_right
sys_command (chức năng) ──< sys_role_command, sys_user_command, sys_approval_rule, sys_notification

erp_material_group ──< erp_material_type ──< erp_material ──< (dòng chứng từ, tồn kho, lô, quy đổi)
erp_uom ──< erp_uom_conversion, erp_material, dòng chứng từ
erp_warehouse ──< erp_location, erp_warehouse_unit, chứng từ, tồn kho
erp_supplier_group ──< erp_supplier ──< phiếu yêu cầu mua, đơn mua, phiếu nhập
erp_project ──< 5 chứng từ (project_code)         sys_tax_rate, erp_payment_term ──< erp_purchase_order

erp_purchase_request ─line─> erp_purchase_order ─line─> erp_goods_receipt ──ghi sổ──> erp_stock_movement ──> erp_stock_balance / lot_balance / location_balance
erp_issue_request   ─line─> erp_goods_issue   ──ghi sổ──> erp_stock_movement
```

(Mũi tên `──<` là "một – nhiều"; `─line─>` là dòng chứng từ sau trỏ về dòng chứng từ trước bằng `*_line_id`.) Danh sách cột tham chiếu **đầy đủ** nằm ở mục 4.

## 4. Bản đồ tham chiếu (`sys_table_ref`)

Mỗi dòng: cột của một bảng trỏ tới khóa của bảng nào. **Chặn xóa** = có thì bảng đích không xóa được khi còn dòng dùng; **Tùy chọn** = cột được để rỗng.

| Bảng | Cột | Trỏ tới | Chặn xóa | Tùy chọn |
|---|---|---|---|---|
| `erp_goods_issue` | `currency_code` | `sys_currency.code` | có |  |
| `erp_goods_issue` | `project_code` | `erp_project.code` | có |  |
| `erp_goods_issue` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_goods_issue` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_goods_issue_line` | `material_code` | `erp_material.code` | có |  |
| `erp_goods_issue_line` | `uom_code` | `erp_uom.code` | có |  |
| `erp_goods_receipt` | `currency_code` | `sys_currency.code` | có |  |
| `erp_goods_receipt` | `project_code` | `erp_project.code` | có |  |
| `erp_goods_receipt` | `supplier_code` | `erp_supplier.code` | có |  |
| `erp_goods_receipt` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_goods_receipt` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_goods_receipt_line` | `material_code` | `erp_material.code` | có |  |
| `erp_goods_receipt_line` | `uom_code` | `erp_uom.code` | có |  |
| `erp_issue_request` | `currency_code` | `sys_currency.code` | có |  |
| `erp_issue_request` | `department_code` | `sys_department.code` | có |  |
| `erp_issue_request` | `project_code` | `erp_project.code` | có |  |
| `erp_issue_request` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_issue_request` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_issue_request_line` | `material_code` | `erp_material.code` | có |  |
| `erp_issue_request_line` | `uom_code` | `erp_uom.code` | có |  |
| `erp_location` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_lot` | `material_code` | `erp_material.code` | có |  |
| `erp_lot` | `supplier_code` | `erp_supplier.code` | có |  |
| `erp_material` | `import_tax_rate_code` | `sys_tax_rate.code` | có |  |
| `erp_material` | `material_group_code` | `erp_material_group.code` | có |  |
| `erp_material` | `material_type_code` | `erp_material_type.code` | có |  |
| `erp_material` | `uom_code` | `erp_uom.code` | có |  |
| `erp_material` | `vat_tax_rate_code` | `sys_tax_rate.code` | có |  |
| `erp_project` | `department_code` | `sys_department.code` | có |  |
| `erp_purchase_order` | `currency_code` | `sys_currency.code` | có |  |
| `erp_purchase_order` | `payment_term_code` | `erp_payment_term.code` | có |  |
| `erp_purchase_order` | `project_code` | `erp_project.code` | có |  |
| `erp_purchase_order` | `supplier_code` | `erp_supplier.code` | có |  |
| `erp_purchase_order` | `tax_rate_code` | `sys_tax_rate.code` | có |  |
| `erp_purchase_order` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_purchase_order` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_purchase_order_line` | `material_code` | `erp_material.code` | có |  |
| `erp_purchase_order_line` | `uom_code` | `erp_uom.code` | có |  |
| `erp_purchase_request` | `currency_code` | `sys_currency.code` | có |  |
| `erp_purchase_request` | `department_code` | `sys_department.code` | có |  |
| `erp_purchase_request` | `project_code` | `erp_project.code` | có |  |
| `erp_purchase_request` | `supplier_code` | `erp_supplier.code` | có |  |
| `erp_purchase_request` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_purchase_request` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_purchase_request_line` | `material_code` | `erp_material.code` | có |  |
| `erp_purchase_request_line` | `uom_code` | `erp_uom.code` | có |  |
| `erp_stock_balance` | `material_code` | `erp_material.code` | có |  |
| `erp_stock_balance` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_stock_balance` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_stock_location_balance` | `location_code` | `erp_location.code` | có |  |
| `erp_stock_location_balance` | `lot_code` | `erp_lot.code` | có |  |
| `erp_stock_location_balance` | `material_code` | `erp_material.code` | có |  |
| `erp_stock_location_balance` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_stock_location_balance` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_stock_lot_balance` | `lot_code` | `erp_lot.code` | có |  |
| `erp_stock_lot_balance` | `material_code` | `erp_material.code` | có |  |
| `erp_stock_lot_balance` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_stock_lot_balance` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_stock_movement` | `line_uom_code` | `erp_uom.code` | có |  |
| `erp_stock_movement` | `location_code` | `erp_location.code` | có |  |
| `erp_stock_movement` | `lot_code` | `erp_lot.code` | có |  |
| `erp_stock_movement` | `material_code` | `erp_material.code` | có |  |
| `erp_stock_movement` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_stock_movement` | `uom_code` | `erp_uom.code` | có |  |
| `erp_stock_movement` | `warehouse_code` | `erp_warehouse.code` | có |  |
| `erp_supplier` | `supplier_group_code` | `erp_supplier_group.code` | có |  |
| `erp_uom_conversion` | `from_uom_code` | `erp_uom.code` | có |  |
| `erp_uom_conversion` | `to_uom_code` | `erp_uom.code` | có |  |
| `erp_uom_translation` | `language_code` | `sys_language.code` | không |  |
| `erp_uom_translation` | `uom_code` | `erp_uom.code` | không |  |
| `erp_warehouse` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_warehouse` | `warehouse_type_code` | `erp_warehouse_type.code` | có |  |
| `erp_warehouse_type_translation` | `language_code` | `sys_language.code` | không |  |
| `erp_warehouse_type_translation` | `warehouse_type_code` | `erp_warehouse_type.code` | không |  |
| `erp_warehouse_unit` | `unit_code` | `sys_company_unit.code` | có |  |
| `erp_warehouse_unit` | `warehouse_code` | `erp_warehouse.code` | không |  |
| `sys_approval_rule` | `unit_code` | `sys_company_unit.code` | có |  |
| `sys_command_translation` | `language_code` | `sys_language.code` | không |  |
| `sys_company_unit_translation` | `language_code` | `sys_language.code` | không |  |
| `sys_company_unit_translation` | `unit_code` | `sys_company_unit.code` | không |  |
| `sys_document_approval` | `unit_code` | `sys_company_unit.code` | có |  |
| `sys_exchange_rate` | `currency_code` | `sys_currency.code` | có |  |
| `sys_fiscal_period` | `unit_code` | `sys_company_unit.code` | có |  |
| `sys_login_notice` | `login_image_code` | `sys_login_image.code` | không |  |
| `sys_notification` | `unit_code` | `sys_company_unit.code` | không |  |
| `sys_user_company_unit` | `unit_code` | `sys_company_unit.code` | có |  |
| `sys_users` | `department_code` | `sys_department.code` | không |  |
| `sys_voucher_sequence` | `unit_code` | `sys_company_unit.code` | có |  |
| `sys_voucher_status` | `unit_code` | `sys_company_unit.code` | có |  |

(Tổng 89 tham chiếu. Cột chứng từ trỏ dòng nguồn bằng id như `purchase_request_line_id`, `purchase_order_line_id`, `issue_request_line_id` không nằm trong bản đồ vì là id, không phải mã danh mục; chúng được mô tả ở từng bảng.)

## 5. Mô tả từng bảng

### 5.1. Người dùng và phân quyền

#### 5.1.1. `sys_command`

Danh mục **chức năng và nút menu** (cây module → nhóm → chức năng). Mã chức năng (`menuid0`...) là khóa dùng chung cho menu, route, phân quyền, thông báo và phê duyệt; tự thêm khi backend khởi động từ `FunctionCatalog` và `menu.json`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `menuid0` | varchar(64) | không |  |  | Mã chức năng / nút menu (khóa chính; ví dụ inv_receipt) |
| 2 | `menuid` | varchar(64) | không | '' |  | Mã nút kiểu cũ |
| 3 | `text` | varchar(100) | không | '' |  | Tên tiếng Việt (kiểu cũ) |
| 4 | `text2` | varchar(100) | không | '' |  | Tên thứ hai (kiểu cũ) |
| 5 | `ma_ct` | varchar(3) | không | '' |  | Mã chứng từ gắn với nút (kiểu cũ) |
| 6 | `report` | varchar(100) | không | '' |  | Cờ báo cáo (kiểu cũ) |
| 7 | `command` | varchar(100) | không | '' |  | Lệnh thực thi (kiểu cũ) |
| 8 | `title` | text | không | '' |  | Tiêu đề (kiểu cũ) |
| 9 | `title2` | text | không | '' |  | Tiêu đề thứ hai (kiểu cũ) |
| 10 | `basicright` | smallint | không | 0 |  | Quyền cơ bản (kiểu cũ) |
| 11 | `picture1` | text | không | '' |  | Biểu tượng (kiểu cũ) |
| 12 | `picture2` | text | không | '' |  | Biểu tượng thứ hai (kiểu cũ) |
| 13 | `type` | varchar(3) | không | '' |  | Loại nút (kiểu cũ) |
| 14 | `sysid` | varchar(50) | không | '' |  | Mã hệ thống (kiểu cũ) |
| 15 | `syscode` | varchar(50) | không | '' |  | Mã phân hệ (kiểu cũ) |
| 16 | `hide_yn` | smallint | không | 0 |  | Cột kiểu cũ: ẩn |
| 17 | `hide_yn2` | smallint | có |  |  | Cờ ẩn thứ hai (kiểu cũ) |
| 18 | `ds_dvcs` | text | không | '' |  | Danh sách đơn vị áp dụng (kiểu cũ) |
| 19 | `menu_kind` | varchar(16) | có |  |  | Loại nút: module, group (nhóm), function (chức năng) |
| 20 | `menu_key` | varchar(64) | có |  |  | Khóa của module / nhóm |
| 21 | `menu_parent_id` | varchar(64) | có |  |  | Nút cha trong cây menu |
| 22 | `menu_icon` | varchar(64) | không | '' |  | Tên biểu tượng |
| 23 | `menu_icon_color` | varchar(64) | có |  |  | Màu biểu tượng |
| 24 | `menu_badge_type` | varchar(32) | có |  |  | Kiểu huy hiệu |
| 25 | `menu_direct_function_code` | varchar(64) | có |  |  | Module mở thẳng một chức năng (không có nhóm) |
| 26 | `menu_order_no` | integer | không | 0 |  | Thứ tự trong cây |
| 27 | `menu_is_active` | boolean | không | true |  | Nút đang hiển thị |

Chỉ mục:

- `ix_sys_command_menu_parent`: (menu_parent_id, menu_order_no)
- `sys_command_pkey`: **duy nhất** (menuid0)

Ràng buộc:

- `ck_sys_command_menu_kind` (CHECK): CHECK (((menu_kind IS NULL) OR ((menu_kind)::text = ANY ((ARRAY['module'::character varying, 'group'::character varying, 'function'::character varying])::text[]))))

#### 5.1.2. `sys_command_translation`

Tên chức năng / menu theo từng ngôn ngữ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `menuid0` | varchar(64) | không |  |  | Mã chức năng |
| 2 | `language_code` | varchar(10) | không |  |  | Mã ngôn ngữ. Trỏ `sys_language` |
| 3 | `title` | varchar(200) | không |  |  | Tên theo ngôn ngữ |

Chỉ mục:

- `sys_command_translation_pkey`: **duy nhất** (menuid0, language_code)

#### 5.1.3. `sys_role`

Vai trò (nhóm quyền). `role_code` duy nhất; vai trò `ADMIN` có mọi quyền.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `role_id` | integer | không | tự tăng |  | Khóa chính |
| 2 | `role_code` | varchar(50) | không |  |  | Mã vai trò, duy nhất; ADMIN có mọi quyền |
| 3 | `role_name` | varchar(100) | không |  |  | Tên vai trò |
| 4 | `description` | text | có |  |  | Mô tả |
| 5 | `validflg` | smallint | không | 1 |  | Cờ cũ: hợp lệ |
| 6 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 7 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 8 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 9 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 10 | `status` | varchar(1) | không | '1' |  | Cờ trạng thái kiểu cũ |

Chỉ mục:

- `sys_role_pkey`: **duy nhất** (role_id)
- `ux_sys_role_code`: **duy nhất** (role_code)
- `ux_sys_role_name`: **duy nhất** (role_name)

#### 5.1.4. `sys_role_command`

Ma trận quyền của **vai trò** theo chức năng (xem, thêm, sửa, xóa, duyệt, in, xuất; vẫn lưu dạng 11 cờ cũ).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `role_id` | integer | không |  |  | Mã vai trò (trỏ `sys_role`) |
| 2 | `menuid0` | varchar(64) | không |  |  | Mã chức năng |
| 3 | `can_view` | boolean | không | false |  | Quyền Xem |
| 4 | `can_add` | boolean | không | false |  | Quyền Thêm (gồm sao chép, nhập Excel) |
| 5 | `can_edit` | boolean | không | false |  | Quyền Sửa |
| 6 | `can_delete` | boolean | không | false |  | Quyền Xóa |
| 7 | `can_print` | boolean | không | false |  | Quyền In |
| 8 | `can_import` | boolean | không | false |  | Cờ cũ (nay gộp vào Thêm) |
| 9 | `can_export` | boolean | không | false |  | Quyền Xuất dữ liệu ra tệp |
| 10 | `can_search` | boolean | không | false |  | Cờ cũ |
| 11 | `can_reload` | boolean | không | false |  | Cờ cũ |
| 12 | `can_copy` | boolean | không | false |  | Cờ cũ (nay gộp vào Thêm) |
| 13 | `can_approve` | boolean | không | false |  | Quyền Duyệt |
| 14 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 15 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 16 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 17 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 18 | `status` | varchar(1) | không | '1' |  | Trạng thái |

Chỉ mục:

- `ix_sys_role_command_menu`: (menuid0)
- `sys_role_command_pkey`: **duy nhất** (role_id, menuid0)

#### 5.1.5. `sys_role_right`

Quyền đặc biệt của vai trò, dạng `{chức năng}:{MÃ}` (ví dụ `inv_receipt:VIEW_PRICE`); quyền trạng thái theo đơn vị có đuôi `@DVCS`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `role_id` | integer | không |  |  | Mã vai trò (trỏ `sys_role`) |
| 2 | `menuid0` | varchar(64) | không |  |  | Mã chức năng |
| 3 | `right_code` | varchar(50) | không |  |  | Mã quyền đặc biệt (VIEW_PRICE, VIEW_ALL, VIEW_COST, ST_APPROVED@DVCS01...) |
| 4 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 5 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 6 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 7 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 8 | `status` | varchar(1) | không | '1' |  | Trạng thái |

Chỉ mục:

- `sys_role_right_pkey`: **duy nhất** (role_id, menuid0, right_code)

#### 5.1.6. `sys_user_command`

Quyền **ngoại lệ** của người dùng: mỗi dòng thay thế quyền của vai trò cho đúng một chức năng; hệ thống chỉ lưu phần chênh lệch.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `user_id` | integer | không |  |  | Mã người dùng (trỏ `sys_users`) |
| 2 | `menuid0` | varchar(64) | không |  |  | Mã chức năng |
| 3 | `can_view` | boolean | không | false |  | Quyền Xem (thay thế quyền vai trò cho chức năng này) |
| 4 | `can_add` | boolean | không | false |  | Quyền Thêm |
| 5 | `can_edit` | boolean | không | false |  | Quyền Sửa |
| 6 | `can_delete` | boolean | không | false |  | Quyền Xóa |
| 7 | `can_print` | boolean | không | false |  | Quyền In |
| 8 | `can_import` | boolean | không | false |  | Cờ cũ |
| 9 | `can_export` | boolean | không | false |  | Quyền Xuất |
| 10 | `can_search` | boolean | không | false |  | Cờ cũ |
| 11 | `can_reload` | boolean | không | false |  | Cờ cũ |
| 12 | `can_copy` | boolean | không | false |  | Cờ cũ |
| 13 | `can_approve` | boolean | không | false |  | Quyền Duyệt |
| 14 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 15 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 16 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 17 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 18 | `status` | varchar(1) | không | '1' |  | Trạng thái |

Chỉ mục:

- `ix_sys_user_command_menu`: (menuid0)
- `sys_user_command_pkey`: **duy nhất** (user_id, menuid0)

#### 5.1.7. `sys_user_company_unit`

Các đơn vị cơ sở mà người dùng được làm việc (đổi đơn vị bằng `POST /api/auth/switch-unit`).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `user_id` | integer | không |  |  | Mã người dùng (trỏ `sys_users`) |
| 2 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở được phép làm việc. Trỏ `sys_company_unit` |

Chỉ mục:

- `ix_sys_user_company_unit_unit`: (unit_code)
- `sys_user_company_unit_pkey`: **duy nhất** (user_id, unit_code)

#### 5.1.8. `sys_user_right`

Quyền đặc biệt của riêng người dùng: `is_granted` = true cấp thêm, false thu hồi so với vai trò.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `user_id` | integer | không |  |  | Mã người dùng (trỏ `sys_users`) |
| 2 | `menuid0` | varchar(64) | không |  |  | Mã chức năng |
| 3 | `right_code` | varchar(50) | không |  |  | Mã quyền đặc biệt |
| 4 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 5 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 6 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 7 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 8 | `status` | varchar(1) | không | '1' |  | Trạng thái |
| 9 | `is_granted` | boolean | không | true |  | true = cấp thêm so với vai trò; false = thu hồi |

Chỉ mục:

- `sys_user_right_pkey`: **duy nhất** (user_id, menuid0, right_code)

#### 5.1.9. `sys_user_role`

Gán vai trò cho người dùng.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `user_id` | integer | không |  |  | Người dùng |
| 2 | `role_id` | integer | không |  |  | Vai trò |
| 3 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 4 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 5 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 6 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 7 | `status` | varchar(1) | không | '1' |  | Trạng thái |

Chỉ mục:

- `ix_sys_user_role_role`: (role_id)
- `sys_user_role_pkey`: **duy nhất** (user_id, role_id)

#### 5.1.10. `sys_users`

Tài khoản người dùng. Khóa là `user_id`; `user_name` đăng nhập; `password_hash` là băm mật khẩu; `security_version` tăng khi khóa tài khoản hoặc đổi mật khẩu để vô hiệu hóa token cũ; `ma_dvcs` là đơn vị cơ sở mặc định. Nhiều cột `createtime/createid/...` là kiểu cũ (legacy).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `user_id` | integer | không | tự tăng |  | Khóa chính (số nguyên tự tăng) |
| 2 | `user_name` | varchar(100) | không |  |  | Tên đăng nhập, duy nhất |
| 3 | `password_hash` | varchar(255) | không |  |  | Băm mật khẩu (không bao giờ trả về qua API) |
| 4 | `full_name` | varchar(100) | không |  |  | Họ tên |
| 5 | `ma_dvcs` | varchar(20) | không | '' |  | Đơn vị cơ sở mặc định của người dùng (trỏ sys_company_unit) |
| 6 | `email` | varchar(150) | có |  |  | Email |
| 7 | `phone` | varchar(20) | có |  |  | Điện thoại |
| 8 | `department` | varchar(100) | không | '' |  | Tên phòng ban để hiển thị; mã nằm ở department_code |
| 9 | `avatar` | text | không | '' |  | Ảnh đại diện |
| 10 | `theme_pref` | varchar(10) | không | 'light' |  | Giao diện ưa thích (light / dark) |
| 11 | `notifications_enabled` | boolean | không | true |  | Bật nhận thông báo |
| 12 | `security_version` | integer | không | 1 |  | Tăng khi khóa tài khoản hoặc đổi mật khẩu: token cũ lập tức vô hiệu |
| 13 | `is_active` | boolean | không | true |  | Tài khoản đang dùng (false = bị khóa / xóa mềm) |
| 14 | `employee_code` | text | không | '' |  | Mã nhân viên |
| 15 | `auth_fl` | varchar(25) | không | '' |  | Cờ quyền kiểu cũ; chứa ký tự 0 = quản trị |
| 16 | `enablefl` | integer | không | 1 |  | Cờ cũ: cho phép |
| 17 | `validflg` | integer | không | 1 |  | Cờ cũ: hợp lệ (0 = đã xóa mềm) |
| 18 | `gender` | boolean | không | false |  | Giới tính (kiểu cũ) |
| 19 | `createtime` | timestamp | có |  |  | Thời điểm tạo (kiểu cũ) |
| 20 | `createid` | varchar(20) | có |  |  | Người tạo (kiểu cũ) |
| 21 | `updatetime` | timestamp | có |  |  | Thời điểm sửa (kiểu cũ) |
| 22 | `updateid` | varchar(20) | có |  |  | Người sửa (kiểu cũ) |
| 23 | `status` | varchar(1) | không | '1' |  | Cờ trạng thái kiểu cũ |
| 24 | `department_code` | varchar(20) | có |  |  | Phòng ban (trỏ `sys_department`) |
| 25 | `language` | varchar(10) | có |  |  | Ngôn ngữ riêng của người dùng (rỗng = ngôn ngữ mặc định; gửi lên bằng Accept-Language) |

Chỉ mục:

- `ix_sys_users_department`: (department_code)
- `ix_sys_users_language`: (language)
- `sys_users_pkey`: **duy nhất** (user_id)
- `ux_sys_users_name`: **duy nhất** (lower((user_name)::text)) WHERE (validflg = 1)

### 5.2. Cài đặt hệ thống

#### 5.2.1. `sys_banner`

Thanh thông báo hệ thống dưới header: mức INFO / WARNING / URGENT, khoảng giờ UTC, đơn vị áp dụng.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(30) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `message` | varchar(500) | không |  |  | Nội dung tiếng Việt |
| 3 | `message_en` | varchar(500) | có |  |  | Nội dung tiếng Anh |
| 4 | `level` | varchar(8) | không | 'INFO' |  | INFO, WARNING, URGENT (URGENT không đóng được) |
| 5 | `start_at` | timestamptz | có |  |  | Bắt đầu hiển thị (UTC) |
| 6 | `end_at` | timestamptz | có |  |  | Kết thúc hiển thị (UTC) |
| 7 | `unit_codes` | varchar(500) | không | '' |  | Đơn vị áp dụng (rỗng = tất cả) |
| 8 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 9 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 10 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 11 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 12 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 13 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_banner_pkey`: **duy nhất** (code)

Ràng buộc:

- `ck_sys_banner_level` (CHECK): CHECK (((level)::text = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'URGENT'::character varying])::text[])))
- `ck_sys_banner_time` (CHECK): CHECK (((start_at IS NULL) OR (end_at IS NULL) OR (end_at >= start_at)))

#### 5.2.2. `sys_fiscal_period`

Khóa sổ theo **tháng và đơn vị cơ sở**: tháng đã khóa không lập, sửa, xóa chứng từ có ngày thuộc tháng đó.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 2 | `year` | integer | không |  |  | Năm |
| 3 | `month` | integer | không |  |  | Tháng |
| 4 | `is_locked` | boolean | không | false |  | Đã khóa sổ: không lập / sửa / xóa chứng từ có ngày trong tháng |
| 5 | `locked_by_user_id` | integer | có |  |  | Người khóa |
| 6 | `locked_at_utc` | timestamptz | có |  |  | Thời điểm khóa (UTC) |

Chỉ mục:

- `sys_fiscal_period_pkey`: **duy nhất** (unit_code, year, month)

Ràng buộc:

- `sys_fiscal_period_month_check` (CHECK): CHECK (((month >= 1) AND (month <= 12)))

#### 5.2.3. `sys_grid_layout`

Bố cục lưới của từng người dùng (cột ẩn, thứ tự, độ rộng, sắp xếp, cỡ trang) và bố cục mặc định của công ty, theo chức năng + tên lưới.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | nextval('sys_grid_layout_id_seq') |  | Khóa chính, tự tăng |
| 2 | `function_code` | varchar(64) | không |  |  | Chức năng chứa lưới |
| 3 | `grid_key` | varchar(64) | không | 'main' |  | Tên lưới trong chức năng |
| 4 | `user_id` | integer | có |  |  | Người dùng; rỗng = bố cục mặc định của công ty |
| 5 | `layout` | jsonb | không |  |  | JSON: cột ẩn, thứ tự, độ rộng, sắp xếp, cỡ trang |
| 6 | `updated_at` | timestamptz | không | now() |  | Thời điểm sửa gần nhất (UTC) |
| 7 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_grid_layout_pkey`: **duy nhất** (id)
- `ux_sys_grid_layout`: **duy nhất** (function_code, grid_key, COALESCE(user_id, 0))

#### 5.2.4. `sys_login_image`

Ảnh của thông báo đăng nhập (đã thu nhỏ, lưu dạng base64), đọc qua API mở `GET /api/auth/notice-images/{mã}`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(40) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `content_type` | varchar(30) | không |  |  | Kiểu tệp ảnh |
| 3 | `size_bytes` | integer | không |  |  | Dung lượng |
| 4 | `data` | bytea | không |  |  | Nội dung ảnh (base64) |
| 5 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 6 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 7 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 8 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_login_image_pkey`: **duy nhất** (code)

Được trỏ tới bởi: `sys_login_notice.login_image_code`.

#### 5.2.5. `sys_login_notice`

Thông báo hiện ở bảng bên trái màn đăng nhập (đang dùng, khoảng ngày, nội dung vi / en, ghim, loại nền).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(30) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `title` | varchar(200) | không |  |  | Tiêu đề (vi) |
| 3 | `content` | varchar(2000) | không | '' |  | Nội dung (vi) |
| 4 | `title_en` | varchar(200) | có |  |  | Tiêu đề (en) |
| 5 | `content_en` | varchar(2000) | có |  |  | Nội dung (en) |
| 6 | `kind` | varchar(12) | không | 'INFO' |  | Loại: thông báo hoặc BACKGROUND (chỉ ảnh nền) |
| 7 | `start_date` | date | có |  |  | Từ ngày |
| 8 | `end_date` | date | có |  |  | Đến ngày |
| 9 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 10 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 11 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 12 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 13 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 14 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 15 | `pinned` | boolean | không | false |  | Ghim: giữ ô lớn, các thông báo khác luân phiên ở ô nhỏ |
| 16 | `login_image_code` | varchar(40) | có |  |  | Ảnh đính kèm (trỏ sys_login_image) |

Chỉ mục:

- `ix_sys_login_notice_login_image_code`: (login_image_code)
- `sys_login_notice_pkey`: **duy nhất** (code)

Ràng buộc:

- `ck_sys_login_notice_dates` (CHECK): CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date)))
- `ck_sys_login_notice_kind` (CHECK): CHECK (((kind)::text = ANY ((ARRAY['INFO'::character varying, 'WELCOME'::character varying, 'MAINTENANCE'::character varying, 'RULE'::character varying, 'BACKGROUND'::character varying])::text[])))

#### 5.2.6. `sys_setting`

Cấu hình dạng JSON theo mục (`section`) và đơn vị: mặc định, năm làm việc, hồ sơ doanh nghiệp, định dạng số, ẩn / hiện menu, thời hạn giữ nhật ký... Dùng cho giá trị mà bảng khác không tham chiếu tới.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `key` | varchar(100) | không |  |  | Tên mục cấu hình (FRONTEND_SYSTEM_DEFAULTS, FRONTEND_FISCAL_CONFIG, FRONTEND_COMPANY_PROFILE, MENU_VISIBILITY...) |
| 3 | `value` | text | không |  |  | Nội dung JSON của mục |
| 4 | `scope` | varchar(50) | không |  |  | Phạm vi (GLOBAL hoặc theo đơn vị) |
| 5 | `is_public` | boolean | không | true |  | Cho phép đọc công khai (trang đăng nhập) |
| 6 | `updated_at_utc` | timestamptz | không |  |  | Thời điểm sửa (UTC) |
| 7 | `updated_by_user_id` | integer | không |  |  | Người sửa (mã người dùng) |

Chỉ mục:

- `sys_setting_pkey`: **duy nhất** (id)
- `ux_sys_setting_key_scope`: **duy nhất** (key, scope)

Ràng buộc:

- `ux_sys_setting_key_scope` (UNIQUE): UNIQUE (key, scope)

#### 5.2.7. `sys_voucher_numbering`

Mẫu số chứng từ theo loại chứng từ và đơn vị (có `{DVCS}`, năm, tháng, số thứ tự).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `voucher_type` | varchar(20) | không |  |  | Loại chứng từ (PNK, PXK, YCX, YCM, DMH...) |
| 2 | `menuid0` | varchar(64) | không |  |  | Mã chức năng |
| 3 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 4 | `prefix` | varchar(20) | không |  |  | Tiền tố số phiếu |
| 5 | `pattern` | varchar(100) | không |  |  | Mẫu số: tiền tố, {DVCS}, năm, tháng, số thứ tự; bắt buộc có {DVCS} |
| 6 | `digits` | smallint | không | 4 |  | Số chữ số của phần thứ tự |
| 7 | `updated_at_utc` | timestamptz | có |  |  | Thời điểm sửa (UTC) |
| 8 | `updated_by_user_id` | integer | có |  |  | Người sửa (mã người dùng) |

Chỉ mục:

- `sys_voucher_numbering_pkey`: **duy nhất** (voucher_type)

#### 5.2.8. `sys_voucher_sequence`

Bộ đếm số chứng từ theo loại + đơn vị + kỳ (`period_key`); cấp số nguyên tử trong giao dịch lưu phiếu.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `voucher_type` | varchar(20) | không |  |  | Loại nghiệp vụ của chứng từ |
| 2 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 3 | `period_key` | varchar(8) | không |  |  | Kỳ cấp số (ví dụ 202610: năm + tháng) |
| 4 | `last_number` | integer | không | 0 |  | Số đã cấp gần nhất trong kỳ |

Chỉ mục:

- `ix_sys_voucher_sequence_unit`: (unit_code)
- `sys_voucher_sequence_pkey`: **duy nhất** (voucher_type, unit_code, period_key)

#### 5.2.9. `sys_voucher_status`

Tên trạng thái chứng từ đổi theo đơn vị và việc bật / tắt bước **Chờ duyệt**; chỉ lưu trạng thái đã đổi so với mặc định.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | nextval('sys_voucher_status_id_seq') |  | Khóa chính, tự tăng |
| 2 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 3 | `voucher_type` | varchar(20) | không |  |  | Loại chứng từ |
| 4 | `status_code` | varchar(20) | không |  |  | Mã trạng thái cố định (Draft, Pending, Approved, Posted, Cancelled) |
| 5 | `name` | varchar(100) | có |  |  | Tên tiếng Việt do đơn vị đặt |
| 6 | `name_en` | varchar(100) | có |  |  | Tên tiếng Anh do đơn vị đặt |
| 7 | `is_enabled` | boolean | không | true |  | Bước còn dùng (tắt Chờ duyệt = phiếu bỏ qua bước duyệt) |
| 8 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 9 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 10 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 11 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `ix_sys_voucher_status_unit_code`: (unit_code)
- `sys_voucher_status_pkey`: **duy nhất** (id)
- `ux_sys_voucher_status_unit_type_status`: **duy nhất** (unit_code, voucher_type, status_code)

Ràng buộc:

- `ck_sys_voucher_status_code` (CHECK): CHECK (((status_code)::text = ANY ((ARRAY['Draft'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Posted'::character varying, 'Cancelled'::character varying])::text[])))

### 5.3. Danh mục hệ thống

#### 5.3.1. `sys_company_unit`

Đơn vị cơ sở (DVCS): chi nhánh / công ty con mà chứng từ và kho thuộc về.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(150) | không |  |  | Tên hiển thị |
| 3 | `short_name` | varchar(100) | có |  |  | Tên viết tắt |
| 4 | `address` | varchar(300) | có |  |  | Địa chỉ |
| 5 | `phone` | varchar(30) | có |  |  | Điện thoại |
| 6 | `email` | varchar(150) | có |  |  | Email |
| 7 | `tax_code` | varchar(30) | có |  |  | Mã số thuế (khác `tax_rate_code`) |
| 8 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 9 | `is_default` | boolean | không | false |  | Đơn vị mặc định |
| 10 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 11 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 12 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 13 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 14 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_company_unit_pkey`: **duy nhất** (code)

Được trỏ tới bởi: `erp_goods_issue.unit_code`, `erp_goods_receipt.unit_code`, `erp_issue_request.unit_code`, `erp_purchase_order.unit_code`, `erp_purchase_request.unit_code`, `erp_stock_balance.unit_code`, `erp_stock_location_balance.unit_code`, `erp_stock_lot_balance.unit_code`, `erp_stock_movement.unit_code`, `erp_warehouse.unit_code`, `erp_warehouse_unit.unit_code`, `sys_approval_rule.unit_code`, `sys_company_unit_translation.unit_code`, `sys_document_approval.unit_code`, `sys_fiscal_period.unit_code`, `sys_notification.unit_code`, `sys_user_company_unit.unit_code`, `sys_voucher_sequence.unit_code`, `sys_voucher_status.unit_code`.

#### 5.3.2. `sys_company_unit_translation`

Tên đơn vị cơ sở theo ngôn ngữ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 2 | `language_code` | varchar(10) | không |  |  | Mã ngôn ngữ (trỏ sys_language) |
| 3 | `name` | varchar(150) | không |  |  | Tên hiển thị |
| 4 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 5 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 6 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 7 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `ix_sys_company_unit_translation_language`: (language_code)
- `sys_company_unit_translation_pkey`: **duy nhất** (unit_code, language_code)

#### 5.3.3. `sys_currency`

Danh mục loại tiền; đúng một đồng tiền hạch toán (`is_base`).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(10) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `symbol` | varchar(10) | không | '' |  | Ký hiệu |
| 4 | `decimal_places` | smallint | không | 2 |  | Số chữ số thập phân khi hiển thị |
| 5 | `is_base` | boolean | không | false |  | Đồng tiền hạch toán (đúng một) |
| 6 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 7 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 8 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 9 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 10 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 11 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_currency_pkey`: **duy nhất** (code)
- `ux_sys_currency_base`: **duy nhất** (is_base) WHERE is_base

Được trỏ tới bởi: `erp_goods_issue.currency_code`, `erp_goods_receipt.currency_code`, `erp_issue_request.currency_code`, `erp_purchase_order.currency_code`, `erp_purchase_request.currency_code`, `sys_exchange_rate.currency_code`.

#### 5.3.4. `sys_department`

Danh mục phòng ban; người dùng và quy tắc duyệt trỏ tới bằng `department_code`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `note` | varchar(300) | có |  |  | Ghi chú |
| 4 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 5 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 6 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 7 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 8 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 9 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_department_pkey`: **duy nhất** (code)
- `ux_sys_department_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_issue_request.department_code`, `erp_project.department_code`, `erp_purchase_request.department_code`, `sys_users.department_code`.

#### 5.3.5. `sys_exchange_rate`

Tỷ giá theo loại tiền và ngày; mã danh mục dạng `USD@2026-10-08`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `currency_code` | varchar(10) | không |  |  | Loại tiền (trỏ `sys_currency`) |
| 3 | `rate_date` | date | không |  |  | Ngày áp dụng tỷ giá |
| 4 | `buy_rate` | numeric(18,6) | không | 0 |  | Tỷ giá mua |
| 5 | `sell_rate` | numeric(18,6) | không | 0 |  | Tỷ giá bán |
| 6 | `accounting_rate` | numeric(18,6) | không |  |  | Tỷ giá hạch toán (chứng từ lấy số này) |
| 9 | `code` | varchar(24) | không |  |  | Mã dạng USD@2026-10-08 |
| 10 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 11 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 12 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 13 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 14 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 15 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_exchange_rate_pkey`: **duy nhất** (id)
- `ux_sys_exchange_rate_code`: **duy nhất** (code)
- `ux_sys_exchange_rate_day`: **duy nhất** (currency_code, rate_date)

Ràng buộc:

- `ux_sys_exchange_rate_day` (UNIQUE): UNIQUE (currency_code, rate_date)

#### 5.3.6. `sys_language`

Danh mục ngôn ngữ giao diện (mã chữ thường như `vi`, `en`); một dòng là mặc định.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(10) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(50) | không |  |  | Tên hiển thị |
| 3 | `native_name` | varchar(50) | không |  |  | Tên bằng chính ngôn ngữ đó |
| 4 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 5 | `is_default` | boolean | không | false |  | Ngôn ngữ mặc định (đúng một) |
| 6 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 7 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 8 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 9 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 10 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_language_pkey`: **duy nhất** (code)
- `ux_sys_language_default`: **duy nhất** (is_default) WHERE is_default

Được trỏ tới bởi: `erp_uom_translation.language_code`, `erp_warehouse_type_translation.language_code`, `sys_command_translation.language_code`, `sys_company_unit_translation.language_code`.

#### 5.3.7. `sys_tax_rate`

Danh mục mã thuế (VAT, nhập khẩu, khác), thuế suất theo phần trăm, cờ miễn thuế. Cột trỏ tới là `tax_rate_code`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `tax_type` | varchar(10) | không | 'VAT' |  | Loại thuế: VAT, IMPORT, OTHER |
| 4 | `rate` | numeric(7,4) | không | 0 |  | Thuế suất (%) |
| 5 | `is_exempt` | boolean | không | false |  | Miễn thuế (thuế suất coi như 0) |
| 6 | `note` | varchar(300) | có |  |  | Ghi chú |
| 7 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 8 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 9 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 10 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 11 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 12 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `sys_tax_rate_pkey`: **duy nhất** (code)
- `ux_sys_tax_rate_name`: **duy nhất** (lower((name)::text))

Ràng buộc:

- `ck_sys_tax_rate_rate` (CHECK): CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric)))
- `ck_sys_tax_rate_type` (CHECK): CHECK (((tax_type)::text = ANY ((ARRAY['VAT'::character varying, 'IMPORT'::character varying, 'OTHER'::character varying])::text[])))

Được trỏ tới bởi: `erp_material.import_tax_rate_code`, `erp_material.vat_tax_rate_code`, `erp_purchase_order.tax_rate_code`.

### 5.4. Phê duyệt, thông báo, nhật ký

#### 5.4.1. `sys_approval_rule`

Quy tắc phê duyệt: chức năng, điều kiện (giá trị, phòng ban), các cấp duyệt và người duyệt.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `menuid0` | varchar(64) | không |  |  | Chức năng chứng từ áp dụng |
| 3 | `unit_code` | varchar(20) | có |  |  | Đơn vị áp dụng. Trỏ `sys_company_unit` |
| 4 | `level` | integer | không | 1 |  | Cấp duyệt (1, 2, ...) |
| 5 | `requester_type` | varchar(20) | không | 'ANY' |  | Điều kiện người lập (tất cả hoặc theo phòng ban) |
| 6 | `requester_value` | varchar(100) | có |  |  | Giá trị điều kiện (mã phòng ban) |
| 7 | `min_amount` | numeric(18,2) | có |  |  | Chỉ áp dụng khi giá trị phiếu từ mức này trở lên |
| 8 | `approver_type` | varchar(20) | không |  |  | Kiểu người duyệt (người có quyền Duyệt, người cụ thể, phòng ban) |
| 9 | `approver_value` | varchar(100) | không |  |  | Giá trị người duyệt |
| 10 | `note` | varchar(500) | có |  |  | Ghi chú |
| 11 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 12 | `updated_at_utc` | timestamptz | không |  |  | Thời điểm sửa (UTC) |
| 13 | `updated_by_user_id` | integer | không |  |  | Người sửa |

Chỉ mục:

- `ix_sys_approval_rule_menu`: (menuid0, level)
- `ix_sys_approval_rule_unit`: (unit_code)
- `sys_approval_rule_pkey`: **duy nhất** (id)

#### 5.4.2. `sys_audit_log`

**Nhật ký thay đổi** dùng chung mọi chức năng, tự ghi khi lưu (trường, giá trị trước → sau, người, đơn vị, địa chỉ IP); dọn tự động theo thời hạn giữ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | nextval('sys_audit_log_id_seq') |  | Khóa chính, tự tăng |
| 2 | `log_time` | timestamp | không | now() |  | Thời điểm ghi |
| 3 | `function_code` | varchar(64) | không |  |  | Chức năng |
| 4 | `object_type` | varchar(50) | không |  |  | Loại đối tượng (purchaseOrder, project, user...) |
| 5 | `object_id` | varchar(64) | không |  |  | Mã / id đối tượng |
| 6 | `object_label` | varchar(300) | có |  |  | Nhãn hiển thị của đối tượng |
| 7 | `action` | varchar(30) | không |  |  | CREATE, UPDATE, DELETE, EXPORT, PURGE, các hành động duyệt... |
| 8 | `changes` | jsonb | không | '[]' |  | JSON các thay đổi: trường, giá trị trước, giá trị sau |
| 9 | `note` | varchar(1000) | có |  |  | Ghi chú |
| 10 | `actor_id` | integer | có |  |  | Mã người thực hiện |
| 11 | `actor_username` | varchar(50) | có |  |  | Tên đăng nhập người thực hiện (chép lúc ghi) |
| 12 | `actor_name` | varchar(100) | có |  |  | Họ tên người thực hiện |
| 13 | `unit_code` | varchar(20) | có |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 14 | `ip_address` | varchar(64) | có |  |  | Địa chỉ IP |

Chỉ mục:

- `ix_sys_audit_log_actor`: (actor_id, log_time DESC)
- `ix_sys_audit_log_function`: (function_code, log_time DESC)
- `ix_sys_audit_log_object`: (object_type, object_id, log_time DESC)
- `ix_sys_audit_log_time`: (log_time)
- `sys_audit_log_pkey`: **duy nhất** (id)

#### 5.4.3. `sys_document_approval`

Các cấp phê duyệt của từng chứng từ (khóa theo mã chức năng + số chứng từ): cấp, người duyệt hợp lệ, trạng thái, người và thời điểm xử lý, lý do.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `menuid0` | varchar(64) | không |  |  | Chức năng của chứng từ |
| 3 | `document_id` | varchar(64) | không |  |  | Số chứng từ (cùng với menuid0 xác định chứng từ) |
| 4 | `document_title` | varchar(200) | có |  |  | Tiêu đề hiển thị |
| 5 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 6 | `amount` | numeric(18,2) | có |  |  | Giá trị phiếu lúc gửi duyệt |
| 7 | `round` | integer | không | 1 |  | Vòng duyệt (tăng mỗi lần gửi lại) |
| 8 | `level` | integer | không |  |  | Cấp duyệt |
| 9 | `approver_user_ids` | text | không |  |  | Danh sách mã người duyệt hợp lệ của cấp, cách nhau dấu phẩy |
| 10 | `approver_label` | varchar(300) | có |  |  | Mô tả người duyệt để hiển thị |
| 11 | `status` | varchar(20) | không |  |  | Trạng thái của cấp duyệt (chờ, đã duyệt, từ chối, rút lại) |
| 12 | `requested_by_user_id` | integer | không |  |  | Người gửi duyệt |
| 13 | `requested_at_utc` | timestamptz | không |  |  | Thời điểm gửi (UTC) |
| 14 | `acted_by_user_id` | integer | có |  |  | Người xử lý |
| 15 | `acted_at_utc` | timestamptz | có |  |  | Thời điểm xử lý (UTC) |
| 16 | `note` | varchar(1000) | có |  |  | Lý do / ghi chú |

Chỉ mục:

- `ix_sys_document_approval_doc`: (menuid0, document_id, round)
- `ix_sys_document_approval_pending`: (unit_code, status)
- `sys_document_approval_pkey`: **duy nhất** (id)

#### 5.4.4. `sys_notification`

Thông báo gửi cho người dùng (cá nhân hoặc toàn đơn vị), có liên kết mở thẳng chứng từ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `title` | varchar(200) | không |  |  | Tiêu đề |
| 3 | `body` | text | không |  |  | Nội dung |
| 4 | `type` | varchar(20) | không | 'info' |  | Mức: info, success, warning, danger |
| 5 | `link_module` | varchar(64) | có |  |  | Module để mở khi bấm |
| 6 | `unit_code` | varchar(20) | có |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 7 | `recipient_user_id` | integer | có |  |  | Người nhận (rỗng = cả đơn vị) |
| 8 | `created_at_utc` | timestamptz | không |  |  | Thời điểm tạo (UTC) |
| 9 | `expires_at_utc` | timestamptz | có |  |  | Hết hạn (dọn tự động) |
| 10 | `created_by_user_id` | integer | không |  |  | Người gửi |
| 11 | `link_function` | varchar(64) | có |  |  | Chức năng để mở khi bấm |
| 12 | `link_document_id` | varchar(64) | có |  |  | Số chứng từ để mở khi bấm |

Chỉ mục:

- `ix_sys_notification_created`: (created_at_utc)
- `ix_sys_notification_inbox`: (unit_code, recipient_user_id, created_at_utc)
- `sys_notification_pkey`: **duy nhất** (id)

#### 5.4.5. `sys_notification_read`

Người dùng nào đã đọc thông báo nào.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `notification_id` | bigint | không |  |  | Thông báo |
| 2 | `user_id` | integer | không |  |  | Mã người dùng (trỏ `sys_users`) |
| 3 | `read_at_utc` | timestamptz | không |  |  | Đã đọc lúc |
| 4 | `dismissed_at_utc` | timestamptz | có |  |  | Đã ẩn lúc |

Chỉ mục:

- `ix_sys_notification_read_user`: (user_id)
- `sys_notification_read_pkey`: **duy nhất** (notification_id, user_id)

### 5.5. Danh mục Kho

#### 5.5.1. `erp_location`

Vị trí lưu kho (kệ, ô...) thuộc đúng một kho; mã duy nhất toàn hệ thống.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(30) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `warehouse_code` | varchar(20) | không |  |  | Kho chứa vị trí (không đổi sau khi lưu). Trỏ `erp_warehouse` |
| 4 | `zone` | varchar(50) | có |  |  | Khu |
| 5 | `rack` | varchar(50) | có |  |  | Dãy / kệ |
| 6 | `shelf` | varchar(50) | có |  |  | Tầng / ô |
| 7 | `capacity` | numeric(18,4) | có |  |  | Sức chứa |
| 8 | `note` | varchar(300) | có |  |  | Ghi chú |
| 9 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 10 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 11 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 12 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 13 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 14 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_location_pkey`: **duy nhất** (code)
- `ix_erp_location_warehouse_code`: (warehouse_code)
- `ux_erp_location_warehouse_name`: **duy nhất** (warehouse_code, lower((name)::text))

Ràng buộc:

- `ck_erp_location_capacity` (CHECK): CHECK (((capacity IS NULL) OR (capacity >= (0)::numeric)))

Được trỏ tới bởi: `erp_stock_location_balance.location_code`, `erp_stock_movement.location_code`.

#### 5.5.2. `erp_lot`

Lô hàng của vật tư có theo dõi lô; khóa gộp vật tư + số lô, ngày hết hạn, trạng thái chặn.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 2 | `code` | varchar(81) | không |  |  | Mã lô dạng VT001@LOT-2610 (vật tư @ số lô) |
| 3 | `material_code` | varchar(50) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 4 | `lot_no` | varchar(30) | không |  |  | Số lô |
| 5 | `mfg_date` | date | có |  |  | Ngày sản xuất |
| 6 | `exp_date` | date | có |  |  | Ngày hết hạn |
| 7 | `supplier_code` | varchar(20) | có |  |  | Nhà cung cấp của lô (tùy chọn). Trỏ `erp_supplier` |
| 8 | `quality_status` | varchar(10) | không | 'PASSED' |  | Chất lượng: PASSED (đạt), INSPECT (đang kiểm), BLOCKED (chặn: không nhập, không xuất) |
| 9 | `note` | varchar(300) | có |  |  | Ghi chú |
| 10 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 11 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 12 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 13 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 14 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 15 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_lot_pkey`: **duy nhất** (code)
- `ix_erp_lot_exp_date`: (exp_date)
- `ix_erp_lot_material_code`: (material_code, lot_no)
- `ix_erp_lot_supplier_code`: (supplier_code)

Ràng buộc:

- `ck_erp_lot_dates` (CHECK): CHECK (((mfg_date IS NULL) OR (exp_date IS NULL) OR (exp_date >= mfg_date)))
- `ck_erp_lot_quality` (CHECK): CHECK (((quality_status)::text = ANY ((ARRAY['PASSED'::character varying, 'INSPECT'::character varying, 'BLOCKED'::character varying])::text[])))

Được trỏ tới bởi: `erp_stock_location_balance.lot_code`, `erp_stock_lot_balance.lot_code`, `erp_stock_movement.lot_code`.

#### 5.5.3. `erp_material`

Danh mục **vật tư / hàng hóa**: đơn vị tính gốc, loại, nhóm, các cờ `track_lot`, `has_expiry`, `track_location`, `is_stock_item`, phương pháp tính giá (AVERAGE / FIFO), tồn tối thiểu...

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(50) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(200) | không |  |  | Tên hiển thị |
| 3 | `customer_material_code` | varchar(50) | có |  |  | Mã vật tư của khách hàng |
| 4 | `part_no` | varchar(50) | có |  |  | Part number / mã hãng |
| 5 | `material_type_code` | varchar(20) | có |  |  | Loại vật tư (trỏ erp_material_type) |
| 6 | `material_group_code` | varchar(20) | có |  |  | Nhóm vật tư (trỏ erp_material_group) |
| 7 | `uom_code` | varchar(20) | không |  |  | Đơn vị tính gốc (tồn kho tính theo đơn vị này). Trỏ `erp_uom` |
| 8 | `vat_tax_rate_code` | varchar(20) | có |  |  | Mã thuế GTGT mặc định (trỏ sys_tax_rate) |
| 9 | `import_tax_rate_code` | varchar(20) | có |  |  | Mã thuế nhập khẩu mặc định (trỏ sys_tax_rate) |
| 10 | `is_stock_item` | boolean | không | true |  | Là hàng tồn kho (chứng từ kho chỉ nhận vật tư có cờ này) |
| 11 | `track_lot` | boolean | không | false |  | Theo dõi lô (tồn theo lô, phiếu nhập mở lô) |
| 12 | `has_expiry` | boolean | không | false |  | Có hạn sử dụng (lô phải có ngày hết hạn) |
| 13 | `shelf_life_days` | integer | có |  |  | Hạn dùng tính bằng ngày |
| 14 | `track_location` | boolean | không | false |  | Theo dõi vị trí lưu kho |
| 15 | `is_cycle_counted` | boolean | không | false |  | Có trong kiểm kê định kỳ |
| 16 | `costing_method` | varchar(10) | không | 'AVERAGE' |  | Phương pháp tính giá: AVERAGE (bình quân) hoặc FIFO |
| 17 | `min_stock` | numeric(18,4) | có |  |  | Tồn tối thiểu |
| 18 | `max_stock` | numeric(18,4) | có |  |  | Tồn tối đa |
| 19 | `length` | numeric(18,4) | có |  |  | Chiều dài |
| 20 | `width` | numeric(18,4) | có |  |  | Chiều rộng |
| 21 | `height` | numeric(18,4) | có |  |  | Chiều cao |
| 22 | `weight` | numeric(18,4) | có |  |  | Khối lượng |
| 23 | `volume` | numeric(18,4) | có |  |  | Thể tích |
| 24 | `note` | varchar(500) | có |  |  | Ghi chú |
| 25 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 26 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 27 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 28 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 29 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 30 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_material_pkey`: **duy nhất** (code)
- `ix_erp_material_import_tax_rate_code`: (import_tax_rate_code)
- `ix_erp_material_material_group_code`: (material_group_code)
- `ix_erp_material_material_type_code`: (material_type_code)
- `ix_erp_material_uom_code`: (uom_code)
- `ix_erp_material_vat_tax_rate_code`: (vat_tax_rate_code)

Ràng buộc:

- `ck_erp_material_costing` (CHECK): CHECK (((costing_method)::text = ANY ((ARRAY['AVERAGE'::character varying, 'FIFO'::character varying])::text[])))
- `ck_erp_material_shelf` (CHECK): CHECK (((shelf_life_days IS NULL) OR (shelf_life_days > 0)))
- `ck_erp_material_stock` (CHECK): CHECK (((min_stock IS NULL) OR (min_stock >= (0)::numeric)))
- `ck_erp_material_stock_max` (CHECK): CHECK (((max_stock IS NULL) OR (min_stock IS NULL) OR (max_stock >= min_stock)))

Được trỏ tới bởi: `erp_goods_issue_line.material_code`, `erp_goods_receipt_line.material_code`, `erp_issue_request_line.material_code`, `erp_lot.material_code`, `erp_purchase_order_line.material_code`, `erp_purchase_request_line.material_code`, `erp_stock_balance.material_code`, `erp_stock_location_balance.material_code`, `erp_stock_lot_balance.material_code`, `erp_stock_movement.material_code`.

#### 5.5.4. `erp_material_group`

Nhóm vật tư.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `note` | varchar(300) | có |  |  | Ghi chú |
| 4 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 5 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 6 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 7 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 8 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 9 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_material_group_pkey`: **duy nhất** (code)
- `ux_erp_material_group_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_material.material_group_code`.

#### 5.5.5. `erp_material_type`

Loại vật tư, thuộc một nhóm.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `group_name` | varchar(100) | có |  |  | Tên nhóm vật tư của loại (chữ) |
| 4 | `note` | varchar(300) | có |  |  | Ghi chú |
| 5 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 6 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 7 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 8 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 9 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 10 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_material_type_pkey`: **duy nhất** (code)
- `ux_erp_material_type_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_material.material_type_code`.

#### 5.5.6. `erp_supplier`

Danh mục nhà cung cấp (mã số thuế, điện thoại, địa chỉ, nhóm).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(200) | không |  |  | Tên hiển thị |
| 3 | `tax_code` | varchar(30) | có |  |  | Mã số thuế của nhà cung cấp |
| 4 | `phone` | varchar(30) | có |  |  | Điện thoại |
| 5 | `address` | varchar(300) | có |  |  | Địa chỉ |
| 6 | `note` | varchar(300) | có |  |  | Ghi chú |
| 7 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 8 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 9 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 10 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 11 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 12 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 13 | `supplier_group_code` | varchar(20) | có |  |  | Nhóm nhà cung cấp (tùy chọn, trỏ erp_supplier_group) |

Chỉ mục:

- `erp_supplier_pkey`: **duy nhất** (code)
- `ix_erp_supplier_supplier_group_code`: (supplier_group_code) WHERE (supplier_group_code IS NOT NULL)
- `ix_erp_supplier_tax_code`: (tax_code)
- `ux_erp_supplier_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_goods_receipt.supplier_code`, `erp_lot.supplier_code`, `erp_purchase_order.supplier_code`, `erp_purchase_request.supplier_code`.

#### 5.5.7. `erp_uom`

Đơn vị tính (cái, kg, thùng...).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `symbol` | varchar(20) | không | '' |  | Ký hiệu |
| 4 | `note` | varchar(300) | có |  |  | Ghi chú |
| 5 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 6 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 7 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 8 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 9 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 10 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_uom_pkey`: **duy nhất** (code)
- `ux_erp_uom_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_goods_issue_line.uom_code`, `erp_goods_receipt_line.uom_code`, `erp_issue_request_line.uom_code`, `erp_material.uom_code`, `erp_purchase_order_line.uom_code`, `erp_purchase_request_line.uom_code`, `erp_stock_movement.line_uom_code`, `erp_stock_movement.uom_code`, `erp_uom_conversion.from_uom_code`, `erp_uom_conversion.to_uom_code`, `erp_uom_translation.uom_code`.

#### 5.5.8. `erp_uom_conversion`

Quy đổi đơn vị tính (có thể riêng cho một vật tư): hệ số từ đơn vị này sang đơn vị kia.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(40) | không |  |  | Mã gộp từ đơn vị và vật tư |
| 2 | `material_code` | varchar(50) | có |  |  | Quy đổi riêng cho vật tư (rỗng = quy đổi chung) |
| 3 | `material_name` | varchar(200) | có |  |  | Tên vật tư chép từ danh mục lúc lưu |
| 4 | `from_uom_code` | varchar(20) | không |  |  | Đơn vị nguồn (trỏ erp_uom) |
| 5 | `to_uom_code` | varchar(20) | không |  |  | Đơn vị đích (trỏ erp_uom) |
| 6 | `factor` | numeric(20,8) | không |  |  | 1 đơn vị nguồn = factor đơn vị đích |
| 7 | `note` | varchar(300) | có |  |  | Ghi chú |
| 8 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 9 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 10 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 11 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 12 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 13 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_uom_conversion_pkey`: **duy nhất** (code)
- `ix_erp_uom_conversion_from`: (from_uom_code)
- `ix_erp_uom_conversion_material`: (material_code)
- `ix_erp_uom_conversion_to`: (to_uom_code)
- `ux_erp_uom_conversion_pair`: **duy nhất** (COALESCE(material_code, ''::character varying), from_uom_code, to_uom_code)

Ràng buộc:

- `ck_erp_uom_conversion_units` (CHECK): CHECK (((from_uom_code)::text <> (to_uom_code)::text))
- `erp_uom_conversion_factor_check` (CHECK): CHECK ((factor > (0)::numeric))

#### 5.5.9. `erp_uom_translation`

Tên đơn vị tính theo ngôn ngữ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `uom_code` | varchar(20) | không |  |  | Đơn vị tính (trỏ `erp_uom`) |
| 2 | `language_code` | varchar(10) | không |  |  | Mã ngôn ngữ (trỏ sys_language) |
| 3 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 4 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 5 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 6 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 7 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_uom_translation_pkey`: **duy nhất** (uom_code, language_code)
- `ix_erp_uom_translation_language`: (language_code)

#### 5.5.10. `erp_warehouse`

Danh mục kho.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `address` | varchar(300) | có |  |  | Địa chỉ kho |
| 4 | `manager` | varchar(100) | có |  |  | Thủ kho / người quản lý |
| 5 | `capacity` | varchar(100) | có |  |  | Sức chứa |
| 6 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 7 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 8 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 9 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 10 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 11 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 12 | `warehouse_type_code` | varchar(20) | có |  |  | Loại kho (trỏ erp_warehouse_type) |
| 13 | `unit_code` | varchar(20) | không | '' |  | Cột cũ của đơn vị cơ sở; danh sách đơn vị được dùng kho nằm ở erp_warehouse_unit. Trỏ `sys_company_unit` |

Chỉ mục:

- `erp_warehouse_pkey`: **duy nhất** (code)
- `ix_erp_warehouse_type_code`: (warehouse_type_code)
- `ix_erp_warehouse_unit_code`: (unit_code)
- `ux_erp_warehouse_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_goods_issue.warehouse_code`, `erp_goods_receipt.warehouse_code`, `erp_issue_request.warehouse_code`, `erp_location.warehouse_code`, `erp_purchase_order.warehouse_code`, `erp_purchase_request.warehouse_code`, `erp_stock_balance.warehouse_code`, `erp_stock_location_balance.warehouse_code`, `erp_stock_lot_balance.warehouse_code`, `erp_stock_movement.warehouse_code`, `erp_warehouse_unit.warehouse_code`.

#### 5.5.11. `erp_warehouse_type`

Loại kho.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `note` | varchar(300) | có |  |  | Ghi chú |
| 4 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 5 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 6 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 7 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 8 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 9 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_warehouse_type_pkey`: **duy nhất** (code)
- `ux_erp_warehouse_type_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_warehouse.warehouse_type_code`, `erp_warehouse_type_translation.warehouse_type_code`.

#### 5.5.12. `erp_warehouse_type_translation`

Tên loại kho theo ngôn ngữ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `warehouse_type_code` | varchar(20) | không |  |  | Trỏ `erp_warehouse_type` |
| 2 | `language_code` | varchar(10) | không |  |  | Mã ngôn ngữ (trỏ sys_language) |
| 3 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 4 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 5 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 6 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 7 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_warehouse_type_translation_pkey`: **duy nhất** (warehouse_type_code, language_code)
- `ix_erp_warehouse_type_translation_language`: (language_code)

#### 5.5.13. `erp_warehouse_unit`

Đơn vị cơ sở được dùng một kho (không có dòng = kho dùng chung mọi đơn vị).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `warehouse_code` | varchar(20) | không |  |  | Kho. Trỏ `erp_warehouse` |
| 2 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở được dùng kho. Trỏ `sys_company_unit` |
| 3 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 4 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 5 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 6 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_warehouse_unit_pkey`: **duy nhất** (warehouse_code, unit_code)
- `ix_erp_warehouse_unit_unit`: (unit_code)

### 5.6. Chứng từ Kho

#### 5.6.1. `erp_goods_issue`

Đầu **phiếu xuất kho** (ghi sổ giảm tồn, tính giá bình quân): khách hàng, người nhận, dự án, các số phiếu yêu cầu đã lấy.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `code` | varchar(64) | không |  |  | Số chứng từ, duy nhất toàn hệ thống (vòng duyệt khóa theo số phiếu); ví dụ PNK-DVCS01-202610-0001 |
| 3 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở của phiếu (trỏ sys_company_unit) |
| 4 | `document_date` | date | không |  |  | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| 5 | `created_date` | date | không |  |  | Ngày lập chứng từ |
| 6 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 7 | `voucher_type` | varchar(100) | không |  |  | Loại xuất: Xuất bán hàng, Xuất điều chuyển, Xuất sản xuất... |
| 8 | `currency_code` | varchar(10) | không | 'VND' |  | Loại tiền (trỏ `sys_currency`) |
| 9 | `exchange_rate` | numeric(18,6) | không | 1 |  | Tỷ giá so với tiền hạch toán tại ngày chứng từ |
| 10 | `customer_name` | varchar(200) | có |  |  | Khách hàng / đơn vị nhận hàng (chữ tự do) |
| 11 | `receiver_name` | varchar(200) | có |  |  | Người nhận hàng |
| 12 | `note` | varchar(1000) | có |  |  | Ghi chú |
| 13 | `status` | varchar(20) | không | 'Draft' |  | Trạng thái: Draft, Pending, Approved, Posted, Cancelled (có CHECK); phiếu không ghi sổ không bao giờ tới Posted |
| 14 | `total_value` | numeric(18,2) | không | 0 |  | Tổng giá trị quy ra tiền hạch toán (đã nhân tỷ giá) |
| 15 | `approved_by_user_id` | integer | có |  |  | Người duyệt cuối cùng (mã người dùng) |
| 16 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 17 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 18 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 19 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 20 | `issue_request_code` | varchar(500) | có |  |  | Các số phiếu yêu cầu xuất kho mà phiếu thực hiện, cách nhau dấu phẩy; suy ra từ các dòng |
| 21 | `project_code` | varchar(20) | có |  |  | Dự án (trỏ `erp_project`), tùy chọn |

Chỉ mục:

- `erp_goods_issue_code_key`: **duy nhất** (code)
- `erp_goods_issue_pkey`: **duy nhất** (id)
- `ix_erp_goods_issue_currency`: (currency_code)
- `ix_erp_goods_issue_issue_request_code`: (issue_request_code) WHERE (issue_request_code IS NOT NULL)
- `ix_erp_goods_issue_project_code`: (project_code) WHERE (project_code IS NOT NULL)
- `ix_erp_goods_issue_unit_date`: (unit_code, document_date DESC)
- `ix_erp_goods_issue_warehouse`: (warehouse_code)

Ràng buộc:

- `ck_erp_goods_issue_rate` (CHECK): CHECK ((exchange_rate > (0)::numeric))
- `ck_erp_goods_issue_status` (CHECK): CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Posted'::character varying, 'Cancelled'::character varying])::text[])))
- `erp_goods_issue_code_key` (UNIQUE): UNIQUE (code)

Trigger:

- `trg_erp_goods_issue_delete`: BEFORE DELETE ON public.erp_goods_issue FOR EACH ROW EXECUTE FUNCTION erp_voucher_delete_cleanup('inv_issue', 'erp_goods_issue_line', 'issue_id')

#### 5.6.2. `erp_goods_issue_line`

Dòng phiếu xuất kho (ITEM / MATERIAL), dòng yêu cầu xuất kho đã thực hiện.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính của dòng; đổi sau mỗi lần sửa phiếu vì dòng được xóa và thêm lại |
| 2 | `issue_id` | bigint | không |  |  | Đầu phiếu xuất kho (không khóa ngoại; có chỉ mục) |
| 3 | `kind` | varchar(20) | không |  |  | ITEM = hàng xuất (ghi sổ, trừ tồn); MATERIAL = nguyên vật liệu (không ghi sổ) |
| 4 | `line_no` | integer | không |  |  | Số thứ tự dòng trong chứng từ |
| 5 | `material_code` | varchar(64) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 6 | `material_name` | varchar(200) | không |  |  | Tên vật tư chép từ danh mục lúc lưu |
| 7 | `uom_code` | varchar(30) | không |  |  | Đơn vị tính của dòng (trỏ erp_uom) |
| 8 | `quantity` | numeric(18,4) | không |  |  | Số lượng theo đơn vị tính của dòng (lớn hơn 0) |
| 9 | `unit_price` | numeric(18,4) | không |  |  | Đơn giá theo loại tiền của phiếu (từ 0) |
| 10 | `amount` | numeric(18,2) | không |  |  | Thành tiền = số lượng × đơn giá |
| 11 | `lot_number` | varchar(64) | có |  |  | Số lô |
| 12 | `position` | varchar(100) | có |  |  | Vị trí lưu kho |
| 13 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 14 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 15 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 16 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 17 | `issue_request_line_id` | bigint | có |  |  | Nguồn sự thật việc dòng thực hiện dòng nào của phiếu yêu cầu xuất kho |

Chỉ mục:

- `erp_goods_issue_line_issue_id_kind_line_no_key`: **duy nhất** (issue_id, kind, line_no)
- `erp_goods_issue_line_pkey`: **duy nhất** (id)
- `ix_erp_goods_issue_line_issue`: (issue_id)
- `ix_erp_goods_issue_line_issue_request_line_id`: (issue_request_line_id) WHERE (issue_request_line_id IS NOT NULL)
- `ix_erp_goods_issue_line_material_code`: (material_code)
- `ix_erp_goods_issue_line_uom_code`: (uom_code)

Ràng buộc:

- `ck_erp_goods_issue_line_kind` (CHECK): CHECK (((kind)::text = ANY ((ARRAY['ITEM'::character varying, 'MATERIAL'::character varying])::text[])))
- `ck_erp_goods_issue_line_price` (CHECK): CHECK ((unit_price >= (0)::numeric))
- `ck_erp_goods_issue_line_quantity` (CHECK): CHECK ((quantity > (0)::numeric))
- `erp_goods_issue_line_issue_id_kind_line_no_key` (UNIQUE): UNIQUE (issue_id, kind, line_no)

#### 5.6.3. `erp_goods_receipt`

Đầu **phiếu nhập kho** (ghi sổ tăng tồn): ngày, kho, loại nhập, nhà cung cấp, loại tiền, trạng thái, dự án, các số đơn mua đã lấy.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `code` | varchar(64) | không |  |  | Số chứng từ, duy nhất toàn hệ thống (vòng duyệt khóa theo số phiếu); ví dụ PNK-DVCS01-202610-0001 |
| 3 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở của phiếu (trỏ sys_company_unit) |
| 4 | `document_date` | date | không |  |  | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| 5 | `created_date` | date | không |  |  | Ngày lập chứng từ |
| 6 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 7 | `voucher_type` | varchar(100) | không |  |  | Loại nhập: Nhập mua mới, Nhập điều chuyển, Nhập trả lại, Nhập sản xuất... |
| 8 | `currency_code` | varchar(10) | không | 'VND' |  | Loại tiền (trỏ `sys_currency`) |
| 9 | `exchange_rate` | numeric(18,6) | không | 1 |  | Tỷ giá so với tiền hạch toán tại ngày chứng từ |
| 10 | `supplier_name` | varchar(200) | có |  |  | Tên nhà cung cấp / đối tác chép lúc lưu |
| 11 | `deliverer_name` | varchar(200) | có |  |  | Người giao hàng |
| 12 | `note` | varchar(1000) | có |  |  | Ghi chú |
| 13 | `status` | varchar(20) | không | 'Draft' |  | Trạng thái: Draft, Pending, Approved, Posted, Cancelled (có CHECK); phiếu không ghi sổ không bao giờ tới Posted |
| 14 | `total_value` | numeric(18,2) | không | 0 |  | Tổng giá trị quy ra tiền hạch toán (đã nhân tỷ giá) |
| 15 | `approved_by_user_id` | integer | có |  |  | Người duyệt cuối cùng (mã người dùng) |
| 16 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 17 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 18 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 19 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 20 | `supplier_code` | varchar(20) | có |  |  | Nhà cung cấp trong danh mục (tùy chọn). Trỏ `erp_supplier` |
| 21 | `purchase_order_code` | varchar(500) | có |  |  | Các số đơn mua hàng mà phiếu nhận, cách nhau dấu phẩy; suy ra từ các dòng, không phải nguồn sự thật |
| 22 | `project_code` | varchar(20) | có |  |  | Dự án (trỏ `erp_project`), tùy chọn |

Chỉ mục:

- `erp_goods_receipt_code_key`: **duy nhất** (code)
- `erp_goods_receipt_pkey`: **duy nhất** (id)
- `ix_erp_goods_receipt_currency`: (currency_code)
- `ix_erp_goods_receipt_project_code`: (project_code) WHERE (project_code IS NOT NULL)
- `ix_erp_goods_receipt_supplier_code`: (supplier_code) WHERE (supplier_code IS NOT NULL)
- `ix_erp_goods_receipt_unit_date`: (unit_code, document_date DESC)
- `ix_erp_goods_receipt_warehouse`: (warehouse_code)

Ràng buộc:

- `ck_erp_goods_receipt_rate` (CHECK): CHECK ((exchange_rate > (0)::numeric))
- `ck_erp_goods_receipt_status` (CHECK): CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Posted'::character varying, 'Cancelled'::character varying])::text[])))
- `erp_goods_receipt_code_key` (UNIQUE): UNIQUE (code)

Trigger:

- `trg_erp_goods_receipt_delete`: BEFORE DELETE ON public.erp_goods_receipt FOR EACH ROW EXECUTE FUNCTION erp_voucher_delete_cleanup('inv_receipt', 'erp_goods_receipt_line', 'receipt_id')

#### 5.6.4. `erp_goods_receipt_line`

Dòng phiếu nhập kho: `kind` = ITEM (hàng nhập) hoặc MATERIAL (nguyên vật liệu); số lượng, giá, lô, vị trí, dòng đơn mua đã nhận.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính của dòng; đổi sau mỗi lần sửa phiếu vì dòng được xóa và thêm lại |
| 2 | `receipt_id` | bigint | không |  |  | Đầu phiếu nhập kho (không khóa ngoại; có chỉ mục) |
| 3 | `kind` | varchar(20) | không |  |  | ITEM = hàng nhập (ghi sổ); MATERIAL = nguyên vật liệu / cấu trúc sản phẩm (không ghi sổ) |
| 4 | `line_no` | integer | không |  |  | Số thứ tự dòng trong chứng từ |
| 5 | `material_code` | varchar(64) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 6 | `material_name` | varchar(200) | không |  |  | Tên vật tư chép từ danh mục lúc lưu |
| 7 | `uom_code` | varchar(30) | không |  |  | Đơn vị tính của dòng (trỏ erp_uom) |
| 8 | `quantity` | numeric(18,4) | không |  |  | Số lượng theo đơn vị tính của dòng (lớn hơn 0) |
| 9 | `unit_price` | numeric(18,4) | không |  |  | Đơn giá theo loại tiền của phiếu (từ 0) |
| 10 | `amount` | numeric(18,2) | không |  |  | Thành tiền = số lượng × đơn giá |
| 11 | `lot_number` | varchar(64) | có |  |  | Số lô (chỉ có nghĩa với vật tư theo dõi lô) |
| 12 | `position` | varchar(100) | có |  |  | Vị trí lưu kho (chỉ có nghĩa với vật tư theo dõi vị trí) |
| 13 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 14 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 15 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 16 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 17 | `purchase_order_line_id` | bigint | có |  |  | Nguồn sự thật việc dòng nhận dòng nào của đơn mua; số đã nhận của dòng đơn = tổng số lượng các dòng này trên phiếu chưa hủy |

Chỉ mục:

- `erp_goods_receipt_line_pkey`: **duy nhất** (id)
- `erp_goods_receipt_line_receipt_id_kind_line_no_key`: **duy nhất** (receipt_id, kind, line_no)
- `ix_erp_goods_receipt_line_material_code`: (material_code)
- `ix_erp_goods_receipt_line_purchase_order_line_id`: (purchase_order_line_id) WHERE (purchase_order_line_id IS NOT NULL)
- `ix_erp_goods_receipt_line_receipt`: (receipt_id)
- `ix_erp_goods_receipt_line_uom_code`: (uom_code)

Ràng buộc:

- `ck_erp_goods_receipt_line_kind` (CHECK): CHECK (((kind)::text = ANY ((ARRAY['ITEM'::character varying, 'MATERIAL'::character varying])::text[])))
- `ck_erp_goods_receipt_line_price` (CHECK): CHECK ((unit_price >= (0)::numeric))
- `ck_erp_goods_receipt_line_quantity` (CHECK): CHECK ((quantity > (0)::numeric))
- `erp_goods_receipt_line_receipt_id_kind_line_no_key` (UNIQUE): UNIQUE (receipt_id, kind, line_no)

#### 5.6.5. `erp_issue_request`

Đầu **phiếu yêu cầu xuất kho** (duyệt, không ghi sổ).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `code` | varchar(64) | không |  |  | Số chứng từ, duy nhất toàn hệ thống (vòng duyệt khóa theo số phiếu); ví dụ PNK-DVCS01-202610-0001 |
| 3 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở của phiếu (trỏ sys_company_unit) |
| 4 | `document_date` | date | không |  |  | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| 5 | `created_date` | date | không |  |  | Ngày lập chứng từ |
| 6 | `required_date` | date | có |  |  | Ngày cần hàng |
| 7 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 8 | `voucher_type` | varchar(100) | không |  |  | Mục đích yêu cầu xuất |
| 9 | `department_code` | varchar(20) | có |  |  | Phòng ban (trỏ `sys_department`) |
| 10 | `requester_name` | varchar(200) | có |  |  | Người yêu cầu (chữ tự do) |
| 11 | `customer_name` | varchar(200) | có |  |  | Khách hàng / bên nhận |
| 12 | `currency_code` | varchar(10) | không | 'VND' |  | Loại tiền (trỏ `sys_currency`) |
| 13 | `exchange_rate` | numeric(18,6) | không | 1 |  | Tỷ giá so với tiền hạch toán tại ngày chứng từ |
| 14 | `note` | varchar(1000) | có |  |  | Ghi chú |
| 15 | `status` | varchar(20) | không | 'Draft' |  | Trạng thái: Draft, Pending, Approved, Posted, Cancelled (có CHECK); phiếu không ghi sổ không bao giờ tới Posted |
| 16 | `total_value` | numeric(18,2) | không | 0 |  | Tổng giá trị quy ra tiền hạch toán (đã nhân tỷ giá) |
| 17 | `approved_by_user_id` | integer | có |  |  | Người duyệt cuối cùng (mã người dùng) |
| 18 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 19 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 20 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 21 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 22 | `project_code` | varchar(20) | có |  |  | Dự án (trỏ `erp_project`), tùy chọn |

Chỉ mục:

- `erp_issue_request_code_key`: **duy nhất** (code)
- `erp_issue_request_pkey`: **duy nhất** (id)
- `ix_erp_issue_request_currency_code`: (currency_code)
- `ix_erp_issue_request_department_code`: (department_code) WHERE (department_code IS NOT NULL)
- `ix_erp_issue_request_project_code`: (project_code) WHERE (project_code IS NOT NULL)
- `ix_erp_issue_request_unit_date`: (unit_code, document_date DESC)
- `ix_erp_issue_request_warehouse_code`: (warehouse_code)

Ràng buộc:

- `ck_erp_issue_request_rate` (CHECK): CHECK ((exchange_rate > (0)::numeric))
- `ck_erp_issue_request_status` (CHECK): CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Posted'::character varying, 'Cancelled'::character varying])::text[])))
- `erp_issue_request_code_key` (UNIQUE): UNIQUE (code)

#### 5.6.6. `erp_issue_request_line`

Dòng phiếu yêu cầu xuất kho.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính của dòng; đổi sau mỗi lần sửa phiếu vì dòng được xóa và thêm lại |
| 2 | `request_id` | bigint | không |  |  | Đầu phiếu yêu cầu xuất kho |
| 3 | `line_no` | integer | không |  |  | Số thứ tự dòng trong chứng từ |
| 4 | `material_code` | varchar(64) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 5 | `material_name` | varchar(200) | không |  |  | Tên vật tư chép từ danh mục lúc lưu |
| 6 | `uom_code` | varchar(30) | không |  |  | Đơn vị tính của dòng (trỏ erp_uom) |
| 7 | `quantity` | numeric(18,4) | không |  |  | Số lượng theo đơn vị tính của dòng (lớn hơn 0) |
| 8 | `unit_price` | numeric(18,4) | không | 0 |  | Đơn giá theo loại tiền của phiếu (từ 0) |
| 9 | `amount` | numeric(18,2) | không | 0 |  | Thành tiền = số lượng × đơn giá |
| 10 | `note` | varchar(300) | có |  |  | Ghi chú |
| 11 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 12 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 13 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 14 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_issue_request_line_pkey`: **duy nhất** (id)
- `erp_issue_request_line_request_id_line_no_key`: **duy nhất** (request_id, line_no)
- `ix_erp_issue_request_line_material_code`: (material_code)
- `ix_erp_issue_request_line_request`: (request_id)
- `ix_erp_issue_request_line_uom_code`: (uom_code)

Ràng buộc:

- `ck_erp_issue_request_line_price` (CHECK): CHECK ((unit_price >= (0)::numeric))
- `ck_erp_issue_request_line_quantity` (CHECK): CHECK ((quantity > (0)::numeric))
- `erp_issue_request_line_request_id_line_no_key` (UNIQUE): UNIQUE (request_id, line_no)

### 5.7. Sổ kho và tồn kho

#### 5.7.1. `erp_stock_balance`

Tồn theo đơn vị + kho + vật tư (số lượng, giá trị); luôn bằng tổng sổ kho.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 2 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 3 | `material_code` | varchar(50) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 4 | `quantity` | numeric(18,4) | không | 0 |  | Số lượng tồn theo đơn vị tính gốc |
| 5 | `value` | numeric(18,2) | không | 0 |  | Giá trị tồn theo tiền hạch toán |
| 6 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 7 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 8 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 9 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_stock_balance_pkey`: **duy nhất** (unit_code, warehouse_code, material_code)
- `ix_erp_stock_balance_material_code`: (material_code)
- `ix_erp_stock_balance_warehouse_code`: (warehouse_code, material_code)

#### 5.7.2. `erp_stock_location_balance`

Tồn theo thêm vị trí (chỉ vật tư theo dõi vị trí).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 2 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 3 | `material_code` | varchar(50) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 4 | `lot_code` | varchar(81) | không | '' |  | Mã lô (rỗng nếu không theo lô). Trỏ `erp_lot` |
| 5 | `location_code` | varchar(30) | không |  |  | Mã vị trí. Trỏ `erp_location` |
| 6 | `quantity` | numeric(18,4) | không | 0 |  | Số lượng |
| 7 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 8 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 9 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 10 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_stock_location_balance_pkey`: **duy nhất** (unit_code, warehouse_code, material_code, lot_code, location_code)
- `ix_erp_stock_location_balance_location_code`: (location_code)
- `ix_erp_stock_location_balance_lot_code`: (lot_code)
- `ix_erp_stock_location_balance_material_code`: (material_code)
- `ix_erp_stock_location_balance_warehouse_code`: (warehouse_code, material_code)

#### 5.7.3. `erp_stock_lot_balance`

Tồn theo thêm lô (chỉ vật tư theo dõi lô).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 2 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 3 | `material_code` | varchar(50) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 4 | `lot_code` | varchar(81) | không |  |  | Mã lô (dạng VT001@LOT-2610). Trỏ `erp_lot` |
| 5 | `quantity` | numeric(18,4) | không | 0 |  | Số lượng |
| 6 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 7 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 8 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 9 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_stock_lot_balance_pkey`: **duy nhất** (unit_code, warehouse_code, material_code, lot_code)
- `ix_erp_stock_lot_balance_lot_code`: (lot_code)
- `ix_erp_stock_lot_balance_material_code`: (material_code)
- `ix_erp_stock_lot_balance_warehouse_code`: (warehouse_code, material_code)

#### 5.7.4. `erp_stock_movement`

**Sổ kho**: nhật ký chỉ-thêm các lần nhập xuất (số lượng có dấu theo đơn vị tính gốc, giá trị theo tiền hạch toán). Bỏ ghi sổ ghi dòng đảo qua `reversal_of_id`; ghi sổ lại tăng `posting_seq`.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `source_function` | varchar(64) | không |  |  | Mã chức năng của chứng từ gây ra dòng sổ (inv_receipt, inv_issue) |
| 3 | `source_id` | bigint | không |  |  | Id đầu phiếu nguồn |
| 4 | `source_line_id` | bigint | không |  |  | Id dòng phiếu nguồn |
| 5 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở (trỏ `sys_company_unit`) |
| 6 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 7 | `material_code` | varchar(64) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 8 | `document_date` | date | không |  |  | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| 9 | `quantity` | numeric(18,4) | không |  |  | Số lượng có dấu theo đơn vị tính gốc của vật tư (nhập dương, xuất âm) |
| 10 | `value` | numeric(18,2) | không |  |  | Giá trị có dấu theo tiền hạch toán (nhập: từ phiếu; xuất: sổ tính giá bình quân) |
| 12 | `lot_code` | varchar(81) | có |  |  | Lô (chỉ vật tư theo dõi lô). Trỏ `erp_lot` |
| 13 | `location_code` | varchar(30) | có |  |  | Vị trí (chỉ vật tư theo dõi vị trí). Trỏ `erp_location` |
| 14 | `uom_code` | varchar(20) | không | '' |  | Đơn vị tính gốc của vật tư. Trỏ `erp_uom` |
| 15 | `line_uom_code` | varchar(20) | có |  |  | Đơn vị tính ghi trên dòng phiếu (có thể khác đơn vị gốc, quy đổi qua erp_uom_conversion). Trỏ `erp_uom` |
| 16 | `line_quantity` | numeric(18,4) | có |  |  | Số lượng theo đơn vị tính của dòng phiếu |
| 17 | `posting_seq` | integer | không | 1 |  | Lần ghi sổ của phiếu (tăng khi bỏ ghi sổ rồi ghi lại) |
| 18 | `reversal_of_id` | bigint | có |  |  | Có giá trị = dòng này là dòng đảo của dòng sổ có id đó (bỏ ghi sổ) |
| 19 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 20 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 21 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 22 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_stock_movement_pkey`: **duy nhất** (id)
- `ix_erp_stock_movement_line_uom_code`: (line_uom_code) WHERE (line_uom_code IS NOT NULL)
- `ix_erp_stock_movement_location_code`: (location_code) WHERE (location_code IS NOT NULL)
- `ix_erp_stock_movement_lot_code`: (lot_code) WHERE (lot_code IS NOT NULL)
- `ix_erp_stock_movement_material_code`: (material_code, document_date)
- `ix_erp_stock_movement_source`: (source_function, source_id)
- `ix_erp_stock_movement_unit_code`: (unit_code, warehouse_code, material_code, document_date)
- `ix_erp_stock_movement_uom_code`: (uom_code)
- `ix_erp_stock_movement_warehouse_code`: (warehouse_code, material_code)
- `ux_erp_stock_movement_posting`: **duy nhất** (source_function, source_line_id, posting_seq) WHERE (reversal_of_id IS NULL)
- `ux_erp_stock_movement_reversal`: **duy nhất** (reversal_of_id) WHERE (reversal_of_id IS NOT NULL)

### 5.8. Danh mục Mua hàng

#### 5.8.1. `erp_payment_term`

Danh mục điều khoản thanh toán (số ngày công nợ).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `days` | integer | không | 0 |  | Số ngày công nợ, 0 = trả ngay, tối đa 1000 (CHECK) |
| 4 | `note` | varchar(300) | có |  |  | Ghi chú |
| 5 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 6 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 7 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 8 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 9 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 10 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_payment_term_pkey`: **duy nhất** (code)
- `ux_erp_payment_term_name`: **duy nhất** (lower((name)::text))

Ràng buộc:

- `ck_erp_payment_term_days` (CHECK): CHECK (((days >= 0) AND (days <= 1000)))

Được trỏ tới bởi: `erp_purchase_order.payment_term_code`.

#### 5.8.2. `erp_project`

Danh mục **dự án**: chiều theo dõi chi phí (và sau này doanh thu) trên chứng từ mua hàng và kho.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(200) | không |  |  | Tên hiển thị |
| 3 | `department_code` | varchar(20) | có |  |  | Phòng ban (trỏ `sys_department`) |
| 4 | `customer_name` | varchar(200) | có |  |  | Khách hàng (chữ tự do) |
| 5 | `manager_name` | varchar(100) | có |  |  | Người quản lý (chữ tự do) |
| 6 | `start_date` | date | có |  |  | Ngày bắt đầu |
| 7 | `end_date` | date | có |  |  | Ngày kết thúc (không trước ngày bắt đầu) |
| 8 | `budget` | numeric(18,2) | không | 0 |  | Ngân sách = chi phí dự kiến, tiền hạch toán; báo cáo so chi phí thực tế với số này |
| 9 | `status` | varchar(12) | không | 'ACTIVE' |  | PLANNING, ACTIVE, ONHOLD, DONE, CANCELLED (CHECK); chỉ PLANNING / ACTIVE nhận chứng từ mới |
| 10 | `note` | varchar(500) | có |  |  | Ghi chú |
| 11 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 12 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 13 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 14 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 15 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 16 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_project_pkey`: **duy nhất** (code)
- `ix_erp_project_department_code`: (department_code) WHERE (department_code IS NOT NULL)
- `ux_erp_project_name`: **duy nhất** (lower((name)::text))

Ràng buộc:

- `ck_erp_project_budget` (CHECK): CHECK ((budget >= (0)::numeric))
- `ck_erp_project_dates` (CHECK): CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date)))
- `ck_erp_project_status` (CHECK): CHECK (((status)::text = ANY ((ARRAY['PLANNING'::character varying, 'ACTIVE'::character varying, 'ONHOLD'::character varying, 'DONE'::character varying, 'CANCELLED'::character varying])::text[])))

Được trỏ tới bởi: `erp_goods_issue.project_code`, `erp_goods_receipt.project_code`, `erp_issue_request.project_code`, `erp_purchase_order.project_code`, `erp_purchase_request.project_code`.

#### 5.8.3. `erp_supplier_group`

Danh mục nhóm nhà cung cấp.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `code` | varchar(20) | không |  |  | Mã (khóa nghiệp vụ, chữ hoa) |
| 2 | `name` | varchar(100) | không |  |  | Tên hiển thị |
| 3 | `note` | varchar(300) | có |  |  | Ghi chú |
| 4 | `is_active` | boolean | không | true |  | Đang sử dụng (false = ngừng dùng) |
| 5 | `sort_order` | integer | không | 0 |  | Thứ tự sắp xếp mặc định |
| 6 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 7 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 8 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 9 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_supplier_group_pkey`: **duy nhất** (code)
- `ux_erp_supplier_group_name`: **duy nhất** (lower((name)::text))

Được trỏ tới bởi: `erp_supplier.supplier_group_code`.

### 5.9. Chứng từ Mua hàng

#### 5.9.1. `erp_purchase_order`

Đầu **đơn mua hàng** (duyệt, không ghi sổ): nhà cung cấp, điều khoản, thuế, ngày giao dự kiến, dự án.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `code` | varchar(64) | không |  |  | Số chứng từ, duy nhất toàn hệ thống (vòng duyệt khóa theo số phiếu); ví dụ PNK-DVCS01-202610-0001 |
| 3 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở của phiếu (trỏ sys_company_unit) |
| 4 | `document_date` | date | không |  |  | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| 5 | `created_date` | date | không |  |  | Ngày lập chứng từ |
| 6 | `delivery_date` | date | có |  |  | Ngày dự kiến nhận hàng mặc định cho các dòng (không trước ngày chứng từ) |
| 7 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 8 | `voucher_type` | varchar(100) | không |  |  | Loại mua hàng |
| 9 | `supplier_code` | varchar(20) | không |  |  | Nhà cung cấp (bắt buộc, trỏ erp_supplier) |
| 10 | `supplier_name` | varchar(200) | có |  |  | Tên nhà cung cấp chép lúc lưu |
| 11 | `payment_terms` | varchar(200) | có |  |  | Chữ điều khoản thanh toán lúc lưu (chép tên điều khoản đã chọn, hoặc chữ tự do của đơn cũ) |
| 12 | `currency_code` | varchar(10) | không | 'VND' |  | Loại tiền (trỏ `sys_currency`) |
| 13 | `exchange_rate` | numeric(18,6) | không | 1 |  | Tỷ giá so với tiền hạch toán tại ngày chứng từ |
| 14 | `tax_rate_code` | varchar(20) | có |  |  | Mã thuế của cả đơn (tùy chọn, trỏ sys_tax_rate) |
| 15 | `tax_rate` | numeric(7,4) | không | 0 |  | Thuế suất (%) chép lúc lưu để đổi danh mục thuế không làm đổi đơn cũ |
| 16 | `sub_total` | numeric(18,2) | không | 0 |  | Tiền hàng trước thuế, theo loại tiền của đơn |
| 17 | `tax_amount` | numeric(18,2) | không | 0 |  | Tiền thuế = tiền hàng × thuế suất / 100, theo loại tiền của đơn |
| 18 | `total_value` | numeric(18,2) | không | 0 |  | (Tiền hàng + tiền thuế) × tỷ giá = tiền hạch toán (mức duyệt theo giá trị nhìn vào số này) |
| 19 | `purchase_request_code` | varchar(500) | có |  |  | Các số phiếu yêu cầu mua mà đơn thực hiện, cách nhau dấu phẩy; suy ra từ các dòng |
| 20 | `note` | varchar(1000) | có |  |  | Ghi chú |
| 21 | `status` | varchar(20) | không | 'Draft' |  | Trạng thái: Draft, Pending, Approved, Posted, Cancelled (có CHECK); phiếu không ghi sổ không bao giờ tới Posted |
| 22 | `approved_by_user_id` | integer | có |  |  | Người duyệt cuối cùng (mã người dùng) |
| 23 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 24 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 25 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 26 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 27 | `payment_term_code` | varchar(20) | có |  |  | Điều khoản chọn từ danh mục (tùy chọn, trỏ erp_payment_term) |
| 28 | `project_code` | varchar(20) | có |  |  | Dự án (trỏ `erp_project`), tùy chọn |

Chỉ mục:

- `erp_purchase_order_code_key`: **duy nhất** (code)
- `erp_purchase_order_pkey`: **duy nhất** (id)
- `ix_erp_purchase_order_currency_code`: (currency_code)
- `ix_erp_purchase_order_payment_term_code`: (payment_term_code) WHERE (payment_term_code IS NOT NULL)
- `ix_erp_purchase_order_project_code`: (project_code) WHERE (project_code IS NOT NULL)
- `ix_erp_purchase_order_supplier_code`: (supplier_code)
- `ix_erp_purchase_order_tax_rate_code`: (tax_rate_code) WHERE (tax_rate_code IS NOT NULL)
- `ix_erp_purchase_order_unit_date`: (unit_code, document_date DESC)
- `ix_erp_purchase_order_warehouse_code`: (warehouse_code)

Ràng buộc:

- `ck_erp_purchase_order_rate` (CHECK): CHECK ((exchange_rate > (0)::numeric))
- `ck_erp_purchase_order_status` (CHECK): CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Posted'::character varying, 'Cancelled'::character varying])::text[])))
- `erp_purchase_order_code_key` (UNIQUE): UNIQUE (code)

#### 5.9.2. `erp_purchase_order_line`

Dòng đơn mua hàng: dòng yêu cầu mua đã đặt, ngày dự kiến nhận của từng dòng.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính của dòng; đổi sau mỗi lần sửa phiếu vì dòng được xóa và thêm lại |
| 2 | `order_id` | bigint | không |  |  | Đầu đơn mua hàng |
| 3 | `line_no` | integer | không |  |  | Số thứ tự dòng trong chứng từ |
| 4 | `material_code` | varchar(64) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 5 | `material_name` | varchar(200) | không |  |  | Tên vật tư chép từ danh mục lúc lưu |
| 6 | `uom_code` | varchar(30) | không |  |  | Đơn vị tính của dòng (trỏ erp_uom) |
| 7 | `quantity` | numeric(18,4) | không |  |  | Số lượng theo đơn vị tính của dòng (lớn hơn 0) |
| 8 | `unit_price` | numeric(18,4) | không | 0 |  | Đơn giá theo loại tiền của phiếu (từ 0) |
| 9 | `amount` | numeric(18,2) | không | 0 |  | Thành tiền = số lượng × đơn giá |
| 10 | `note` | varchar(300) | có |  |  | Ghi chú |
| 11 | `purchase_request_line_id` | bigint | có |  |  | Nguồn sự thật việc dòng đặt mua dòng nào của phiếu yêu cầu; số đã đặt = tổng số lượng các dòng này trên đơn chưa hủy |
| 12 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 13 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 14 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 15 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 16 | `delivery_date` | date | có |  |  | Ngày dự kiến nhận của dòng; lưu không kèm ngày thì lấy ngày ở đầu đơn |

Chỉ mục:

- `erp_purchase_order_line_order_id_line_no_key`: **duy nhất** (order_id, line_no)
- `erp_purchase_order_line_pkey`: **duy nhất** (id)
- `ix_erp_purchase_order_line_material_code`: (material_code)
- `ix_erp_purchase_order_line_order`: (order_id)
- `ix_erp_purchase_order_line_request_line`: (purchase_request_line_id) WHERE (purchase_request_line_id IS NOT NULL)
- `ix_erp_purchase_order_line_uom_code`: (uom_code)

Ràng buộc:

- `ck_erp_purchase_order_line_price` (CHECK): CHECK ((unit_price >= (0)::numeric))
- `ck_erp_purchase_order_line_quantity` (CHECK): CHECK ((quantity > (0)::numeric))
- `erp_purchase_order_line_order_id_line_no_key` (UNIQUE): UNIQUE (order_id, line_no)

#### 5.9.3. `erp_purchase_request`

Đầu **phiếu yêu cầu mua hàng** (duyệt, không ghi sổ).

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính, tự tăng |
| 2 | `code` | varchar(64) | không |  |  | Số chứng từ, duy nhất toàn hệ thống (vòng duyệt khóa theo số phiếu); ví dụ PNK-DVCS01-202610-0001 |
| 3 | `unit_code` | varchar(20) | không |  |  | Đơn vị cơ sở của phiếu (trỏ sys_company_unit) |
| 4 | `document_date` | date | không |  |  | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| 5 | `created_date` | date | không |  |  | Ngày lập chứng từ |
| 6 | `required_date` | date | có |  |  | Ngày bộ phận cần hàng |
| 7 | `warehouse_code` | varchar(20) | không |  |  | Kho (trỏ `erp_warehouse`) |
| 8 | `voucher_type` | varchar(100) | không |  |  | Loại mua (trong nước, nhập khẩu, nguyên vật liệu sản xuất...) |
| 9 | `department_code` | varchar(20) | có |  |  | Phòng ban (trỏ `sys_department`) |
| 10 | `requester_name` | varchar(200) | có |  |  | Người yêu cầu (chữ tự do) |
| 11 | `supplier_code` | varchar(20) | có |  |  | Nhà cung cấp đề nghị (tùy chọn). Trỏ `erp_supplier` |
| 12 | `supplier_name` | varchar(200) | có |  |  | Tên nhà cung cấp đề nghị chép lúc lưu |
| 13 | `currency_code` | varchar(10) | không | 'VND' |  | Loại tiền (trỏ `sys_currency`) |
| 14 | `exchange_rate` | numeric(18,6) | không | 1 |  | Tỷ giá so với tiền hạch toán tại ngày chứng từ |
| 15 | `note` | varchar(1000) | có |  |  | Ghi chú |
| 16 | `status` | varchar(20) | không | 'Draft' |  | Trạng thái: Draft, Pending, Approved, Posted, Cancelled (có CHECK); phiếu không ghi sổ không bao giờ tới Posted |
| 17 | `total_value` | numeric(18,2) | không | 0 |  | Tổng giá trị quy ra tiền hạch toán (đã nhân tỷ giá) |
| 18 | `approved_by_user_id` | integer | có |  |  | Người duyệt cuối cùng (mã người dùng) |
| 19 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 20 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 21 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 22 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |
| 23 | `project_code` | varchar(20) | có |  |  | Dự án (trỏ `erp_project`), tùy chọn |

Chỉ mục:

- `erp_purchase_request_code_key`: **duy nhất** (code)
- `erp_purchase_request_pkey`: **duy nhất** (id)
- `ix_erp_purchase_request_currency_code`: (currency_code)
- `ix_erp_purchase_request_department_code`: (department_code) WHERE (department_code IS NOT NULL)
- `ix_erp_purchase_request_project_code`: (project_code) WHERE (project_code IS NOT NULL)
- `ix_erp_purchase_request_supplier_code`: (supplier_code) WHERE (supplier_code IS NOT NULL)
- `ix_erp_purchase_request_unit_date`: (unit_code, document_date DESC)
- `ix_erp_purchase_request_warehouse_code`: (warehouse_code)

Ràng buộc:

- `ck_erp_purchase_request_rate` (CHECK): CHECK ((exchange_rate > (0)::numeric))
- `ck_erp_purchase_request_status` (CHECK): CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Posted'::character varying, 'Cancelled'::character varying])::text[])))
- `erp_purchase_request_code_key` (UNIQUE): UNIQUE (code)

#### 5.9.4. `erp_purchase_request_line`

Dòng phiếu yêu cầu mua hàng.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `id` | bigint | không | tự tăng |  | Khóa chính của dòng; đổi sau mỗi lần sửa phiếu vì dòng được xóa và thêm lại |
| 2 | `request_id` | bigint | không |  |  | Đầu phiếu yêu cầu mua hàng |
| 3 | `line_no` | integer | không |  |  | Số thứ tự dòng trong chứng từ |
| 4 | `material_code` | varchar(64) | không |  |  | Mã vật tư (trỏ `erp_material`) |
| 5 | `material_name` | varchar(200) | không |  |  | Tên vật tư chép từ danh mục lúc lưu |
| 6 | `uom_code` | varchar(30) | không |  |  | Đơn vị tính của dòng (trỏ erp_uom) |
| 7 | `quantity` | numeric(18,4) | không |  |  | Số lượng theo đơn vị tính của dòng (lớn hơn 0) |
| 8 | `unit_price` | numeric(18,4) | không | 0 |  | Đơn giá dự kiến |
| 9 | `amount` | numeric(18,2) | không | 0 |  | Thành tiền = số lượng × đơn giá |
| 10 | `note` | varchar(300) | có |  |  | Ghi chú |
| 11 | `created_at` | timestamptz | không | now() |  | Thời điểm tạo (UTC), do hệ thống điền |
| 12 | `created_by` | integer | có |  |  | Mã người dùng tạo, do hệ thống điền |
| 13 | `updated_at` | timestamptz | có |  |  | Thời điểm sửa gần nhất (UTC) |
| 14 | `updated_by` | integer | có |  |  | Mã người dùng sửa gần nhất |

Chỉ mục:

- `erp_purchase_request_line_pkey`: **duy nhất** (id)
- `erp_purchase_request_line_request_id_line_no_key`: **duy nhất** (request_id, line_no)
- `ix_erp_purchase_request_line_material_code`: (material_code)
- `ix_erp_purchase_request_line_request`: (request_id)
- `ix_erp_purchase_request_line_uom_code`: (uom_code)

Ràng buộc:

- `ck_erp_purchase_request_line_price` (CHECK): CHECK ((unit_price >= (0)::numeric))
- `ck_erp_purchase_request_line_quantity` (CHECK): CHECK ((quantity > (0)::numeric))
- `erp_purchase_request_line_request_id_line_no_key` (UNIQUE): UNIQUE (request_id, line_no)

### 5.10. Kỹ thuật (hạ tầng của khung)

#### 5.10.1. `sys_migration`

Dấu các script SQL đã chạy (nếu dùng); không chứa dữ liệu nghiệp vụ.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `name` | varchar(100) | không |  |  | Tên bước chuyển dữ liệu một lần đã chạy (ví dụ permission_exceptions) |
| 2 | `applied_at_utc` | timestamptz | không | now() |  | Thời điểm chạy (UTC) |

Chỉ mục:

- `sys_migration_pkey`: **duy nhất** (name)

#### 5.10.2. `sys_table_ref`

Bản đồ tham chiếu giữa các bảng (không có khóa ngoại): mỗi cột `*_code` / `*_id` trỏ tới bảng nào, có chặn xóa không, có thể rỗng không. Ghi lại từ các thuộc tính `[References]` mỗi lần backend khởi động.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `table_name` | varchar(64) | không |  |  | Bảng chứa cột tham chiếu |
| 2 | `column_name` | varchar(64) | không |  |  | Cột tham chiếu |
| 3 | `ref_table` | varchar(64) | không |  |  | Bảng được trỏ tới |
| 4 | `ref_column` | varchar(64) | không |  |  | Cột khóa của bảng đích |
| 5 | `table_kind` | varchar(16) | không |  |  | catalog, document, system, translation |
| 6 | `blocks_delete` | boolean | không | true |  | true = bảng đích không xóa được khi còn dòng dùng |
| 7 | `optional` | boolean | không | false |  | true = cột được để rỗng |
| 8 | `entity_type` | varchar(100) | không |  |  | Lớp thực thể C# khai báo |
| 9 | `synced_at` | timestamptz | không | now() |  | Lần đồng bộ gần nhất lúc khởi động backend |

Chỉ mục:

- `ix_sys_table_ref_target`: (ref_table)
- `sys_table_ref_pkey`: **duy nhất** (table_name, column_name)

#### 5.10.3. `sys_v_columns`

View: mọi cột của các bảng `erp_*` / `sys_*` ghép với bản đồ tham chiếu để thấy cột nào trỏ sang bảng nào.

| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |
|---|---|---|---|---|---|---|
| 1 | `table_name` | information_schema.sql_identifier | có |  |  | Tên bảng |
| 2 | `column_name` | information_schema.sql_identifier | có |  |  | Tên cột |
| 3 | `ordinal_position` | information_schema.cardinal_number | có |  |  | Thứ tự cột trong bảng |
| 4 | `data_type` | information_schema.character_data | có |  |  | Kiểu dữ liệu |
| 5 | `max_length` | information_schema.cardinal_number | có |  |  | Độ dài tối đa (chữ) |
| 6 | `nullable` | boolean | có |  |  | Cho phép rỗng |
| 7 | `indexed` | boolean | có |  |  | Có chỉ mục bắt đầu bằng cột này |
| 8 | `ref_table` | varchar(64) | có |  |  | Bảng được trỏ tới (rỗng nếu không phải cột tham chiếu) |
| 9 | `ref_column` | varchar(64) | có |  |  | Cột khóa của bảng đích |
| 10 | `blocks_delete` | boolean | có |  |  | Chặn xóa bảng đích khi còn dùng |
| 11 | `ref_optional` | boolean | có |  |  | Cột được để rỗng |
| 12 | `table_kind` | varchar(16) | có |  |  | Loại bảng: catalog, document, system, translation |

## 6. View, hàm và trigger

### 6.1. View `sys_v_columns`

View: mọi cột của các bảng `erp_*` / `sys_*` ghép với bản đồ tham chiếu để thấy cột nào trỏ sang bảng nào.

```sql
SELECT c.table_name,
    c.column_name,
    c.ordinal_position,
    c.data_type,
    c.character_maximum_length AS max_length,
    ((c.is_nullable)::text = 'YES'::text) AS nullable,
    (EXISTS ( SELECT 1
           FROM (((pg_index i
             JOIN pg_class t ON ((t.oid = i.indrelid)))
             JOIN pg_namespace n ON (((n.oid = t.relnamespace) AND (n.nspname = (c.table_schema)::name))))
             JOIN pg_attribute a ON (((a.attrelid = t.oid) AND (a.attnum = i.indkey[0]))))
          WHERE ((t.relname = (c.table_name)::name) AND (a.attname = (c.column_name)::name)))) AS indexed,
    r.ref_table,
    r.ref_column,
    r.blocks_delete,
    r.optional AS ref_optional,
    r.table_kind
   FROM (information_schema.columns c
     LEFT JOIN sys_table_ref r ON ((((r.table_name)::text = (c.table_name)::name) AND ((r.column_name)::text = (c.column_name)::name))))
  WHERE (((c.table_schema)::name = 'public'::name) AND (((c.table_name)::name ~~ 'sys\_%'::text) OR ((c.table_name)::name ~~ 'erp\_%'::text)));
```

### 6.2. Hàm trợ giúp

| Hàm | Tham số | Trả về |
|---|---|---|
| `erp_voucher_delete_cleanup` |  | trigger |
| `sys_drop_foreign_keys` | VARIADIC table_names text[] | void |
| `sys_rename_column` | table_name text, old_name text, new_name text | void |
| `sys_rename_constraint` | table_name text, old_name text, new_name text | void |
| `sys_rename_table` | old_name text, new_name text | void |
| `sys_search_match` | value text, pattern text | boolean |
| `sys_unaccent` | value text | text |

Các hàm `unaccent*` do extension PostgreSQL `unaccent` cung cấp (bắt buộc cài). Các hàm `sys_rename_*`, `sys_drop_foreign_keys` phục vụ script chuyển cấu trúc; `sys_search_match(văn bản, mẫu)` tìm **không dấu** (dùng cho ô tìm kiếm).

### 6.3. Trigger

| Bảng | Trigger | Việc |
|---|---|---|
| `erp_goods_issue` | `trg_erp_goods_issue_delete` | BEFORE DELETE ON public.erp_goods_issue FOR EACH ROW EXECUTE FUNCTION erp_voucher_delete_cleanup('inv_issue', 'erp_goods_issue_line', 'issue_id') |
| `erp_goods_receipt` | `trg_erp_goods_receipt_delete` | BEFORE DELETE ON public.erp_goods_receipt FOR EACH ROW EXECUTE FUNCTION erp_voucher_delete_cleanup('inv_receipt', 'erp_goods_receipt_line', 'receipt_id') |

Trigger xóa phiếu (`erp_voucher_delete_cleanup`, script `41`): khi xóa đầu phiếu nhập / xuất, xóa luôn các dòng; từ chối nếu phiếu còn đang ghi sổ; với phiếu đã bỏ ghi sổ thì xóa cả các dòng sổ kho (cộng dồn bằng 0) để bảng tồn luôn bằng sổ kho.

## 7. Các script SQL

Chạy theo thứ tự tên file trong `ServerService/sql/postgresql/`:

| Script | Nội dung |
|---|---|
| `00-helpers.sql` | Hàm trợ giúp (đổi tên bảng / cột / ràng buộc, xóa khóa ngoại cũ, tìm không dấu). **Chạy đầu tiên.** |
| `01-users.sql` | Tài khoản, vai trò, mã chức năng và ma trận quyền |
| `02-company-units.sql` | Đơn vị cơ sở và các đơn vị người dùng được đăng nhập |
| `03-notifications.sql` | Thông báo và trạng thái đã đọc / đã ẩn của từng người |
| `04-system-config.sql` | Cấu hình dạng JSON của các màn Cài đặt (`sys_setting`) |
| `05-approvals.sql` | Quy trình phê duyệt chứng từ (quy tắc và các cấp duyệt) |
| `06-departments.sql` | Danh mục phòng ban |
| `07-currencies.sql` | Loại tiền và tỷ giá |
| `08-fiscal-periods.sql` | Khóa sổ theo tháng và đơn vị cơ sở |
| `09-voucher-numbering.sql` | Mẫu số và dải số chứng từ |
| `10-permission-exceptions.sql` | Quyền ngoại lệ theo từng người dùng |
| `11-languages.sql` | Ngôn ngữ giao diện và dữ liệu dịch |
| `12-audit-log.sql` | Nhật ký thay đổi dùng chung mọi chức năng |
| `13-inventory-uom.sql` | Danh mục đơn vị tính |
| `14-grid-layout.sql` | Bố cục lưới của từng người dùng (`sys_grid_layout`) |
| `15-inventory-uom-conversions.sql` | Quy đổi đơn vị tính |
| `16-inventory-material-groups.sql` | Nhóm vật tư |
| `17-inventory-warehouses.sql` | Danh mục kho |
| `18-inventory-uom-translations.sql` | Bản dịch tên đơn vị tính |
| `19-inventory-warehouse-types.sql` | Loại kho và bản dịch tên |
| `20-inventory-goods-receipts.sql` | Phiếu nhập kho và sổ kho (bản đầu, sau được `34` thay bằng sổ kho dùng chung) |
| `21-company-unit-translations.sql` | Bản dịch tên đơn vị cơ sở |
| `22-inventory-suppliers.sql` | Danh mục nhà cung cấp |
| `23-menu-tree.sql` | Cây menu lưu trong `sys_command` |
| `24-table-ref.sql` | Bản đồ tham chiếu `sys_table_ref` và view `sys_v_columns` |
| `25-inventory-warehouse-units.sql` | Đơn vị cơ sở được dùng từng kho (chọn nhiều) |
| `26-stamp-system-catalogs.sql` | Dấu bản ghi cho các danh mục hệ thống chuyển sang khung danh mục |
| `27-exchange-rate-catalog.sql` | Tỷ giá theo khung danh mục (mã dạng `USD@2026-10-08`) |
| `28-inventory-material-types.sql` | Loại vật tư |
| `29-system-tax-rates.sql` | Mã thuế (VAT, nhập khẩu, khác) |
| `30-inventory-warehouse-owner-unit.sql` | Đơn vị cơ sở sở hữu kho (cột `unit_code` của kho) |
| `31-inventory-materials.sql` | Danh mục vật tư |
| `32-inventory-locations.sql` | Vị trí lưu kho |
| `33-inventory-lots.sql` | Lô và hạn sử dụng |
| `34-inventory-stock-ledger.sql` | Sổ kho dùng chung và ba bảng tồn (kho, lô, vị trí) |
| `35-voucher-numbering-unit.sql` | Mẫu số chứng từ bắt buộc có `{DVCS}` |
| `36-login-notices.sql` | Thông báo trang đăng nhập |
| `37-login-notice-images.sql` | Ảnh của thông báo đăng nhập, cờ ghim, loại thông báo nền |
| `38-banners.sql` | Thanh thông báo hệ thống dưới header |
| `39-inventory-goods-issues.sql` | Phiếu xuất kho (đầu phiếu và dòng) |
| `40-inventory-voucher-line-references.sql` | Dòng phiếu nhập / xuất trỏ tới danh mục thật (vật tư, đơn vị tính) |
| `41-voucher-delete-trigger.sql` | Trigger xóa phiếu nhập / xuất: xóa dòng và dấu vết sổ kho |
| `42-inventory-issue-requests.sql` | Phiếu yêu cầu xuất kho và liên kết từ phiếu xuất kho |
| `43-voucher-status.sql` | Trạng thái chứng từ theo đơn vị cơ sở và quyền theo trạng thái |
| `44-purchasing.sql` | Phiếu yêu cầu mua hàng, đơn mua hàng, cột nối sang phiếu nhập kho |
| `45-purchasing-catalogs.sql` | Danh mục dự án, điều khoản thanh toán, nhóm nhà cung cấp; cột dự án trên các chứng từ |
| `46-purchase-order-line-delivery.sql` | Ngày dự kiến nhận hàng theo từng dòng đơn mua hàng |

## 8. Kiểm tra cấu trúc bằng test tự động

| Test (`ServerService/tests/Core.Tests`) | Canh điều gì |
|---|---|
| `TablesAndColumnsFollowNamingConvention` | tên bảng `sys_` / `erp_`, `snake_case` |
| `BusinessTablesHaveRecordStamps` | mọi bảng `erp_*` có 4 cột dấu bản ghi |
| `VersionedRecordsUseXminAsConcurrencyToken` | bản ghi sửa trên form dùng `xmin` làm phiên bản |
| `TableReferenceTests` | mọi cột `*_code` khai `[References]` hoặc `[NotReference]`, có chỉ mục, bảng đích có nhãn `table.<tên>` |
| `AuditDeclarationTests` | mọi thực thể khai `[Audited]` hoặc `[NotAudited]` |
| `ConcurrencyContractTests` | dịch vụ sửa có `Version` và `ExpectVersion` |

## 9. Cách cập nhật tài liệu này

1. Sửa cấu trúc bằng script SQL mới (hoặc script đang làm), chạy hai lần trên `erp_dev`.
2. Thêm mô tả bảng mới vào bảng `T` trong `docs/cong-cu/gen-database-doc.cjs` (công cụ cảnh báo bảng chưa có mô tả) và mô tả các cột mới vào `docs/cong-cu/database-notes.cjs`.
3. `node docs/cong-cu/gen-database-doc.cjs` rồi `node docs/cong-cu/build-word.cjs docs/phat-trien/mo-ta-co-so-du-lieu.md docs/phat-trien/Mo-ta-co-so-du-lieu.docx "S-ERP - Mô tả cơ sở dữ liệu" "Mô tả cơ sở dữ liệu S-ERP"`.
