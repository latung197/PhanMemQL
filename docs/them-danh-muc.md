# Thêm một danh mục mới (backend + frontend)

Tài liệu này hướng dẫn từng bước thêm một danh mục chạy thật trên backend, từ bảng trong database đến màn hình, phân quyền, Excel, tra cứu và kiểm tra. Ví dụ xuyên suốt là **Danh mục nhà cung cấp**.

> **Tài liệu này đã được kiểm chứng.** Danh mục nhà cung cấp trong ví dụ được dựng lại **đúng từ các khối mã ở đây** (không sửa tay): biên dịch 0 lỗi, toàn bộ test qua, `npm run lint` sạch, thử đủ API (phân trang, sắp xếp, tìm không dấu, lọc, xuất Excel, tra cứu, chống ghi đè, nhật ký) và màn hình trên trình duyệt. Làm theo đúng thứ tự thì ra đúng như vậy. Gặp lỗi mà tài liệu không nói thì xem §7.3.

Mẫu để copy là **Danh mục đơn vị tính** (danh mục khác trong dự án đã theo khung này: quy đổi, nhà cung cấp, nhóm vật tư, loại vật tư, loại kho, kho, phòng ban, ngoại tệ, tỷ giá, mã thuế, ngôn ngữ, đơn vị cơ sở; Phần 5.1 mô tả mẫu danh mục có danh sách chọn nhiều, Phần 5.2 mẫu khóa ghép). Đây là mẫu đầy đủ và mới nhất: bảng `erp_*`, nhật ký tự động, cột người tạo / người sửa, chống ghi đè, Excel, xóa nhiều, tra cứu, hai ngôn ngữ.

| Lớp | File mẫu |
| --- | --- |
| SQL | `ServerService/sql/postgresql/13-inventory-uom.sql` |
| Entity | `ServerService/Core.Domain/Modules/Inventory/Categories/uom/Uom.cs` |
| Contract (DTO, interface) | `ServerService/Core.Application/Modules/Inventory/Categories/uom/UomContracts.cs` |
| Service (kế thừa `CatalogService`) | `ServerService/Core.Infrastructure/Modules/Inventory/Categories/uom/UomService.cs` |
| Controller (kế thừa `CatalogControllerBase`) | `ServerService/Core/Modules/Inventory/Categories/uom/UomsController.cs` |
| Tra cứu | `ServerService/Core.Infrastructure/Common/Lookups/LookupCatalogs.cs` (mục `"uoms"`) |
| Màn hình | `Frontend/src/modules/inventory/categories/uom/` (`UomCategoryView.tsx`, `api.ts`, `types.ts`, `index.ts`) |

## Trước khi bắt đầu

Phần này giúp bạn tự làm một danh mục mà không cần biết trước toàn bộ dự án. Đọc một lần (khoảng 10 phút), rồi làm theo các bước.

### Cần chuẩn bị

| Thứ cần | Kiểm tra | Dùng để |
| --- | --- | --- |
| .NET 10 SDK | `dotnet --version` ra `10.x` | Build và chạy backend |
| Node.js | `node --version` | Chạy frontend |
| PostgreSQL 15+ và `psql` | Mở được `psql` (thường ở `C:\Program Files\PostgreSQL\15\bin\psql.exe`) | Chạy script tạo bảng |
| Database `erp_dev` đã có đủ bảng | Đã chạy mọi file trong `ServerService/sql/postgresql/` theo thứ tự tên (`00-helpers.sql` trước) | Backend cần các bảng này |
| Backend chạy được | `ASPNETCORE_ENVIRONMENT=Development`, địa chỉ `http://localhost:2512` | Thử API |
| Frontend chạy được | `cd Frontend`, `npm install`, `npm run dev`, mở `http://localhost:3000` | Thử màn hình |
| Tài khoản thử | Đăng nhập `admin` (môi trường Development, mật khẩu admin đặt lại mỗi lần backend khởi động) | Quản trị viên có toàn quyền |

Khi backend chạy ở Development, trang **Swagger** `http://localhost:2512/swagger` liệt kê mọi API, kèm quyền cần có, và cho gọi thử ngay trên trình duyệt. Đây là cách dễ nhất để thử backend trước khi có màn hình (xem §2.10).

> Backend đang chạy sẽ khóa file DLL: **dừng backend trước khi build**, build xong chạy lại.

### Thuật ngữ (đọc một lần)

| Từ | Nghĩa trong dự án này |
| --- | --- |
| **Danh mục** | Danh sách dữ liệu gốc dùng đi dùng lại (đơn vị tính, kho, nhà cung cấp...). Mỗi dòng có một **mã** (`code`) không trùng và một **tên** (`name`) |
| **Mã chức năng** | Tên ngắn của một màn hình, ví dụ `inv_supplier_cat`. Cùng một mã dùng cho menu, đường dẫn, phân quyền, nhật ký. **Đã dùng thì không đổi** |
| **Entity** | Lớp C# đại diện cho một bảng (`Supplier` ↔ `erp_supplier`) |
| **DTO** | Dữ liệu backend **trả ra** cho màn hình (`SupplierDto`) |
| **Request** | Dữ liệu màn hình **gửi lên** để thêm hoặc sửa (`SaveSupplierRequest`) |
| **Service** | Nơi kiểm tra dữ liệu và lưu (`SupplierService`). Phần chung đã có sẵn ở lớp `CatalogService`, bạn chỉ khai báo phần riêng |
| **Controller** | Cửa vào API (`SuppliersController`). Với danh mục chỉ là 5 dòng khai báo |
| **Tra cứu (lookup)** | Ô chọn mã ở màn khác (ví dụ chọn nhà cung cấp trên phiếu). Chỉ trả mã, tên và vài cột; **không** cần quyền xem danh mục |
| **Quyền** | 7 quyền cho mỗi chức năng: Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất. Danh mục dùng 5 cái đầu và Xuất |
| **Nhật ký thay đổi** | Mọi thêm, sửa, xóa, xuất Excel tự ghi lại: ai, lúc nào, trường nào đổi từ gì sang gì. Xem ở Cài đặt › Nhật ký thay đổi |
| **Phiên bản bản ghi** (`version`) | Số của lần lưu cuối. Hai người cùng sửa một dòng thì người lưu sau bị báo "đã bị người khác sửa" thay vì ghi đè |
| **Phân trang phía máy chủ** | Mỗi lần chỉ tải một trang (tối đa 200 dòng); tìm kiếm, sắp xếp, lọc cũng làm ở máy chủ |

### Bản đồ thư mục

```
ServerService/                       Backend (.NET). Phụ thuộc một chiều: Core → Infrastructure → Application → Domain
  sql/postgresql/NN-*.sql            Script tạo bảng (chạy theo thứ tự tên)
  Core.Domain/Modules/<PhanHe>/Categories/<ten>/        Entity (bảng)
  Core.Application/Modules/<PhanHe>/Categories/<ten>/   DTO, request, interface
  Core.Infrastructure/Modules/<PhanHe>/Categories/<ten>/ Service (kiểm tra dữ liệu, lưu)
  Core/Modules/<PhanHe>/Categories/<ten>/               Controller (API)
  Core.Application/Common/Localization/Messages.*.json  Thông báo lỗi (vi, en)
Frontend/src/                        Frontend (React)
  types/index.ts, config/functions.ts                   Mã chức năng, đường dẫn
  (menu bên trái nằm trong DB; khai báo ở ServerService/Core/SeedData/menu.json, xem bước 3.3)
  modules/<phan-he>/categories/<ten>/                   Màn hình của danh mục (4 file)
  locales/vi|en/*.json                                  Chữ hiển thị (không gõ cứng chữ trong màn)
  components/catalog/                                   Khung màn danh mục dùng chung (không sửa khi thêm danh mục)
```

`<PhanHe>` là tên phân hệ viết hoa chữ đầu ở backend (`Inventory`) và viết thường ở frontend (`inventory`). `<ten>` là tên số nhiều của danh mục (`suppliers`).

### Cách làm việc khuyên dùng: ba mốc kiểm tra

Đừng viết hết rồi mới chạy. Làm theo từng mốc, mỗi mốc có cách kiểm tra rõ ràng; lỗi hiện ra sớm sẽ dễ tìm hơn nhiều.

| Mốc | Làm xong | Kiểm tra |
| --- | --- | --- |
| **1. Backend** | Phần 1 và Phần 2 | `dotnet build`, `dotnet test`, rồi thử bằng Swagger (§2.10) |
| **2. Frontend** | Phần 3 | `npm run lint`, mở màn hình (§3.8) |
| **3. Phân quyền và dọn dẹp** | Phần 6 và Phần 7 | Thử bằng tài khoản thiếu quyền, xóa dữ liệu thử |

---

## Tóm tắt quy trình

Thêm một danh mục là **khai báo**, không phải viết lại chức năng: danh sách phân trang, tìm kiếm, sắp xếp, xuất / nhập Excel, xóa nhiều, phân quyền, nhật ký, chống ghi đè đều do khung dùng chung lo (§0.3). Làm theo thứ tự, mỗi bước có mục chi tiết bên dưới:

| # | Việc | File chính | Mục |
| --- | --- | --- | --- |
| 1 | Bảng SQL, chạy trên database | `sql/postgresql/NN-<ten>.sql` | 1 |
| 2 | Mã chức năng | `FunctionCatalog.cs` | 2.1 |
| 3 | Entity (`: ErpEntity, ICatalogRecord`, `[Audited]`, `[References]` / `[NotReference]` cho cột `*_code`) và `DbSet` | `Core.Domain/...`, `CoreContext.cs` | 2.2, 2.3 |
| 4 | DTO, request, interface (kế thừa khung) | `<Ten>Contracts.cs` | 2.4 |
| 5 | Service **khai báo** (cột sắp xếp, tìm kiếm, bộ lọc, kiểm tra, cột xuất) | `<Ten>Service.cs` | 2.5 |
| 6 | Đăng ký service và tra cứu | `DependencyInjection.cs`, `LookupCatalogs.cs` | 2.6 |
| 7 | Controller 5 dòng | `<Ten>sController.cs` | 2.7 |
| 8 | Thông báo lỗi và tiêu đề Excel (vi + en) | `Messages.vi.json`, `Messages.en.json` | 2.8 |
| 9 | Mã chức năng, menu, đường dẫn ở frontend | `types/index.ts`, `config/functions.ts`, `locales/*/common.json`; menu: `Core/SeedData/menu.json` | 3.1 - 3.3 |
| 10 | Thư mục màn hình: `types.ts`, `api.ts` (3 dòng), View (`CatalogDefinition`), `index.ts` | `modules/<phan-he>/categories/<ten>/` | 3.4 |
| 11 | Chữ hiển thị và gắn màn vào phân hệ | `locales/*/<khu>.json`, `<PhanHe>Module.tsx` | 3.6, 3.7 |
| 12 | Cấp quyền, build, test, chạy thử, dọn dữ liệu thử | | 6, 7 |

Việc thêm tùy chọn khi cần: tham chiếu danh mục khác (Phần 5, chi tiết ở `docs/tham-chieu-danh-muc.md`), bộ lọc riêng (§2.5), bản dịch / bảng con (`AfterApplyAsync`), tra cứu riêng nhiều bảng hoặc có tham số (§4.3).

---

## Phần 0. Bức tranh chung

### 0.1. Một danh mục gồm những gì

```
 Trình duyệt                                   Backend (.NET)                                  PostgreSQL
 ──────────────────────────────────────────    ─────────────────────────────────────────────   ───────────────
 SupplierCategoryView  (chỉ khai báo)
   └─ CatalogScreen    (khung chung)
        ├─ useCatalog ─── suppliersApi ──────► SuppliersController : CatalogControllerBase  (kiểm tra quyền)
        │   (createCatalogApi)                    └─ SupplierService : CatalogService (kiểm tra dữ liệu)
        │                                             └─ CoreContext (EF) ─────────────────► erp_supplier
        │                                                  ├─ tự điền created_* / updated_*
        │                                                  ├─ tự ghi nhật ký ──────────────► sys_audit_log
        │                                                  ├─ chống ghi đè (xmin)
        │                                                  └─ tự xóa cache của bảng
        ├─ phân trang, sắp xếp, tìm kiếm ──────► GET ...?page=&pageSize=&sort=&dir=&search=&status=
        ├─ Excel xuất (mọi dòng khớp bộ lọc) ──► GET .../export (ghi nhật ký EXPORT)
        ├─ Excel nhập / xóa nhiều ─────────────► .../import, .../delete-many (CatalogBatch)
        └─ Cột (ẩn / hiện, độ rộng) ───────────► /api/grid-layouts ─────────────────────────► sys_grid_layout

 Màn khác (phiếu, báo cáo)
   └─ CatalogLookup / CatalogMultiLookup ────► /api/lookups/suppliers (LookupService)
```

### 0.2. Phải viết và không phải viết

| Bạn viết | Hệ thống tự có |
| --- | --- |
| Bảng SQL | Cột người tạo / người sửa (điền khi lưu) |
| Entity + `[Audited]` | Nhật ký thay đổi từng trường (trước → sau) |
| DTO, request, service **khai báo** (cột được sắp xếp, trường tìm kiếm, kiểm tra dữ liệu, cột xuất Excel) | Tạo / sửa / xóa / danh sách phân trang / xuất Excel / nhập Excel / xóa nhiều (lớp `CatalogService`) |
| `[References<T>]` trên mỗi cột `*_code` trỏ sang danh mục khác (và index cho cột đó) | Chặn xóa khi bảng khác đang dùng mã, kiểm tra mã tham chiếu có thật khi lưu, bảng `sys_table_ref` để xem ai trỏ tới ai |
| Controller 5 dòng: route + mã chức năng | Mọi API và quyền của từng API (lớp `CatalogControllerBase`) |
| Chống ghi đè khi hai người cùng sửa (lỗi 409) | Báo trùng mã / trùng tên dạng dễ hiểu kể cả khi lọt kiểm tra (409) |
| 1 mục đăng ký tra cứu (kèm các bảng nó đọc) | Nhập Excel cả file hoặc không dòng nào, lỗi theo từng dòng |
| Khóa thông báo lỗi và tiêu đề xuất Excel (vi + en) | Phân trang phía máy chủ tối đa 200 dòng / trang, bộ nhớ đệm cho tra cứu (tự xóa khi bảng đổi) |
| Mã chức năng (backend + frontend), mục menu | Dòng trong ma trận phân quyền, route, breadcrumb |
| Màn hình: cột, form, cột Excel (khai báo) | Thanh công cụ, tìm kiếm không dấu, bộ lọc trạng thái, phân trang, xuất / nhập Excel, file mẫu, xóa nhiều, ẩn nút theo quyền, hộp xác nhận, thông báo, chọn cột / độ rộng / sắp xếp lưu theo người dùng |
| Chữ hiển thị (vi + en) | |

