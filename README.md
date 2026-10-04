# Phần mềm quản lý (S-ERP)

ERP gồm hai phần:

| Thư mục | Là gì | Công nghệ | Cổng mặc định |
| --- | --- | --- | --- |
| [`Frontend/`](Frontend/README.md) | Giao diện web | React 19 + TypeScript, Vite 6, Tailwind v4, Express (`server.ts`) | `http://localhost:3000` |
| [`ServerService/`](ServerService/README.md) | API | .NET 10, EF Core + Dapper, PostgreSQL | `http://localhost:2512` |
| [`docs/`](docs/) | Tài liệu cho người dùng / nghiệp vụ | Word | — |

**Frontend là chuẩn.** Tên chức năng, kiểu dữ liệu và cách hiển thị lấy theo frontend (`Frontend/src/types/index.ts`). Backend làm theo cho khớp.

## Chạy trên máy mới

Cần cài:
- Node.js 20 trở lên
- .NET SDK 10
- PostgreSQL 14 trở lên (có `psql` để chạy script)

**1. Database**

```powershell
createdb -U postgres erp_dev
cd ServerService/sql/postgresql
Get-ChildItem *.sql | Sort-Object Name | ForEach-Object { psql -U postgres -d erp_dev -f $_.FullName }
```

- Script chạy lại nhiều lần vẫn an toàn.
- Luôn chạy theo thứ tự tên file.

**2. Backend.** Tạo file `ServerService/Core/appsettings.Local.json`. File này không đưa vào mã nguồn; mỗi máy tự tạo:

```json
{
  "ConnectionStrings": { "CoreContext": "Host=localhost;Port=5432;Database=erp_dev;Username=postgres;Password=..." },
  "Tokens": { "Key": "chuỗi-ngẫu-nhiên-ít-nhất-32-ký-tự" },
  "Seed": { "DemoData": true, "DefaultPassword": "mật-khẩu-demo-≥8-ký-tự", "AdminPassword": "admin" }
}
```

```powershell
cd ServerService
dotnet build Core.sln
dotnet test tests/Core.Tests/Core.Tests.csproj
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project Core/Core.csproj --urls http://localhost:2512
```

- Lần chạy đầu với database trống, API tự nạp dữ liệu mẫu từ `Core/SeedData/seed.json`.
- Tài khoản quản trị là **admin / admin**. `Seed:AdminPassword` chỉ có tác dụng ở môi trường Development.
- Các tài khoản demo khác dùng mật khẩu `Seed:DefaultPassword`.

**3. Frontend**

```powershell
cd Frontend
npm install
copy .env.example .env.local   # sửa VITE_API_URL nếu backend không ở http://localhost:2512
npm run dev                    # http://localhost:3000
```

- Muốn mở frontend ở cổng hoặc tên máy khác thì thêm địa chỉ đó vào `Cors:AllowedOrigins` của backend.
- Không cài `GEMINI_API_KEY` thì chỉ màn "Trợ lý AI" không chạy, các màn khác vẫn bình thường.

## Luồng tổng thể

```
Trình duyệt ── fetch + Bearer token ──► ServerService (Core, controller)
   │                                         │ RequirePermission (quyền theo mã chức năng)
   │                                         ▼
   │                                    Service (Core.Infrastructure) ── EF Core / Dapper ──► PostgreSQL
   │
   └── GET /api/notifications/stream (SSE) ◄── tín hiệu "có thông báo mới"
```

1. **Đăng nhập.**
   - Người dùng chọn đơn vị cơ sở (DVCS), rồi gọi `POST /api/auth/login`.
   - Backend trả JWT, trong đó có đơn vị làm việc, kèm hồ sơ người dùng: ma trận quyền và quyền đặc biệt.
   - Frontend lưu token ở `localStorage['s_erp_auth_token']`.
2. **Hiển thị menu và màn hình.**
   - Frontend đọc `user.permissions[mãChứcNăng].view` để ẩn hoặc hiện menu và chặn màn hình không có quyền (`utils/permissions.ts`).
   - Việc chặn ở frontend chỉ để hiển thị. Backend kiểm tra lại mọi API.
