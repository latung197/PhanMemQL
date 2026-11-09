# Tổng quan dự án S-ERP

Tài liệu giới thiệu dự án cho người mới và cho người quản lý: hệ thống làm gì, **kiến trúc mã nguồn** hiện tại và **kiến trúc hệ thống** (các thành phần chạy, dữ liệu đi đâu, bảo mật, triển khai, vận hành). Muốn đi sâu từng phần, xem [Kiến trúc dự án](kien-truc-du-an.md) và bản đồ tài liệu ở cuối.

## 1. Dự án là gì

S-ERP là phần mềm quản trị doanh nghiệp bằng tiếng Việt (có tiếng Anh), chạy trên trình duyệt. Một công ty có nhiều **đơn vị cơ sở** (DVCS); mọi chứng từ, tồn kho, khóa sổ, dải số và quyền ghi sổ đều tính theo đơn vị đang làm việc.

| Phân hệ | Đã chạy thật trên máy chủ | Còn dữ liệu mẫu trong trình duyệt |
|---|---|---|
| Hệ thống và cài đặt | Đăng nhập, người dùng, vai trò, ma trận quyền, quyền đặc biệt, đơn vị cơ sở, phòng ban, ngoại tệ và tỷ giá, mã thuế, khóa sổ, dải số chứng từ, trạng thái chứng từ, lưới chứng từ, quy tắc phê duyệt, thông báo, nhật ký thay đổi, đa ngôn ngữ, menu, thông báo trang đăng nhập, thanh thông báo | |
| Kho | Danh mục (đơn vị tính, quy đổi, nhóm / loại vật tư, vật tư, loại kho, kho, vị trí, lô, nhà cung cấp); phiếu nhập, xuất, yêu cầu xuất, điều chuyển (lệnh, xuất, nhập), kiểm kê; sổ kho; in tem và quét mã; **năm báo cáo** (tồn kho, nhập xuất tồn, hàng nhập, hàng xuất, tuổi hàng tồn); định mức tồn kho theo kho; tính tồn kho tức thời; tính giá trung bình tháng | (không còn) |
| Mua hàng | Yêu cầu mua, đơn mua, hóa đơn mua, dự án, điều khoản thanh toán, nhóm nhà cung cấp, báo cáo chi phí dự án, báo cáo công nợ phải trả | |
| Bán hàng | Nhóm khách hàng, khách hàng, bảng giá bán, đơn bán hàng (và phiếu xuất theo đơn) | Phiếu giao hàng, báo cáo doanh số |
| Tài chính | Hệ thống tài khoản (Thông tư 200), mã thuế gắn tài khoản | Phiếu thu chi, báo cáo quỹ, các báo cáo còn lại; hạch toán chưa làm |
| Khác | Trang Tổng quan (số thật theo quyền) | Nhân sự, danh mục nhân viên, tài nguyên, trợ lý AI (gọi Gemini) |

Quy tắc chủ đạo: **giao diện là nguồn sự thật về hình dạng dữ liệu**; backend điều chỉnh theo. Chữ trên màn, lỗi từ API và tài liệu viết tiếng Việt.

## 2. Kiến trúc hệ thống

### 2.1. Các thành phần chạy

```
┌────────────┐   HTTPS/HTTP    ┌──────────────────────────┐   REST + JWT    ┌─────────────────────────┐   Npgsql   ┌────────────┐
│ Trình      │ ──────────────► │ Frontend (Express)       │ ──────────────► │ ServerService (.NET 10) │ ─────────► │ PostgreSQL │
│ duyệt      │ ◄────────────── │ cổng 3000: file tĩnh +   │ ◄────────────── │ cổng 2512: Web API,     │            │ (erp_dev)  │
│            │   SSE (tín hiệu)│ /api/gemini/analyze      │                 │ dịch vụ nền, SSE        │            │            │
└────────────┘                 └──────────────────────────┘                 └─────────────────────────┘            └────────────┘
                                         │                                              │
                                         └── Google Gemini (trợ lý AI)                  └── logs/erp-*.log (Serilog)
```

