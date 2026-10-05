# ERP backend (.NET 10, PostgreSQL)

API cho frontend `Frontend/` (React). Frontend là chuẩn: tên module, đường dẫn API và dữ liệu trả về khớp với kiểu trong `Frontend/src/types/index.ts` (`UserProfile`, `RoleDefinition`, `ActionPermissions`, `CompanyUnit`, `SystemNotification`) và các nhóm cài đặt của `Frontend/src/services/systemSettingsService.ts`.

## Cấu trúc

Bốn tầng, phụ thuộc một chiều `Core → Infrastructure → Application → Domain`. Trong mỗi tầng, phần dùng chung nằm ở `Common/`, còn mỗi chức năng nằm ở `Modules/<Module>/`.

```
Core.Domain/                 Entity, không phụ thuộc gì
  Common/                    AuditableEntity (cột createtime/createid/... của bảng sys_*)
  Modules/Users/             SysUser, SysRole, SysUserRole, SysCommand, quyền (ActionPermissions)
  Modules/CompanyUnits/      CompanyUnit, UserCompanyUnit
  Modules/Notifications/     Notification, NotificationRead
  Modules/SystemConfig/      SystemSetting
  Modules/Departments/       Department (phòng ban)
  Modules/Currencies/        Currency, ExchangeRate
  Modules/Fiscal/            FiscalPeriod (khóa sổ theo tháng, từng đơn vị)
  Modules/VoucherNumbering/  VoucherNumberingRule, VoucherSequence
  Modules/Inventory/Categories/<feature>/  Uom, UomConversion, MaterialGroup, Warehouse
  Modules/Approvals/         ApprovalRule, DocumentApproval
Core.Application/            Contract (DTO + interface) và quy tắc thuần
  Common/Exceptions/         BusinessRuleException (400), NotFound (404), AuthenticationFailed (401), Forbidden (403)
  Common/Security/           ICurrentUser, IPasswordService, ITokenService, PasswordPolicy
  Common/Permissions/        FunctionCatalog (mã chức năng = SubMenuKey), PermissionMatrix, SpecialRightCatalog, DocumentStatusPolicy
  Common/Documents/          VoucherCatalog: danh sách phiếu (loại số, quyền đặc biệt, quy trình duyệt)
  Common/Persistence/        ISqlExecutor, IUnitOfWork
  Common/Validation/         Guard
  Modules/{Auth,Users,Roles,CompanyUnits,Departments,Currencies,Fiscal,VoucherNumbering,Notifications,SystemConfig,Approvals,Inventory}/
Core.Infrastructure/         Triển khai
  Common/Persistence/        CoreContext (EF Core), UnitOfWork, Sql/ (SqlExecutor, SqlScripts)
  Common/Security/           PasswordService, JwtTokenService, CurrentUser
  Common/Seeding/            DatabaseSeeder, SeedDataFile
  Modules/<Module>/          Service của từng module (và Sql/*.sql khi cần SQL thuần)
Core/                        Web API (chạy được dạng Windows service)
  Common/Authorization/      Policy, RequirePermissionAttribute, handler
  Common/Controllers/        ApiControllerBase
  Common/Errors/             AppExceptionFilter → { message }
  Common/Extensions/         AddApi: JWT, CORS, rate limit, authorization
  Modules/<Module>/          Controller mỏng
  SeedData/seed.json         Dữ liệu mẫu, xuất từ mock của frontend
sql/postgresql/              00-helpers, 01-users, 02-company-units, 03-notifications, 04-system-config, 05-approvals,
                             06-departments, 07-currencies, 08-fiscal-periods, 09-voucher-numbering,
                             10-permission-exceptions đến 23-menu-tree
tests/Core.Tests/            Common/ và Modules/ giống cấu trúc trên
```

`_legacy/` chứa mã cũ trước khi tái cấu trúc, không còn nằm trong solution. Xem lại rồi xóa khi không cần.

## Thiết kế database