3. **Gọi API.**
   - Mọi request đi qua `apiRequest` (`Frontend/src/services/apiClient.ts`).
   - Lỗi trả dạng `{ message }` bằng tiếng Việt. Lỗi 401 thì frontend tự đăng xuất.
4. **Đổi đơn vị** bằng `POST /api/auth/switch-unit`. Backend cấp token mới; dữ liệu và thông báo tải lại theo đơn vị đó.
5. **Phê duyệt chứng từ.**
   - Người lập trình phiếu. Backend tìm người duyệt theo quy tắc trong `sys_approval_rule` và gửi thông báo cho người duyệt.
   - Người duyệt bấm vào thông báo là mở đúng phiếu (`utils/documentLinks.ts`).

## Hiện trạng: đâu là thật, đâu là dữ liệu mẫu

| Phần | Lưu ở đâu |
| --- | --- |
| Đăng nhập, người dùng, vai trò, phân quyền, quyền đặc biệt | **Backend / PostgreSQL** |
| Đơn vị cơ sở, phòng ban | **Backend** |
| Ngoại tệ, tỷ giá (bảng riêng), khóa sổ theo tháng từng đơn vị, đánh số chứng từ | **Backend** |
| Tham số mặc định, năm tài chính, hồ sơ doanh nghiệp, định dạng số (JSON trong `sys_setting`), sao lưu / phục hồi cài đặt | **Backend** |
| Thông báo (gửi, đọc, thời gian thực, tự dọn) | **Backend** |
| Quy tắc phê duyệt (Cài đặt › Phân quyền › Quy trình phê duyệt) | **Backend** |
| Nhật ký thay đổi (Cài đặt › Nhật ký thay đổi) | **Backend** |
| Quản lý menu (Cài đặt › Quản lý menu) | **Backend**: module ẩn lưu trong `sys_setting` (`MENU_VISIBILITY`), chức năng ẩn lưu tại `sys_command.hide_yn`. Ẩn menu không thay đổi quyền truy cập API. |
| Kho › Danh mục đơn vị tính (`erp_uom`) | **Backend** |
| Kho › Quy đổi đơn vị tính (`erp_uom_conversion`) | **Backend**; vật tư liên kết vẫn lấy từ danh mục mẫu trên frontend |
| Kho › Nhóm vật tư (`erp_material_group`) | **Backend**; màn Vật tư mẫu chọn mã cho 5 trường nhóm qua tra cứu |
| Kho › Danh mục kho (`erp_warehouse`) | **Backend**; các màn chứng từ, tồn kho và vị trí kho vẫn dùng dữ liệu mẫu trong trình duyệt |
| API trình / duyệt / từ chối phiếu (`/api/approvals/...`) | Backend đã có, **frontend chưa gọi** |
| Kho — Phiếu nhập kho (`erp_goods_receipt`, `erp_goods_receipt_line`, `erp_stock_movement`) | **Backend**: lưu phiếu, duyệt, ghi sổ và bỏ ghi sổ. Chạy `ServerService/sql/postgresql/20-inventory-goods-receipts.sql` sau các script Kho trước đó. Bộ chọn vật tư và nhà cung cấp vẫn dùng dữ liệu mẫu. |
| Vật tư, phiếu xuất, báo cáo tồn kho, vị trí kho, bán hàng, tài chính, nhân sự | **Dữ liệu mẫu trong trình duyệt** (`Frontend/src/mock`, `localStorage['s_erp_database_state']`) |

Khi làm một nghiệp vụ thật, làm theo quy trình bên dưới rồi bỏ dữ liệu mẫu của màn đó.

## Quy ước chung