| Thành phần | Vai trò |
|---|---|
| Trình duyệt | Chạy ứng dụng React một trang. Gọi API qua một hàm duy nhất (`apiRequest`), nhận tín hiệu realtime qua SSE |
| Frontend (Express, cổng 3000) | Phát triển: Vite chạy ở chế độ middleware. Sản xuất: phục vụ thư mục `dist` (`npm run build` tạo thêm `dist/server.cjs`). Có thêm một API riêng `/api/gemini/analyze` cho trợ lý AI, cần `GEMINI_API_KEY` |
| ServerService (cổng 2512) | Toàn bộ nghiệp vụ, phân quyền, ghi sổ. Chạy như tiến trình thường hoặc **dịch vụ Windows** (`UseWindowsService`) |
| PostgreSQL | Một cơ sở dữ liệu cho mọi đơn vị; không dùng khóa ngoại; cấu trúc do 56 script SQL đánh số dựng |
| Dịch vụ nền (trong ServerService) | `NotificationCleanupService` dọn thông báo cũ (12 giờ một lần), `AuditLogCleanupService` dọn nhật ký theo thời hạn lưu (hai lần một ngày) |

### 2.2. Luồng một yêu cầu

1. Người dùng thao tác trên màn hình; màn gọi hàm trong `api.ts` của chức năng, hàm này gọi `apiRequest`.
2. `apiRequest` gắn `Authorization: Bearer <JWT>` và `Accept-Language`; mã 401 làm đăng xuất.
3. Backend: CORS, xác thực JWT, kiểm tra người dùng còn quyền vào **đơn vị trong token** (`UnitAccess`), rồi bộ lọc quyền `[RequirePermission]` (chức năng + thao tác) hoặc `[RequireRight]` (quyền đặc biệt).
4. Controller mỏng gọi service. Service kiểm tra quy tắc, đọc / ghi bằng EF Core (CRUD) hoặc SQL thuần (báo cáo, ghi sổ), trong một giao dịch khi cần.
5. Lỗi nghiệp vụ là `BusinessRuleException("khóa.thông.báo", tham số)`; `AppExceptionFilter` đổi thành `{ message }` đúng ngôn ngữ người dùng với mã 400 / 403 / 404 / 409; lỗi PostgreSQL (trùng, deadlock, số quá lớn...) cũng được đổi thành thông báo tương ứng.
6. Mỗi request ghi một dòng log kèm `UserId`, `UnitCode`, `ClientIp`, `RequestId` (trả về ở header `X-Request-Id`).

### 2.3. Bảo mật

| Nội dung | Cách làm |
|---|---|
| Đăng nhập | Mật khẩu băm; JWT sống 480 phút, mang theo đơn vị đang làm việc (`POST /api/auth/switch-unit` cấp token mới). Đổi mật khẩu hoặc khóa tài khoản tăng `security_version` làm mọi token cũ hết hiệu lực |
| Chống đoán mật khẩu | Giới hạn 10 lần đăng nhập mỗi phút mỗi địa chỉ IP (HTTP 429) |
| Phân quyền | Vai trò + ngoại lệ theo người dùng; 7 thao tác (xem, thêm, sửa, xóa, duyệt, in, xuất) cho từng chức năng; quyền đặc biệt (xem giá vốn, đổi mã, quyền theo trạng thái chứng từ từng đơn vị...). Không ai cấp được quyền mình không có (`GrantGuard`). Kiểm tra ở frontend chỉ để hiển thị, quyết định thật ở backend |
| Phạm vi dữ liệu | Mọi truy vấn chứng từ, báo cáo theo đơn vị trong token; người dùng không thấy chứng từ đơn vị khác. Ở màn quản trị, người không phải quản trị viên chỉ thấy người dùng, quy tắc duyệt, nhật ký của đơn vị mình, không quản lý được tài khoản rộng hơn mình, không sửa cài đặt chung toàn hệ thống |
| Nhật ký | Mọi thêm / sửa / xóa dữ liệu quan trọng ghi tự động vào `sys_audit_log` (trường, giá trị trước và sau, người làm) |
| Bí mật | Chuỗi kết nối, khóa JWT, mật khẩu demo chỉ ở `appsettings.Local.json` hoặc `.env.local`, không commit |
| CORS | Chỉ các nguồn khai trong `Cors:AllowedOrigins` |

### 2.4. Dữ liệu và nhất quán