- **Đặt tên:** `sys_*` cho bảng hệ thống (tài khoản, phân quyền, đơn vị cơ sở, thông báo, cài đặt), `erp_*` cho bảng dữ liệu nghiệp vụ (vật tư, chứng từ, sổ kho, sổ cái…). Tên bảng và cột dùng `snake_case`; test `TablesAndColumnsFollowNamingConvention` kiểm tra quy tắc này.
- Bảng hệ thống hiện có: `sys_users`, `sys_role`, `sys_user_role`, `sys_command`, `sys_role_command`, `sys_user_command`, `sys_role_right`, `sys_user_right`, `sys_company_unit`, `sys_user_company_unit`, `sys_department`, `sys_notification`, `sys_notification_read`, `sys_setting`, `sys_currency`, `sys_exchange_rate`, `sys_fiscal_period`, `sys_voucher_numbering`, `sys_voucher_sequence`, `sys_approval_rule`, `sys_document_approval`, `sys_language` (danh mục ngôn ngữ, một ngôn ngữ mặc định), `sys_audit_log` (nhật ký thay đổi của mọi chức năng), `sys_migration` (chuyển dữ liệu một lần đã chạy). Bảng nghiệp vụ hiện có: `erp_uom` (danh mục đơn vị tính).
- Bảng nghiệp vụ `erp_uom_conversion` lưu quy đổi đơn vị tính; `material_code` tùy chọn vì danh mục vật tư hiện vẫn là dữ liệu mẫu trên frontend. Hai mã đơn vị luôn được kiểm tra với `erp_uom` khi lưu.
- Đa ngôn ngữ đơn vị tính: chạy `18-inventory-uom-translations.sql` để tạo `erp_uom_translation` (`uom_code`, `language_code`, `name`). `erp_uom.name` là tên gốc tiếng Việt; màn danh mục cho nhập tên theo các ngôn ngữ đang bật trong `sys_language`. Danh sách và tra cứu trả tên theo `Accept-Language`, thiếu bản dịch thì dùng tên gốc. API vẫn trả `name` gốc cùng `translations` để sửa; nhập Excel không có trường `translations` sẽ giữ bản dịch đã lưu khi cập nhật.
- Đa ngôn ngữ đơn vị cơ sở: chạy `21-company-unit-translations.sql` để tạo `sys_company_unit_translation`. `sys_company_unit.name` là tên gốc; `localizedName` theo `Accept-Language`, thiếu bản dịch thì dùng tên gốc. Màn Cài đặt › Đơn vị cơ sở dùng khung danh mục chung, hỗ trợ nhập/xuất Excel, sửa hàng loạt và ghi nhật ký thay đổi tên dịch. Excel chỉ chứa tên gốc; khi cập nhật không xóa bản dịch đã lưu.
- Danh mục loại kho: `19-inventory-warehouse-types.sql` tạo `erp_warehouse_type`, `erp_warehouse_type_translation` và thêm `erp_warehouse.warehouse_type_code` (cho phép NULL để giữ kho cũ). Loại kho có mã, tên gốc, bản dịch tên, ghi chú, trạng thái; không xóa được khi kho đang sử dụng. Màn kho chọn loại qua lookup `warehouseTypes`; API `/api/inventory/warehouse-types` theo quyền `inv_warehouse_type_cat`.
- Bảng nghiệp vụ `erp_material_group` lưu nhóm vật tư; màn Vật tư hiện vẫn là dữ liệu mẫu trong trình duyệt nên backend chưa thể chặn xóa nhóm đang được vật tư sử dụng.
- Mọi bảng `erp_*` có 4 cột dấu vết `created_at`, `created_by`, `updated_at`, `updated_by` (`timestamptz` giờ UTC, id người dùng): entity kế thừa `ErpEntity`, `CoreContext` tự điền khi lưu (client gửi lên cũng bị bỏ qua), test `BusinessTablesHaveRecordStamps` bắt buộc. DTO trả về dạng `stamp` (`RecordStampDto`, có tên người tạo / sửa); frontend dùng `recordStampColumns(t)` cho lưới và `<RecordStampLine>` cho form. Bảng `sys_*` cũ vẫn dùng `createtime` / `createid` / `updatetime` / `updateid`. `sys_users.language` là ngôn ngữ riêng của người dùng (null = theo ngôn ngữ mặc định).
- **Chống ghi đè khi nhiều người cùng sửa**: bản ghi sửa trên form có `Version` (`IVersioned`; mọi `ErpEntity` đã có), ánh xạ tới cột hệ thống `xmin` của PostgreSQL (không cần thêm cột). DTO trả `version`, màn hình gửi lại khi lưu; service gọi `db.ExpectVersion(entity, request.Version)` sau khi tải bản ghi. Nếu bản ghi đã bị người khác sửa hoặc xóa, API trả **409** với thông báo `record.changed`, không ghi gì. Không gửi `version` thì không kiểm tra (nhập khẩu, sao lưu). Hướng dẫn: `docs/chong-ghi-de.md`.
- Cài đặt dạng JSON (`sys_setting`) chỉ dùng cho giá trị không bị dữ liệu khác tham chiếu (tham số mặc định, năm tài chính, hồ sơ doanh nghiệp, định dạng số). Thứ gì được phiếu / người dùng tham chiếu (ngoại tệ, tỷ giá, phòng ban, kỳ khóa sổ, dải số) có bảng riêng. Script 06–08 tự chuyển dữ liệu JSON / chữ cũ sang các bảng này. Các bảng `erp_unit`, `erp_user_unit`, `erp_notification`, `erp_notification_read`, `erp_setting` của phiên bản cũ được script tự đổi tên (giữ nguyên dữ liệu).
- `00-helpers.sql` có các hàm dùng lại khi viết script: `sys_rename_table`, `sys_rename_column`, `sys_rename_constraint`, `sys_drop_foreign_keys`.
- **Không dùng khóa ngoại.** Các bảng liên kết với nhau qua trường mã/ID (`user_id`, `role_id`, `menuid0`, `unit_code`, `notification_id`), có index trên các trường này. Service kiểm tra bản ghi liên kết tồn tại trước khi ghi và không cho xóa bản ghi đang được dùng. Các script tự gỡ khóa ngoại còn sót từ phiên bản cũ.
- Quan hệ khai báo trong `CoreContext` chỉ để EF viết được phép join, không tạo ràng buộc trong database.

## EF Core và SQL thuần

- **CRUD** (danh mục, người dùng, phân quyền, chứng từ khi lưu nháp): EF Core qua `CoreContext`.
- **Báo cáo, tính toán, ghi sổ kho / sổ cái**: SQL thuần qua `ISqlExecutor` (Dapper). Viết câu lệnh trong `Core.Infrastructure/Modules/<Module>/Sql/<Tên>.sql` (được nhúng vào DLL), đọc bằng `SqlScripts.Get("<Module>", "<Tên>")`. Luôn truyền giá trị bằng tham số `@ten`, không nối chuỗi. Cột snake_case tự map sang thuộc tính PascalCase.
- `ISqlExecutor` chạy trên cùng kết nối và transaction với EF. Lưu phiếu bằng EF rồi ghi sổ bằng SQL trong một `IUnitOfWork.ExecuteAsync(...)` thì cả hai cùng commit hoặc cùng rollback:

```csharp
await unitOfWork.ExecuteAsync(async ct =>
{
    db.Receipts.Add(receipt);                  // EF
    await db.SaveChangesAsync(ct);
    await sql.ExecuteAsync(SqlScripts.Get("Inventory", "PostReceipt"),
        new { receiptId = receipt.Id }, ct);   // SQL thuần, cùng transaction
}, ct);
```

## Phân quyền

- Ma trận quyền giống frontend: mỗi mã chức năng (`SubMenuKey`) có 7 thao tác `view / create / edit / delete / approve / print / export`. Bảng `sys_role_command` / `sys_user_command` vẫn giữ 11 cờ cũ; `CommandPermission` chuyển đổi hai chiều (`can_add` = Thêm, kèm `can_copy` / `can_import`; `can_edit` = Sửa; `can_print` = In; `can_export` = Xuất). Endpoint thêm mới dùng `PermissionAction.Create`, sửa / lưu cấu hình dùng `Edit`; gửi duyệt chứng từ cần `Create` hoặc `Edit`. JSON kiểu cũ (`createEdit`, `printExport` trong file seed, file sao lưu) vẫn đọc được, nghĩa là có cả hai quyền.
- Quyền hiệu lực = **vai trò + ngoại lệ** (`PermissionMatrix.Resolve`). Quản trị viên (vai trò mã `ADMIN` hoặc cờ cũ `auth_fl` chứa `0`) có toàn quyền. Người khác có quyền của vai trò; mỗi dòng `sys_user_command` là ngoại lệ, thay quyền của đúng chức năng đó. Chức năng không có dòng riêng luôn theo vai trò, nên thêm chức năng hoặc sửa vai trò thì người giữ vai trò nhận ngay.
- Màn phân quyền vẫn gửi cả ma trận mong muốn; backend chỉ lưu phần khác vai trò (`PermissionMatrix.Overrides`). "Đưa N người về đúng vai trò" (`POST /api/settings/roles/{id}/sync-users`) xóa ngoại lệ của những người giữ vai trò. Script `10-permission-exceptions.sql` đã chuyển dữ liệu kiểu cũ (ma trận riêng thay cả vai trò) sang kiểu này mà không đổi quyền của ai.
- API bảo vệ bằng `[RequirePermission("sys_users", PermissionAction.Delete)]`. Mọi controller kế thừa `ApiControllerBase` yêu cầu đăng nhập và quyền vào đơn vị cơ sở của token.
- Người quản lý tài khoản không phải quản trị viên chỉ được cấp thêm những quyền, quyền đặc biệt và đơn vị cơ sở mà chính mình có (`GrantGuard`); không tự đổi quyền hay tự đặt lại mật khẩu của mình. Quyền đặc biệt chỉ có hiệu lực trên chức năng được Xem.
- Chỉ quản trị viên được gán vai trò ADMIN, sửa tài khoản quản trị hoặc vai trò ADMIN. Hệ thống luôn giữ ít nhất một quản trị viên và một đơn vị cơ sở hoạt động.
- Token JWT chứa đơn vị cơ sở. Khóa tài khoản, đổi hoặc đặt lại mật khẩu sẽ tăng `security_version`, làm các token cũ hết hiệu lực ngay.

### Quyền đặc biệt

- Ngoài 5 thao tác, mỗi chức năng có thể có quyền đặc biệt dạng `{chức năng}:{mã}`, khai báo trong `Core.Application/Common/Permissions/SpecialRightCatalog.cs`, lưu ở `sys_role_right` / `sys_user_right` (không cần thêm cột khi thêm quyền mới).
- Mã hiện có: `VIEW_PRICE` (xem đơn giá, thành tiền), `VIEW_COST` (xem giá vốn), `VIEW_ALL` (xem phiếu của người khác), `EDIT_PENDING`, `EDIT_APPROVED`, `POST`, `UNPOST`, `CANCEL`.
- Cách tính: quản trị viên có tất cả; người khác có quyền của vai trò, cộng các dòng `sys_user_right` có `is_granted = true`, trừ các dòng `is_granted = false`. Quyền mới thêm vào danh mục chưa ai có (trừ quản trị viên) cho tới khi được cấp.
- Thêm quyền đặc biệt: xem mục "Quyền đặc biệt và trạng thái chứng từ" trong README gốc.
- API: `[RequireRight("inv_receipt", SpecialRightCatalog.ViewPrice)]` hoặc `IPermissionService.HasRightAsync`. Frontend: `hasRight(user, 'inv_receipt', RIGHTS.VIEW_PRICE)`. Phiếu nhập kho ẩn giá cả ở API và giao diện khi không có `VIEW_PRICE`; phiếu xuất kho hiện chỉ ẩn trên giao diện mẫu.
- Gửi thông báo (chuông trên header): quyền `overview_main:SEND_NOTIFICATION` cho gửi trong đơn vị đang làm việc (cả đơn vị hoặc một người), `overview_main:SEND_NOTIFICATION_ALL` cho gửi mọi đơn vị. Quản trị viên luôn gửi được. Hai quyền này không được cấp tự động. Thông báo tự động của quy trình duyệt không cần quyền này.
- `DocumentStatusPolicy` quyết định thao tác nào được phép theo trạng thái phiếu (Nháp / Chờ duyệt / Đã duyệt / Đã ghi sổ / Đã hủy) và quyền của người dùng. Frontend có bản sao `Frontend/src/utils/documentPolicy.ts`; cả hai cùng được kiểm tra bằng `tests/Core.Tests/Common/DocumentPolicyCases.json` (`dotnet test` và `npm run check-policy`).

