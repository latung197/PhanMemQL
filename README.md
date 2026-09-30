# Phần mềm quản lý (S-ERP)

ERP gồm hai phần:

| Thư mục | Là gì | Công nghệ | Cổng mặc định |
| --- | --- | --- | --- |
| [`Frontend/`](Frontend/README.md) | Giao diện web | React 19 + TypeScript, Vite 6, Tailwind v4, Express (`server.ts`) | `http://localhost:3000` |
| [`ServerService/`](ServerService/README.md) | API | .NET 10, EF Core + Dapper, PostgreSQL | `http://localhost:2512` |
| [`docs/`](docs/README.md) | Tài liệu cho người dùng / nghiệp vụ | Word | — |

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
| Đơn vị cơ sở, cài đặt hệ thống (năm tài chính, tiền tệ, tỷ giá, cấu hình mặc định, thông tin công ty) | **Backend** |
| Thông báo (gửi, đọc, thời gian thực, tự dọn) | **Backend** |
| Quy tắc phê duyệt (Cài đặt › Phân quyền › Quy trình phê duyệt) | **Backend** |
| API trình / duyệt / từ chối phiếu (`/api/approvals/...`) | Backend đã có, **frontend chưa gọi** |
| Vật tư, kho, phiếu nhập / xuất, bán hàng, tài chính, nhân sự, báo cáo | **Dữ liệu mẫu trong trình duyệt** (`Frontend/src/mock`, `localStorage['s_erp_database_state']`) |

Khi làm một nghiệp vụ thật (ví dụ phiếu nhập kho), làm theo quy trình bên dưới rồi bỏ dữ liệu mẫu của màn đó.

## Quy ước chung

- Giao diện, thông báo lỗi và tài liệu viết **tiếng Việt**.
- **Bảng:** `sys_*` cho bảng hệ thống, `erp_*` cho bảng nghiệp vụ. Tên bảng và cột viết `snake_case`. **Không dùng khóa ngoại**: liên kết bằng mã hoặc ID có index, và service tự kiểm tra.
- **Truy vấn:** CRUD viết bằng EF Core. Báo cáo, tính toán và ghi sổ dùng SQL thuần qua `ISqlExecutor`, luôn truyền tham số, không nối chuỗi.
- **Mã chức năng** (`SubMenuKey`, ví dụ `inv_receipt`) là khóa chung của menu, route, phân quyền và thông báo. Phải khai báo ở cả frontend (`types/index.ts`) lẫn backend (`FunctionCatalog.cs`).
- **Quyền:** mỗi chức năng có 5 thao tác (`view`, `createEdit`, `delete`, `approve`, `printExport`). Ngoài ra có quyền đặc biệt dạng `{chức năng}:{mã}`, ví dụ `inv_receipt:VIEW_PRICE`.
- **Bí mật** (mật khẩu database, khóa JWT, mật khẩu demo) chỉ để trong `appsettings.Local.json` hoặc `.env.local`, không commit.

## Thêm một chức năng mới (đầu đến cuối)

Ví dụ: danh mục **Nhà cung cấp**, mã `inv_supplier_cat`.

**Backend** (chi tiết: [ServerService/README.md](ServerService/README.md#thêm-module-mới))

1. `Core.Application/Common/Permissions/FunctionCatalog.cs`: thêm `["inv_supplier_cat"] = "Danh mục nhà cung cấp"`. API tự thêm mã vào `sys_command` khi khởi động.
2. `sql/postgresql/NN-suppliers.sql`: `CREATE TABLE IF NOT EXISTS erp_supplier (...)`, rồi chạy script trên database.
3. `Core.Domain/Modules/Suppliers/Supplier.cs`: entity. Thêm `DbSet` vào `Core.Infrastructure/Common/Persistence/CoreContext.cs`.
4. `Core.Application/Modules/Suppliers/SupplierContracts.cs`: DTO, request và `ISupplierService`.
5. `Core.Infrastructure/Modules/Suppliers/SupplierService.cs`: triển khai, đăng ký trong `Core.Infrastructure/DependencyInjection.cs`.
6. `Core/Modules/Suppliers/SuppliersController.cs`: kế thừa `ApiControllerBase`, gắn `[RequirePermission("inv_supplier_cat", PermissionAction.X)]` cho từng action.
7. Thêm test trong `tests/Core.Tests/Modules/Suppliers/`, rồi chạy `dotnet test`.

**Frontend** (chi tiết: [Frontend/src/DEVELOPER_GUIDE.md](Frontend/src/DEVELOPER_GUIDE.md))

1. `src/types/index.ts`: thêm `'inv_supplier_cat'` vào `SubMenuKey`.
2. `src/mock/initialMenuData.ts`: thêm mục menu. `src/utils/navigationHelper.ts` (`SUB_MENU_MAP`) và `src/config/router.ts` (`ROUTE_MAP`): thêm nhãn và đường dẫn.
3. Copy `src/modules/_templates/category-feature-template/` sang `src/modules/inventory/suppliers/` rồi đổi tên và sửa cột, form.
4. `src/modules/inventory/suppliers/api.ts`: các hàm gọi `apiRequest('GET', '/api/...')`. Không để màn hình gọi `fetch` trực tiếp.
5. `src/modules/inventory/InventoryModule.tsx`: thêm `case 'inv_supplier_cat'`.
6. `src/modules/settings/permissions/permissionCatalog.ts`: thêm chức năng vào nhóm để hiện trong ma trận phân quyền.
7. Chạy `npm run lint` (kiểm tra kiểu) và `npm run build`.

**Nếu chứng từ cần phê duyệt:**
- Gọi `/api/approvals/{fn}/{id}/submit | approve | reject | withdraw`.
- Trong màn chứng từ, gọi `useOpenDocumentRequest('<mã chức năng>', id => mở phiếu)` để thông báo mở được đúng phiếu.

## Bản đồ tài liệu

- Frontend:
  - [Frontend/README.md](Frontend/README.md)
  - [src/components](Frontend/src/components/README.md)
  - [src/modules](Frontend/src/modules/README.md)
  - [src/services](Frontend/src/services/README.md)
  - [src/utils](Frontend/src/utils/README.md)
  - [src/types](Frontend/src/types/README.md)
  - [src/mock](Frontend/src/mock/README.md)
  - [src/context](Frontend/src/context/README.md)
  - [src/hooks](Frontend/src/hooks/README.md)
  - [src/config](Frontend/src/config/README.md)
  - [src/lib](Frontend/src/lib/README.md)
  - [src/locales](Frontend/src/locales/README.md)
  - [scripts](Frontend/scripts/README.md)
- Backend:
  - [ServerService/README.md](ServerService/README.md): thiết kế, phân quyền, API, thông báo
  - [Core](ServerService/Core/README.md)
  - [Core.Application](ServerService/Core.Application/README.md)
  - [Core.Domain](ServerService/Core.Domain/README.md)
  - [Core.Infrastructure](ServerService/Core.Infrastructure/README.md)
  - [sql](ServerService/sql/README.md)
  - [tests](ServerService/tests/README.md)
  - [_legacy](ServerService/_legacy/README.md)
- Tài liệu phân quyền cho người dùng: [docs/Phan-quyen-S-ERP.docx](docs/Phan-quyen-S-ERP.docx)