### 0.3. Lớp dùng chung (đừng viết lại)

Một danh mục chỉ khai báo phần riêng của nó; mọi thứ còn lại nằm ở các lớp dưới đây. Sửa hành vi chung (ví dụ thêm một bước kiểm tra cho mọi danh mục) thì sửa ở đây, **không sửa riêng từng danh mục**.

| Lớp | File | Việc |
| --- | --- | --- |
| `CatalogService<TEntity, TDto, TRequest>` | `Core.Infrastructure/Common/Catalogs/CatalogService.cs` | Danh sách phân trang, xuất Excel, tạo, sửa (chống ghi đè), xóa, nhập Excel, xóa nhiều |
| `ICatalogService`, `ICatalogRequest` | `Core.Application/Common/Catalogs/CatalogContracts.cs` | Hợp đồng chung của service và request |
| `ICatalogRecord` | `Core.Domain/Common/ICatalogRecord.cs` | Entity có `Code`, `IsActive`, `SortOrder` |
| `CatalogControllerBase<TDto, TRequest>` | `Core/Common/Controllers/CatalogControllerBase.cs` | 7 API: danh sách, export, tạo, sửa, nhập, xóa nhiều, xóa |
| `[CatalogFunction]`, `[CatalogRight]`, `CatalogPermissionFilter` | `Core/Common/Authorization/CatalogPermissions.cs` | Kiểm tra quyền của từng API |
| `SortMap<T>`, `ToPagedAsync`, `ContainsPattern` | `Core.Infrastructure/Common/Paging/` | Cột được sắp xếp (danh sách trắng), cắt trang, mẫu tìm kiếm |
| `CatalogListQuery`, `PagedResult<T>` | `Core.Application/Common/Paging/PagingContracts.cs` | Tham số và kết quả phân trang |
| `IExcelExporter` | `Core.Infrastructure/Common/Export/ExcelExporter.cs` | Ghi file .xlsx |
| `CatalogBatch` | `Core.Infrastructure/Common/Catalogs/CatalogBatch.cs` | Nhập Excel / xóa nhiều trong một giao dịch |
| `LookupService`, `LookupCatalogs`, `LookupProvider` | `Core.Infrastructure/Common/Lookups/` | Tra cứu có bộ nhớ đệm; `LookupProvider` cho tra cứu viết riêng (§4.3) |
| `createCatalogApi` | `Frontend/src/components/catalog/createCatalogApi.ts` | `api.ts` của danh mục (ba dòng) |
| `CatalogScreen`, `useCatalog`, `usePagedList` | `Frontend/src/components/catalog/`, `hooks/` | Màn hình chung, phân trang phía máy chủ |

Quy ước tên: loại đối tượng `<loai>` (camelCase: `supplier`, `uomConversion`) quyết định các khóa thông báo mà lớp nền dùng: `<loai>.notFound`, `<loai>.codeExists`, `export.<loai>.sheet` (§2.8). Cột sắp xếp được: tên là `sortKey` (hoặc `key`) của cột lưới ở frontend và phải có trong `SortMap` ở service. Test `CatalogFrameworkTests` báo đỏ khi controller thiếu mã chức năng / API thiếu quyền / service thiếu khóa thông báo.

### 0.4. Tên dùng trong ví dụ

| Thông tin | Giá trị ví dụ | Ghi chú |
| --- | --- | --- |
| Mã chức năng | `inv_supplier_cat` | Khóa chung của menu, route, phân quyền, nhật ký, bố cục lưới. Chữ thường, dấu `_`, kết thúc `_cat` cho danh mục. **Không đổi sau khi đã dùng** (quyền và nhật ký lưu theo mã này) |
| Bảng | `erp_supplier` | Bảng nghiệp vụ `erp_*`, cột `snake_case` |
| Entity / loại đối tượng | `Supplier` / `supplier` | `supplier` hiện ở màn Nhật ký thay đổi |
| Phân hệ backend | `Inventory` | Thư mục `Modules/Inventory/` ở cả 4 project |
| API | `api/inventory/suppliers` | Số nhiều, chữ thường |
| Tên tra cứu | `suppliers` | `GET /api/lookups/suppliers` |
| Đường dẫn màn | `/inventory/suppliers` | |
| Thư mục màn | `Frontend/src/modules/inventory/categories/suppliers/` | |

Đổi các tên này cho danh mục của bạn. Làm theo thứ tự: **SQL → backend → frontend → phân quyền → kiểm tra**.

**Quy ước đặt tên cột (bắt buộc cho danh mục):**

| Cột | Quy ước | Ví dụ |
| --- | --- | --- |
| Khóa của chính danh mục | `code` (mã, duy nhất) và `name` (tên): khung dùng chung, tra cứu và tìm kiếm dựa vào hai cột này | `erp_uom.code`, `erp_uom.name` |
| Cột chung | `is_active`, `sort_order`, `note` | |
| Cột trỏ sang danh mục khác | `<bảng đích>_code`, cho dễ đọc khi nối bảng | `uom_code`, `warehouse_code`, `material_code`, `from_uom_code` |
| Tên hiển thị | Chữ tiếng Việt (Mã vật tư, Tên vật tư) nằm ở file ngôn ngữ `locales/*`, **không** đặt trong tên cột kiểu `ma_vt`, `ten_vt` | |

Danh mục không có `name` vẫn dùng được khung (xem mẫu tỷ giá ở Phần 5.2 cho khóa ghép; không có tên thì `NameOf` lấy mã để đặt tên trong thông báo).

---

## Phần 1. Database

### 1.1. Tạo script SQL — `ServerService/sql/postgresql/NN-<ten>.sql` (thêm mới)

> **Giải thích.** Bảng là nơi dữ liệu thật sự nằm. Mỗi cột trong ví dụ có một lý do:
> - `code` là **khóa chính**: mã do người dùng đặt (NCC001), không đổi sau khi tạo, và là phần cuối của địa chỉ API (`/api/inventory/suppliers/NCC001`).
> - `name` là tên hiển thị; `UNIQUE INDEX` trên `lower(name)` chặn hai nhà cung cấp trùng tên (không phân biệt hoa thường) kể cả khi hai người lưu cùng lúc.
> - `is_active` cho phép **ngừng sử dụng** thay vì xóa: dữ liệu cũ (phiếu đã lập) vẫn trỏ được tới bản ghi đó, nhưng phiếu mới không chọn được nữa.
> - `sort_order` là thứ tự mặc định trong danh sách.
> - Bốn cột `created_at / created_by / updated_at / updated_by` do hệ thống tự điền khi lưu, để biết ai tạo và ai sửa gần nhất.
> - Các index (`ix_...`) giúp tìm và lọc nhanh khi bảng có nhiều dòng.
> - Không có khóa ngoại (`FOREIGN KEY`) vì quy ước dự án: liên kết bằng cột mã, và service tự kiểm tra (xem §2.5 và Phần 5).

`NN` là số tiếp theo trong thư mục `ServerService/sql/postgresql/` (xem số lớn nhất trước khi tạo file mới). Script phải **chạy lại nhiều lần không lỗi**: dùng `IF NOT EXISTS`, không `DROP`.

```sql
-- Inventory: supplier catalog (danh mục nhà cung cấp, function inv_supplier_cat). Safe to rerun.
-- Goods receipts will link to a supplier by its code.

CREATE TABLE IF NOT EXISTS erp_supplier (
    code varchar(20) PRIMARY KEY,           -- NCC001...
    name varchar(200) NOT NULL,
    tax_code varchar(30),
    phone varchar(30),
    address varchar(300),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    -- Record stamps of every erp_* table (ErpEntity): filled by the API on save, UTC.
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,                     -- sys_users.user_id; null for rows created by scripts
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_supplier_name ON erp_supplier (lower(name));
CREATE INDEX IF NOT EXISTS ix_erp_supplier_tax_code ON erp_supplier (tax_code);
```

Quy tắc:

| Quy tắc | Vì sao |
| --- | --- |
| Tên bảng `erp_*` (nghiệp vụ) hoặc `sys_*` (hệ thống), cột `snake_case` | Test `TablesAndColumnsFollowNamingConvention` |
| Có đủ 4 cột `created_at`, `created_by`, `updated_at`, `updated_by` | Entity kế thừa `ErpEntity`, thiếu cột thì lỗi khi chạy |
| **Không tạo khóa ngoại** | Quy ước dự án. Liên kết bằng cột mã có index; service tự kiểm tra (2.5) |
| **Không cần cột phiên bản** | Chống ghi đè dùng cột ẩn `xmin` có sẵn ở mọi bảng PostgreSQL |
| Unique index cho cột không được trùng (tên...) | Chặn trùng kể cả khi hai người lưu cùng lúc. API tự đổi thành lỗi 409 dễ đọc (2.5) |
| Index cho cột hay tìm / liên kết | Danh sách và tra cứu nhanh khi nhiều dòng |
| Dữ liệu mặc định chỉ chèn khi bảng còn trống (`WHERE NOT EXISTS (SELECT 1 FROM erp_supplier)`) | Bản ghi người dùng đã xóa không quay lại khi chạy lại script |
| Đổi cấu trúc về sau: sửa luôn file này, thêm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` | Dự án **không dùng EF migrations** (xem cuối `13-inventory-uom.sql`) |

Dữ liệu mặc định (tùy chọn), copy kiểu của `13-inventory-uom.sql`:

```sql
INSERT INTO erp_supplier (code, name, sort_order)
SELECT v.code, v.name, v.sort_order
FROM (VALUES ('NCC001', 'Công ty A', 1), ('NCC002', 'Công ty B', 2)) AS v(code, name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM erp_supplier);
```

### 1.2. Chạy script

`psql` có thể không có trong PATH. Mật khẩu database nằm trong `ServerService/Core/appsettings.Local.json` (`ConnectionStrings:CoreContext`); không ghi mật khẩu vào script hay tài liệu.

```powershell
psql -h localhost -U postgres -d erp_dev -v ON_ERROR_STOP=1 -f ServerService/sql/postgresql/NN-inventory-supplier.sql
```

Thay `NN` bằng số đã chọn ở bước 1.1; nếu `psql` chưa có trong PATH, gọi bằng đường dẫn tới bản PostgreSQL đang cài.

Database mới: chạy **mọi** file trong `sql/postgresql/` theo thứ tự tên (`00-helpers.sql` trước).

**Kiểm tra bước này:**
1. Chạy script lần thứ hai: **không được báo lỗi** (script phải chạy lại được nhiều lần).
2. Xem bảng đã tạo đúng cột chưa:
   ```powershell
   psql -h localhost -U postgres -d erp_dev -c "\d erp_supplier"
   ```
   Phải thấy các cột `code`, `name`, ..., `updated_by` và hai index.
3. (Nếu có dữ liệu mặc định) `psql ... -c "select code, name from erp_supplier"` ra đúng các dòng.

---

## Phần 2. Backend (`ServerService/`)

Phụ thuộc một chiều: `Core` (controller) → `Core.Infrastructure` (service, EF) → `Core.Application` (DTO, interface) → `Core.Domain` (entity).

### 2.1. Khai báo mã chức năng — `Core.Application/Common/Permissions/FunctionCatalog.cs` (sửa)

> **Giải thích.** Mã chức năng là "tên" của màn hình trong toàn hệ thống. Backend dùng nó để biết quyền nào áp cho màn nào, ghi nhật ký của chức năng nào, và lưu bố cục cột theo từng chức năng. Khai báo ở đây để khi backend khởi động, mã tự được thêm vào bảng `sys_command` và hiện trong ma trận phân quyền. Frontend khai báo cùng mã ở Phần 3; hai nơi **phải giống từng chữ**.

Thêm một dòng vào danh sách:

```csharp
["inv_supplier_cat"] = "Danh mục nhà cung cấp",
```

Khi khởi động, API tự thêm mã vào bảng `sys_command`, nên mã hiện trong ma trận phân quyền với 7 quyền (Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất).

Tên tiếng Anh của chức năng — `Core.Application/Common/Localization/Messages.en.json` (sửa):

```json
"function.inv_supplier_cat": "Suppliers",
```

### 2.2. Entity — `Core.Domain/Modules/Inventory/Categories/suppliers/Supplier.cs` (thêm mới)

> **Giải thích.** Entity là bản "C#" của bảng. Tên bảng và tên cột khai báo bằng `[Table]` và `[Column]`; `[MaxLength]` phải **bằng độ dài trong SQL** (khác thì lưu lỗi hoặc bị cắt chữ). `[Key]` đánh dấu khóa chính. `[Audited(...)]` bật nhật ký tự động cho bảng này; `Label` là chữ hiện ở cột "Đối tượng" của màn nhật ký (`{Code} - {Name}` được thay bằng giá trị của bản ghi). `ErpEntity` cho sẵn bốn cột dấu vết và `Version`; `ICatalogRecord` báo cho lớp `CatalogService` rằng entity có `Code`, `IsActive`, `SortOrder`.

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>Nhà cung cấp. Goods receipts link to it by code.</summary>
[Audited("inv_supplier_cat", "supplier", Label = "{Code} - {Name}")]
[Table("erp_supplier")]
public class Supplier : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [NotReference("mã số thuế, không phải mã danh mục")]
    [Column("tax_code"), MaxLength(30)] public string? TaxCode { get; set; }
    [Column("phone"), MaxLength(30)] public string? Phone { get; set; }
    [Column("address"), MaxLength(300)] public string? Address { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
```