### Quy trình phê duyệt

Phiếu nhập kho dùng API `/api/inventory/goods-receipts` và các bảng trong `sql/postgresql/20-inventory-goods-receipts.sql`. Chạy script 20 sau các script Kho 15–19 trước khi sử dụng màn hình. Ghi sổ tạo dòng `erp_stock_movement`; bỏ ghi sổ xóa các dòng của phiếu đó. Báo cáo tồn kho hiện vẫn dùng dữ liệu mẫu và chưa đọc bảng này.

Danh mục nhà cung cấp dùng bảng `erp_supplier` trong `sql/postgresql/22-inventory-suppliers.sql`. Trên database đã tồn tại, chạy lại `00-helpers.sql` để cập nhật hàm tìm kiếm `sys_search_match`, rồi chạy script 22. Phiếu nhập kho hiện chưa liên kết tới danh mục này.

Cây menu nằm trong `sys_command` (`23-menu-tree.sql` thêm các cột `menu_*`); tên theo từng ngôn ngữ nằm trong `sys_command_translation` (`menuid0`, `language_code`, `title`). Chạy script 23 trước khi khởi động API mới; script chuyển dữ liệu từ `sys_menu_node` cũ nếu có. Nếu chưa có metadata menu, API nhập cây ban đầu từ `Core/SeedData/menu.json` đúng một lần. `menuid0` của chức năng vẫn là khóa phân quyền, `hide_yn` vẫn quyết định ẩn/hiện; `GET /api/menu` trả cây menu cho frontend.

Khi thêm chức năng, giữ mã trong `FunctionCatalog.cs` và route/màn hình frontend như trước. Dòng `sys_command` của mã đó được seeder tạo sẵn; chỉ cần đặt `menu_kind = 'function'`, `menu_parent_id` bằng `menuid0` của nhóm, `menu_key` bằng mã chức năng, cùng icon và thứ tự. Thêm mỗi bản dịch bằng một dòng `sys_command_translation` với `language_code` tương ứng. Tạo phân hệ hoặc nhóm bằng một dòng `sys_command` có `menu_kind = 'module'` hoặc `'group'`; các dòng này không tham gia ma trận quyền.

- Quy tắc ở `sys_approval_rule`: chức năng, cấp, người lập (mọi người / người cụ thể / vai trò / phòng ban), giá trị từ, đơn vị, người duyệt (người cụ thể / vai trò). Quản lý tại Cài đặt › Người dùng & Phân quyền › Quy trình phê duyệt.
- Phiếu duyệt lần lượt từng cấp; các quy tắc cùng cấp gộp người duyệt. Người duyệt phải còn hoạt động, được vào đơn vị của phiếu, có quyền Duyệt chức năng và không phải người lập. Không có quy tắc nào khớp thì mọi người có quyền Duyệt được duyệt (một cấp).
- Trạng thái duyệt lưu ở `sys_document_approval`; mỗi bước gửi thông báo cho người duyệt và người lập.

## Cài đặt

1. Tạo database PostgreSQL, chạy lần lượt các script trong `sql/postgresql/` theo thứ tự tên file (bắt đầu từ `00-helpers.sql`) (chạy lại nhiều lần vẫn an toàn; sao lưu database cũ trước khi áp dụng).
2. Tạo `Core/appsettings.Local.json` (không commit):

```json
{
  "ConnectionStrings": { "CoreContext": "Host=localhost;Port=5432;Database=erp_dev;Username=...;Password=..." },
  "Tokens": { "Key": "chuỗi-ngẫu-nhiên-ít-nhất-32-byte" },
  "Seed": { "DemoData": true, "DefaultPassword": "mật-khẩu-demo-tối-thiểu-8-ký-tự" }
}
```

3. Chạy:

```powershell
dotnet build Core.sln
dotnet test tests/Core.Tests/Core.Tests.csproj
dotnet run --project Core/Core.csproj   # http://localhost:2512
```

Khi khởi động, API thêm các mã chức năng còn thiếu vào `sys_command`, tạo dải số cho các phiếu mới trong `VoucherCatalog` và bảo đảm có một đồng tiền hạch toán (mặc định VND). Nếu `sys_users` đang trống:
- `Seed:DemoData = true`: nạp `Core/SeedData/seed.json` (đơn vị, vai trò, phòng ban, người dùng, thông báo, cài đặt, ngoại tệ, tỷ giá của mock frontend). Mọi tài khoản demo dùng mật khẩu `Seed:DefaultPassword`.
- Ngược lại, nếu có `Bootstrap:AdminPassword` (≥ 12 ký tự): chỉ tạo tài khoản quản trị `Bootstrap:AdminUsername` và đơn vị `Bootstrap:UnitCode`.

Môi trường Development: đặt `Seed:AdminPassword` (ví dụ `"admin"`) thì mỗi lần khởi động tài khoản `admin` được đặt lại về mật khẩu này, không áp chính sách 8 ký tự. Ngoài Development cấu hình này bị bỏ qua.

Tạo lại `seed.json` sau khi sửa mock frontend: trong `Frontend/` chạy `npm run export-seed`.

## API