- **Hai cách truy cập:** CRUD qua EF Core; báo cáo, tính toán, ghi sổ qua SQL thuần (Dapper), báo cáo kho viết thành **hàm PostgreSQL** `rpt_*`.
- **Sổ kho** (`erp_stock_movement`) là nhật ký chỉ ghi thêm; ba bảng tồn (theo kho, lô, vị trí) được cập nhật cùng giao dịch và luôn bằng tổng sổ (có API đối chiếu và dựng lại). Mọi chứng từ làm đổi tồn đều đi qua `IStockLedger`.
- **Không khóa ngoại:** liên kết bằng mã có chỉ mục; service kiểm mã khi lưu và chặn xóa dòng đang được dùng (bản đồ tham chiếu ghi vào `sys_table_ref`).
- **Chống ghi đè:** mọi bản ghi có phiên bản (cột hệ thống `xmin` của PostgreSQL); lưu bản cũ nhận 409 và màn hình nạp lại.
- **Bộ nhớ đệm:** bộ nhớ của tiến trình API, mỗi mục khai bảng nó đọc và tự hết hiệu lực khi bảng bị ghi; không bao giờ cache tồn kho, số dư, số chứng từ, khóa sổ.
- **Thông báo realtime:** SSE giữ trong bộ nhớ một tiến trình; máy chủ chỉ gửi tín hiệu, trình duyệt tự tải lại; thêm vào đó trình duyệt hỏi lại mỗi 3 phút.

### 2.5. Triển khai và vận hành

| Mục | Hiện tại |
|---|---|
| Môi trường dev | `.claude/launch.json`: `backend` (2512, Development) và `frontend` (3000). Đăng nhập `admin` / `admin`, các đơn vị `DVCS01`...`DVCS04`; Swagger ở `/swagger` (chỉ Development) |
| Cơ sở dữ liệu | Chạy mọi script `ServerService/sql/postgresql/NN-*.sql` theo thứ tự tên; script chạy lại được và tự chuyển dữ liệu cũ; không dùng EF migration |
| Dữ liệu khởi tạo | Mỗi lần khởi động bổ sung mã chức năng, dải số, nội dung menu thiếu, đồng tiền gốc VND. Cơ sở dữ liệu trống: `Seed:DemoData=true` nạp dữ liệu mẫu, hoặc `Bootstrap` chỉ tạo tài khoản quản trị và một đơn vị |
| Sức khỏe | `GET /health` (kiểm tra cơ sở dữ liệu), `GET /health/live` |
| Log | Serilog ra console và `Core/logs/erp-yyyyMMdd.log` (giữ 30 file, tối đa 100 MB mỗi file); cảnh báo request chậm hơn 1.000 ms và câu SQL chậm hơn 500 ms |
| Giới hạn hiện tại | Một tiến trình API (bộ nhớ đệm và SSE nằm trong tiến trình, chưa chạy nhiều bản song song); camera quét mã cần HTTPS nên chưa làm; một số màn còn dữ liệu mẫu |

## 3. Kiến trúc mã nguồn

### 3.1. Cấu trúc thư mục

```
PhanMemQL/
├─ Frontend/                  React + TypeScript + Vite
│  ├─ server.ts               Express (phát triển + phục vụ dist + API Gemini)
│  └─ src/
│     ├─ App.tsx              phiên đăng nhập, người dùng, đơn vị, thông báo, điều hướng
│     ├─ config/functions.ts  FUNCTION_REGISTRY: mã chức năng → nhóm, đường dẫn, nhãn, loại
│     ├─ modules/<phân hệ>/   inventory, purchasing, sales, finance, hr, settings, overview...
│     ├─ components/          common (điều khiển dùng chung), catalog (màn danh mục), layout
│     ├─ services/            apiClient, cài đặt, menu, thông báo SSE, lưới chứng từ...
│     ├─ utils/ hooks/ context/ locales/ types/
│     └─ mock/                dữ liệu mẫu cho màn chưa có API
├─ ServerService/             .NET 10
│  ├─ Core/                   lớp ngoài cùng: controller mỏng, xác thực, CORS, Program.cs
│  ├─ Core.Infrastructure/    EF Core (CoreContext), SQL thuần, service, DatabaseSeeder
│  ├─ Core.Application/       DTO, giao diện service, quy tắc thuần, ngoại lệ, thông báo dịch
│  ├─ Core.Domain/            entity
│  ├─ sql/postgresql/         56 script dựng và nâng cấp cơ sở dữ liệu
│  └─ tests/Core.Tests/       xUnit (hơn 500 test)
└─ docs/                      hướng dẫn Markdown + Word theo nhóm chức năng
```

