---
name: them-danh-muc
description: Thêm một danh mục mới (master data) chạy thật trên backend cho S-ERP, đủ cả SQL, backend .NET, màn hình React, phân quyền, Excel, tra cứu, nhật ký, chống ghi đè và kiểm tra. Dùng khi người dùng muốn thêm / tạo / làm danh mục mới (ví dụ "thêm danh mục nhà cung cấp", "làm danh mục kho", "chuyển danh mục X từ mock lên backend").
---

# Thêm một danh mục mới

Quy trình chuẩn để thêm một danh mục **mà không phải đọc cả dự án**. Chỉ đọc đúng các file nêu dưới đây.

- Code mẫu đầy đủ (ví dụ nhà cung cấp) nằm trong `docs/them-danh-muc.md`; số mục (§2.5...) dưới đây là mục trong file đó.
- Mẫu đang chạy thật là danh mục đơn vị tính, dùng khi cần xem code thực tế:
  - backend `ServerService/**/Inventory/Uom*.cs`;
  - SQL `ServerService/sql/postgresql/13-inventory-uom.sql`;
  - frontend `Frontend/src/modules/inventory/uom/`.

## Quy tắc làm việc

- Trả lời người dùng bằng **tiếng Việt**. Chữ trên màn, thông báo lỗi và tài liệu viết tiếng Việt; chú thích trong code viết tiếng Anh, ngắn, giống code xung quanh.
- **Không commit** nếu người dùng không yêu cầu.
- Không in mật khẩu: lấy mật khẩu database từ `ServerService/Core/appsettings.Local.json` bằng lệnh, không ghi ra màn hình hay file.
- Dữ liệu thử tạo ra khi kiểm tra phải xóa khi xong.
- Không sửa `ServerService/_legacy/`.

## Bước 0. Chốt thông tin trước khi làm

Hỏi người dùng (một lần, gộp các câu) những gì chưa rõ, đề xuất sẵn giá trị theo quy ước:

| Thông tin | Quy ước | Ví dụ |
| --- | --- | --- |
| Tên danh mục (vi / en) | | Danh mục nhà cung cấp / Suppliers |
| Phân hệ | `inventory`, `sales`, `finance`, `hr`, `settings` | inventory |
| Mã chức năng | chữ thường, `_`, tiền tố phân hệ, đuôi `_cat`. **Không đổi về sau** | `inv_supplier_cat` |
| Bảng | `erp_<ten>` (nghiệp vụ) | `erp_supplier` |
| Entity / loại đối tượng nhật ký | PascalCase / camelCase | `Supplier` / `supplier` |
| API | `api/<phan-he>/<so-nhieu>` | `api/inventory/suppliers` |
| Tên tra cứu | camelCase số nhiều | `suppliers` |
| Các trường | tên, kiểu, độ dài, bắt buộc, không trùng, có liên kết danh mục khác không | code(20), name(200, không trùng), tax_code(30)... |
| Có trạng thái `is_active` không | mặc định có | |
| Bảng nào sẽ tham chiếu danh mục này (để chặn xóa) | | phiếu nhập kho |
| Icon (lucide-react) | | `Truck` |

Mã chức năng đã có sẵn trong `Frontend/src/types/index.ts` (danh mục đang là mock) thì **dùng lại mã đó**.

Kiểm tra trước: `ls ServerService/sql/postgresql` (lấy số script tiếp theo), `grep` mã chức năng trong `FunctionCatalog.cs` và `Frontend/src/types/index.ts`.

## Bước 1. Database

1. Tạo `ServerService/sql/postgresql/NN-<phan-he>-<ten>.sql` theo §1.1. Chạy lại không lỗi (`IF NOT EXISTS`), có 4 cột `created_at/created_by/updated_at/updated_by`, **không khóa ngoại**, không cột phiên bản, unique index cho cột không được trùng, index cho cột liên kết.
2. Chạy script trên `erp_dev`, không in mật khẩu:
   ```bash
   cd /d/TungLV/Project/PhanMemQL/ServerService
   export PGPASSWORD=$(node -e "const c=require('./Core/appsettings.Local.json').ConnectionStrings.CoreContext;process.stdout.write(/Password=([^;]+)/i.exec(c)[1])")
   "C:/Program Files/PostgreSQL/15/bin/psql.exe" -h localhost -U postgres -d erp_dev -v ON_ERROR_STOP=1 -f sql/postgresql/NN-<ten>.sql
   ```