Mọi API (trừ đăng nhập) nhận `Authorization: Bearer <token>`; lỗi trả `{ "message": "..." }`.

| Module | Endpoint | Quyền |
| --- | --- | --- |
| Auth | `GET /api/auth/company-units`, `POST /api/auth/login` | Công khai, giới hạn 10 lần/phút/IP |
| Auth | `GET /api/auth/me`, `POST /api/auth/switch-unit`, `PUT /api/auth/me/profile`, `PUT /api/auth/me/password` | Đã đăng nhập |
| Users | `GET/POST /api/settings/users`, `PUT /api/settings/users/{id}`, `PUT .../{id}/permissions`, `PUT .../{id}/password`, `DELETE .../{id}` | `sys_users` |
| Roles | `GET/POST /api/settings/roles`, `PUT /api/settings/roles/{id}`, `POST .../{id}/sync-users`, `DELETE .../{id}` (từ chối khi còn người giữ vai trò hoặc quy tắc duyệt dùng vai trò) | `sys_users` (xóa: quyền Xóa) |
| CompanyUnits | `GET /api/settings/company-units`; `POST`, `PUT /{code}`, `DELETE /{code}`, `POST /import`, `POST /delete-many` | Xem: đã đăng nhập; sửa: `inv_company_unit_cat` |
| SystemConfig | `GET /api/settings/system-config`; `PUT /api/settings/system-config/{section}?unitCode=` (section: `systemDefaults`, `fiscalConfig`, `companyProfile`, `numberFormat`; `unitCode` phải là đơn vị người dùng được vào) | Sửa: `sys_default_config`, `sys_fiscal_year`, `settings_main` theo section |
| SystemConfig | `GET /api/settings/system-config/backup`, `POST .../restore` (một transaction, chỉ thêm / sửa, không xóa) | Quản trị viên |
| Departments | `GET /api/settings/departments`; `POST`, `PUT /{code}`, `DELETE /{code}` | Xem: đã đăng nhập; sửa: `sys_departments` |
| Languages | `GET /api/auth/languages` (ngôn ngữ đang dùng, không cần đăng nhập), `PUT /api/auth/me/language`; `GET/POST /api/settings/languages`, `PUT /{code}`, `DELETE /{code}` | Danh mục: `sys_languages` |
| Currencies | `GET /api/settings/currencies`; `POST`, `PUT /{code}`, `DELETE /{code}` | Xem: đã đăng nhập; sửa: `sys_currencies` |
| Currencies | `GET /api/settings/exchange-rates?currency=`, `GET .../rate?currency=&date=`; `POST`, `PUT /{id}`, `DELETE /{id}` | Xem: đã đăng nhập; sửa: `sys_exchange_rates` |
| Fiscal | `GET /api/settings/fiscal-periods/{year}`, `GET .../check?date=`; `PUT /{year}` `{ months, isLocked }` (đơn vị của phiên) | Xem: đã đăng nhập; khóa / mở: `sys_fiscal_year` |
| VoucherNumbering | `GET /api/settings/voucher-numbering`, `PUT /{voucherType}`; `GET /{voucherType}/preview?date=` | Xem / sửa: `sys_default_config`; xem trước số: đã đăng nhập |
| Notifications | `GET /api/notifications`, `PUT /{id}/read`, `PUT /read-all`, `DELETE /{id}` (ẩn một thông báo), `DELETE` (ẩn tất cả), `GET /stream` (sự kiện thời gian thực); `POST` gửi, `GET /send-scope`, `GET /recipients?unitCode=` | Gửi: quản trị viên hoặc quyền `SEND_NOTIFICATION` / `SEND_NOTIFICATION_ALL` |
| Permissions | `GET /api/settings/permission-catalog` (danh sách quyền đặc biệt) | Đã đăng nhập |
| Approvals | `GET/POST /api/settings/approval-rules`, `PUT/DELETE .../{id}`, `POST .../preview` | `sys_users` |
| Inventory | `GET /api/inventory/uoms` (danh mục đơn vị tính đầy đủ); `POST`, `PUT /{code}`, `DELETE /{code}`; `POST .../import` `{ rows, mode: "create" \| "upsert" }` (nhập Excel), `POST .../delete-many` `{ keys }` | Xem: Xem; thêm / nhập: Thêm (upsert cần thêm Sửa); sửa: Sửa; xóa: Xóa (`inv_uom_cat`). Màn khác chọn đơn vị qua `/api/lookups/uoms` |
| Inventory | `GET /api/inventory/uom-conversions`; `POST`, `PUT /{code}`, `DELETE /{code}`; `POST .../import`, `POST .../delete-many` | Quyền theo `inv_uom_conversion_cat` giống danh mục đơn vị tính. Tra cứu một / nhiều mã qua `/api/lookups/uomConversions` |
| Inventory | `GET /api/inventory/material-groups`; `POST`, `PUT /{code}`, `DELETE /{code}`; `POST .../import`, `POST .../delete-many` | Quyền theo `inv_material_group_cat` giống danh mục đơn vị tính. Tra cứu một / nhiều mã qua `/api/lookups/materialGroups` |
| Inventory | `GET /api/inventory/warehouses`; `POST`, `PUT /{code}`, `DELETE /{code}`; `POST .../import`, `POST .../delete-many` | Quyền theo `inv_warehouse_cat` giống danh mục đơn vị tính. Tra cứu một / nhiều mã qua `/api/lookups/warehouses` |
| Menu | `GET /api/menu` lấy cây menu từ `sys_command` và `sys_command_translation`; `GET /api/settings/system-config` (mục `menuVisibility`); `PUT /api/settings/system-config/menuVisibility` với `{ hiddenModules, hiddenFunctions }` | Đọc: đã đăng nhập; sửa ẩn/hiện: quyền Sửa `sys_menu`. Module ẩn lưu ở `sys_setting`, chức năng ẩn cập nhật `sys_command.hide_yn`. Không cho ẩn Tổng quan, Cài đặt hoặc chính màn Quản lý menu. Chỉ ảnh hưởng điều hướng. |
| AuditLogs | `GET /api/audit-logs/settings`, `PUT .../settings` `{ retentionMonths }` (0 = lưu vĩnh viễn, tối đa 120) | Xem / Sửa: `sys_audit_log` |
| GridLayouts | `GET /api/grid-layouts/{functionCode}/{gridKey}` (bố cục của tôi + mặc định công ty), `PUT/DELETE .../me`, `PUT/DELETE .../company` | Xem chức năng đó; `company`: quản trị viên |
| Lookups | `GET /api/lookups/{name}?q=&page=&pageSize=&includeInactive=`, `GET /api/lookups/{name}/codes?codes=A,B` (danh mục đăng ký bằng `AddLookup`: `uoms`, `uomConversions`, `materialGroups`, `warehouses`) | Đã đăng nhập |
| Health | `GET /health` (kiểm tra cả database), `GET /health/live` (chỉ tiến trình) | Công khai (cho load balancer / công cụ giám sát) |
| AuditLogs | `GET /api/audit-logs/filters`; `GET /api/audit-logs?functionCode=&objectType=&objectId=&action=&actor=&search=&from=&to=&page=&pageSize=` (mới nhất trước; `actor` / `search` tìm một phần tên, không phân biệt hoa thường; `to` tính cả ngày đó) | Xem: `sys_audit_log` |
| Approvals | `GET /api/approvals/pending`, `GET /api/approvals/{fn}/{id}`, `POST .../submit`, `.../approve`, `.../reject`, `.../withdraw` | Theo chức năng của phiếu |