### 3.2. Backend: bốn lớp, phụ thuộc một chiều

```
Core  ──►  Core.Infrastructure  ──►  Core.Application  ──►  Core.Domain
(API)      (EF, SQL, service)        (hợp đồng, quy tắc)     (entity)
```

- Trong mỗi lớp: mã dùng chung ở `Common/`, mã theo chức năng ở `Modules/<Phân hệ>/`.
- `Core.Application` không biết cơ sở dữ liệu: chỉ có DTO, giao diện, quy tắc thuần (ma trận quyền, luật phê duyệt, chính sách trạng thái chứng từ) nên test được không cần máy chủ.
- `Core.Infrastructure` đăng ký service trong `DependencyInjection.cs`; file SQL đặt ở `Modules/<Phân hệ>/Sql/*.sql`, nhúng vào DLL, đọc bằng `SqlScripts.Get`.
- `_legacy/` là mã trước tái cấu trúc, không nằm trong solution, không sửa và không tham chiếu.

### 3.3. Các khung dùng lại (không viết lại cho từng chức năng)

| Khung | Cho phép |
|---|---|
| **Danh mục** (`CatalogService` + `CatalogControllerBase` + `CatalogScreen` + `createCatalogApi`) | Khai báo một danh mục là có đủ: danh sách phân trang và sắp xếp, tìm kiếm, lọc, thêm sửa xóa, nhập / xuất Excel, xóa nhiều dòng, đổi mã / gộp mã, quyền, nhật ký, chống ghi đè, bố cục cột từng người |
| **Chứng từ** | Số chứng từ nguyên tử theo dải, khóa sổ theo tháng, tỷ giá, máy trạng thái (nháp, chờ duyệt, đã duyệt, ghi sổ, hủy, khôi phục), phê duyệt nhiều cấp, lưu thẳng ở trạng thái đích, chứng từ nối tiếp (lấy từ chứng từ trước, số lượng đã làm tính ra, không lưu) |
| **Sổ kho** (`IStockLedger`) | Ghi sổ nhập / xuất / sửa phiếu đã ghi sổ, giá bình quân kho, lô, vị trí, hạn dùng, chặn âm kho |
| **Tra cứu** (`LookupDefinition` / `LookupProvider`, `CatalogLookup`) | Chọn mã danh mục ở mọi nơi bằng ô mã + F2, có bộ nhớ đệm |
| **Báo cáo** | Hàm `rpt_*` trong cơ sở dữ liệu, một service mỏng gọi hàm, giá trị tiền che khi thiếu `VIEW_COST`, Excel qua `IExcelExporter`, in khổ A4 (`ReportKit`) |
| **Nhật ký tự động** (`[Audited]`) | Ghi mọi thay đổi của entity, không cần viết tay |
| **Đa ngôn ngữ** | Ngôn ngữ là danh mục; mỗi người một ngôn ngữ; thông báo backend là khóa trong `Messages.{vi,en}.json` |

### 3.4. Frontend

- `App.tsx` giữ phiên, người dùng, đơn vị, thông báo; vẽ thanh bên và thanh trên cùng, rồi một `*Module.tsx` cho mỗi nhóm; module chọn màn theo mã chức năng (`subKey`).
- Điều hướng luôn qua `navigateTo` / `openFunction` để địa chỉ trên thanh trình duyệt (`#/...`) khớp.
- Mỗi chức năng là một thư mục: `*View.tsx`, `types.ts`, `index.ts`, `api.ts`. Làm mới từ mẫu `modules/_templates/`.
- Màn không được gọi `fetch` trực tiếp; mọi gọi API đi qua `apiRequest` (ngoại lệ duy nhất: luồng SSE).
- Điều khiển dùng chung ở `components/common` (lưới, hộp thoại, ô nhập số, tra cứu, trạng thái tải / lỗi / rỗng...), thông báo qua `showToast`; màu theo một thang xanh nhạt `brand-*`.
- Menu bên trái lấy từ máy chủ (`GET /api/menu`), đã cắt theo quyền Xem của người dùng; cấu trúc menu do quản trị tối cao chỉnh.