## Bước 2. Backend (`ServerService/`)

| # | File | Việc | Mẫu |
| --- | --- | --- | --- |
| 2.1 | `Core.Application/Common/Permissions/FunctionCatalog.cs` | Thêm `["<ma>"] = "<Tên vi>",` (cạnh `inv_uom_cat`) | §2.1 |
| 2.2 | `Core.Domain/Modules/<PhanHe>/<Ten>.cs` (mới) | Entity `: ErpEntity`, `[Audited("<ma>", "<loai>", Label = "{Code} - {Name}")]`, `[Table("erp_...")]`, `[Column("snake_case")]`, `MaxLength` khớp SQL | §2.2 |
| 2.3 | `Core.Infrastructure/Common/Persistence/CoreContext.cs` | `public DbSet<Ten> Tens => Set<Ten>();` dưới comment phân hệ (cạnh `Uoms`) | §2.3 |
| 2.4 | `Core.Application/Modules/<PhanHe>/<Ten>Contracts.cs` (mới) | `<Ten>Dto(..., RecordStampDto Stamp, uint Version)`, `Save<Ten>Request(..., bool IsActive = true, uint? Version = null)`, `I<Ten>Service` (GetAll, Create, Update, Delete, Import, DeleteMany) | §2.4 |
| 2.5 | `Core.Infrastructure/Modules/<PhanHe>/<Ten>Service.cs` (mới) | Copy `UomService.cs`: `CachedAsync` (bảng + `sys_users`), `Guard.*`, `ExpectVersion` ngay sau khi tải trong `UpdateAsync`, chặn xóa khi đang dùng, `CatalogBatch` cho Import / DeleteMany | §2.5 |
| 2.6 | `Core.Infrastructure/DependencyInjection.cs` | `services.AddScoped<I<Ten>Service, <Ten>Service>();` cạnh `UomService`, và `services.AddLookup(new LookupDefinition("<tra-cuu>", ...))` cạnh dòng `"uoms"` | §2.6 |
| 2.7 | `Core/Modules/<PhanHe>/<Ten>sController.cs` (mới) | Copy `UomsController.cs`: `private const string Function`, `GET` = View, `POST` = Create, `PUT` = Edit, `DELETE` + `delete-many` = Delete, `import` = Create (+ Edit khi upsert) | §2.7 |
| 2.8 | `Core.Application/Common/Localization/Messages.vi.json` **và** `Messages.en.json` | `field.<ten>Code`, `field.<ten>Name`, `<loai>.notFound/codeExists/nameExists/inUse`, `dbfield.<cot>` cho cột unique chưa có khóa; bản en thêm `function.<ma>`. Dùng lại khóa `field.*` đã có (grep trước) | §2.8 |

Bắt buộc:
- `throw new BusinessRuleException("khóa", args)`, **không viết câu** trong `throw`.
- Không gán `CreatedAt/CreatedBy/UpdatedAt/UpdatedBy`, không tự ghi nhật ký, không tự xóa cache. `CoreContext` làm hết.
- Trường liên kết danh mục khác: kiểm tra mã có và đang dùng khi lưu; danh mục cha chặn xóa khi còn dùng (§5).

## Bước 3. Frontend (`Frontend/src/`)

