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
  Modules/Approvals/         ApprovalRule, DocumentApproval
Core.Application/            Contract (DTO + interface) và quy tắc thuần
  Common/Exceptions/         BusinessRuleException (400), NotFound (404), AuthenticationFailed (401), Forbidden (403)
  Common/Security/           ICurrentUser, IPasswordService, ITokenService, PasswordPolicy
  Common/Permissions/        FunctionCatalog (mã chức năng = SubMenuKey), PermissionMatrix, SpecialRightCatalog, DocumentStatusPolicy
  Common/Documents/          VoucherCatalog: danh sách phiếu (loại số, quyền đặc biệt, quy trình duyệt)
  Common/Persistence/        ISqlExecutor, IUnitOfWork
  Common/Validation/         Guard
  Modules/{Auth,Users,Roles,CompanyUnits,Departments,Currencies,Fiscal,VoucherNumbering,Notifications,SystemConfig,Approvals}/
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
                             10-permission-exceptions
tests/Core.Tests/            Common/ và Modules/ giống cấu trúc trên
```

`_legacy/` chứa mã cũ trước khi tái cấu trúc, không còn nằm trong solution. Xem lại rồi xóa khi không cần.

## Thiết kế database

- **Đặt tên:** `sys_*` cho bảng hệ thống (tài khoản, phân quyền, đơn vị cơ sở, thông báo, cài đặt), `erp_*` cho bảng dữ liệu nghiệp vụ (vật tư, chứng từ, sổ kho, sổ cái…). Tên bảng và cột dùng `snake_case`; test `TablesAndColumnsFollowNamingConvention` kiểm tra quy tắc này.
- Bảng hệ thống hiện có: `sys_users`, `sys_role`, `sys_user_role`, `sys_command`, `sys_role_command`, `sys_user_command`, `sys_role_right`, `sys_user_right`, `sys_company_unit`, `sys_user_company_unit`, `sys_department`, `sys_notification`, `sys_notification_read`, `sys_setting`, `sys_currency`, `sys_exchange_rate`, `sys_fiscal_period`, `sys_voucher_numbering`, `sys_voucher_sequence`, `sys_approval_rule`, `sys_document_approval`, `sys_migration` (chuyển dữ liệu một lần đã chạy).
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

- Ma trận quyền giống frontend: mỗi mã chức năng (`SubMenuKey`) có 5 thao tác `view / createEdit / delete / approve / printExport`. Bảng `sys_role_command` / `sys_user_command` vẫn giữ 11 cờ cũ; `CommandPermission` chuyển đổi hai chiều.
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
- API: `[RequireRight("inv_receipt", SpecialRightCatalog.ViewPrice)]` hoặc `IPermissionService.HasRightAsync`. Frontend: `hasRight(user, 'inv_receipt', RIGHTS.VIEW_PRICE)`. Hiện phiếu nhập/xuất kho đã ẩn giá khi không có `VIEW_PRICE` (chỉ ẩn ở giao diện; API chứng từ khi làm cần lọc giá phía server).
- Gửi thông báo (chuông trên header): quyền `overview_main:SEND_NOTIFICATION` cho gửi trong đơn vị đang làm việc (cả đơn vị hoặc một người), `overview_main:SEND_NOTIFICATION_ALL` cho gửi mọi đơn vị. Quản trị viên luôn gửi được. Hai quyền này không được cấp tự động. Thông báo tự động của quy trình duyệt không cần quyền này.
- `DocumentStatusPolicy` quyết định thao tác nào được phép theo trạng thái phiếu (Nháp / Chờ duyệt / Đã duyệt / Đã ghi sổ / Đã hủy) và quyền của người dùng. Frontend có bản sao `Frontend/src/utils/documentPolicy.ts`; cả hai cùng được kiểm tra bằng `tests/Core.Tests/Common/DocumentPolicyCases.json` (`dotnet test` và `npm run check-policy`).

### Quy trình phê duyệt

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
| CompanyUnits | `GET /api/settings/company-units`; `POST`, `PUT /{code}`, `DELETE /{code}` | Xem: đã đăng nhập; sửa: `inv_company_unit_cat` |
| SystemConfig | `GET /api/settings/system-config`; `PUT /api/settings/system-config/{section}?unitCode=` (section: `systemDefaults`, `fiscalConfig`, `companyProfile`, `numberFormat`; `unitCode` phải là đơn vị người dùng được vào) | Sửa: `sys_default_config`, `sys_fiscal_year`, `settings_main` theo section |
| SystemConfig | `GET /api/settings/system-config/backup`, `POST .../restore` (một transaction, chỉ thêm / sửa, không xóa) | Quản trị viên |
| Departments | `GET /api/settings/departments`; `POST`, `PUT /{code}`, `DELETE /{code}` | Xem: đã đăng nhập; sửa: `sys_departments` |
| Currencies | `GET /api/settings/currencies`; `POST`, `PUT /{code}`, `DELETE /{code}` | Xem: đã đăng nhập; sửa: `sys_currencies` |
| Currencies | `GET /api/settings/exchange-rates?currency=`, `GET .../rate?currency=&date=`; `POST`, `PUT /{id}`, `DELETE /{id}` | Xem: đã đăng nhập; sửa: `sys_exchange_rates` |
| Fiscal | `GET /api/settings/fiscal-periods/{year}`, `GET .../check?date=`; `PUT /{year}` `{ months, isLocked }` (đơn vị của phiên) | Xem: đã đăng nhập; khóa / mở: `sys_fiscal_year` |
| VoucherNumbering | `GET /api/settings/voucher-numbering`, `PUT /{voucherType}`; `GET /{voucherType}/preview?date=` | Xem / sửa: `sys_default_config`; xem trước số: đã đăng nhập |
| Notifications | `GET /api/notifications`, `PUT /{id}/read`, `PUT /read-all`, `DELETE /{id}` (ẩn một thông báo), `DELETE` (ẩn tất cả), `GET /stream` (sự kiện thời gian thực); `POST` gửi, `GET /send-scope`, `GET /recipients?unitCode=` | Gửi: quản trị viên hoặc quyền `SEND_NOTIFICATION` / `SEND_NOTIFICATION_ALL` |
| Permissions | `GET /api/settings/permission-catalog` (danh sách quyền đặc biệt) | Đã đăng nhập |
| Approvals | `GET/POST /api/settings/approval-rules`, `PUT/DELETE .../{id}`, `POST .../preview` | `sys_users` |
| Approvals | `GET /api/approvals/pending`, `GET /api/approvals/{fn}/{id}`, `POST .../submit`, `.../approve`, `.../reject`, `.../withdraw` | Theo chức năng của phiếu |

## Thông báo

- Người nhận: `unit_code` / `recipient_user_id` để trống nghĩa là tất cả. Thông báo gửi chung trước ngày tạo tài khoản không hiện với tài khoản đó; thông báo gửi riêng luôn hiện.
- Liên kết: `link_module` mở phân hệ; `link_function` + `link_document_id` mở đúng một chứng từ (thông báo của quy trình duyệt luôn có). Frontend: `requestOpenDocument` / `useOpenDocumentRequest` trong `utils/documentLinks.ts`.
- Thời gian thực: `GET /api/notifications/stream` (server-sent events, đọc bằng `fetch` để token nằm trong header). Server chỉ gửi tín hiệu `notification` hoặc `sync`, trình duyệt tự tải lại danh sách qua API thường. Kết nối tự đóng khi token bị thu hồi. `NotificationStream` giữ kết nối trong bộ nhớ, nên chạy nhiều instance API thì cần thêm kênh chung (PostgreSQL LISTEN/NOTIFY hoặc Redis). Frontend vẫn tải định kỳ 3 phút làm dự phòng.
- Dọn dẹp: `NotificationCleanupService` chạy 12 giờ một lần, xóa thông báo cũ hơn `Notifications:RetentionDays` (mặc định 180 ngày, tối thiểu 7) và thông báo đã hết hạn quá 30 ngày, kèm trạng thái đọc.

## Thêm module mới

1. Entity trong `Core.Domain/Modules/<Module>/` (bảng nghiệp vụ đặt tên `erp_*`, cột `snake_case`, không khóa ngoại), bảng trong `sql/postgresql/NN-<module>.sql`, `DbSet` trong `CoreContext`.
2. Contract (DTO + interface) trong `Core.Application/Modules/<Module>/`.
3. Service trong `Core.Infrastructure/Modules/<Module>/` (EF cho CRUD, `ISqlExecutor` + `Sql/*.sql` cho báo cáo và ghi sổ), đăng ký trong `DependencyInjection.cs`.
4. Controller kế thừa `ApiControllerBase` trong `Core/Modules/<Module>/`, bảo vệ bằng `RequirePermission`.
5. Mã chức năng mới: thêm vào `FunctionCatalog` và `SubMenuKey` của frontend.
6. Phiếu (chứng từ): thêm vào `Common/Documents/VoucherCatalog.cs`; dải số và các quyền đặc biệt của phiếu có sẵn ngay.

Mẫu module tham khảo: danh mục đơn giản → `Departments`; danh mục + bảng con có ngày → `Currencies` (ngoại tệ, tỷ giá); số liệu tính bằng SQL thuần → `VoucherNumbering/Sql/NextNumber.sql`.

### Khung lưu một phiếu

Service của phiếu ghép các khối có sẵn, tất cả trong một transaction:

```csharp
public async Task<ReceiptDto> CreateAsync(int userId, string unitCode, SaveReceiptRequest request, CancellationToken ct)
{
    await permissions.EnsureAllowedAsync(userId, "inv_receipt", PermissionAction.CreateEdit, ct);
    await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);            // khóa sổ, ngày bắt đầu nhập liệu
    var rate = await rates.GetRateAsync(request.CurrencyCode, request.Date, ct); // 1 nếu là tiền hạch toán

    return await unitOfWork.ExecuteAsync(async token =>
    {
        var receipt = new Receipt { /* ... */ ExchangeRate = rate, UnitCode = unitCode, CreatedBy = userId };
        receipt.Number = await numbers.NextAsync("PNK", unitCode, request.Date, token); // không trùng số
        db.Receipts.Add(receipt);
        await db.SaveChangesAsync(token);
        return ToDto(receipt);
    }, ct);
}
```

Sửa / xóa / trình duyệt / ghi sổ: kiểm tra `DocumentStatusPolicy.Check(action, status, actor)` trước, trình duyệt qua `IDocumentApprovalService.SubmitAsync`, ghi sổ bằng SQL (`ISqlExecutor`) trong cùng `IUnitOfWork`.