Bắt buộc (thiếu là test báo đỏ):

| Khai báo | Có tác dụng gì |
| --- | --- |
| `: ErpEntity` | 4 cột người tạo / người sửa (`CoreContext` tự điền, **không gán tay**) và `Version` (chống ghi đè, ánh xạ vào `xmin`) |
| `, ICatalogRecord` | Báo cho lớp `CatalogService` biết entity có `Code` (khóa), `IsActive`, `SortOrder`; cần đúng ba property này |
| `[Audited("mã chức năng", "loại đối tượng", Label = ...)]` | Mọi thêm / sửa / xóa tự ghi vào Nhật ký thay đổi: ai, lúc nào, trường nào trước → sau. `Label` là chữ hiện ở cột "Đối tượng", dùng tên property trong `{}`. Bảng không cần nhật ký thì ghi `[NotAudited("lý do")]` |
| `[References<T>]` hoặc `[NotReference("lý do")]` trên **mỗi** cột tên `*_code` (trừ khóa `code`) | Cột trỏ sang danh mục `T` thì khung tự chặn xóa dòng của `T` khi cột này còn dùng mã và kiểm mã tồn tại khi lưu; cột `*_code` không phải tham chiếu (mã số thuế, mã chức năng...) phải ghi lý do. Thiếu thì test `TableReferenceTests` báo đỏ. Chi tiết: `docs/tham-chieu-danh-muc.md` |

Tùy chọn:

| Khai báo | Khi nào dùng |
| --- | --- |
| `[AuditIgnore]` trên property | Cột không được ghi nhật ký (mật khẩu, token, cột kỹ thuật) |
| `[AuditField("tên")]` | Đặt tên trường dễ đọc cho cột tên xấu |
| `[AuditJson]` | Cột chứa JSON: ghi từng khóa thay đổi |
| `SoftDelete = nameof(Cột)` trong `[Audited]` | Danh mục xóa mềm: cờ về 0 / false thì ghi là "Xóa" |
| `[AuditedChild]` | Bảng dòng con (danh sách chi tiết) ghi chung vào nhật ký của bản ghi cha |
| `[References<T>(Optional = true)]` | Cột trỏ danh mục được phép để trống (giá trị khác rỗng vẫn được kiểm tra) |
| `[References<T>(BlocksDelete = false)]` | Bảng dòng con tự xóa cùng dòng cha (bản dịch): không coi là "đang dùng" |

### 2.3. Đăng ký bảng — `Core.Infrastructure/Common/Persistence/CoreContext.cs` (sửa)

> **Giải thích.** `DbSet` cho Entity Framework biết có bảng này để đọc ghi. Không cần cấu hình thêm gì khác.

```csharp
    // Inventory
    public DbSet<Uom> Uoms => Set<Uom>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
```

Chỉ cần dòng `DbSet`. Ánh xạ `xmin`, cột người tạo / sửa và nhật ký đã có sẵn cho mọi entity.

### 2.4. Contract — `Core.Application/Modules/Inventory/Categories/suppliers/SupplierContracts.cs` (thêm mới)

> **Giải thích.** Có ba thứ tách biệt: **DTO** là gói dữ liệu trả ra màn hình (có `Stamp` = người tạo / sửa và `Version`); **request** là gói màn hình gửi lên khi thêm hoặc sửa (có `Version` để chống ghi đè); **interface** là danh sách việc service làm được. Danh mục không phải khai báo phương thức nào vì mọi việc chung (danh sách, xuất Excel, thêm, sửa, xóa, nhập Excel, xóa nhiều) đã có trong `ICatalogService`.

```csharp
using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

/// <summary>Stamp = người tạo / người sửa và thời điểm; Version = phiên bản bản ghi (tự có cho mọi bảng erp_*).</summary>
public sealed record SupplierDto(string Code, string Name, string? TaxCode, string? Phone, string? Address,
    string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

/// <summary>Version: phiên bản lúc màn hình tải bản ghi (chống ghi đè khi 2 người cùng sửa).</summary>
public sealed record SaveSupplierRequest(string Code, string Name, string? TaxCode, string? Phone, string? Address,
    string? Note, bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>Danh sách, xuất Excel, tạo, sửa, xóa, nhập Excel, xóa nhiều đều có sẵn từ ICatalogService.</summary>
public interface ISupplierService : ICatalogService<SupplierDto, SaveSupplierRequest>;
```

- DTO có `RecordStampDto Stamp` và `uint Version`; request có `uint? Version = null` và `: ICatalogRequest` (cần property `Code` và `Version` đúng tên). Thiếu thì `ConcurrencyContractTests` hoặc trình biên dịch báo đỏ.
- Tên property PascalCase; JSON trả về tự thành camelCase (`taxCode`, `isActive`, `stamp`, `version`), khớp kiểu ở frontend (3.4).
- Interface của danh mục **chỉ kế thừa** `ICatalogService`. Chỉ thêm phương thức khi danh mục có thao tác riêng.
- **Không có API "lấy hết danh sách"**: mọi danh sách phân trang ở máy chủ (`ListAsync`). Tham số danh sách là `CatalogListQuery` có sẵn (`Page`, `PageSize` tối đa 200, `Sort`, `Dir`, `Search`, `Status`). Màn khác chọn mã bằng tra cứu (Phần 4).
- Bộ lọc riêng của danh mục (ngoài trạng thái) **không cần record query mới**: mọi tham số URL còn lại (`?hasTaxCode=yes`) đi vào `query.Filters`, và service đọc chúng trong `ApplyFilters` (§2.5).

### 2.5. Service — `Core.Infrastructure/Modules/Inventory/Categories/suppliers/SupplierService.cs` (thêm mới)

> **Giải thích: một yêu cầu đi qua service như thế nào.**
>
> ```
> Màn hình ─► Controller (kiểm quyền) ─► CatalogService (lớp nền) ─► CoreContext ─► PostgreSQL
>                                          ├─ CreateAsync: kiểm tra mã ─► ApplyAsync (BẠN) ─► lưu
>                                          ├─ UpdateAsync: tìm bản ghi ─► kiểm tra phiên bản ─► ApplyAsync (BẠN) ─► lưu
>                                          ├─ ListAsync:   ApplyFilters + Search (BẠN) ─► Sorts (BẠN) ─► cắt trang ─► MapAsync (BẠN)
>                                          └─ ExportAsync: cùng bộ lọc như ListAsync nhưng mọi dòng ─► ExportColumns (BẠN)
> ```
>
> Chỗ có chữ **BẠN** là phần bạn khai báo, còn lại lớp nền lo. Mỗi thành viên bạn khai báo có một việc rõ ràng:
>
> | Thành viên | Việc | Quên hoặc sai thì |
> | --- | --- | --- |
> | `Spec` | Cho lớp nền biết mã chức năng, loại đối tượng (`supplier`), nhãn mã, độ dài mã, tên file xuất | Thông báo lỗi hoặc tên file sai; `CatalogFrameworkTests` báo đỏ khi thiếu khóa thông báo |
> | `Sorts` | Các cột người dùng được bấm để sắp xếp (danh sách trắng) | Bấm cột nào không có ở đây thì báo "Cột sắp xếp không hợp lệ" |
> | `Search` | Ô tìm kiếm tìm trong những trường nào | Ô tìm kiếm không tìm thấy trường đó |
> | `ApplyFilters` | Bộ lọc riêng ngoài trạng thái | Bộ lọc ở màn hình không có tác dụng |
> | `ExportColumns` | Các cột của file Excel xuất | File xuất thiếu cột |
> | `WithoutVersion` | Dòng nhập Excel không có phiên bản | Biên dịch báo thiếu |
> | `MapAsync` | Đổi dòng trong database thành DTO gửi màn hình | Màn hình thiếu dữ liệu |
> | `ApplyAsync` | Kiểm tra dữ liệu người dùng nhập và chép vào bản ghi | Lưu dữ liệu sai, không báo lỗi |
>
> Tìm kiếm luôn dùng `SearchFunctions.Matches(cột, pattern)`: không phân biệt hoa thường **và dấu** (gõ `thung` ra "Thùng"). Không dùng `EF.Functions.ILike` trực tiếp; test sẽ báo đỏ.

Kế thừa `CatalogService` và chỉ khai báo phần riêng của danh mục. Mẫu: `UomService.cs` (có thêm bản dịch) và `UomConversionService.cs` (đơn giản hơn, có tên đơn vị ghép vào danh sách).

```csharp
using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Danh mục nhà cung cấp. Changes are logged automatically ([Audited]).</summary>
public sealed class SupplierService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Supplier, SupplierDto, SaveSupplierRequest>(db, batch, excel, audit), ISupplierService
{
    // Function, loại đối tượng, nhãn của mã (field.*), độ dài mã, tên file xuất.
    private static readonly CatalogSpec Info = new("inv_supplier_cat", "supplier", "field.supplierCode", 20, "DanhMucNhaCungCap");

    // Cột được phép sắp xếp (danh sách trắng). Tên = sortKey / key của cột lưới ở frontend; "order" là thứ tự mặc định.
    private static readonly SortMap<Supplier> SortColumns = SortMap<Supplier>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("taxCode", x => x.TaxCode)
        .Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Supplier> Sorts => SortColumns;

    // Ô tìm kiếm khớp những trường nào. Dùng SearchFunctions.Matches (không phân biệt hoa thường VÀ dấu: gõ "thung" ra "Thùng"),
    // không dùng EF.Functions.ILike trực tiếp (test AccentInsensitiveSearchContractTests báo đỏ). pattern đã thoát ký tự đặc biệt.
    protected override IQueryable<Supplier> Search(IQueryable<Supplier> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.TaxCode, pattern) || SearchFunctions.Matches(x.Phone, pattern));

    // Bộ lọc riêng của danh mục: tham số URL ngoài page, pageSize, sort, dir, search, status (ví dụ ?hasTaxCode=yes).
    // Chỉ đọc những khóa mình biết, khóa lạ bỏ qua. Dùng cho cả danh sách lẫn xuất Excel.
    protected override IQueryable<Supplier> ApplyFilters(IQueryable<Supplier> rows, IReadOnlyDictionary<string, string> filters) =>
        filters.TryGetValue("hasTaxCode", out var value)
            ? rows.Where(x => (x.TaxCode != null && x.TaxCode != "") == (value == "yes"))
            : rows;

    // Cột file Excel xuất: tiêu đề là khóa export.supplier.* (vi trùng tiêu đề file nhập để xuất xong sửa rồi nhập lại).
    protected override IReadOnlyList<ExportColumn<Supplier>> ExportColumns() =>
    [
        new("export.supplier.code", x => x.Code), new("export.supplier.name", x => x.Name),
        new("export.supplier.taxCode", x => x.TaxCode), new("export.supplier.isActive", x => YesNo(x.IsActive))
    ];

    // Dòng nhập Excel không có phiên bản.
    protected override SaveSupplierRequest WithoutVersion(SaveSupplierRequest request) => request with { Version = null };

    // Entity -> DTO. Cần dữ liệu liên quan (tên, bản dịch) thì đọc một lần cho cả danh sách, đừng đọc từng dòng.
    protected override Task<IReadOnlyList<SupplierDto>> MapAsync(IReadOnlyList<Supplier> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<SupplierDto>>(rows.Select(x => new SupplierDto(x.Code, x.Name, x.TaxCode, x.Phone,
            x.Address, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    // Kiểm tra rồi chép request vào entity. Mã (Code) và SortOrder đã do lớp nền xử lý.
    protected override async Task ApplyAsync(Supplier row, SaveSupplierRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.supplierName");
        if (await Db.Suppliers.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("supplier.nameExists", name);
        row.Name = name;
        row.TaxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
        row.Phone = Guard.Optional(request.Phone, 30, "field.phone");
        row.Address = Guard.Optional(request.Address, 300, "field.address");
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    // Chặn xóa khi dữ liệu khác đang dùng KHÔNG cần viết ở đây: bảng nào có cột [References<Supplier>]
    // (ví dụ erp_goods_receipt.supplier_code) thì khung tự từ chối xóa, kèm tên bảng và số dòng.
    // BeforeDeleteAsync chỉ để xóa dòng con hoặc thêm điều kiện mà tham chiếu không diễn đạt được.
}
```

**Lớp nền đã làm** (không viết lại):

| Việc | Cách làm |
| --- | --- |
| Danh sách | Lọc theo ô tìm kiếm (`Search`) và trạng thái `active` / `inactive`, sắp xếp theo `SortMap` (cột lạ → lỗi 400), cắt trang tối đa 200 dòng, đọc người tạo / sửa một lần (`RecordStamps`) |
| Xuất Excel | Cùng bộ lọc với danh sách nhưng mọi dòng (tối đa `PagingLimits.MaxExportRows`), ghi dòng nhật ký `EXPORT` |
| Tạo | `Guard.Code` cho mã, báo trùng mã (`<loai>.codeExists`), gán `SortOrder`, gọi `ApplyAsync` rồi `AfterApplyAsync`, kiểm các cột `[References]` có mã thật (`ref.notFound`) |
| Sửa | Tìm bản ghi (`<loai>.notFound`), `ExpectVersion` (409 khi có người sửa trước), `ApplyAsync`, `AfterApplyAsync`, kiểm các cột `[References]` đã đổi |
| Xóa | Tìm bản ghi, **từ chối nếu bảng nào có cột `[References<TEntity>]` còn dùng mã này** (`record.inUse`, nêu tên bảng và số dòng), gọi `BeforeDeleteAsync`, xóa |
| Nhập Excel / xóa nhiều | `CatalogBatch`: mỗi dòng đi qua đúng `CreateAsync` / `UpdateAsync` / `DeleteAsync` ở trên, tất cả hoặc không dòng nào |

**Điểm móc tùy chọn** (ghi đè khi cần):