## Thông báo

- Người nhận: `unit_code` / `recipient_user_id` để trống nghĩa là tất cả. Thông báo gửi chung trước ngày tạo tài khoản không hiện với tài khoản đó; thông báo gửi riêng luôn hiện.
- Liên kết: `link_module` mở phân hệ; `link_function` + `link_document_id` mở đúng một chứng từ (thông báo của quy trình duyệt luôn có). Frontend: `requestOpenDocument` / `useOpenDocumentRequest` trong `utils/documentLinks.ts`.
- Thời gian thực: `GET /api/notifications/stream` (server-sent events, đọc bằng `fetch` để token nằm trong header). Server chỉ gửi tín hiệu `notification` hoặc `sync`, trình duyệt tự tải lại danh sách qua API thường. Kết nối tự đóng khi token bị thu hồi. `NotificationStream` giữ kết nối trong bộ nhớ, nên chạy nhiều instance API thì cần thêm kênh chung (PostgreSQL LISTEN/NOTIFY hoặc Redis). Frontend vẫn tải định kỳ 3 phút làm dự phòng.
- Dọn dẹp: `NotificationCleanupService` chạy 12 giờ một lần, xóa thông báo cũ hơn `Notifications:RetentionDays` (mặc định 180 ngày, tối thiểu 7) và thông báo đã hết hạn quá 30 ngày, kèm trạng thái đọc.

## Nhật ký thay đổi

Bảng `sys_audit_log` dùng chung cho mọi chức năng: ai sửa (`actor_id`, tên đăng nhập, họ tên), lúc nào, ở đơn vị nào, từ IP nào, sửa bản ghi nào (`function_code`, `object_type`, `object_id`, `object_label`), hành động gì và các trường đổi trước → sau (`changes`, JSON). Xem tập trung ở **Cài đặt › Nhật ký thay đổi** (chức năng `sys_audit_log`), không hiện trên màn chức năng.

**Tự động (mặc định).** Khi người dùng đã đăng nhập lưu dữ liệu, `CoreContext.SaveChangesAsync` gọi `AuditTrail`: đọc các bản ghi thêm / sửa / xóa của entity có `[Audited]`, so từng cột trước → sau, ghi nhật ký **trong cùng transaction** (lưu lỗi thì không có nhật ký). Seeder và tác vụ nền không ghi. Khai báo trên entity (`Core.Domain/Common/AuditAttributes.cs`):

| Khai báo | Ý nghĩa |
| --- | --- |
| `[Audited("mã chức năng", "loại đối tượng", Label = "{Code} - {Name}", SoftDelete = nameof(ValidFlg))]` | Ghi tự động; `Label` là tên hiển thị; `SoftDelete` = cờ xóa mềm (về 0 / false thì ghi là DELETE) |
| `[NotAudited("lý do / ghi ở đâu")]` | Không ghi tự động (bảng kỹ thuật, hoặc đã ghi tay có nghĩa nghiệp vụ) |
| `[AuditIgnore]` trên property | Không bao giờ ghi (mật khẩu, `security_version`, tùy chọn cá nhân, cột sao chép) |
| `[AuditField("tên")]` | Đổi tên trường (cột cũ: `MaDvcs` → `defaultUnit`, `MenuId0` → `function`) |
| `[AuditJson]` | Cột JSON: ghi từng khóa đổi thành một trường (`sys_setting.value`) |
| `[AuditedChild(typeof(Cha), nameof(ChaId), "tên trường", nameof(GiáTrị))]` | Bảng con dạng danh sách (đơn vị được vào của người dùng): ghi thành một trường trên bản ghi cha |