- Giao diện, thông báo lỗi và tài liệu viết **tiếng Việt**.
- **Bảng:** `sys_*` cho bảng hệ thống, `erp_*` cho bảng nghiệp vụ. Tên bảng và cột viết `snake_case`. **Không dùng khóa ngoại**: liên kết bằng mã hoặc ID có index, và service tự kiểm tra.
- **Truy vấn:** CRUD viết bằng EF Core. Báo cáo, tính toán và ghi sổ dùng SQL thuần qua `ISqlExecutor`, luôn truyền tham số, không nối chuỗi.
- **Mã chức năng** (`SubMenuKey`, ví dụ `inv_receipt`) là khóa chung của menu, route, phân quyền và thông báo. Frontend khai báo một lần trong `src/config/functions.ts` (route, nhãn, ma trận quyền tự lấy từ đây); backend khai báo trong `FunctionCatalog.cs`.
- **Quyền:** mỗi chức năng có 7 thao tác: `view` (xem), `create` (thêm, cả sao chép / nhập Excel), `edit` (sửa bản ghi đã lưu), `delete`, `approve`, `print` (in), `export` (xuất file). API thêm mới (`POST`) kiểm tra `Create`, sửa (`PUT`) kiểm tra `Edit`. Ngoài ra có quyền đặc biệt dạng `{chức năng}:{mã}`, ví dụ `inv_receipt:VIEW_PRICE`.
- **Bí mật** (mật khẩu database, khóa JWT, mật khẩu demo) chỉ để trong `appsettings.Local.json` hoặc `.env.local`, không commit.

## Thêm một chức năng mới

Mỗi chức năng có một **mã** (ví dụ `inv_supplier_cat`) và thuộc một trong ba loại: **danh mục**, **phiếu (chứng từ)** hoặc **báo cáo**. Các bước chung giống nhau; phần khác nhau ghi ở cuối.

### Bước chung