| Móc | Dùng khi |
| --- | --- |
| `AfterApplyAsync(row, request, isNew, ct)` | Có bảng dòng con, ví dụ bản dịch (xem `UomService`) |
| `NormalizeCode(code)` / `KeyText(code)` | Mã không viết hoa như thường lệ (mã ngôn ngữ là chữ thường: `vi`, `zh-cn`): ghi đè để chuẩn hóa mã khi tạo (`NormalizeCode`, ném lỗi nếu sai) và mã gõ trong URL hay file Excel (`KeyText`, không ném lỗi). Xem `LanguageService` |
| `SaveAsync(ct)` | Việc phải làm cùng giao dịch với lưu, ví dụ bỏ chọn dòng "mặc định" cũ trước khi lưu dòng mới, hoặc chép tên mới sang bảng khác. Bọc trong `IUnitOfWork.ExecuteAsync`. Xem `CurrencyService` (đồng tiền hạch toán), `LanguageService` (mặc định), `DepartmentService` (đổi tên chép sang người dùng) |
| `BeforeExportAsync(rows, ct)` | Cột xuất Excel cần dữ liệu ngoài entity (danh sách dòng con, tên): đọc một lần cho cả các dòng sắp xuất vào một trường của service rồi để `ExportColumns` lấy ra (xem `WarehouseService`: đơn vị cơ sở sử dụng) |
| `BeforeDeleteAsync(row, ct)` | Xóa kèm dòng con (bản dịch) hoặc chặn thêm điều khiển mà tham chiếu không diễn đạt được. **Không** cần viết kiểm tra "đang dùng" cho bảng đã khai `[References]` |
| `ApplyFilters(rows, filters)` | Có bộ lọc riêng ngoài trạng thái. Khóa của `filters` là tên tham số URL, giá trị đã cắt khoảng trắng, đã bỏ giá trị rỗng. Luôn so sánh bằng tham số của EF (`x.Cột == value`), không ghép chuỗi SQL |

Quy tắc:
- Dùng `Db` (property của lớp nền), không đưa tham số `db` của hàm tạo vào trường của lớp con.
- Không gán `CreatedAt/CreatedBy/UpdatedAt/UpdatedBy` hay `Version`, không tự ghi nhật ký thay đổi, không tự xóa cache: `CoreContext` làm hết.
- `throw new BusinessRuleException("khóa", tham số)`: khóa thông báo, không viết câu.
- Danh sách không có bộ nhớ đệm (mỗi trang khác nhau); bộ nhớ đệm nằm ở tra cứu (§2.6).

### 2.6. Đăng ký service và tra cứu — `Core.Infrastructure/DependencyInjection.cs` (sửa)

> **Giải thích.** Có hai việc khác nhau. **Đăng ký service** nối `ISupplierService` với `SupplierService` để hệ thống biết dùng lớp nào. **Đăng ký tra cứu** cho các màn khác (phiếu nhập, báo cáo...) một ô chọn nhà cung cấp nhẹ, chỉ lấy mã, tên và vài cột; ô này **không đòi quyền xem danh mục**, nên người lập phiếu chọn được nhà cung cấp mà không xem được cả danh mục. Dữ liệu tra cứu được giữ trong bộ nhớ và tự làm mới khi bảng đổi, nên danh sách bảng khai ở đây phải **đủ**.

```csharp
services.AddScoped<IUomService, UomService>();
services.AddScoped<ISupplierService, SupplierService>();
```

**Tra cứu** (ô chọn mã + F2 ở màn khác). Thêm một mục vào danh sách `LookupCatalogs.All` trong `Core.Infrastructure/Common/Lookups/LookupCatalogs.cs`, cạnh mục `"uoms"` (không còn đăng ký trong `DependencyInjection.cs`):

```csharp
new LookupDefinition("suppliers", db => db.Suppliers.Select(x =>
    new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.TaxCode, Extra2 = x.Phone }),
    ["erp_supplier"], "taxCode", "phone"),
```

- `"suppliers"` là tên tra cứu, dùng ở URL và ở `CatalogLookup lookup="suppliers"`.
- `["erp_supplier"]` là **các bảng mà phép chiếu đọc** (kể cả bảng bản dịch nếu tên có dịch). Tra cứu được **giữ trong bộ nhớ đệm** (mỗi tra cứu và ngôn ngữ một bản, tìm và chia trang ngay trong bộ nhớ, tối đa 5000 dòng; lớn hơn thì không đệm và tìm trong database). Bản đệm tự bị xóa khi một trong các bảng này bị ghi (lưu, nhập Excel, xóa ở màn danh mục). Khai thiếu bảng thì tra cứu hiện dữ liệu cũ: test `EveryLookupNamesEveryTableItReads` báo đỏ khi thiếu.
- `Extra1..3`: tối đa 3 cột phụ hiện trong hộp tra cứu; các chuỗi cuối (`"taxCode"`, `"phone"`) là tên của chúng trong kết quả (`extra.taxCode`).
- Phép chiếu `Select` được dịch thành SQL, nên chỉ dùng cột của bảng, không gọi hàm C#.

Cần tra cứu phức tạp hơn (nhiều bảng, cột có kiểu, tham số, kiểm quyền) thì viết `LookupProvider` (§4.3) thay vì mục này. Không phải viết controller cho tra cứu. API chung `Core/Modules/Lookups/LookupsController.cs` có sẵn, mở cho **mọi người đã đăng nhập**:

| API | Trả về |
| --- | --- |
| `GET /api/lookups/suppliers?q=abc&page=1&pageSize=20&includeInactive=false` | `{ items: [{ code, name, isActive, extra: { taxCode, phone } }], total }`. Tìm một phần chữ trong mã hoặc tên, không phân biệt hoa thường; mã trùng khớp đứng đầu, rồi mã bắt đầu bằng chữ tìm; mặc định bỏ bản ghi ngừng dùng |
| `GET /api/lookups/suppliers/codes?codes=NCC001,NCC002` | Các bản ghi theo danh sách mã (để hiện tên cạnh mã đã lưu) |

### 2.7. Controller — `Core/Modules/Inventory/Categories/suppliers/SuppliersController.cs` (thêm mới)

> **Giải thích.** Controller là cổng vào API. Với danh mục, mọi API đã viết sẵn trong `CatalogControllerBase`; bạn chỉ khai báo địa chỉ (`[Route]`) và mã chức năng (`[CatalogFunction]`). Mã chức năng quyết định quyền: người dùng phải có quyền tương ứng của **chức năng đó** mới gọi được API (xem bảng quyền bên dưới).

```csharp
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục nhà cung cấp. The endpoints come from CatalogControllerBase; other screens pick suppliers with the
/// lookup (GET /api/lookups/suppliers).</summary>
[Route("api/inventory/suppliers")]
[CatalogFunction("inv_supplier_cat")]
public sealed class SuppliersController(ISupplierService suppliers, IPermissionService permissions)
    : CatalogControllerBase<SupplierDto, SaveSupplierRequest>(suppliers, permissions);
```

Chỉ có vậy. `CatalogControllerBase` đã có sẵn 7 API, mỗi API gắn đúng quyền của mã chức năng trong `[CatalogFunction]`:

| API | Quyền cần |
| --- | --- |
| `GET api/inventory/suppliers?page=&pageSize=&sort=&dir=&search=&status=` | Xem |
| `GET .../export?sort=&dir=&search=&status=` (Excel mọi dòng khớp bộ lọc) | Xem **và** Xuất |
| `POST ...` (tạo) | Thêm |
| `PUT .../{code}` (sửa) | Sửa |
| `POST .../import` (nhập Excel) | Thêm (chế độ `upsert` thêm quyền Sửa) |
| `POST .../delete-many`, `DELETE .../{code}` | Xóa |

- Không viết `[RequirePermission]`: bộ lọc `CatalogPermissionFilter` đọc `[CatalogFunction]` của controller và `[CatalogRight]` của từng API. API thiếu mã chức năng hoặc thiếu quyền bị từ chối (403), không để mở.
- Chỉ cần thêm API riêng (ngoài 7 API trên) thì khai báo trong controller con, tự gắn `[RequirePermission("<mã>", PermissionAction.X)]` như các controller khác.
- Test `CatalogFrameworkTests` và `CatalogPermissionFilterTests` kiểm tra mã chức năng có thật, route có, và từng API đòi đúng quyền.
- Màn khác **không** gọi các API này để chọn mã (cần quyền Xem danh mục); dùng tra cứu `GET /api/lookups/suppliers` (Phần 4).

### 2.8. Thông báo lỗi — `Core.Application/Common/Localization/Messages.vi.json` và `Messages.en.json` (sửa cả hai)

> **Giải thích.** Mọi chữ hiển thị cho người dùng nằm trong file thông báo, không viết thẳng vào code. Code chỉ ném ra một **khóa** (`supplier.codeExists`) kèm tham số, và hệ thống đổi sang chữ theo ngôn ngữ của người dùng. Nhờ vậy cùng một lỗi hiện tiếng Việt hay tiếng Anh tùy người dùng. Phải thêm đủ **cả hai file** (vi và en), nếu thiếu thì test `MessagesTests` báo đỏ.

> **Xuất Excel cũng cần chữ theo ngôn ngữ**: thêm `export.<loai>.sheet` (tên sheet) và `export.<loai>.<cot>` cho mỗi cột xuất, ở cả hai file. Chữ bản **vi trùng đúng** tiêu đề trong `excel.columns` ở frontend (`<loai>.code`, `<loai>.name`...) để file xuất sửa xong nhập lại được. Các khóa dùng chung có sẵn: `export.yes`, `export.no`, `export.tooMany`, `paging.sortInvalid`.

```json
"field.supplierCode": "mã nhà cung cấp",
"field.supplierName": "tên nhà cung cấp",
"supplier.notFound": "Nhà cung cấp không tồn tại.",
"supplier.codeExists": "Mã nhà cung cấp {0} đã tồn tại.",
"supplier.nameExists": "Tên nhà cung cấp \"{0}\" đã tồn tại.",
"dbfield.tax_code": "Mã số thuế",
"export.supplier.sheet": "Danh mục nhà cung cấp",
"export.supplier.code": "Mã nhà cung cấp",
"export.supplier.name": "Tên nhà cung cấp",
"export.supplier.taxCode": "Mã số thuế",
"export.supplier.isActive": "Đang sử dụng"
```

- Bản tiếng Anh thêm đúng các khóa đó (`"supplier.notFound": "The supplier does not exist."`...).
- `{0}`, `{1}` là tham số truyền vào `BusinessRuleException`.
- Khóa có sẵn thì dùng lại, không thêm trùng: `field.phone`, `field.address`, `field.taxCode`, `field.note`... (tìm trong file trước khi thêm).
- `dbfield.*` chỉ cần cho cột có unique index mà chưa có khóa; cột `[References]` cũng dùng `dbfield.<cột>` làm tên trường trong thông báo `ref.notFound`.
- Danh mục mới **được** các bảng khác trỏ tới thì mỗi bảng đó cần nhãn `table.<tên bảng>` ở cả hai file (ví dụ `"table.erp_goods_receipt": "Phiếu nhập kho"`) để thông báo "đang được dùng ở: Phiếu nhập kho (12)" nêu đúng tên. `TableReferenceTests` báo đỏ khi thiếu.
- Thông báo chặn xóa `record.inUse` và `ref.notFound` dùng chung, không viết `<loai>.inUse` riêng.
- `MessagesTests` báo đỏ khi một khóa thiếu ở một trong hai file, hoặc `throw` chứa câu tiếng Việt.
- Lớp nền `CatalogService` dùng các khóa theo loại đối tượng `<loai>` của `CatalogSpec`: **`<loai>.notFound`, `<loai>.codeExists`, `export.<loai>.sheet`** và nhãn mã (`field.<...>Code`) bắt buộc phải có ở cả hai file; `CatalogFrameworkTests` báo đỏ khi thiếu.

### 2.9. Quyền đặc biệt (chỉ khi cần) — `Core.Application/Common/Permissions/SpecialRightCatalog.cs`

Ví dụ "xem giá", "sửa phiếu đã duyệt". Mã dạng `{chức năng}:{MÃ}` (`inv_supplier_cat:VIEW_DEBT`), kiểm tra bằng `[RequireRight(...)]` ở controller và `hasRight(...)` ở frontend. Danh mục thường không cần.

### 2.10. Mốc 1: thử backend trước khi làm frontend

Làm xong Phần 1 và Phần 2 thì thử ngay, chưa cần màn hình.

**Bước 1: build và test.** Dừng backend nếu đang chạy, rồi:

```powershell
cd ServerService
dotnet build Core.sln
dotnet test tests/Core.Tests/Core.Tests.csproj
```

Phải ra `0 Error(s)` và `Passed!`. Test đỏ thì đọc thông báo: thường nói rõ thiếu gì (thiếu khóa thông báo, thiếu `[CatalogFunction]`, quên `Messages.en.json`...).

**Bước 2: chạy script SQL (nếu chưa) và chạy backend** ở Development (`dotnet run --project Core/Core.csproj --urls http://localhost:2512`, nhớ đặt `ASPNETCORE_ENVIRONMENT=Development`, hoặc F5 trong Visual Studio).

**Bước 3: thử bằng Swagger.** Mở `http://localhost:2512/swagger`:

1. Mở `POST /api/auth/login`, **Try it out**, nhập `{"username":"admin","password":"<mật khẩu admin>","unitCode":"DVCS01"}`, **Execute**. Sao chép giá trị `token` trong kết quả.
2. Bấm **Authorize** (ổ khóa ở góc trên), dán token (không cần chữ `Bearer`), **Authorize**.
3. Thử lần lượt các API của danh mục (mô tả mỗi API ghi sẵn quyền cần có):