### 3.5. Mã chức năng nối mọi thứ

Mã chức năng (ví dụ `inv_receipt`) là khóa chung của menu, đường dẫn, quyền, thông báo và phê duyệt. Thêm một chức năng phải khai ở năm nơi: `types/index.ts` (`SubMenuKey`), `config/functions.ts`, `menu.json`, `FunctionCatalog.cs` (và `VoucherCatalog.cs` cho chứng từ), cùng một `case` trong `*Module.tsx` của nhóm. Thiếu một nơi thì biên dịch hoặc test báo lỗi (`MenuSeedFileTests`, kiểu `Record<SubMenuKey, …>`).

### 3.6. Quy ước cơ sở dữ liệu

- Bảng `sys_*` (hệ thống) và `erp_*` (nghiệp vụ), tên `snake_case`; mọi bảng `erp_*` có bốn cột dấu vết (`created_at`, `created_by`, `updated_at`, `updated_by`).
- Cột `*_code` trỏ sang danh mục phải khai `[References<T>]` hoặc `[NotReference(lý do)]`; test chặn quên.
- Khóa và tên của danh mục luôn là `code` và `name`; nhãn tiếng Việt nằm ở `locales`, không ở tên cột.
- Mô tả từng bảng, cột, chỉ mục: [Mô tả cơ sở dữ liệu](mo-ta-co-so-du-lieu.md) (sinh tự động từ cơ sở dữ liệu thật).

### 3.7. Kiểm tra chất lượng

| Việc | Lệnh |
|---|---|
| Biên dịch backend | `dotnet build Core.sln` (trong `ServerService/`) |
| Test backend | `dotnet test tests/Core.Tests/Core.Tests.csproj` |
| Kiểu dữ liệu frontend | `npm run lint` (trong `Frontend/`, là `tsc --noEmit`) |
| Quy tắc trạng thái chứng từ khớp backend | `npm run check-policy` |
| Menu khớp `menu.json` | `npm run check-menu` |
| Mã tem sản phẩm | `npm run check-label` |

Các test "hợp đồng" giữ kiến trúc không bị phá: quy ước đặt tên bảng và cột, dấu vết bản ghi, khai `[Audited]`, khai tham chiếu, chống ghi đè, quyền đọc dữ liệu, đủ khóa dịch.

## 4. Một chức năng mới làm thế nào

| Loại | Việc cần làm |
|---|---|
| Danh mục | Script SQL, entity, service kế thừa `CatalogService`, controller kế thừa `CatalogControllerBase`, `api.ts` bằng `createCatalogApi`, màn khai `CatalogDefinition`, mã chức năng và menu. Xem lệnh `/them-danh-muc` và [Thêm danh mục](them-danh-muc.md) |
| Chứng từ | Thêm bảng đầu phiếu và dòng, service theo khung lưu phiếu, khai trong `VoucherCatalog`, màn từ mẫu `voucher-feature-template`, phê duyệt, ghi sổ kho nếu làm đổi tồn. Xem [Thêm chứng từ](them-chung-tu.md) |
| Báo cáo | Viết hàm `rpt_*` trong script SQL, file SQL một dòng gọi hàm, service và controller, màn dùng `ReportKit`. Xem [Báo cáo kho](../kho/bao-cao-kho.md) |

## 5. Bản đồ tài liệu

| Muốn biết | Đọc |
|---|---|
| Chi tiết từng lớp, khung, quyền, cài đặt | [Kiến trúc dự án](kien-truc-du-an.md) |
| Thêm danh mục / chứng từ từng bước | [Thêm danh mục](them-danh-muc.md), [Thêm chứng từ](them-chung-tu.md) |
| Bảng, cột, chỉ mục | [Mô tả cơ sở dữ liệu](mo-ta-co-so-du-lieu.md) |
| Kho: sổ kho, phiếu, điều chuyển, kiểm kê, tem, báo cáo | thư mục `docs/kho/` |
| Mua hàng, bán hàng, tài chính | thư mục `docs/mua-hang/`, `docs/ban-hang/`, `docs/tai-chinh/` |
| Phân quyền, menu, trạng thái chứng từ | thư mục `docs/he-thong/` |
| Mục lục đầy đủ | `docs/README.md` |