**Backend** (`ServerService/`, chi tiết: [ServerService/README.md](ServerService/README.md#thêm-module-mới))

1. `Core.Application/Common/Permissions/FunctionCatalog.cs`: thêm `["inv_supplier_cat"] = "Danh mục nhà cung cấp"`. API tự thêm mã vào `sys_command` khi khởi động.
2. `sql/postgresql/NN-<ten>.sql`: `CREATE TABLE IF NOT EXISTS erp_...` (bảng nghiệp vụ `erp_*`, cột `snake_case`, không khóa ngoại), rồi chạy script.
3. `Core.Domain/Modules/<Module>/`: entity; thêm `DbSet` vào `Core.Infrastructure/Common/Persistence/CoreContext.cs`.
4. `Core.Application/Modules/<Module>/<Module>Contracts.cs`: DTO, request, interface service.
5. `Core.Infrastructure/Modules/<Module>/<Module>Service.cs`: triển khai; đăng ký trong `Core.Infrastructure/DependencyInjection.cs`.
6. `Core/Modules/<Module>/<Module>Controller.cs`: kế thừa `ApiControllerBase`, gắn `[RequirePermission("mã", PermissionAction.X)]`.
7. Test trong `tests/Core.Tests/Modules/<Module>/`, chạy `dotnet test`.

**Frontend** (`Frontend/src/`)

1. `types/index.ts`: thêm mã vào `SubMenuKey`.
2. `config/functions.ts`: thêm một dòng `mã: fn(phân hệ, '/đường-dẫn', 'Nhãn', loại)`. Route, tiêu đề, lịch sử điều hướng và ma trận phân quyền tự lấy từ đây. Thiếu dòng này TypeScript báo lỗi.
3. `mock/initialMenuData.ts`: thêm mục menu (chỉ cần `subKey`, tên, icon, thứ tự).
4. Thư mục chức năng trong `modules/<phân hệ>/<nhóm>/<tên>/`: màn hình + `api.ts` (gọi `apiRequest`, không gọi `fetch` trực tiếp). Kho dùng `categories/`, `documents/`, `reports/`; xem [cấu trúc module Kho](docs/cau-truc-module-kho.md).
5. `modules/<phân hệ>/<Phân hệ>Module.tsx`: thêm `case 'mã'`.
6. Chạy `npm run lint` và `npm run build`.

### Danh mục

Hướng dẫn từng bước, từng file (lấy danh mục đơn vị tính làm mẫu): **[docs/them-danh-muc.md](docs/them-danh-muc.md)**.

Quy trình triển khai thực tế danh mục quy đổi đơn vị tính, gồm tra cứu chọn một/chọn nhiều: **[docs/them-quy-doi-don-vi-tinh.md](docs/them-quy-doi-don-vi-tinh.md)**.

Chống ghi đè khi nhiều người cùng sửa (phiên bản bản ghi, lỗi 409, các bước cho chức năng mới): **[docs/chong-ghi-de.md](docs/chong-ghi-de.md)**.


- Backend: làm theo mẫu **Phòng ban** (`Core.Infrastructure/Modules/Departments/DepartmentService.cs`): kiểm tra dữ liệu bằng `Guard`, không trùng mã, không xóa bản ghi đang được dùng (tự kiểm tra vì không có khóa ngoại), cho phép "ngừng sử dụng".
- Frontend: copy **`modules/settings/DepartmentCategoryView.tsx`**. Hook `useCatalog(api, ...)` lo phần tải, thêm, sửa, xóa kèm thông báo; màn hình chỉ khai báo cột (`GridView`) và form (`Modal` + `TextInput`, `SelectInput`, `Checkbox`).
- Danh mục mà màn khác cần tra cứu thì cho `GET` không cần quyền riêng (chỉ cần đăng nhập), như phòng ban, ngoại tệ.
- Nhật ký thay đổi: gắn `[Audited("mã", "loại", Label = "{Code} - {Name}")]` lên entity là thêm / sửa / xóa tự được ghi (ai, lúc nào, trước → sau). Xem tập trung ở **Cài đặt › Nhật ký thay đổi** (`sys_audit_log`), không hiện trên màn chức năng. Chi tiết: [ServerService/README.md](ServerService/README.md#nhật-ký-thay-đổi).

### Phiếu (chứng từ)

- Backend: thêm một dòng vào **`Core.Application/Common/Documents/VoucherCatalog.cs`** (mã chức năng, loại số, tên). Tự có ngay: dải số chứng từ (sửa được ở Cài đặt › Tham số mặc định › Đánh số chứng từ), các quyền đặc biệt của phiếu (xem giá, sửa phiếu đã duyệt, ghi sổ...), và phiếu xuất hiện trong màn quy trình phê duyệt.
- Service của phiếu dùng các khối dùng chung đã có:

  | Việc | Gọi |
  | --- | --- |
  | Chặn ngày đã khóa sổ / trước ngày bắt đầu nhập liệu | `IFiscalPeriodService.EnsureDateOpenAsync(unit, ngày)` |
  | Cấp số chứng từ (không trùng khi nhiều người lưu cùng lúc) | `IVoucherNumberService.NextAsync(loại, unit, ngày)` trong `IUnitOfWork.ExecuteAsync` |
  | Tỷ giá hạch toán cho phiếu ngoại tệ | `IExchangeRateService.GetRateAsync(mã tiền, ngày)` |
  | Thao tác nào được phép theo trạng thái phiếu | `DocumentStatusPolicy.Check(...)` |
  | Trình duyệt / duyệt / từ chối | `IDocumentApprovalService` (`/api/approvals/...`) |
  | Ghi sổ kho / sổ cái | SQL trong `Modules/<Module>/Sql/*.sql` qua `ISqlExecutor`, cùng transaction |
  | Nhật ký ai sửa gì | `[Audited]` trên entity (tự động); trình / duyệt / ghi sổ bằng SQL thì ghi tay `IAuditLog.RecordAsync`; xem ở Cài đặt › Nhật ký thay đổi |

- Frontend: dùng `modules/_templates/voucher-feature-template/` để tham khảo bố cục; đây là dữ liệu mẫu, cần thay ô nhập và định dạng cố định bằng control chung, `useLanguage` và `useNumberFormat` trước khi dùng thật. Số phiếu hiển thị trước khi lưu lấy bằng `voucherNumberingApi.preview(loại)`; số thật do backend cấp lúc lưu. Kiểm tra ngày bằng `fiscalPeriodsApi.check(ngày)`. Mở đúng phiếu từ thông báo bằng `useOpenDocumentRequest('mã', id => ...)`.

### Báo cáo

- Backend: câu SQL đặt trong `Core.Infrastructure/Modules/<Module>/Sql/<TenBaoCao>.sql`, đọc bằng `SqlScripts.Get("<Module>", "<TenBaoCao>")`, chạy bằng `ISqlExecutor.QueryAsync<T>` (luôn truyền tham số `@ten`). Controller chỉ cần quyền `View` (in: `Print`, xuất file: `Export`). Ẩn cột giá / giá vốn theo quyền đặc biệt `VIEW_PRICE` / `VIEW_COST` ngay ở backend.
- Frontend: loại `'report'` trong `config/functions.ts`.

### Quyền đặc biệt và trạng thái chứng từ

Quyền thực tế của một người = **quyền của vai trò + ngoại lệ riêng**. Sửa vai trò thì mọi người giữ vai trò nhận ngay, trừ những ô đã chỉnh riêng cho từng người.

**Thêm quyền đặc biệt** (ví dụ "Xem công nợ" cho danh mục khách hàng):

1. `ServerService/Core.Application/Common/Permissions/SpecialRightCatalog.cs`: thêm mã và một dòng khai báo:
   ```csharp
   public const string ViewDebt = "VIEW_DEBT";
   // trong Build():
   list.Add(new("sales_customers", ViewDebt, "Xem công nợ", SpecialRightGroups.Data, "Xem số dư công nợ của khách hàng."));
   ```
   Chỉ cần "Xem giá / Xem giá vốn" cho một danh mục hoặc báo cáo khác: thêm mã chức năng vào mảng `PricedCatalogsAndReports`. Mọi phiếu trong `VoucherCatalog` tự có đủ quyền theo trạng thái.
2. Màn phân quyền tự hiện quyền mới dưới chức năng đó. Quyền mới chưa ai có (trừ quản trị viên) cho tới khi được cấp.
3. Chặn ở backend (bắt buộc): `await permissions.HasRightAsync(userId, "sales_customers", SpecialRightCatalog.ViewDebt, ct)` rồi bỏ trường bị ẩn khỏi DTO; hoặc `[RequireRight("sales_customers", SpecialRightCatalog.ViewDebt)]` cho cả API.
4. Frontend: thêm mã vào `RIGHTS` (`src/utils/permissions.ts`), ẩn cột bằng `hasRight(currentUser, 'sales_customers', RIGHTS.VIEW_DEBT)`.

**Luật theo trạng thái chứng từ** (Lập → Chờ duyệt → Đã duyệt → Đã ghi sổ, hoặc Hủy):

- Backend: `Core.Application/Common/Permissions/DocumentStatusPolicy.cs`. Frontend: bản sao `src/utils/documentPolicy.ts`; màn phiếu bật / tắt nút bằng `documentActions(user, 'mã', status, isOwner)` (xem `modules/_templates/voucher-feature-template`).
- Thêm luật hoặc trạng thái mới (ví dụ quyền "Mở lại phiếu đã hủy"):
  1. `SpecialRightCatalog.cs`: thêm mã `REOPEN` vào vòng lặp quyền của phiếu (nhóm `Status`).
  2. `DocumentStatusPolicy.cs`: thêm `DocumentAction.Reopen` và luật của nó. Trạng thái mới: thêm vào `DocumentStatus` và xử lý trong từng luật.
  3. `src/utils/documentPolicy.ts`: sửa y hệt; thêm `REOPEN` vào `RIGHTS`.
  4. Thêm ca vào `ServerService/tests/Core.Tests/Common/DocumentPolicyCases.json`, rồi chạy `dotnet test` (backend) và `npm run check-policy` (frontend). Hai bên lệch nhau thì lệnh báo sai.

## Bản đồ tài liệu

- [ServerService/README.md](ServerService/README.md): thiết kế backend, database, phân quyền, API, thông báo, thêm module.
- [Frontend/src/DEVELOPER_GUIDE.md](Frontend/src/DEVELOPER_GUIDE.md): màn hình mẫu và các control dùng chung.
- Mẫu màn hình: [danh mục](Frontend/src/modules/_templates/category-feature-template/README.md), [chứng từ](Frontend/src/modules/_templates/voucher-feature-template/README.md).
- [CLAUDE.md](CLAUDE.md): tóm tắt kiến trúc và lệnh thường dùng.
- Tài liệu phân quyền cho người dùng: [docs/Phan-quyen-S-ERP.docx](docs/Phan-quyen-S-ERP.docx)