| Thử | Kết quả đúng |
| --- | --- |
| `GET /api/inventory/suppliers` | Có `items`, `total`, `page`, `pageSize` |
| `POST` thêm một nhà cung cấp | 200, kết quả có `stamp` (người tạo) và `version` |
| `POST` lần nữa cùng mã | 400, thông báo "Mã nhà cung cấp ... đã tồn tại." |
| `GET ?search=<chữ không dấu>` | Tìm được bản ghi có dấu |
| `GET ?sort=<tên cột không có trong Sorts>` | 400 "Cột sắp xếp không hợp lệ" |
| `PUT /{code}` với `version` cũ | 409 "Dữ liệu này vừa được người khác thay đổi" |
| `GET /export` | Tải được file `.xlsx` |
| `GET /api/lookups/suppliers?q=...` | Thấy bản ghi vừa thêm |
| `DELETE /{code}` | 204, bản ghi mất |

Cùng việc đó bằng PowerShell nếu bạn thích gõ lệnh:

```powershell
$login = '{"username":"admin","password":"<mật khẩu admin>","unitCode":"DVCS01"}'
$token = (Invoke-RestMethod -Method Post http://localhost:2512/api/auth/login -ContentType 'application/json' -Body $login).token
$h = @{ Authorization = "Bearer $token" }

# danh sách
Invoke-RestMethod "http://localhost:2512/api/inventory/suppliers?page=1&pageSize=5" -Headers $h

# thêm (gửi UTF-8 để tiếng Việt không bị lỗi chữ)
$json = '{"code":"NCC009","name":"Công ty Thử Nghiệm","isActive":true}'
Invoke-RestMethod -Method Post http://localhost:2512/api/inventory/suppliers -Headers $h `
  -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
```

> Gõ tiếng Việt thẳng trong dòng lệnh Windows có thể bị hỏng bảng mã (tên hiện thành `??`). Gửi bằng `[Text.Encoding]::UTF8.GetBytes(...)` như trên, hoặc dùng Swagger.

**Bước 4: thử tra cứu** bằng `GET /api/lookups/suppliers?q=...` (kể cả khi tài khoản không có quyền xem danh mục).

Backend ổn thì sang Phần 3. Chưa ổn thì xem bảng lỗi §7.3 trước khi làm tiếp: lỗi ở backend mà đi tiếp thì frontend sẽ báo lỗi khó hiểu hơn.

---

## Phần 3. Frontend (`Frontend/src/`)

### 3.1. Mã chức năng — `types/index.ts` (sửa)

> **Giải thích.** `SubMenuKey` là danh sách mọi mã chức năng mà frontend biết. Thêm mã vào đây để trình biên dịch (TypeScript) giúp bạn: chỗ nào dùng mã mà chưa khai báo thì `npm run lint` báo lỗi.

Thêm vào kiểu `SubMenuKey`:

```ts
  | 'inv_supplier_cat'          // Danh mục nhà cung cấp
```

### 3.2. Đăng ký chức năng — `config/functions.ts` (sửa)

> **Giải thích.** `FUNCTION_REGISTRY` gom thông tin của mỗi chức năng một lần: thuộc phân hệ nào, đường dẫn (`#/inventory/suppliers`), tên ngắn, và là danh mục hay loại khác. Từ đây hệ thống tự suy ra đường dẫn, tiêu đề, breadcrumb và dòng trong ma trận phân quyền. Tên menu theo ngôn ngữ nằm ở `locales/*/common.json`, mục `navigation.subMenus`.

```ts
  inv_supplier_cat: fn('inventory', '/inventory/suppliers', 'Nhà cung cấp', 'catalog'),
```

Tham số: phân hệ, đường dẫn, tên, loại (`'catalog'` cho danh mục). Từ dòng này hệ thống tự có route, tiêu đề, breadcrumb và dòng trong ma trận phân quyền. Thiếu dòng này thì `npm run lint` báo lỗi (`FUNCTION_REGISTRY` có kiểu `Record<SubMenuKey, …>`).

Tên tiếng Anh — `locales/en/common.json` (sửa), mục `function`:

```json
"inv_supplier_cat": "Suppliers"
```

Tên trên menu / tab theo ngôn ngữ — `locales/vi/common.json` và `locales/en/common.json` (sửa cả hai), mục `navigation.subMenus` (cạnh `inv_uom_cat`):

```json
"inv_supplier_cat": "Danh mục nhà cung cấp"
```

### 3.3. Mục menu — `ServerService/Core/SeedData/menu.json` (sửa)

> **Giải thích.** Menu bên trái được lưu trong database (`sys_command`, tên theo ngôn ngữ ở `sys_command_translation`) và frontend lấy qua `GET /api/menu`. `menu.json` là danh sách khai báo: mỗi lần backend khởi động, nút nào trong file mà database chưa có thì được **thêm tự động** (kể cả database cũ). Nút đã có thì không bị ghi đè, nên sửa tên, icon, thứ tự trong database vẫn được giữ. Vì vậy bạn **không viết SQL cho menu**. Mục menu chỉ hiện với người có quyền **Xem** chức năng.

Thêm vào mảng `items` của nhóm danh mục thuộc phân hệ (copy nút `MNU_INV_UOM`):

```json
{
  "id": "MNU_INV_SUPPLIER",
  "subKey": "inv_supplier_cat",
  "titleVi": "Danh mục nhà cung cấp",
  "titleEn": "Suppliers",
  "icon": "Truck",
  "orderNo": 55,
  "isActive": true
}
```

- `subKey` phải đúng mã chức năng (bước 2.1 và 3.1); `id` không được trùng nút nào khác.
- `icon` là tên icon của lucide-react. Icon chưa dùng ở đâu thì thêm tên đó vào **cả hai chỗ** trong `components/common/DynamicIcon.tsx` (dòng `import` và bảng tên icon); không thêm thì menu hiện icon mặc định.
- `orderNo` quyết định thứ tự trong nhóm (số nhỏ đứng trước), không nên trùng với nút cùng nhóm.
- Test `MenuSeedFileTests` báo đỏ khi mã chức năng không có trong `menu.json`, hoặc nút trong `menu.json` không có trong `FunctionCatalog`, hoặc `id` trùng.
- Sau khi khởi động lại backend, log ghi "Đã thêm N mục menu còn thiếu từ menu.json". Sửa nút đã có thì sửa trong database (hoặc màn Quản lý menu); sửa `menu.json` không đổi được nút đã tồn tại.

### 3.4. Thư mục chức năng — `modules/inventory/categories/suppliers/` (thêm mới, copy từ `modules/inventory/categories/uom/`)

> **Giải thích.** Mỗi danh mục có bốn file nhỏ trong một thư mục:
>
> | File | Việc |
> | --- | --- |
> | `types.ts` | Kiểu dữ liệu của danh mục, **khớp DTO và request của backend** (đổi `TaxCode` thành `taxCode`, chữ thường đầu) |
> | `api.ts` | Ba dòng khai báo địa chỉ API (`createCatalogApi`); mọi việc gọi API đã có sẵn |
> | `<Ten>CategoryView.tsx` | **Khai báo** màn hình: các cột, form nhập, cột Excel, bộ lọc (không viết logic). Khung `CatalogScreen` lo phần còn lại |
> | `index.ts` | Xuất khẩu hai file trên để màn khác import |
>
> Đường dẫn `../../../../components/...` có **bốn** `../` vì thư mục nằm sâu bốn cấp dưới `src/` (`modules/inventory/categories/suppliers/`). Đặt sai độ sâu thì `npm run lint` báo "Cannot find module".

#### `types.ts`

Khớp với DTO và request của backend (2.4), tên trường camelCase.

```ts
import type { RecordStamp } from '../../../../components/common/RecordStamp';

/** A supplier from the backend catalog (erp_supplier); the code is the key. */
export interface Supplier {
  code: string;
  name: string;
  taxCode?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  isActive: boolean;
  /** Who created / last changed it and when (filled by the backend). */
  stamp: RecordStamp;
  /** Row version; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version: number;
}

export interface SaveSupplierInput {
  code: string;
  name: string;
  taxCode: string;
  phone: string;
  address: string;
  note: string;
  isActive: boolean;
  version?: number;
}
```

- `Supplier` là bản ghi đọc về; `SaveSupplierInput` là dữ liệu của form, của mỗi dòng Excel và body gửi lên.
- Trường của input dùng chuỗi rỗng thay vì `null` để ô nhập dễ xử lý; backend `Guard.Optional` đổi chuỗi rỗng thành `null`.
- Giữ `isActive` nếu danh mục có trạng thái: `CatalogScreen` tự thêm bộ lọc **Trạng thái**.

#### `api.ts`

Ba dòng, dùng `createCatalogApi` (đã có đủ danh sách phân trang, xuất Excel, tạo, sửa, xóa, nhập Excel, xóa nhiều; mọi lệnh gọi đi qua `apiRequest` / `apiDownload`, **không gọi `fetch` trực tiếp**):

```ts
// Kho › Danh mục nhà cung cấp (backend /api/inventory/suppliers, function inv_supplier_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveSupplierInput, Supplier } from './types';

export const suppliersApi = createCatalogApi<Supplier, SaveSupplierInput>({
  url: '/api/inventory/suppliers', fileName: 'DanhMucNhaCungCap'
});
```

`fileName` là tên gốc của file Excel xuất (thêm ngày và `.xlsx`). Không có `importMany` / `removeMany` thì màn ẩn nút Nhập Excel và ô chọn nhiều dòng; `createCatalogApi` luôn có cả hai.

**Phân trang dùng chung:** `CatalogScreen` tự lo trang, số dòng mỗi trang (tối đa 200, nhớ theo từng người), sắp xếp (gửi `sortKey` hoặc `key` của cột, phải có trong `SortMap` ở backend), ô tìm kiếm (chờ 300 ms rồi hỏi máy chủ), bộ lọc (khóa của `filters` là tên tham số gửi lên; bộ lọc Trạng thái gửi `status=active|inactive`) và nút **Xuất Excel** (gọi `exportAll`, máy chủ xuất mọi dòng khớp bộ lọc và ghi nhật ký). `getAll` chỉ còn cho các màn cũ chưa chuyển.

#### `SupplierCategoryView.tsx`

Màn danh mục chỉ **khai báo** một `CatalogDefinition` rồi giao cho `CatalogScreen`. Không tự viết thanh công cụ, tìm kiếm, lọc, Excel, xóa nhiều, hộp xác nhận hay kiểm tra quyền.

```tsx
// Kho › Danh mục nhà cung cấp (inv_supplier_cat), backed by the API (erp_supplier). See docs/them-danh-muc.md.
import React, { useMemo } from 'react';
import { Truck } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { UserProfile } from '../../../../types';
import { suppliersApi } from './api';
import { SaveSupplierInput, Supplier } from './types';

export const SupplierCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();

  const definition = useMemo((): CatalogDefinition<Supplier, SaveSupplierInput> => ({
    functionCode: 'inv_supplier_cat',
    api: suppliersApi,
    keyOf: s => s.code,
    describe: s => `${s.code} - ${s.name}`,
    icon: <Truck className="h-4 w-4" />,
    texts: {
      title: t('suppliers.title'),
      subtitle: t('suppliers.subtitle'),
      noun: t('suppliers.noun'),
      add: t('suppliers.add'),
      searchPlaceholder: t('suppliers.search'),
      addTitle: t('suppliers.addTitle'),
      editTitle: s => t('suppliers.editTitle', { code: s.code }),
      fileName: 'DanhMucNhaCungCap'
    },
    columns: [
      { key: 'code', header: t('suppliers.code'), width: '120px', sortable: true, render: s => <span className="font-mono font-bold">{s.code}</span> },
      { key: 'name', header: t('suppliers.name'), sortable: true },
      { key: 'taxCode', header: t('suppliers.taxCode'), width: '140px', sortable: true, render: s => s.taxCode || '—' },
      { key: 'phone', header: t('suppliers.phone'), width: '130px', render: s => s.phone || '—' },
      { key: 'address', header: t('suppliers.address'), render: s => s.address || '—' },
      {
        key: 'isActive', header: t('suppliers.status'), align: 'center', width: '140px',
        render: s => s.isActive
          ? <Badge variant="success" size="sm">{t('suppliers.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('suppliers.inactive')}</Badge>
      },
      ...recordStampColumns<Supplier>(t)
    ],
    // Bộ lọc thêm: key là tên tham số gửi lên (?hasTaxCode=yes), service đọc trong ApplyFilters (§2.5).
    // Bộ lọc Trạng thái có sẵn khi bản ghi có isActive. Ô tìm kiếm do `Search` của service lo, không khai báo ở đây.
    filters: [{
      key: 'hasTaxCode', label: t('suppliers.taxCode'),
      options: [{ value: 'yes', label: t('suppliers.hasTaxCode') }, { value: 'no', label: t('suppliers.noTaxCode') }]
    }],
    excel: {
      columns: [
        { key: 'code', header: t('suppliers.code'), required: true, width: 16, example: 'NCC001' },
        { key: 'name', header: t('suppliers.name'), required: true, width: 36, example: 'Công ty TNHH ABC' },
        { key: 'taxCode', header: t('suppliers.taxCode'), width: 16, example: '0101234567' },
        { key: 'phone', header: t('suppliers.phone'), width: 16, example: '0241234567' },
        { key: 'address', header: t('suppliers.address'), width: 40, example: 'Hà Nội' },
        { key: 'note', header: t('suppliers.note'), width: 30 },
        { key: 'isActive', header: t('suppliers.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: s => toInput(s)
    },
    emptyInput: { code: '', name: '', taxCode: '', phone: '', address: '', note: '', isActive: true },
    toInput,
    normalize: x => ({
      ...x, code: x.code.trim().toUpperCase(), name: x.name.trim(),
      taxCode: (x.taxCode ?? '').trim(), phone: (x.phone ?? '').trim(), address: x.address ?? '', note: x.note ?? ''
    }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextInput label={t('suppliers.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20}
            className="font-mono uppercase" value={form.code} hint={t('suppliers.codeHint')}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <TextInput label={t('suppliers.taxCode')} maxLength={30} value={form.taxCode}
            onChange={e => setForm({ ...form, taxCode: e.target.value })} />
        </div>
        <TextInput label={t('suppliers.name')} required maxLength={200} value={form.name} autoFocus={!!editing}
          onChange={e => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextInput label={t('suppliers.phone')} maxLength={30} value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} />
          <TextInput label={t('suppliers.address')} maxLength={300} value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <TextArea label={t('suppliers.note')} rows={2} maxLength={300} value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('suppliers.isActive')} subLabel={t('suppliers.isActiveHint')}
          checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t]);

  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};

const toInput = (s: Supplier): SaveSupplierInput => ({
  code: s.code, name: s.name, taxCode: s.taxCode ?? '', phone: s.phone ?? '',
  address: s.address ?? '', note: s.note ?? '', isActive: s.isActive
});
```