| # | File | Việc | Mẫu |
| --- | --- | --- | --- |
| 3.1 | `types/index.ts` | Thêm `\| '<ma>'` vào `SubMenuKey` (bỏ qua nếu đã có) | §3.1 |
| 3.2 | `config/functions.ts` | `<ma>: fn('<phan-he>', '/<phan-he>/<duong-dan>', '<Tên ngắn>', 'catalog'),` | §3.2 |
| 3.3 | `locales/vi/common.json` + `locales/en/common.json` | `menu.subMenus.<ma>` (vi + en); `function.<ma>` (en); `audit.objectType.<loai>` (vi + en) | §3.2, §3.6 |
| 3.4 | `mock/initialMenuData.ts` | Mục menu trong nhóm danh mục của phân hệ (copy `MNU_INV_UOM`). Icon mới thì thêm vào **cả hai chỗ** của `components/common/DynamicIcon.tsx` | §3.3 |
| 3.5 | `modules/<phan-he>/<ten>/types.ts`, `api.ts`, `<Ten>CategoryView.tsx`, `index.ts` (mới) | Copy `modules/inventory/uom/`. `types` khớp DTO (camelCase, có `stamp`, `version`); `api.ts` là `CatalogScreenApi` qua `apiRequest` (có `importMany`, `removeMany`); View chỉ khai báo `CatalogDefinition` cho `CatalogScreen` | §3.4 |
| 3.6 | `locales/vi/<khu>.json` + `locales/en/<khu>.json` | Mục chữ của màn, **cùng khóa** ở hai file. Khu: `inventory.json` cho Kho, `settings.json` cho Cài đặt, còn lại đặt trong `common.json` | §3.6 |
| 3.7 | `modules/<phan-he>/<PhanHe>Module.tsx` | `import` + `case '<ma>': return <TenCategoryView currentUser={currentUser} />;` (Cài đặt: `renderScreen` trong `SettingsModule.tsx`). Danh mục trước là mock thì bỏ prop dữ liệu mẫu | §3.7 |

Bắt buộc:
- Không gõ cứng chữ tiếng Việt trong màn; dùng `t('...')`.
- Không gọi `fetch`; chỉ `apiRequest`.
- Dùng control chung (`TextInput`, `TextArea`, `SelectInput`, `Checkbox`, `NumberInput`...).
- Giữ `...recordStampColumns<T>(t)` ở cuối `columns`.
- `key` của cột là tên lưu bố cục: đặt bằng tên trường, không đổi về sau.
- Màn khác chọn mã bằng `CatalogLookup` / `CatalogMultiLookup lookup="<tra-cuu>"` (§4), không gọi `getAll` của danh mục.

## Bước 4. Kiểm tra (bắt buộc, báo kết quả thật)

1. Dừng backend nếu đang chạy (DLL bị khóa), rồi:
   ```bash
   cd /d/TungLV/Project/PhanMemQL/ServerService && dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj
   cd /d/TungLV/Project/PhanMemQL/Frontend && npm run lint && npm run check-i18n
   ```
   Có sẵn 2 lỗi `tsc` cũ không liên quan: `WarehouseCategoryView.tsx` và `LanguageCategoryView.tsx`. Chỉ cần không có lỗi mới.
2. Chạy `backend` và `frontend` bằng preview (`.claude/launch.json`), đăng nhập `admin` / `admin`. Mật khẩu admin đặt lại mỗi lần backend khởi động, nên token cũ mất hiệu lực.
3. Thử bằng script API (đặt trong scratchpad) và trình duyệt:
   - thêm, sửa, xóa;
   - trùng mã / tên ra thông báo dễ hiểu;
   - sửa với `version` cũ → 409;
   - nhập Excel có dòng sai thì không lưu dòng nào;
   - xóa nhiều;
   - `GET /api/lookups/<tra-cuu>?q=` trả đúng;
   - Cài đặt › Nhật ký thay đổi có các dòng Tạo / Sửa / Xóa;
   - tài khoản không có quyền Xem: `GET` danh sách → 403, tra cứu → 200.
4. Xóa dữ liệu thử: bản ghi, tài khoản thử và dòng nhật ký của chúng.

Lỗi thường gặp và cách sửa: §7.3.

## Bước 5. Báo cáo

Báo bằng tiếng Việt, ngắn:
- danh sách file thêm / sửa (link `[file](path)`);
- đã chạy script SQL nào;
- kết quả test và lint (số test qua, lỗi nếu có, kèm output);
- đã thử gì trên trình duyệt / API;
- đã dọn dữ liệu thử;
- việc người dùng còn phải làm: cấp quyền cho vai trò ở Cài đặt › Người dùng & phân quyền.

Cập nhật tài liệu nếu danh mục thay đổi danh sách chức năng chạy backend: dòng "Backend-backed" trong `CLAUDE.md` và bảng API trong `ServerService/README.md`.

Không commit.