Test `AuditDeclarationTests` bắt mọi entity phải có `[Audited]` hoặc `[NotAudited]`, nên thêm bảng mới không thể quên. Cột kiểm toán (`createtime`, `updateid`...) không ghi. Bản ghi mới tạo rồi được sửa tiếp trong cùng request (ví dụ thêm đơn vị sau khi tạo người dùng) gộp vào một dòng CREATE.

**Ghi tay** (`IAuditLog`), chỉ khi EF không thấy hoặc cần nghĩa nghiệp vụ:
- `Attach(entity, changes)`: thêm trường vào dòng tự động của entity đó (ví dụ tên người duyệt thay cho id, vai trò của tài khoản mới).
- `RecordAsync(new AuditEntry(...))`: một dòng riêng, gọi trước `SaveChanges`. Đang dùng cho: phân quyền tài khoản (quyền **thực tế** được thêm / bớt, `UserAccessAudit`), ma trận + quyền đặc biệt của vai trò, đưa người dùng về đúng vai trò (`SYNC`), đặt lại / đổi mật khẩu, trình / duyệt / từ chối / rút phiếu (`DocumentApprovalService`), và thay đổi bằng `ExecuteUpdate` (bỏ cờ tiền hạch toán / ngôn ngữ mặc định cũ).
- SQL thuần (`ISqlExecutor`, ghi sổ) và `ExecuteUpdate` / `ExecuteDelete` **không** đi qua EF: phải ghi tay một dòng tóm tắt.

**Tự xóa nhật ký cũ.** Màn Nhật ký thay đổi có nút **Lưu trữ** (cần quyền Sửa của `sys_audit_log`): số tháng giữ nhật ký, lưu ở mục cài đặt `auditLog` (`sys_setting`, khóa `AUDIT_LOG_SETTINGS`; không có = lưu vĩnh viễn). `AuditLogCleanupService` chạy 1 phút sau khi API khởi động rồi 12 giờ một lần, xóa từng lô 5.000 dòng cũ hơn số tháng đó (tính trọn ngày), rồi ghi một dòng `PURGE` của "Hệ thống" (số dòng đã xóa, xóa trước ngày nào). Dòng `PURGE` không bao giờ bị xóa. Đổi số tháng cũng được ghi nhật ký.

Quy ước trường (frontend tự hiển thị): trường thường `camelCase` (nhãn `audit.field.<tên>`), `permission:{chức năng}` (các quyền được cấp), `right:{chức năng}:{mã}` (quyền đặc biệt). Bộ lọc của màn lấy từ `GET /api/audit-logs/filters`, nên chức năng mới tự hiện; nhãn `audit.objectType.<loại>` / `audit.action.<HÀNH_ĐỘNG>` là tùy chọn (không có thì hiện mã).

## Lỗi trùng dữ liệu, cache, log và giám sát

**Lỗi trùng / xung đột** (`Core.Infrastructure/Common/Persistence/DatabaseErrors.cs`, dùng trong `AppExceptionFilter`): mọi lỗi unique (23505) từ bất kỳ đường ghi nào (EF, `ExecuteUpdate`, SQL thuần) thành **409** *"Tên "Kilogram" đã tồn tại. Vui lòng nhập giá trị khác."*, không còn lỗi 500. Tên trường lấy từ khóa `dbfield.<tên cột>` (`Messages.*.json`), giá trị lấy từ chi tiết lỗi của PostgreSQL (`IncludeErrorDetail` bật trong `AddInfrastructure`). Deadlock / serialization (40P01, 40001) thành 409 `record.busy`. Service vẫn nên kiểm tra trước để có thông báo riêng; lớp này là lưới an toàn khi hai người lưu cùng lúc.

**Cache** (`IAppCache`, `Core.Infrastructure/Common/Caching/`): bộ nhớ của instance API. Mỗi mục cache khai báo các bảng nó đọc; `CacheInvalidationInterceptor` dò mọi lệnh `INSERT` / `UPDATE` / `DELETE` mà `CoreContext` chạy và xóa cache của bảng đó ngay, rồi xóa lại khi transaction commit hoặc rollback. Trong transaction đang mở thì không dùng cache (`db.CachedAsync`). Đang cache:
- quyền của từng người dùng (tài khoản còn hoạt động, `security_version`, admin, ma trận quyền, quyền đặc biệt, đơn vị được vào): trước đây đọc DB ở mọi request, nay đọc một lần cho tới khi bảng tài khoản / vai trò / quyền thay đổi. Thu hồi quyền hay khóa tài khoản vẫn có hiệu lực ngay request sau;
- danh sách đơn vị đang hoạt động, các mục cài đặt theo đơn vị, ngôn ngữ đang dùng, danh mục đơn vị tính.

Không cache tồn kho, số dư, số chứng từ, khóa sổ. Lệnh ghi qua Dapper (`ISqlExecutor`) không đi qua EF: nếu ghi vào bảng có cache thì gọi `cache.InvalidateTables(...)`. Chạy nhiều instance API thì cần kênh xóa cache chung (PostgreSQL LISTEN / NOTIFY hoặc Redis).