Các mục của `CatalogDefinition` (`components/catalog/catalogTypes.ts`):

| Mục | Ý nghĩa |
| --- | --- |
| `functionCode` | Mã chức năng; quyền Xem / Thêm / Sửa / Xóa / Xuất lấy theo mã này. Cũng là khóa lưu bố cục lưới |
| `api` | Đối tượng ở `api.ts` |
| `keyOf` | Khóa của bản ghi trong URL (`PUT /{code}`, `DELETE /{code}`) và trong `delete-many` |
| `describe` | Chữ gọi tên một bản ghi trong hộp xác nhận / thông báo ("Xóa NCC001 - Công ty A?") |
| `icon` | Icon ở tiêu đề màn |
| `texts` | Tiêu đề, mô tả, danh từ ("nhà cung cấp"), nút thêm, gợi ý ô tìm, tiêu đề form thêm / sửa, `fileName` (tên file Excel, không dấu) |
| `columns` | Cột của lưới (`GridViewColumn`): `key`, `header`, `width`, `sortable`, `align`, `render`, `hidden` (mặc định ẩn, người dùng bật trong nút **Cột**). **`key` là tên được lưu trong bố cục của người dùng: đừng đổi `key` của cột đã có** |
| `...recordStampColumns(t)` | Hai cột **Người tạo** và **Người sửa** (tên + giờ, sắp xếp theo giờ). Để ở cuối danh sách cột |
| `filters` | Bộ lọc thêm (`key`, `label`, `options`). `key` là tên tham số gửi lên máy chủ; service đọc trong `ApplyFilters`. Bộ lọc **Trạng thái** (`status=active|inactive`) có sẵn khi bản ghi có `isActive` |
| `searchText`, `filters[].match` | Chỉ cho màn cũ còn tải cả danh sách (`getAll`). Danh mục phân trang ở máy chủ **không khai báo**: tìm kiếm do `Search` ở service, lọc do `ApplyFilters` |
| `excel.columns` | Cột của file Excel (xuất, nhập, file mẫu). `key`: tên trường của input; `header`: tiêu đề cột (khi nhập nhận cả `header` lẫn `key`); `required`; `type: 'boolean' \| 'number' \| 'text'`; `width`; `example`: giá trị dòng ví dụ trong file mẫu |
| `excel.toRow` | Bản ghi → một dòng Excel (cùng dạng với input) |
| `emptyInput` | Giá trị form khi thêm mới |
| `toInput` | Bản ghi → giá trị form khi sửa (`useCatalog` tự gắn `version`) |
| `normalize` | Chạy trước khi lưu và trước khi nhập Excel: cắt khoảng trắng, viết hoa mã |
| `renderForm` | Các ô nhập của form. `editing` có giá trị khi đang sửa (khóa ô mã) |
| `formWidth` | Độ rộng form: `'md' \| 'lg' \| 'xl' \| '2xl'` |

`useMemo(..., [t])`: khai báo dựng lại khi đổi ngôn ngữ. Hàm dùng chung (như `toInput`) để ngoài component.

Dùng control chung trong `components/common/` (`TextInput`, `TextArea`, `SelectInput`, `Checkbox`, `NumberInput`, `CurrencyInput`...), không dùng thẻ `<input>` thô.

#### `index.ts`

```ts
export * from './SupplierCategoryView';
export * from './types';
```

### 3.5. Những gì `CatalogScreen` tự lo, theo quyền

> **Giải thích.** Bảng dưới liệt kê những gì `CatalogScreen` tự làm, để bạn **không phải viết lại**: nếu thấy mình đang viết code cho một việc trong bảng này thì nhiều khả năng đang làm sai hướng.

| Phần | Cần quyền |
| --- | --- |
| Nạp lại, ô tìm kiếm, đếm số dòng, bộ lọc, phân trang | Xem |
| Nút **Cột**: ẩn / hiện, đổi thứ tự cột, kéo mép tiêu đề đổi độ rộng, sắp xếp, số dòng mỗi trang; lưu theo từng người trên server (`sys_grid_layout`). Quản trị viên lưu được **bố cục mặc định cho cả công ty** | Xem |
| Nút Thêm, form thêm | Thêm |
| Nút sửa, bấm vào dòng để sửa; chống ghi đè (có người sửa trước thì báo và tải lại) | Sửa |
| Nút xóa; chọn nhiều dòng → **Xóa các dòng đã chọn** (có dòng không xóa được thì không xóa dòng nào) | Xóa |
| **Xuất Excel** (`.xlsx` do máy chủ làm: mọi dòng khớp ô tìm và bộ lọc đang chọn, không chỉ trang đang xem; tối đa 100.000 dòng; ghi vào nhật ký) | Xem và Xuất |
| **Nhập Excel**: tải file mẫu, chọn file, xem trước từng dòng và lỗi, chọn "Chỉ thêm mới" hoặc "Thêm mới và cập nhật mã đã có" (cần thêm quyền Sửa); lỗi từ server hiện đúng số dòng Excel | Thêm |
| Thông báo lưu / xóa, lỗi từ API, dòng "Tạo: … · Sửa: …" trong form | |

Việc ẩn nút ở frontend chỉ để hiển thị; quyền thật được backend kiểm tra ở controller (2.7).

### 3.6. Chữ hiển thị — `locales/vi/inventory.json` và `locales/en/inventory.json` (sửa cả hai)

> **Giải thích.** Mọi chữ trên màn hình lấy từ file ngôn ngữ bằng `t('suppliers.title')`. Mục `suppliers` phải có **cùng khóa** ở cả `vi` và `en`; thiếu thì màn hiện nguyên khóa (`suppliers.title`) thay vì chữ.

Thêm mục `suppliers` có **cùng khóa** ở hai file (copy mục `uoms` rồi sửa chữ). Chữ của các nút chung (Sửa, Xóa, Lưu, Hủy, Nhập / Xuất Excel, bộ lọc trạng thái, Cột...) có sẵn trong `common.json` (`catalog.*`), không phải thêm.

```json
"suppliers": {
  "noun": "nhà cung cấp",
  "title": "Danh mục nhà cung cấp",
  "subtitle": "Nhà cung cấp hàng hóa, dùng trên phiếu nhập kho.",
  "search": "Tìm mã, tên, mã số thuế...",
  "add": "Thêm nhà cung cấp",
  "addTitle": "Thêm nhà cung cấp",
  "editTitle": "Sửa nhà cung cấp {code}",
  "code": "Mã nhà cung cấp",
  "codeHint": "Không đổi được sau khi tạo",
  "name": "Tên nhà cung cấp",
  "taxCode": "Mã số thuế",
  "hasTaxCode": "Có mã số thuế",
  "noTaxCode": "Chưa có mã số thuế",
  "phone": "Điện thoại",
  "address": "Địa chỉ",
  "note": "Ghi chú",
  "status": "Trạng thái",
  "active": "Đang dùng",
  "inactive": "Ngừng sử dụng",
  "isActive": "Đang sử dụng",
  "isActiveHint": "Nhà cung cấp ngừng sử dụng không chọn được trên phiếu mới"
}
```

- Màn hình **không gõ cứng chữ tiếng Việt**; mọi chữ lấy bằng `t('suppliers.xxx')`. Tham số dạng `{code}`.
- Danh mục thuộc Cài đặt thì đặt chữ ở `locales/*/settings.json`.

Nhãn ở màn **Nhật ký thay đổi** (tùy chọn) — `locales/vi/common.json` và `locales/en/common.json`:
- `audit.objectType.supplier`: "Nhà cung cấp" / "Supplier";
- `audit.field.<tên trường>` cho trường chưa có nhãn (`taxCode`, `address`... đã có sẵn).

Không thêm thì màn nhật ký hiện tên gốc (`supplier`, `taxCode`).

### 3.7. Gắn màn vào phân hệ — `modules/inventory/InventoryModule.tsx` (sửa)

> **Giải thích.** Mỗi phân hệ có một file `*Module.tsx` chọn màn hình theo mã chức năng. Thêm `import` và một `case` để khi người dùng mở mục menu mới thì hiện đúng màn hình. Đường dẫn import là `./categories/suppliers` (thư mục `categories` nằm trong thư mục phân hệ).

```tsx
import { SupplierCategoryView } from './categories/suppliers';
...
      case 'inv_supplier_cat':
        return <SupplierCategoryView currentUser={currentUser} />;
```

- Danh mục thuộc phân hệ khác: sửa file `*Module.tsx` của phân hệ đó.
- Danh mục thuộc Cài đặt: thêm `case` vào `renderScreen` trong `modules/settings/SettingsModule.tsx`.
- Trước đó danh mục này là dữ liệu mẫu (mock): bỏ prop dữ liệu mẫu truyền vào màn. Dữ liệu mẫu trong `mock/initialERPData.ts` chỉ giữ lại nếu màn khác chưa chuyển lên backend vẫn còn đọc.

### 3.8. Mốc 2: mở màn hình

1. `cd Frontend`, rồi `npm run lint`: phải sạch (không lỗi). Lỗi "Cannot find module" thường là sai số `../` ở `import`; lỗi về `SubMenuKey` hoặc `FUNCTION_REGISTRY` là quên bước 3.1 hoặc 3.2.
2. Chạy `npm run dev`, mở `http://localhost:3000`, đăng nhập `admin`.
3. Menu **Kho** (hoặc phân hệ của bạn) có mục mới. Bấm vào: màn hình hiện đúng tiêu đề, các nút (Thêm, Nhập Excel, Xuất Excel, Cột, Bộ lọc) và danh sách.
4. Thử **Thêm**: điền mã và tên rồi lưu; dòng mới xuất hiện kèm cột Người tạo.
5. Thử gõ ô tìm kiếm không dấu; thử bấm tiêu đề cột để sắp xếp.

Mở lại tab trình duyệt cũ mà không thấy mục menu mới: tải lại trang (Ctrl+F5) và nhớ đăng nhập lại sau khi khởi động lại backend.

---

## Phần 4. Dùng danh mục ở màn khác (tra cứu)

Màn khác **không** gọi `suppliersApi.list` (cần quyền Xem danh mục). Dùng ô tra cứu với tên đã đăng ký ở 2.6. Cả hai nằm trong `components/catalog/CatalogLookup.tsx`.

### 4.1. Chọn một mã — `CatalogLookup`

Ví dụ ô nhà cung cấp trên phiếu nhập kho:

```tsx
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';

<CatalogLookup lookup="suppliers" label={t('receipts.supplier')} required value={form.supplierCode}
  onChange={(code, item) => setForm({ ...form, supplierCode: code })}
  extraColumns={[{ key: 'taxCode', title: t('suppliers.taxCode') }]} />
```

- Gõ mã rồi Enter (hoặc rời ô): nhận nếu đúng mã đang dùng, sai thì báo.
- F2 hoặc nút kính lúp: mở hộp tìm trên server (↑ ↓ chọn, Enter lấy, Esc đóng).
- Tên hiện bên cạnh mã. `item` (tham số thứ hai) có `name` và `extra` nếu cần điền thêm ô khác.
- `extraColumns`: cột phụ trong hộp tìm, `key` là tên đã khai báo ở `LookupCatalogs`.

### 4.2. Chọn nhiều mã — `CatalogMultiLookup`

Ví dụ lọc báo cáo theo nhiều nhà cung cấp; giá trị là mảng mã:

```tsx
import { CatalogMultiLookup } from '../../../../components/catalog/CatalogLookup';

<CatalogMultiLookup lookup="suppliers" label={t('report.suppliers')} value={filter.suppliers}
  onChange={(codes, items) => setFilter({ ...filter, suppliers: codes })} max={50} />
```

- Mã đã chọn hiện thành thẻ: × để bỏ, Backspace bỏ mã cuối.
- Gõ nhiều mã cách nhau bằng dấu phẩy rồi Enter để thêm nhanh; mã không có hoặc ngừng dùng sẽ được báo.
- F2 mở hộp tìm có ô tích từng dòng, ô tích các dòng đang hiện, giữ lựa chọn khi tìm chữ khác, nút **Bỏ chọn tất cả** và **Xong** (hoặc Ctrl+Enter).
- `max` (tùy chọn) giới hạn số mã.

Props chung của hai control: `lookup`, `params` (tham số cho tra cứu riêng, §4.3), `label`, `required`, `disabled`, `placeholder`, `extraColumns`, `title` (tiêu đề hộp tìm), `className`.

---

### 4.3. Tra cứu viết riêng — `LookupProvider`

Tra cứu chung (`LookupCatalogs`) chỉ lấy **một bảng**: mã, tên, trạng thái và tối đa 3 cột phụ kiểu chữ. Cần hơn thế (ghép nhiều bảng, tính toán, cột có kiểu số / ngày / đúng sai, phụ thuộc kho / ngày / khách hàng, ẩn dữ liệu với người không có quyền) thì viết **một lớp tra cứu riêng**. Nó vẫn chạy trên cùng API `GET /api/lookups/{tên}` và cùng `CatalogLookup`, nên màn hình dùng như mọi tra cứu khác.

| Cần | Dùng |
| --- | --- |
| Chọn mã + tên + vài cột chữ từ một bảng danh mục | Tra cứu chung: một mục trong `LookupCatalogs.All` (§2.6) |
| Ghép nhiều bảng, cột có kiểu, tham số theo ngữ cảnh, kiểm quyền | **`LookupProvider`** (mục này) |

**Mẫu chạy thật:** `Core.Infrastructure/Modules/Inventory/Categories/uom/UomFullLookup.cs` (`GET /api/lookups/uomsFull`): mọi cột của danh mục đơn vị tính ("select * từ đơn vị tính") thành cột phụ có kiểu, và tham số `convertibleTo=KG` chỉ liệt kê các đơn vị có quy đổi với KG.

