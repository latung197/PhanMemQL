# Kiến trúc và thiết kế dự án S-ERP

Tài liệu cho người mới vào dự án: dự án gồm những phần nào, chạy ra sao, đặt mã ở đâu, theo những quy ước nào và vì sao. Hướng dẫn chi tiết từng việc nằm ở các tài liệu khác (mục 12). Hướng dẫn cho trợ lý lập trình ở `CLAUDE.md`; cách chạy máy mới ở `README.md` gốc.

Nội dung:

1. [Tổng quan](#1-tổng-quan)
2. [Chạy và kiểm tra](#2-chạy-và-kiểm-tra)
3. [Backend: các lớp](#3-backend-các-lớp)
4. [Quy ước cơ sở dữ liệu](#4-quy-ước-cơ-sở-dữ-liệu)
5. [Khung danh mục](#5-khung-danh-mục)
6. [Chứng từ, phê duyệt và sổ kho](#6-chứng-từ-phê-duyệt-và-sổ-kho)
7. [Phân quyền](#7-phân-quyền)
8. [Cài đặt, nhật ký, bộ nhớ đệm, thông báo](#8-cài-đặt-nhật-ký-bộ-nhớ-đệm-thông-báo)
9. [Frontend](#9-frontend)
10. [Đa ngôn ngữ](#10-đa-ngôn-ngữ)
11. [Phần nào đã chạy thật, phần nào còn dữ liệu mẫu](#11-phần-nào-đã-chạy-thật-phần-nào-còn-dữ-liệu-mẫu)
12. [Bản đồ tài liệu](#12-bản-đồ-tài-liệu)

---

## 1. Tổng quan

S-ERP là phần mềm quản trị doanh nghiệp tiếng Việt gồm hai ứng dụng và tài liệu:

| Phần | Công nghệ | Cổng | Thư mục |
|---|---|---|---|
| Giao diện | React 19, TypeScript, Vite 6, Tailwind v4; máy chủ phát triển Express (`server.ts`) | 3000 | `Frontend/` |
| API | .NET 10 Web API, EF Core và Dapper, PostgreSQL 16 | 2512 | `ServerService/` |
| Tài liệu | Markdown (nguồn) và Word | | `docs/` |

```
 Trình duyệt ──► Frontend (React)  ── apiRequest (JWT, Accept-Language) ──►  ServerService (.NET)  ──►  PostgreSQL
                    │                                                              │
                    └─ dữ liệu mẫu trong localStorage cho các màn chưa có API      └─ SSE: tín hiệu thông báo, cài đặt, thanh thông báo
```

**Giao diện là nguồn sự thật về hình dạng dữ liệu.** Mã chức năng, kiểu dữ liệu và dạng trả về theo `Frontend/src/types/index.ts` và các mục cài đặt trong `services/systemSettingsService.ts`; backend điều chỉnh theo. Chữ trên màn, thông báo lỗi và tài liệu viết bằng **tiếng Việt**; chú thích trong code bằng tiếng Anh, ngắn.

**Mã chức năng** (ví dụ `inv_receipt`) là chìa khóa chung của menu, đường dẫn, quyền, thông báo và phê duyệt. Một chức năng mới phải khai ở: `Frontend/src/types/index.ts` (`SubMenuKey`), `Frontend/src/config/functions.ts`, `ServerService/Core/SeedData/menu.json` và `FunctionCatalog.cs` (backend, tự thêm vào bảng `sys_command` khi khởi động).

---

## 2. Chạy và kiểm tra

**Cơ sở dữ liệu:** chạy mọi script trong `ServerService/sql/postgresql/` **theo thứ tự tên file** (`00-helpers.sql` đầu tiên). Script chạy lại được và tự chuyển dữ liệu cũ; **không dùng EF migration**, thay đổi cấu trúc nằm trong script `NN-*.sql` mới hoặc có sẵn. Bí mật cục bộ (chuỗi kết nối, khóa token, mật khẩu mẫu) nằm trong `ServerService/Core/appsettings.Local.json` (không đưa vào git).

**Chạy:** `.claude/launch.json` định nghĩa `backend` (cổng 2512, môi trường Development) và `frontend` (cổng 3000). Đăng nhập dev: `admin` / `admin`, các đơn vị `DVCS01` đến `DVCS04`. Ở Development, `http://localhost:2512/swagger` liệt kê mọi API kèm quyền cần có.

**Kiểm tra:**

| Việc | Lệnh |
|---|---|
| Biên dịch backend | `dotnet build Core.sln` (trong `ServerService/`) |
| Test backend (xUnit) | `dotnet test tests/Core.Tests/Core.Tests.csproj` |
| Kiểu dữ liệu frontend | `npm run lint` (trong `Frontend/`, chính là `tsc --noEmit`) |
| Chữ gõ cứng và khóa dịch | `npm run check-i18n` |
| Menu khớp với menu.json | `npm run check-menu` |
| Quy tắc trạng thái chứng từ khớp backend | `npm run check-policy` |

Dừng backend đang chạy trước khi `dotnet build` hoặc `dotnet test` (DLL bị khóa).

---

## 3. Backend: các lớp

Kiến trúc sạch, phụ thuộc một chiều: **`Core` → `Core.Infrastructure` → `Core.Application` → `Core.Domain`**. Trong mỗi lớp, phần dùng chung ở `Common/`, phần của từng tính năng ở `Modules/<Module>/`.

| Lớp | Chứa | Ví dụ |
|---|---|---|
| `Core.Domain` | Thực thể, thuộc tính khai báo (`[References]`, `[Audited]`) | `GoodsIssue`, `ErpEntity` |
| `Core.Application` | DTO, giao diện dịch vụ, quy tắc thuần (không chạm database), ngoại lệ | `DocumentStatusPolicy`, `PermissionMatrix`, `IStockLedger` |
| `Core.Infrastructure` | `CoreContext` (EF), `UnitOfWork`, `SqlExecutor` (Dapper), các dịch vụ, `DatabaseSeeder`, đăng ký trong `DependencyInjection.cs` | `GoodsIssueService`, `StockLedgerService` |
| `Core` | Controller mỏng, chính sách xác thực, `AddApi` (JWT, CORS, giới hạn tần suất); chạy được như dịch vụ Windows | `GoodsIssuesController` |

`ServerService/_legacy/` là mã trước khi tái cấu trúc, **không nằm trong solution**: không sửa, không tham chiếu.

**Ngoại lệ → mã HTTP** (qua `AppExceptionFilter`, trả `{ message }`): `BusinessRuleException` → 400, `NotFoundException` → 404, lỗi đăng nhập → 401, `ForbiddenException` → 403, `ConflictException` → 409. Nội dung thông báo là **khóa** (`new BusinessRuleException("issue.itemsRequired")`), không viết câu trong code; chữ nằm ở `Messages.{vi,en}.json`.

**Truy cập dữ liệu:**

- **CRUD qua EF Core**; **báo cáo, tính toán, ghi sổ qua SQL thuần** bằng `ISqlExecutor`. File SQL ở `Core.Infrastructure/Modules/<Module>/Sql/<Ten>.sql` (nhúng vào DLL), đọc bằng `SqlScripts.Get("<Module>", "<Ten>")`; luôn dùng tham số `@ten`; cột `snake_case` tự ánh xạ sang thuộc tính PascalCase.
- Lưu bằng EF cùng SQL ghi sổ phải nằm trong `IUnitOfWork.ExecuteAsync(...)` để chung một transaction.
- Dịch vụ lồng nhau (ví dụ dịch vụ phiếu gọi dịch vụ duyệt) dùng chung transaction đang mở.

**Khối dùng chung cho chứng từ:** `IFiscalPeriodService` (khóa sổ), `IVoucherNumberService` (cấp số, không trùng), `IExchangeRateService`, `DocumentStatusPolicy`, `IDocumentApprovalService`, `IStockLedger`.

---

## 4. Quy ước cơ sở dữ liệu

Do test `TablesAndColumnsFollowNamingConvention` và các test khác kiểm:

- `sys_*` cho bảng hệ thống, `erp_*` cho bảng nghiệp vụ; tên bảng và cột `snake_case`.
- Mỗi thực thể `erp_*` kế thừa `ErpEntity`: bốn cột `created_at`, `created_by`, `updated_at`, `updated_by` (giờ UTC, mã người dùng) **do `CoreContext` tự điền khi lưu**, người gọi không gán. DTO trả chúng dưới tên `stamp`. Bảng `sys_*` cũ giữ `createtime`/`createid`... riêng; nhóm danh mục hệ thống (ngoại tệ, tỷ giá, mã thuế...) đã được thêm bốn cột dấu vết (script `26`).
- **Không dùng khóa ngoại.** Liên kết bằng cột mã có chỉ mục; dịch vụ kiểm mã tồn tại và chặn xóa bản ghi đang được dùng. Quan hệ trong `CoreContext` chỉ để EF nối bảng.
- **Cột tham chiếu**: mọi cột `*_code` (trừ khóa `code`) khai trên thực thể bằng `[References<DanhMucDich>]` (`Optional`, `BlocksDelete`) hoặc `[NotReference("lý do")]` (mã số thuế, mã chức năng...). Tên cột kết thúc bằng tên bảng đích bỏ tiền tố (`uom_code`, `from_uom_code`) và **có chỉ mục bắt đầu bằng chính cột đó**. Bản đồ được ghi vào `sys_table_ref` mỗi lần khởi động, nối với cột thật qua view `sys_v_columns`. Hướng dẫn: `docs/phat-trien/tham-chieu-danh-muc.md`.
- **Cột của danh mục**: khóa và tên hiển thị luôn là `code` và `name`; cột trỏ sang danh mục khác là `<bảng đích>_code`. Nhãn tiếng Việt nằm ở `locales/*`, không đặt trong tên cột (không `ma_vt`, `ten_vt`).
- **Chống ghi đè khi nhiều người cùng sửa**: bản ghi sửa trong form có `uint Version` ánh xạ sang cột hệ thống `xmin` của PostgreSQL làm dấu so sánh (không cần cột SQL). DTO trả `version`, request sửa gửi lại, `UpdateAsync` gọi `db.ExpectVersion(...)`; lệch phiên bản trả HTTP 409. Hướng dẫn: `docs/phat-trien/chong-ghi-de.md`.
- **Mọi thực thể phải khai `[Audited(...)]` hoặc `[NotAudited(lý do)]`** (test `AuditDeclarationTests`).
- `00-helpers.sql` cung cấp `sys_rename_table`, `sys_rename_column`, `sys_rename_constraint`, `sys_drop_foreign_keys` cho script chuyển cấu trúc.
- Lỗi database được dịch sang thông báo: vi phạm duy nhất → 409 "đã tồn tại" nêu tên trường và giá trị (khóa `dbfield.<cột>`), khóa chết → 409 "đang bận".

---

## 5. Khung danh mục

Một danh mục **được khai báo, không viết từng cái**:

- Backend: dịch vụ kế thừa `CatalogService<TEntity, TDto, TRequest>` (khai `Spec`, `Sorts`, `Search`, `ExportColumns`, `MapAsync`, `ApplyAsync`; tùy chọn `ApplyFilters`, `AfterApplyAsync`, `BeforeDeleteAsync`, `SaveAsync`...), controller kế thừa `CatalogControllerBase` với `[CatalogFunction("mã")]`. Khung lo sẵn: danh sách phân trang, sắp xếp, tìm kiếm không dấu, xuất và nhập Excel (tất cả hoặc không dòng nào), xóa nhiều, chống ghi đè, nhật ký, kiểm mã tham chiếu và chặn xóa khi đang dùng.
- Frontend: `api.ts` ba dòng (`createCatalogApi`), màn chỉ khai `CatalogDefinition` cho `CatalogScreen` (cột, form, cột Excel, bộ lọc). Khung lo tìm kiếm, bộ lọc, xuất và nhập Excel, xóa nhiều, form có dấu vết và chống ghi đè, **bố cục cột từng người dùng lưu trên máy chủ** (`sys_grid_layout`).
- Ô chọn mã ở màn khác: `CatalogLookup` / `CatalogMultiLookup` (gõ mã hoặc F2 để tìm trên máy chủ) đọc `GET /api/lookups/{tên}`, đăng ký bằng một mục `LookupDefinition` (hoặc lớp `LookupProvider` khi cần nối nhiều bảng, tham số, quyền); kết quả được lưu đệm theo bảng.

Tài liệu từng bước: `docs/phat-trien/them-danh-muc.md`, kèm skill `/them-danh-muc`.

---

## 6. Chứng từ, phê duyệt và sổ kho

Chứng từ (phiếu) khác danh mục: có **trạng thái**, **phê duyệt nhiều cấp**, **số tự cấp**, **khóa sổ**, và thường **ghi sổ**.

- **Vòng đời:** `Lập chứng từ → Chờ duyệt → Đã duyệt → Đã ghi sổ` (hoặc `Đã hủy`). `DocumentStatusPolicy` (backend) quyết định thao tác nào được phép theo trạng thái và quyền; `Frontend/src/utils/documentPolicy.ts` là bản sao để bật tắt nút, hai bên được kiểm bằng cùng một bộ ca thử (`DocumentPolicyCases.json`).
- **Phê duyệt:** quy tắc cấu hình ở Cài đặt (`sys_approval_rule`: ai lập, đơn vị, từ số tiền nào, cấp nào, ai duyệt); `DocumentApprovalService` dựng các cấp khi trình, thông báo người duyệt và đổi trạng thái phiếu qua `IApprovableDocument`. Người có đủ quyền còn **lưu thẳng ở trạng thái** mà quyền của họ tới được (`TargetStatus`), cùng transaction, vẫn ghi vòng duyệt.
- **Số chứng từ:** `sys_voucher_numbering` (mẫu, ví dụ `{PREFIX}-{DVCS}-{YYYY}{MM}-{SEQ}`) và `sys_voucher_sequence`; `NextAsync` cấp số nguyên tử trong transaction lưu phiếu; mẫu **bắt buộc có `{DVCS}`** để số duy nhất giữa các đơn vị.
- **Khóa sổ:** `sys_fiscal_period` theo đơn vị và tháng; ngày chứng từ trong tháng đã khóa thì không lập, sửa, ghi sổ.
- **Sổ kho:** mọi chứng từ làm đổi tồn ghi qua `IStockLedger`, **không** có SQL riêng. `erp_stock_movement` là sổ chỉ ghi thêm (bỏ ghi sổ ghi dòng đảo, không xóa dòng cũ); ba bảng tồn (`erp_stock_balance` theo kho, `erp_stock_lot_balance` theo lô, `erp_stock_location_balance` theo vị trí) được cộng trừ **cùng transaction** và luôn bằng tổng của sổ (`GET /api/inventory/stock/verify` kiểm, `POST .../rebuild` dựng lại). Xuất kho tính giá **bình quân di động theo kho**, khóa dòng tồn `FOR UPDATE` trước khi đọc, từ chối khi không đủ tồn (trừ khi đơn vị bật tồn âm). Xóa phiếu: trigger ở script `41` xóa dòng chi tiết và dọn dòng sổ đã triệt tiêu, chặn xóa phiếu còn ghi sổ.
- **Mẫu chạy thật:** phiếu nhập kho và phiếu xuất kho.

Tài liệu: `docs/phat-trien/them-chung-tu.md` (cách thêm một chứng từ), `docs/kho/so-kho-va-phieu-nhap-kho.md`, `docs/kho/phieu-xuat-kho.md`.

---

## 7. Phân quyền

- Mỗi chức năng có **7 thao tác**: Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất. `POST` cần Thêm, `PUT` cần Sửa, nhập Excel cần Thêm, xuất file cần Xuất.
- **Quyền đặc biệt** dạng `{chức năng}:{MÃ}` khai ở `SpecialRightCatalog.cs`: `VIEW_PRICE` (xem giá), `VIEW_COST` (xem giá vốn), `VIEW_ALL` (xem phiếu người khác) và các quyền trạng thái `ST_PENDING`, `ST_APPROVED`, `ST_POSTED`, `ST_UNPOST`, `ST_CANCELLED` (cấp riêng từng đơn vị cơ sở: mã `{chức năng}:ST_POSTED@DVCS01`; xem `docs/he-thong/trang-thai-chung-tu.md`)... Chứng từ khai trong `VoucherCatalog` tự có bộ này.
- **Quyền hiệu lực = quyền của vai trò + ngoại lệ riêng của người dùng** (`PermissionMatrix.Resolve`): quản trị viên (vai trò `ADMIN`) có tất cả; ngoài ra lấy ma trận vai trò, mỗi dòng ngoại lệ của người dùng thay thế đúng một chức năng. Màn phân quyền gửi ma trận mong muốn đầy đủ, backend chỉ lưu phần chênh lệch. `GrantGuard` không cho người không phải quản trị cấp quyền mà họ không có.
- Backend: controller kế thừa `ApiControllerBase` (cần đăng nhập và quyền vào đơn vị trong token); mỗi API khai `[RequirePermission("mã", PermissionAction.X)]` hoặc `[RequireRight(...)]`; controller danh mục dùng `[CatalogFunction]`. Màn khác chọn mã qua **tra cứu** (`/api/lookups/{tên}`, mở cho người đã đăng nhập) chứ không đọc dữ liệu đầy đủ của danh mục. Test `ReadAccessContractTests` bắt controller có `const string Function` mà `GET` thiếu `RequirePermission`.
- Frontend chỉ kiểm quyền để **hiển thị**; backend mới là nơi chặn thật. Đổi khóa hoặc mật khẩu làm tăng `security_version` và vô hiệu hóa mọi token cũ. Token mang đơn vị đang làm việc; `POST /api/auth/switch-unit` cấp token mới.
- Menu: `GET /api/menu` chỉ trả những chức năng người dùng được **Xem**; cấu trúc menu chỉ siêu quản trị (`Security:SuperAdmin`) sửa được. Hướng dẫn: `docs/he-thong/phan-quyen.md`, `docs/he-thong/quan-ly-menu.md`.

---

## 8. Cài đặt, nhật ký, bộ nhớ đệm, thông báo

- **Cài đặt:** giá trị không bảng nào tham chiếu nằm trong `sys_setting` dạng JSON theo mục (mặc định hệ thống, năm làm việc, hồ sơ doanh nghiệp, định dạng số); thứ được tham chiếu (ngoại tệ, tỷ giá, phòng ban, khóa sổ, dải số) có bảng riêng. Có sao lưu và phục hồi.
- **Nhật ký thay đổi:** `sys_audit_log` dùng chung, **ghi tự động**: `CoreContext.SaveChangesAsync` chạy `AuditTrail` ghi mọi thêm, sửa, xóa của thực thể có `[Audited]` (trường trước → sau, cùng transaction). Chỉ gọi `IAuditLog` bằng tay cho thứ EF không thấy (quyền, đổi mật khẩu, hành động duyệt, SQL thuần). Chỉ xem ở Cài đặt › Nhật ký thay đổi, có thời hạn lưu cấu hình được.
- **Bộ nhớ đệm:** `IAppCache` (bộ nhớ, một máy chủ) gắn với danh sách bảng; `CacheInvalidationInterceptor` xóa mục lưu đệm khi bảng của nó bị ghi. Có lưu đệm: quyền người dùng, đơn vị, cài đặt, ngôn ngữ, tra cứu danh mục. **Không bao giờ** lưu đệm tồn kho, số dư, số chứng từ, khóa sổ. Ghi bằng Dapper phải tự gọi `cache.InvalidateTables`.
- **Thông báo thời gian thực:** `NotificationStream` giữ kết nối SSE trong bộ nhớ (chỉ một máy chủ); máy chủ chỉ gửi **tín hiệu** (`notification`, `sync`, `settings`) và trình duyệt tự tải lại; ngoài ra thăm dò mỗi 3 phút. Tín hiệu `settings` cũng làm thanh thông báo hệ thống đọc lại.
- **Nhật ký chạy và theo dõi:** Serilog (console và `Core/logs/erp-*.log`, giữ 30 ngày), mỗi yêu cầu một dòng kèm người dùng, đơn vị, địa chỉ, `X-Request-Id`; yêu cầu và SQL chậm ghi cảnh báo; `GET /health` và `/health/live`.

---

## 9. Frontend

- `App.tsx` giữ phiên đăng nhập, người dùng, đơn vị, thông báo và dữ liệu mẫu; vẽ `Sidebar`, `Header`, thanh thông báo hệ thống và một `*Module.tsx` cho mỗi phân hệ, mỗi module chọn màn theo mã chức năng. Luôn chuyển màn bằng `navigateTo` / `openFunction` để đường dẫn `#/...` khớp.
- **Mọi lời gọi backend** qua `apiRequest` trong `services/apiClient.ts` (token ở `localStorage['s_erp_auth_token']`, lỗi 401 tự đăng xuất). Màn không gọi `fetch` trực tiếp; lời gọi theo chức năng nằm ở `api.ts` của thư mục chức năng. Ngoại lệ duy nhất là luồng SSE.
- **Cấu trúc một chức năng**: thư mục có `*View.tsx`, `types.ts`, `index.ts`, tùy chọn `api.ts`. Mẫu để sao: `modules/_templates/category-feature-template/` (danh mục) và `voucher-feature-template/` (chứng từ).
- **Control dùng chung** trong `src/components/common/` (`GridView`, `Modal`, `TextInput`, `Tabs`, `useConfirm`, `NumberInput`...) và `showToast` / `saveWithFeedback`; không dùng ô nhập thô hay `window.confirm`. Màu: một thang xanh nhạt `brand-50…950` cho điểm nhấn, `slate-*` cho trung tính, đỏ / vàng / xanh lá chỉ để chỉ ý nghĩa; không dùng gradient. Chế độ tối biến `slate` thành xám trung tính.
- **Phân trang phía máy chủ** cho mọi danh sách (`usePagedList`, `GridView serverSide`, tối đa 200 dòng một trang); bộ lọc của danh sách cũng điều khiển xuất Excel phía máy chủ.
- Màn đăng nhập (`modules/auth`) có khung giới thiệu bên trái (thông báo và ảnh nền sửa được ở Cài đặt); thanh thông báo hệ thống dưới header (`components/layout/SystemBanner.tsx`). Chi tiết: `docs/he-thong/thong-bao-dang-nhap-va-thanh-thong-bao.md`.

---

## 10. Đa ngôn ngữ

- Ngôn ngữ là danh mục `sys_language` (Cài đặt › Ngôn ngữ); mỗi người dùng có ngôn ngữ riêng (`sys_users.language`, trống = mặc định); frontend gửi nó trong tiêu đề `Accept-Language`.
- Chữ giao diện ở `Frontend/src/locales/{vi,en}/*.json`, dùng bằng `t('khóa')`. Chữ backend dành cho người dùng ở `ServerService/Core.Application/Common/Localization/Messages.{vi,en}.json`: `throw new BusinessRuleException("module.khóa", args)` (không viết câu), nhãn trường là khóa `field.*`. Test `MessagesTests` bắt thiếu khóa hoặc câu tiếng Việt trong `throw`; thiếu bản dịch thì lùi về tiếng Việt.
- Hiện **dịch phần dùng chung và Cài đặt**; phân hệ Kho dịch sau khi làm lại. `npm run check-i18n` liệt kê chữ gõ cứng trong phạm vi đã dịch; một dòng phải giữ tiếng Việt thì kết thúc bằng `// i18n-ignore`.

---

## 11. Phần nào đã chạy thật, phần nào còn dữ liệu mẫu

**Chạy thật trên backend:** đăng nhập, người dùng, vai trò, ma trận quyền, quyền đặc biệt, đơn vị cơ sở, phòng ban, ngoại tệ và tỷ giá, khóa sổ, dải số chứng từ, cài đặt (có sao lưu), thông báo, quy tắc phê duyệt, nhật ký thay đổi, thông báo trang đăng nhập và thanh thông báo hệ thống, mã thuế, danh mục kho (đơn vị tính, quy đổi, nhóm và loại vật tư, vật tư, loại kho, kho, vị trí, lô, nhà cung cấp), **phiếu nhập kho, phiếu xuất kho, sổ kho và ba bảng tồn**.

**Vẫn là dữ liệu mẫu trong trình duyệt** (`Frontend/src/mock/`, lưu ở `localStorage['s_erp_database_state']`): các phiếu điều chuyển và kiểm kê, bán hàng, tài chính, nhân sự, báo cáo, danh mục khách hàng và nhân viên.

Chuyển một tính năng từ mẫu lên thật: thêm module backend, thêm `api.ts` gọi `apiRequest`, bỏ dữ liệu mẫu của màn đó.

---

## 12. Bản đồ tài liệu

| Tài liệu | Dùng để |
|---|---|
| `README.md` gốc | Cài đặt máy mới, luồng tổng thể, công thức thêm chức năng |
| `ServerService/README.md` | Bảng, bảng API kèm quyền, khung lưu một phiếu |
| `docs/phat-trien/them-danh-muc.md` | Thêm một danh mục (mã mẫu đầy đủ) |
| `docs/phat-trien/them-chung-tu.md` | **Thêm một chứng từ** (phiếu) |
| `docs/phat-trien/tham-chieu-danh-muc.md` | `[References]`, chặn xóa, `sys_table_ref` |
| `docs/phat-trien/chong-ghi-de.md` | Chống ghi đè (`Version`, `xmin`, 409) |
| `docs/kho/so-kho-va-phieu-nhap-kho.md`, `phieu-xuat-kho.md` | Hai chứng từ mẫu, sổ kho |
| `docs/kho/cau-truc-module-kho.md`, `huong-dan-danh-muc-kho.md` | Cấu trúc thư mục module Kho, danh mục kho |
| `docs/he-thong/phan-quyen.md`, `quan-ly-menu.md`, `thong-bao-dang-nhap-va-thanh-thong-bao.md` | Cài đặt hệ thống |
| `CLAUDE.md` | Bản đầy đủ dành cho trợ lý lập trình, luôn cập nhật theo mã |
| `docs/README.md` | Mục lục và quy ước đặt tài liệu |