**Log** (Serilog, mục `Serilog` trong `appsettings.json`): ghi ra console và `Core/logs/erp-yyyyMMdd.log` (mỗi ngày một file, giữ 30 file, tối đa 100 MB / file; thư mục `logs/` không commit). Mỗi request một dòng: phương thức, đường dẫn, mã trả về, thời gian xử lý, kèm `UserId`, `UnitCode`, `ClientIp`, `RequestId`. Request chậm hơn `Monitoring:SlowRequestMs` (1.000 ms) ghi mức Warning, lỗi server ghi Error. Câu SQL chậm hơn `Monitoring:SlowQueryMs` (500 ms) ghi Warning kèm câu lệnh (`SlowQueryInterceptor`, không ghi giá trị tham số). Mỗi response có header `X-Request-Id` để người dùng báo lỗi kèm mã, tra đúng dòng log.

**Bố cục lưới** (`sys_grid_layout`, `14-grid-layout.sql`): mỗi người một dòng cho mỗi lưới (`function_code` + `grid_key`), `user_id` NULL là mặc định của công ty; `layout` là JSON do frontend ghi (`columns: [{ key, visible, width }]`, `sortKey`, `sortDir`, `pageSize`), backend chỉ kiểm tra hình dạng và kích thước (`GridLayoutRules`). Cột do code định nghĩa; khóa cột không còn thì frontend bỏ qua.

**Quyền đọc**: `GET` dữ liệu đầy đủ của một chức năng cần quyền **Xem** chức năng đó; chọn mã ở màn khác đi qua tra cứu (chỉ mã, tên, cột phụ khai báo). `ReadAccessContractTests` bắt mọi `GET` của controller có `Function` phải có `RequirePermission`; các ngoại lệ hiện có (đơn vị cơ sở, tiền tệ, tỷ giá, phòng ban, khóa sổ, xem trước số phiếu) ghi lý do trong test và sẽ chuyển sang tra cứu khi chuyển màn.

**Tra cứu dùng chung** (`ILookupService`, `Core.Infrastructure/Common/Lookups/`): mỗi danh mục đăng ký một `LookupDefinition` (chiếu sang `LookupRow`: mã, tên, đang dùng, 3 cột phụ). Tìm `ILIKE` trên mã và tên (ký tự `%` / `_` được hiểu là chữ), mã trùng khớp rồi mã bắt đầu bằng chữ tìm đứng trước, phân trang tối đa 100.

**Giám sát**: `GET /health` trả `{ status, checks: { database } }` (200 khi ổn, 503 khi database không kết nối được), `GET /health/live` chỉ kiểm tra tiến trình. Trên server database nên bật `pg_stat_statements` để biết câu lệnh nào tốn thời gian nhất.

## Thêm module mới

1. Entity trong `Core.Domain/Modules/<Module>/` (bảng nghiệp vụ đặt tên `erp_*`, cột `snake_case`, không khóa ngoại), bảng trong `sql/postgresql/NN-<module>.sql`, `DbSet` trong `CoreContext`.
2. Contract (DTO + interface) trong `Core.Application/Modules/<Module>/`.
3. Service trong `Core.Infrastructure/Modules/<Module>/` (EF cho CRUD, `ISqlExecutor` + `Sql/*.sql` cho báo cáo và ghi sổ), đăng ký trong `DependencyInjection.cs`.
4. Controller kế thừa `ApiControllerBase` trong `Core/Modules/<Module>/`, bảo vệ bằng `RequirePermission`.
5. Mã chức năng mới: thêm vào `FunctionCatalog` và `SubMenuKey` của frontend.
6. Phiếu (chứng từ): thêm vào `Common/Documents/VoucherCatalog.cs`; dải số và các quyền đặc biệt của phiếu có sẵn ngay.
7. Nhật ký: gắn `[Audited("mã chức năng", "loại", Label = ...)]` lên entity (hoặc `[NotAudited(lý do)]`), thêm / sửa / xóa qua EF tự được ghi (xem [Nhật ký thay đổi](#nhật-ký-thay-đổi)).

Mẫu module tham khảo: danh mục đơn giản → `Departments`; danh mục + bảng con có ngày → `Currencies` (ngoại tệ, tỷ giá); số liệu tính bằng SQL thuần → `VoucherNumbering/Sql/NextNumber.sql`.

### Khung lưu một phiếu

Service của phiếu ghép các khối có sẵn, tất cả trong một transaction:

```csharp
public async Task<ReceiptDto> CreateAsync(int userId, string unitCode, SaveReceiptRequest request, CancellationToken ct)
{
    await permissions.EnsureAllowedAsync(userId, "inv_receipt", PermissionAction.Create, ct);   // UpdateAsync: Edit
    await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);            // khóa sổ, ngày bắt đầu nhập liệu
    var rate = await rates.GetRateAsync(request.CurrencyCode, request.Date, ct); // 1 nếu là tiền hạch toán

    return await unitOfWork.ExecuteAsync(async token =>
    {
        var receipt = new Receipt { /* ... */ ExchangeRate = rate, UnitCode = unitCode, CreatedBy = userId };
        receipt.Number = await numbers.NextAsync("PNK", unitCode, request.Date, token); // không trùng số
        db.Receipts.Add(receipt);
        await db.SaveChangesAsync(token);       // Receipt có [Audited("inv_receipt", "inv_receipt")]: nhật ký tự ghi
        return ToDto(receipt);
    }, ct);
}
```

Sửa / xóa / trình duyệt / ghi sổ: kiểm tra `DocumentStatusPolicy.Check(action, status, actor)` trước, trình duyệt qua `IDocumentApprovalService.SubmitAsync`, ghi sổ bằng SQL (`ISqlExecutor`) trong cùng `IUnitOfWork`.