```csharp
public sealed class UomFullLookup(CoreContext db) : LookupProvider
{
    public override string Name => "uomsFull";                                   // tên trong URL và lookup="..."

    // Các bảng LoadAsync đọc. Khác rỗng: kết quả được đệm trong bộ nhớ và tự xóa khi một bảng này bị ghi.
    // Để rỗng cho dữ liệu phải đọc mới mỗi lần (tồn kho, số dư): khi đó không bao giờ đệm.
    public override IReadOnlyCollection<string> Tables => ["erp_uom", "erp_uom_translation", "erp_uom_conversion"];

    // Tham số URL mà tra cứu hiểu (?convertibleTo=KG). Tham số khác bị bỏ qua và không vào khóa đệm.
    public override IReadOnlyCollection<string> ParameterNames => ["convertibleTo"];

    // (tùy chọn) Kiểm quyền trước mỗi lần tra cứu:
    // public override async Task AuthorizeAsync(LookupContext context, CancellationToken ct) =>
    //     await context.Permissions.EnsureAllowedAsync(context.UserId, "inv_receipt", PermissionAction.View, ct);

    // (tùy chọn) Tách bản đệm khi nội dung phụ thuộc người hỏi, ví dụ cột giá chỉ điền cho người có quyền xem giá:
    // public override async Task<string> CacheScopeAsync(LookupContext context, CancellationToken ct) =>
    //     await context.Permissions.HasRightAsync(context.UserId, "inv_receipt", "VIEW_PRICE", ct) ? "price:1" : "price:0";

    // Trả về MỌI bản ghi người hỏi được chọn (theo tham số). Khung tự tìm theo mã / tên, sắp xếp, chia trang, đệm.
    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var units = db.Uoms.AsNoTracking();
        if (context.Param("convertibleTo")?.ToUpperInvariant() is { } other)
            units = units.Where(u => db.UomConversions.Any(c => (c.FromUomCode == other && c.ToUomCode == u.Code)
                || (c.ToUomCode == other && c.FromUomCode == u.Code)));
        var rows = await units.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        return rows.Select(x => new LookupItem(x.Code, x.Name, x.IsActive, new Dictionary<string, object?>
        {
            ["symbol"] = x.Symbol, ["sortOrder"] = x.SortOrder, ["createdAt"] = x.CreatedAt   // giữ nguyên kiểu: chữ, số, ngày
        })).ToList();
    }
}
```

Đăng ký một dòng trong `DependencyInjection.cs`, cạnh `foreach ... LookupCatalogs.All`:

```csharp
services.AddLookupProvider<UomFullLookup>();
```

**Quy tắc**
- Đọc dữ liệu bằng EF hoặc SQL có tham số, **vài truy vấn cho cả danh sách**, không mỗi bản ghi một truy vấn. Không ghép chuỗi SQL.
- Tra cứu mở cho **mọi người đã đăng nhập**. Dữ liệu nhạy cảm (giá nhập, công nợ) phải kiểm quyền trong `AuthorizeAsync`, hoặc không trả cột đó cho người không có quyền và tách bản đệm bằng `CacheScopeAsync`. Bản đệm dùng chung cho mọi người, nên **không bao giờ để lộ dữ liệu theo quyền mà quên `CacheScopeAsync`**.
- Khai đủ **mọi bảng** `LoadAsync` đọc vào `Tables` (kể cả bảng bản dịch). Thiếu bảng thì tra cứu hiện dữ liệu cũ sau khi bảng đó đổi.
- Dữ liệu đổi từng giây (tồn kho, giá theo ngày) thì để `Tables` rỗng: luôn đọc mới, không đệm. Khi đó nhớ giới hạn số dòng trả về.
- `ParameterNames`: chỉ chữ cái và số. Mỗi giá trị tham số khác nhau là một bản đệm riêng, nên chỉ khai tham số thật sự đổi kết quả.
- Mọi tra cứu (chung và riêng) phải có **tên khác nhau**; trùng tên thì lỗi khi gọi.
- Danh sách rất lớn (hàng chục nghìn dòng) chưa hợp với kiểu "tải hết rồi tìm trong bộ nhớ": lúc đó cần mở rộng khung để provider tự tìm trong database.

**Phía màn hình**

```tsx
<CatalogLookup lookup="uomsFull" params={{ convertibleTo: baseUnit }} label="Đơn vị"
  value={line.unit}
  onChange={(code, item) => setLine({ ...line, unit: code, symbol: item?.extra.symbol as string })}
  extraColumns={[{ key: 'symbol', title: 'Ký hiệu' }, { key: 'sortOrder', title: 'Thứ tự' }]} />
```

- `params` gửi thành tham số URL; đổi giá trị thì tên đã chọn được nạp lại.
- `onChange(code, item)` nhận **cả bản ghi vừa chọn** (`item.extra.<tên>` giữ đúng kiểu: số, đúng sai, ngày dạng chữ ISO). Nhờ đó chọn một vật tư là điền luôn đơn vị, giá, tồn vào dòng phiếu mà không cần gọi thêm.
- Cột phụ kiểu số tự căn phải, đúng sai hiện dấu ✓, ngày hiện theo giờ máy.

**Test:** `LookupProviderTests` kiểm tra khung (bộ nhớ đệm theo tham số, tách theo phạm vi, xóa khi bảng đổi, không đệm khi không khai bảng, quyền, kiểu cột phụ, tên trùng). Viết provider mới thì chỉ cần thêm test cho truy vấn riêng của nó.

---

## Phần 5. Danh mục có trường tham chiếu danh mục khác

Ví dụ nhà cung cấp có **nhóm nhà cung cấp** (`group_code`, tra cứu `supplierGroups`). Không có khóa ngoại, nên **khai báo tham chiếu** để khung làm phần còn lại (tài liệu đầy đủ: `docs/tham-chieu-danh-muc.md`):

1. **SQL**: thêm cột và index.
   ```sql
   ALTER TABLE erp_supplier ADD COLUMN IF NOT EXISTS group_code varchar(20);
   CREATE INDEX IF NOT EXISTS ix_erp_supplier_group_code ON erp_supplier (group_code);
   ```
2. **Entity danh mục con**: khai báo cột trỏ sang nhóm. Khung tự kiểm mã có thật khi lưu và tự chặn xóa nhóm khi còn nhà cung cấp dùng.
   ```csharp
   [References<SupplierGroup>(Optional = true)]
   [Column("group_code"), MaxLength(20)] public string? GroupCode { get; set; }
   ```
3. **Service danh mục con**: trong `ApplyAsync`, chuẩn hóa mã (nếu muốn kiểm thêm "đang dùng" thì tự thêm, khung chỉ kiểm mã tồn tại).
   ```csharp
   row.GroupCode = Guard.Optional(request.GroupCode, 20, "field.supplierGroup")?.ToUpperInvariant();
   ```
   Thêm nhãn `table.erp_supplier` ("Nhà cung cấp") vào `Messages.vi.json` / `Messages.en.json` để thông báo xóa nhóm nêu đúng tên bảng. **Không** viết `BeforeDeleteAsync` kiểm tra nhà cung cấp trong service của nhóm.
4. **Form**: dùng `CatalogLookup` trong `renderForm`, thêm cột vào `excel.columns` (người dùng nhập mã nhóm trong file; sai mã thì lỗi hiện đúng dòng).
   ```tsx
   <CatalogLookup lookup="supplierGroups" label={t('suppliers.group')} value={form.groupCode}
     onChange={groupCode => setForm({ ...form, groupCode })} />
   ```

Muốn hiện **tên** nhóm trong lưới: trả thêm `GroupName` trong DTO. Đọc tên các nhóm của **cả trang** bằng một truy vấn trong `MapAsync` (`Where(g => codes.Contains(g.Code))`, giống cách `UomConversionService` lấy tên đơn vị), không đọc từng dòng. Danh sách phân trang không có bộ nhớ đệm nên đổi tên nhóm là danh sách thấy ngay; nếu tra cứu nhà cung cấp cũng hiện tên nhóm thì thêm `"erp_supplier_group"` vào danh sách bảng của mục tra cứu.

Muốn lọc theo nhóm: thêm bộ lọc `groupCode` (frontend `filters`, backend `ApplyFilters`, §2.5). Muốn tìm theo tên nhóm: thêm điều kiện vào `Search`.

### 5.1. Danh mục có danh sách chọn nhiều (mẫu: kho → đơn vị cơ sở sử dụng)

Một dòng danh mục có **nhiều** mã của danh mục khác (kho dùng cho nhiều đơn vị cơ sở). Mẫu chạy thật: `WarehouseService`, bảng `erp_warehouse_unit`.

| Việc | Cách làm |
| --- | --- |
| Bảng con | Script `25-inventory-warehouse-units.sql`: khóa `(warehouse_code, unit_code)`, 4 cột dấu vết, **index trên `unit_code`** (tra khi xóa đơn vị) |
| Entity con | `WarehouseUnit : ErpEntity` với `[AuditedChild(typeof(Warehouse), nameof(WarehouseCode), "units", nameof(UnitCode))]` (nhật ký ghi danh sách như một trường của kho), `[References<Warehouse>(BlocksDelete = false)]` trên `warehouse_code` (xóa cùng kho), `[References<CompanyUnit>]` trên `unit_code` (đơn vị còn được kho dùng thì không xóa được). Khai khóa ghép trong `CoreContext` |
| Request / DTO | Request nhận `string? UnitCodes` (mã cách nhau dấu phẩy hoặc chấm phẩy: cũng là dạng một ô Excel); `null` = giữ nguyên, rỗng = xóa hết. DTO trả `IReadOnlyList<string> UnitCodes` |
| Lưu | `AfterApplyAsync`: tách mã, kiểm tra đơn vị mới có thật và đang dùng (đơn vị đã gán thì giữ dù về sau bị ngừng), thêm / xóa dòng con, nếu có đổi và đang sửa thì đánh dấu `Name` đã đổi để **phiên bản bản ghi cha tăng** (chống ghi đè) |
| Xóa | `BeforeDeleteAsync` xóa các dòng con |
| Danh sách | `MapAsync` đọc dòng con của cả trang một lần; `Search` thêm điều kiện tìm theo dòng con; `ApplyFilters` đọc `unitCode` |
| Xuất Excel | `BeforeExportAsync` đọc dòng con của các dòng sắp xuất vào một trường, `ExportColumns` lấy ra |
| Màn hình | `CatalogMultiLookup lookup="companyUnits"` (giá trị là mảng mã; trong input lưu thành chuỗi nối bằng dấu phẩy), cột "Dùng chung" khi trống, cột Excel `unitCodes` |
| Dùng ở nơi khác | Truy vấn dùng lại ở một nơi: `db.UsableBy(unitCode)` (`WarehouseQueries`): kho đang dùng mà đơn vị này được dùng hoặc kho dùng chung. Phiếu nhập dùng nó cho ô chọn kho và khi lưu |

Quy ước nghiệp vụ của mẫu này: **không chọn đơn vị nào = dùng chung cho mọi đơn vị cơ sở**.

### 5.2. Danh mục có khóa ghép (mẫu: tỷ giá = ngoại tệ + ngày)

Khung chỉ biết một khóa văn bản là `code`. Khi khóa thật là một cặp giá trị (tỷ giá theo ngoại tệ và ngày), **mã của dòng là chuỗi ghép** và bảng vẫn giữ khóa chính `id`:

| Việc | Cách làm (xem `ExchangeRateService`, script `27-exchange-rate-catalog.sql`) |
|---|---|
| Bảng | Thêm cột `code` (duy nhất, ví dụ `USD@2026-10-08`), giữ cặp cột thật (`currency_code`, `rate_date`) và chỉ mục duy nhất của cặp đó, thêm `is_active`, `sort_order` và 4 cột dấu vết |
| Request | `Code` là thuộc tính **tính từ** các trường khóa (`ExchangeRateKey.Of(CurrencyCode, Date)`), nên file Excel và form không có cột mã; nhập Excel nhận dòng theo ngoại tệ + ngày |
| Sửa | `ApplyAsync` từ chối đổi cặp khóa của dòng đã lưu (`exchangeRate.keyChanged`); muốn đổi hãy xóa và thêm mới. Form khóa hai ô đó khi sửa |
| Bộ lọc | `ApplyFilters` đọc `currency`, `from`, `to`; màn dùng `filters` của `CatalogDefinition` cho ô ngoại tệ |
| Đọc ở nơi khác | Hàm riêng (`GetRateAsync`) ở interface của danh mục; endpoint mở cho mọi người đăng nhập tách ra **controller riêng** (controller danh mục từ chối action không khai `CatalogRight`) |

---

## Phần 6. Phân quyền cho người dùng

1. Khởi động lại backend để mã chức năng mới vào `sys_command`.
2. **Cài đặt › Người dùng & phân quyền**: cấp cho vai trò cần dùng các quyền của chức năng mới. Quản trị viên có sẵn toàn quyền.

| Quyền | Người có quyền làm được |
| --- | --- |
| Xem | Mở màn, xem danh sách, tìm, lọc, chọn cột |
| Thêm | Thêm mới, nhập Excel chế độ "Chỉ thêm mới" |
| Sửa | Sửa bản ghi đã lưu; cùng với Thêm thì nhập Excel chế độ "Thêm mới và cập nhật" |
| Xóa | Xóa một dòng, xóa nhiều dòng |
| Xuất | Xuất Excel |
| Duyệt, In | Danh mục thường không dùng |

Người chỉ cần chọn nhà cung cấp trên phiếu **không cần** quyền Xem danh mục: tra cứu mở cho mọi người đã đăng nhập.

Muốn tài khoản demo có sẵn quyền (dữ liệu mẫu khi database trống): thêm mã vào vai trò trong `mock/initialRoles.ts` rồi chạy `npm run export-seed` để tạo lại `ServerService/Core/SeedData/seed.json`.

---

## Phần 7. Kiểm tra

### 7.1. Build và test

```bash
cd ServerService
dotnet build Core.sln
dotnet test tests/Core.Tests/Core.Tests.csproj
```

Backend đang chạy thì dừng trước khi build (file DLL bị khóa).

```bash
cd Frontend
npm run lint
npm run check-i18n
```

Test tự bắt các điểm hay quên:

| Test | Báo lỗi khi |
| --- | --- |
| `TablesAndColumnsFollowNamingConvention` | Tên bảng không phải `sys_*` / `erp_*`, cột không `snake_case` |
| `BusinessTablesHaveRecordStamps` | Bảng `erp_*` không kế thừa `ErpEntity` |
| `VersionedRecordsUseXminAsConcurrencyToken` | Bản ghi có `Version` mà không ánh xạ vào `xmin` |
| `ConcurrencyContractTests` | `UpdateAsync` thiếu `Version` ở request / DTO, hoặc thiếu `db.ExpectVersion(...)` |
| `ReadAccessContractTests` | `GET` của controller viết tay (có `const string Function`) thiếu `RequirePermission` |
| `CatalogFrameworkTests` | Controller danh mục thiếu `[CatalogFunction]` hoặc mã chức năng không có thật, thiếu `[Route]`; API của lớp nền thiếu quyền; service thiếu khóa thông báo `<loai>.notFound` / `<loai>.codeExists` / `export.<loai>.sheet` / nhãn mã ở vi hoặc en |
| `TableReferenceTests` | Cột `*_code` thiếu `[References]` / `[NotReference]`; tên cột không kết thúc bằng tên bảng đích; cột tham chiếu chưa có index trong script SQL; bảng được tham chiếu thiếu nhãn `table.<tên bảng>` |
| `CatalogPermissionFilterTests` | Một API của controller danh mục cho qua khi thiếu đúng quyền của nó (Xem, Thêm, Sửa, Xóa; xuất cần cả Xem và Xuất) |
| `PagingTests` | Kích thước trang không bị kẹp, sắp xếp theo cột lạ không bị từ chối, tìm kiếm không thoát `%` / `_`, bộ lọc riêng không lấy đúng tham số, xuất Excel sai tiêu đề |
| `LookupCacheTests` | Tra cứu khai thiếu bảng mà phép chiếu đọc (bản đệm không được xóa khi bảng đó đổi), tìm kiếm / chia trang trong bộ nhớ sai |
| `LookupProviderTests` | Tra cứu viết riêng: bộ nhớ đệm theo tham số, quyền, phạm vi bản đệm, kiểu cột phụ, tên trùng |
| `EveryEntityDeclaresItsChangeLog` | Entity thiếu `[Audited]` / `[NotAudited]` |
| `AuditDeclarationsNameExistingProperties` | Mã chức năng trong `[Audited]` chưa có ở `FunctionCatalog`, hoặc `Label` dùng property không tồn tại |
| `MessagesTests` | Khóa thông báo thiếu ở `Messages.vi.json` / `Messages.en.json`, hoặc `throw` viết câu tiếng Việt |
| `npm run lint` | Thiếu mã trong `SubMenuKey` / `FUNCTION_REGISTRY`, sai kiểu giữa `types.ts` và `CatalogDefinition` |
| `npm run check-i18n` | Khóa có ở tiếng Việt mà thiếu ở tiếng Anh; chữ tiếng Việt gõ cứng trong màn (hiện chỉ quét phần dùng chung và Cài đặt) |

### 7.2. Chạy thử trên trình duyệt

1. Khởi động lại backend, mở `http://localhost:3000`, đăng nhập `admin`.
2. Menu có mục mới. Thêm, sửa, xóa một bản ghi; thử trùng mã / trùng tên: phải ra thông báo dễ hiểu.
3. **Chống ghi đè**: mở cùng một bản ghi ở hai tab, lưu ở tab 1 rồi lưu ở tab 2: tab 2 báo bản ghi đã bị người khác sửa và tải lại.
4. **Phân trang**: đổi số dòng mỗi trang, chuyển trang, bấm tiêu đề cột để sắp xếp (hai chiều), gõ ô tìm kiếm, chọn bộ lọc: mỗi thao tác chỉ gửi **một** yêu cầu và quay về trang 1. **Xuất Excel** ra `.xlsx` gồm **mọi dòng** khớp bộ lọc (không chỉ trang đang xem), tiêu đề đúng ngôn ngữ; Cài đặt › Nhật ký thay đổi có dòng "Xuất Excel" kèm số dòng và bộ lọc. **Tải file mẫu**, điền vài dòng (có một dòng sai), **Nhập Excel**: dòng sai báo lỗi đúng số dòng và không dòng nào được lưu; sửa file rồi nhập lại thành công.
5. Chọn vài dòng → **Xóa các dòng đã chọn**.
6. Nút **Cột**: ẩn một cột, kéo đổi độ rộng, tải lại trang: bố cục còn nguyên.
7. Cột **Người tạo / Người sửa** có tên và giờ.
8. **Cài đặt › Nhật ký thay đổi**: lọc chức năng "Danh mục nhà cung cấp", thấy đủ Tạo mới / Sửa / Xóa với trường trước → sau.
9. Đăng nhập tài khoản thiếu quyền: nút tương ứng phải ẩn (không có Thêm thì ẩn Thêm và Nhập Excel, không có Xuất thì ẩn Xuất Excel...). Không có quyền Xem thì không thấy menu, gọi `GET /api/inventory/suppliers` bị 403 nhưng `GET /api/lookups/suppliers` vẫn được.

**Thử bằng lệnh gọi API** (đăng nhập `POST /api/auth/login`, lấy `token`, gửi `Authorization: Bearer <token>`):

| Gọi | Kết quả đúng |
| --- | --- |
| `GET /api/inventory/suppliers?page=1&pageSize=2&sort=name&dir=desc` | `{ items, total, page, pageSize }`, 2 dòng, đúng thứ tự |
| `...?pageSize=99999` | `pageSize` bị kẹp về 200 |
| `...?sort=password` | 400 "Cột sắp xếp không hợp lệ" |
| `...?search=%25` | Chỉ khớp dòng có ký tự `%` thật (không khớp tất cả) |
| `...?status=inactive`, `...?hasTaxCode=yes` | Lọc đúng; tham số lạ (`?foo=1`) bị bỏ qua |
| `GET .../export?search=...` | File `.xlsx` (đọc được, số dòng = tổng khớp bộ lọc + 1 dòng tiêu đề) |
| Không token | 401. Có token nhưng thiếu quyền Xem: 403; thiếu Xuất: export 403 |
| `GET /api/lookups/suppliers?q=...`, `.../codes?codes=A,B` | 200 và thấy ngay bản ghi vừa thêm, vừa sửa tên, vừa ngừng dùng (bộ nhớ đệm tự làm mới) |

Thử xong thì xóa dữ liệu thử (bản ghi, tài khoản thử, dòng nhật ký của chúng nếu cần).

### 7.3. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| Menu không có mục mới | Thiếu nút trong `Core/SeedData/menu.json` (hoặc `subKey` khác mã chức năng), backend chưa khởi động lại, hoặc tài khoản chưa có quyền Xem |
| Mở màn báo không có quyền dù đã cấp | Backend chưa khởi động lại nên mã chưa có trong `sys_command`; hoặc mã ở frontend và `FunctionCatalog.cs` khác nhau |
| API lỗi 500 "column ... does not exist" | Chưa chạy script SQL, hoặc tên trong `[Column("...")]` khác tên cột |
| `/api/lookups/suppliers` trả 404 "Không có danh mục tra cứu" | Thiếu mục trong `LookupCatalogs.All`, hoặc tên tra cứu khác nhau giữa backend và `lookup="..."` |
| Lưu báo "bản ghi đã bị thay đổi" dù chỉ một người sửa | `toInput` hoặc `normalize` làm mất `version`; hoặc DTO không trả `Version` |
| Thông báo lỗi hiện khóa thô (`supplier.codeExists`) | Thiếu khóa trong `Messages.*.json` |
| Màn hiện chữ dạng `suppliers.title` | Thiếu khóa trong `locales/*/inventory.json` |
| Sửa thẳng trong pgAdmin mà màn vẫn hiện dữ liệu cũ | Cache không biết lệnh ngoài API; khởi động lại backend |
| API trả 403 dù tài khoản có quyền | Thiếu `[CatalogFunction("...")]` trên controller, hoặc mã chức năng khác mã trong `FunctionCatalog.cs` |
| Bấm sắp xếp cột báo "Cột sắp xếp không hợp lệ" | `sortKey` / `key` của cột lưới chưa có trong `SortMap` của service |
| `CatalogFrameworkTests` đỏ | Thiếu khóa `<loai>.notFound` / `<loai>.codeExists` / `export.<loai>.sheet` / `field.*Code` ở một trong hai file Messages |
| Xuất Excel xong không thấy dòng nhật ký | Tự viết xuất mà quên `SaveChangesAsync` sau `audit.RecordAsync`; dùng `CatalogService` thì đã có |
| Chọn bộ lọc riêng mà danh sách không đổi | `key` của bộ lọc ở frontend khác khóa mà `ApplyFilters` đọc (khóa so sánh không phân biệt hoa thường, nhưng phải đúng chữ), hoặc quên ghi đè `ApplyFilters` |
| Tra cứu hiện dữ liệu cũ sau khi sửa danh mục | Mục tra cứu khai thiếu bảng (kể cả bảng bản dịch); `LookupCacheTests` báo đỏ khi thiếu |
| Xuất Excel báo "quá nhiều dòng" | Hơn 100.000 dòng khớp: thu hẹp bộ lọc rồi xuất lại |
| Nhập Excel báo cột thiếu | Tiêu đề cột trong file khác `header` (hoặc `key`) của `excel.columns`; dùng file mẫu |

---

## Danh sách kiểm tra nhanh

**Thêm mới**
- [ ] `ServerService/sql/postgresql/NN-<ten>.sql` (đã chạy trên database; mỗi cột `*_code` trỏ danh mục khác có `CREATE INDEX` bắt đầu bằng chính cột đó)
- [ ] `Core.Domain/Modules/<PhanHe>/<Ten>.cs` (`: ErpEntity, ICatalogRecord`, `[Audited]`, mỗi cột `*_code` có `[References<T>]` hoặc `[NotReference("lý do")]`)
- [ ] `Core.Application/Modules/<PhanHe>/<Ten>Contracts.cs` (DTO có `Stamp`, `uint Version`; request `: ICatalogRequest` có `uint? Version = null`; interface `: ICatalogService<Dto, Request>`)
- [ ] `Core.Infrastructure/Modules/<PhanHe>/<Ten>Service.cs` (`: CatalogService<...>`: `Spec`, `Sorts`, `Search`, `ExportColumns`, `WithoutVersion`, `MapAsync`, `ApplyAsync`; tùy chọn `ApplyFilters`, `AfterApplyAsync`, `BeforeDeleteAsync`)
- [ ] `Core/Modules/<PhanHe>/<Ten>sController.cs` (`: CatalogControllerBase<Dto, Request>` với `[Route]` và `[CatalogFunction("<mã>")]`, không viết API nào)
- [ ] `Frontend/src/modules/<phan-he>/<ten>/`: `types.ts` (có `stamp`, `version`), `api.ts` (`createCatalogApi`, ba dòng), `<Ten>CategoryView.tsx` (`CatalogDefinition` cho `CatalogScreen`), `index.ts`

**Sửa**
- [ ] `FunctionCatalog.cs`: mã chức năng
- [ ] `Messages.vi.json` + `Messages.en.json`: `<loai>.notFound`, `<loai>.codeExists`, khóa lỗi riêng, `field.*`, `dbfield.*` (nếu cần), `function.<mã>` (bản en), `export.<loai>.sheet` + `export.<loai>.<cột>` (tiêu đề trùng file nhập), `table.<tên bảng>` cho bảng của danh mục này khi bảng khác sẽ trỏ tới nó
- [ ] `CoreContext.cs`: `DbSet`
- [ ] `DependencyInjection.cs`: đăng ký service; `LookupCatalogs.cs`: mục tra cứu (kèm các bảng nó đọc)
- [ ] `types/index.ts`: `SubMenuKey`
- [ ] `config/functions.ts`: `FUNCTION_REGISTRY`
- [ ] `locales/vi|en/common.json`: `navigation.subMenus.<mã>` (cả hai), `function.<mã>` (en); tùy chọn `audit.objectType.*` (cả hai)
- [ ] `ServerService/Core/SeedData/menu.json`: nút menu (+ `DynamicIcon.tsx` nếu icon mới)
- [ ] `locales/vi|en/<phan-he>.json`: chữ của màn
- [ ] `modules/<phan-he>/<PhanHe>Module.tsx`: `case` mở màn
- [ ] Cài đặt › Người dùng & phân quyền: cấp quyền cho vai trò

**Kiểm tra**
- [ ] `dotnet build Core.sln` (0 lỗi, 0 cảnh báo) và `dotnet test` (tất cả qua, kể cả `CatalogFrameworkTests`, `LookupCacheTests`)
- [ ] `npm run lint` sạch, `npm run check-i18n` không thêm lỗi mới
- [ ] Thử API: phân trang, sắp xếp (cột lạ → 400), tìm, lọc, export (có nhật ký `EXPORT`), 401 / 403, tra cứu cập nhật ngay
- [ ] Thử trình duyệt (Phần 7.2) rồi xóa dữ liệu thử

**Không phải làm** (hệ thống tự có): ghi nhật ký thay đổi, điền người tạo / người sửa, chống ghi đè ở màn hình, báo trùng từ database, xóa cache, dòng trong ma trận phân quyền, route và breadcrumb, ẩn nút theo quyền, hộp xác nhận xóa, tìm kiếm / lọc / sắp xếp / phân trang ở máy chủ, xuất Excel ở máy chủ (có quyền và nhật ký), nhập Excel, xóa nhiều, chọn cột và lưu bố cục, API tra cứu có bộ nhớ đệm, 7 API và quyền của controller.
