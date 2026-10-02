# Thêm một danh mục mới (backend + frontend)

Tài liệu này hướng dẫn từng bước thêm một danh mục chạy thật trên backend, từ bảng trong database đến màn hình, phân quyền, Excel, tra cứu và kiểm tra. Ví dụ xuyên suốt là **Danh mục nhà cung cấp**.

Mẫu để copy là **Danh mục đơn vị tính**. Đây là mẫu đầy đủ và mới nhất: bảng `erp_*`, nhật ký tự động, cột người tạo / người sửa, chống ghi đè, Excel, xóa nhiều, tra cứu, hai ngôn ngữ.

| Lớp | File mẫu |
| --- | --- |
| SQL | `ServerService/sql/postgresql/13-inventory-uom.sql` |
| Entity | `ServerService/Core.Domain/Modules/Inventory/Uom.cs` |
| Contract (DTO, interface) | `ServerService/Core.Application/Modules/Inventory/UomContracts.cs` |
| Service | `ServerService/Core.Infrastructure/Modules/Inventory/UomService.cs` |
| Controller | `ServerService/Core/Modules/Inventory/UomsController.cs` |
| Tra cứu | `ServerService/Core.Infrastructure/DependencyInjection.cs` (dòng `AddLookup(... "uoms" ...)`) |
| Màn hình | `Frontend/src/modules/inventory/uom/` (`UomCategoryView.tsx`, `api.ts`, `types.ts`, `index.ts`) |

---

## Phần 0. Bức tranh chung

### 0.1. Một danh mục gồm những gì

```
 Trình duyệt                                   Backend (.NET)                                  PostgreSQL
 ──────────────────────────────────────────    ─────────────────────────────────────────────   ───────────────
 SupplierCategoryView  (chỉ khai báo)
   └─ CatalogScreen    (khung chung)
        ├─ useCatalog ─── suppliersApi ──────► SuppliersController  (kiểm tra quyền)
        │                                        └─ SupplierService (kiểm tra dữ liệu)
        │                                             └─ CoreContext (EF) ─────────────────► erp_supplier
        │                                                  ├─ tự điền created_* / updated_*
        │                                                  ├─ tự ghi nhật ký ──────────────► sys_audit_log
        │                                                  ├─ chống ghi đè (xmin)
        │                                                  └─ tự xóa cache của bảng
        ├─ Excel (xuất / nhập) ────────────────► .../import, .../delete-many (CatalogBatch)
        └─ Cột (ẩn / hiện, độ rộng) ───────────► /api/grid-layouts ─────────────────────────► sys_grid_layout

 Màn khác (phiếu, báo cáo)
   └─ CatalogLookup / CatalogMultiLookup ────► /api/lookups/suppliers (LookupService)
```

### 0.2. Phải viết và không phải viết

| Bạn viết | Hệ thống tự có |
| --- | --- |
| Bảng SQL | Cột người tạo / người sửa (điền khi lưu) |
| Entity + `[Audited]` | Nhật ký thay đổi từng trường (trước → sau) |
| DTO, request, service (kiểm tra dữ liệu, chặn xóa khi đang dùng) | Chống ghi đè khi hai người cùng sửa (lỗi 409) |
| Controller (gắn quyền cho từng API) | Báo trùng mã / trùng tên dạng dễ hiểu kể cả khi lọt kiểm tra (409) |
| 1 dòng đăng ký tra cứu | Nhập Excel cả file hoặc không dòng nào, lỗi theo từng dòng |
| Khóa thông báo lỗi (vi + en) | Cache danh sách, tự xóa khi bảng đổi |
| Mã chức năng (backend + frontend), mục menu | Dòng trong ma trận phân quyền, route, breadcrumb |
| Màn hình: cột, form, cột Excel (khai báo) | Thanh công cụ, tìm kiếm không dấu, bộ lọc trạng thái, phân trang, xuất / nhập Excel, file mẫu, xóa nhiều, ẩn nút theo quyền, hộp xác nhận, thông báo, chọn cột / độ rộng / sắp xếp lưu theo người dùng |
| Chữ hiển thị (vi + en) | |

### 0.3. Tên dùng trong ví dụ

| Thông tin | Giá trị ví dụ | Ghi chú |
| --- | --- | --- |
| Mã chức năng | `inv_supplier_cat` | Khóa chung của menu, route, phân quyền, nhật ký, bố cục lưới. Chữ thường, dấu `_`, kết thúc `_cat` cho danh mục. **Không đổi sau khi đã dùng** (quyền và nhật ký lưu theo mã này) |
| Bảng | `erp_supplier` | Bảng nghiệp vụ `erp_*`, cột `snake_case` |
| Entity / loại đối tượng | `Supplier` / `supplier` | `supplier` hiện ở màn Nhật ký thay đổi |
| Phân hệ backend | `Inventory` | Thư mục `Modules/Inventory/` ở cả 4 project |
| API | `api/inventory/suppliers` | Số nhiều, chữ thường |
| Tên tra cứu | `suppliers` | `GET /api/lookups/suppliers` |
| Đường dẫn màn | `/inventory/suppliers` | |
| Thư mục màn | `Frontend/src/modules/inventory/suppliers/` | |

Đổi các tên này cho danh mục của bạn. Làm theo thứ tự: **SQL → backend → frontend → phân quyền → kiểm tra**.

---

## Phần 1. Database

### 1.1. Tạo script SQL — `ServerService/sql/postgresql/NN-<ten>.sql` (thêm mới)

`NN` là số tiếp theo trong thư mục (hiện có đến `14`), ví dụ `15-inventory-supplier.sql`. Script phải **chạy lại nhiều lần không lỗi**: dùng `IF NOT EXISTS`, không `DROP`.

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

```bash
"C:/Program Files/PostgreSQL/15/bin/psql.exe" -h localhost -U postgres -d erp_dev -f ServerService/sql/postgresql/15-inventory-supplier.sql
```

Database mới: chạy **mọi** file trong `sql/postgresql/` theo thứ tự tên (`00-helpers.sql` trước).

---

## Phần 2. Backend (`ServerService/`)

Phụ thuộc một chiều: `Core` (controller) → `Core.Infrastructure` (service, EF) → `Core.Application` (DTO, interface) → `Core.Domain` (entity).

### 2.1. Khai báo mã chức năng — `Core.Application/Common/Permissions/FunctionCatalog.cs` (sửa)

Thêm một dòng vào danh sách:

```csharp
["inv_supplier_cat"] = "Danh mục nhà cung cấp",
```

Khi khởi động, API tự thêm mã vào bảng `sys_command`, nên mã hiện trong ma trận phân quyền với 7 quyền (Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất).

Tên tiếng Anh của chức năng — `Core.Application/Common/Localization/Messages.en.json` (sửa):

```json
"function.inv_supplier_cat": "Suppliers",
```

### 2.2. Entity — `Core.Domain/Modules/Inventory/Supplier.cs` (thêm mới)

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>Nhà cung cấp. Goods receipts link to it by code.</summary>
[Audited("inv_supplier_cat", "supplier", Label = "{Code} - {Name}")]
[Table("erp_supplier")]
public class Supplier : ErpEntity
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
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
| `[Audited("mã chức năng", "loại đối tượng", Label = ...)]` | Mọi thêm / sửa / xóa tự ghi vào Nhật ký thay đổi: ai, lúc nào, trường nào trước → sau. `Label` là chữ hiện ở cột "Đối tượng", dùng tên property trong `{}`. Bảng không cần nhật ký thì ghi `[NotAudited("lý do")]` |

Tùy chọn:

| Khai báo | Khi nào dùng |
| --- | --- |
| `[AuditIgnore]` trên property | Cột không được ghi nhật ký (mật khẩu, token, cột kỹ thuật) |
| `[AuditField("tên")]` | Đặt tên trường dễ đọc cho cột tên xấu |
| `[AuditJson]` | Cột chứa JSON: ghi từng khóa thay đổi |
| `SoftDelete = nameof(Cột)` trong `[Audited]` | Danh mục xóa mềm: cờ về 0 / false thì ghi là "Xóa" |
| `[AuditedChild]` | Bảng dòng con (danh sách chi tiết) ghi chung vào nhật ký của bản ghi cha |

### 2.3. Đăng ký bảng — `Core.Infrastructure/Common/Persistence/CoreContext.cs` (sửa)

```csharp
    // Inventory
    public DbSet<Uom> Uoms => Set<Uom>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
```

Chỉ cần dòng `DbSet`. Ánh xạ `xmin`, cột người tạo / sửa và nhật ký đã có sẵn cho mọi entity.

### 2.4. Contract — `Core.Application/Modules/Inventory/SupplierContracts.cs` (thêm mới)

```csharp
using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

/// <summary>Stamp = người tạo / người sửa và thời điểm; Version = phiên bản bản ghi (tự có cho mọi bảng erp_*).</summary>
public sealed record SupplierDto(string Code, string Name, string? TaxCode, string? Phone, string? Address,
    string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

/// <summary>Version: phiên bản lúc màn hình tải bản ghi (chống ghi đè khi 2 người cùng sửa).</summary>
public sealed record SaveSupplierRequest(string Code, string Name, string? TaxCode, string? Phone, string? Address,
    string? Note, bool IsActive = true, uint? Version = null);

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierDto>> GetAllAsync(CancellationToken ct);
    Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed.</summary>
    Task<SupplierDto> UpdateAsync(string code, SaveSupplierRequest request, CancellationToken ct);

    /// <summary>Refused while other data uses it (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);

    /// <summary>Nhập Excel: every row checked like the form, all saved or none (CatalogBatch).</summary>
    Task<ImportResult> ImportAsync(ImportRequest<SaveSupplierRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
```

- DTO có `RecordStampDto Stamp` và `uint Version`; request có `uint? Version = null`. Thiếu thì `ConcurrencyContractTests` báo đỏ.
- Tên property PascalCase; JSON trả về tự thành camelCase (`taxCode`, `isActive`, `stamp`, `version`), khớp kiểu ở frontend (3.4).

### 2.5. Service — `Core.Infrastructure/Modules/Inventory/SupplierService.cs` (thêm mới)

Copy `UomService.cs`, đổi tên:

```csharp
using Core.Application.Common.Caching;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Danh mục nhà cung cấp. Changes are logged automatically ([Audited]).</summary>
public sealed class SupplierService(CoreContext db, IAppCache cache, CatalogBatch batch) : ISupplierService
{
    /// <summary>Cached until erp_supplier (or a user name shown in the stamps) changes.</summary>
    public Task<IReadOnlyList<SupplierDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, "suppliers:all", ["erp_supplier", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<SupplierDto>> LoadAllAsync(CancellationToken ct)
    {
        var rows = await db.Suppliers.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var stamp = await RecordStamps.ForAsync(db, rows, ct);
        return rows.Select(x => ToDto(x, stamp(x))).ToList();
    }

    public async Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.supplierCode");
        if (await db.Suppliers.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("supplier.codeExists", code);
        var row = new Supplier { Code = code, SortOrder = (await db.Suppliers.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        db.Suppliers.Add(row);
        await db.SaveChangesAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct));
    }

    public async Task<SupplierDto> UpdateAsync(string code, SaveSupplierRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        db.ExpectVersion(row, request.Version);
        await ApplyAsync(row, request, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct));
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        // No foreign keys: check every table that links to a supplier before deleting it.
        // if (await db.GoodsReceipts.AnyAsync(x => x.SupplierCode == row.Code, ct))
        //     throw new BusinessRuleException("supplier.inUse", row.Name);
        db.Suppliers.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveSupplierRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.Suppliers.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<Supplier> FindAsync(string code, CancellationToken ct) =>
        await db.Suppliers.FirstOrDefaultAsync(x => x.Code == code, ct) ?? throw new NotFoundException("supplier.notFound");

    private async Task ApplyAsync(Supplier row, SaveSupplierRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.supplierName");
        if (await db.Suppliers.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("supplier.nameExists", name);
        row.Name = name;
        row.TaxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
        row.Phone = Guard.Optional(request.Phone, 30, "field.phone");
        row.Address = Guard.Optional(request.Address, 300, "field.address");
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    private static SupplierDto ToDto(Supplier x, RecordStampDto stamp) =>
        new(x.Code, x.Name, x.TaxCode, x.Phone, x.Address, x.Note, x.IsActive, stamp, x.Version);
}
```

Giải thích từng phần:

**Kiểm tra dữ liệu — `Guard`** (`Core.Application/Common/Validation/`)

| Hàm | Làm gì |
| --- | --- |
| `Guard.Code(value, max, "field.x")` | Bắt buộc, cắt khoảng trắng, viết hoa, không chứa khoảng trắng, `:` hay `,`, không quá `max` ký tự |
| `Guard.Required(value, max, "field.x")` | Bắt buộc, cắt khoảng trắng, không quá `max` |
| `Guard.Optional(value, max, "field.x")` | Không bắt buộc; chuỗi rỗng thành `null` |

Tham số cuối là khóa `field.*` (tên trường trong thông báo, ví dụ "Vui lòng nhập tên nhà cung cấp"). Khóa đặt ở 2.8.

**Lỗi nghiệp vụ.** `throw new BusinessRuleException("khóa", tham số)` → HTTP 400 `{ message }`. **Không viết câu văn** trong `throw`: `MessagesTests` báo đỏ. Các loại lỗi khác:

| Exception | HTTP | Dùng khi |
| --- | --- | --- |
| `BusinessRuleException("khóa", ...)` | 400 | Dữ liệu sai, trùng, đang được dùng |
| `NotFoundException("khóa")` | 404 | Không có bản ghi |
| `ForbiddenException` | 403 | Thường không cần: controller đã kiểm tra quyền |
| `ConflictException("record.changed")` | 409 | Tự có qua `ExpectVersion`, không tự ném |

**Chống ghi đè.** Trong `UpdateAsync` gọi `db.ExpectVersion(row, request.Version)` **ngay sau khi tải bản ghi**. Nếu người khác đã sửa hoặc xóa bản ghi sau khi màn hình mở, API trả 409 (`record.changed`) và màn hình tải lại, thay vì âm thầm đè mất thay đổi của họ. Lần lưu chỉ sửa dòng con mà không sửa dòng chính thì dùng `db.ExpectVersion(row, request.Version, touch: true)` (xem `RoleService.UpdateAsync`). Thiếu dòng này thì `ConcurrencyContractTests` báo đỏ. Chi tiết: [chong-ghi-de.md](chong-ghi-de.md).

**Trùng dữ liệu.** Nên kiểm tra trước (`supplier.codeExists`, `supplier.nameExists`) để có thông báo riêng. Nếu vẫn lọt (hai người lưu cùng lúc, hoặc chỉ có unique index), `DatabaseErrors` tự đổi lỗi PostgreSQL thành 409 dạng *Mã "NCC01" đã tồn tại*, không bao giờ là 500. Tên trường trong thông báo lấy từ khóa `dbfield.<tên cột>` (ví dụ `dbfield.tax_code`) trong `Messages.*.json`; cột chưa có khóa thì hiện "Giá trị".

**Không có khóa ngoại**, nên service tự kiểm tra:
- Khi **xóa**: tìm trong mọi bảng tham chiếu đến danh mục này; còn dùng thì ném `supplier.inUse` (gợi ý người dùng đặt "Ngừng sử dụng").
- Khi **lưu một trường tham chiếu danh mục khác** (ví dụ nhóm nhà cung cấp): kiểm tra mã đó có và đang dùng, xem Phần 6.

**Nhập Excel / xóa nhiều — `CatalogBatch`.** `ImportAsync` và `DeleteManyAsync` gọi lại đúng `CreateAsync` / `UpdateAsync` / `DeleteAsync` ở trên, nên mọi kiểm tra của form, nhật ký và cột người tạo / sửa đều áp dụng cho từng dòng.
- Tất cả trong **một transaction**, mỗi dòng có savepoint riêng. Có dòng lỗi thì **không lưu dòng nào**; lỗi trả về theo số dòng.
- Giới hạn 5000 dòng mỗi lần, dừng kiểm tra sau 200 lỗi (`CatalogBatchLimits`).
- Tham số thứ hai của `ImportAsync` lấy khóa của dòng (chuẩn hóa giống `Guard.Code`); tham số thứ ba hỏi khóa đã có chưa, để chọn thêm mới hay cập nhật.
- `row with { Version = null }`: nhập Excel cập nhật theo dữ liệu trong file, không so phiên bản.

**Cache.** `db.CachedAsync(cache, khóa, [các bảng], hàm đọc, ct)`:
- Kết quả giữ trong bộ nhớ đến khi một trong các bảng được ghi (qua EF), lúc đó tự xóa. **Không phải tự xóa cache** khi thêm / sửa / xóa.
- Thêm `"sys_users"` vì DTO có tên người tạo / sửa.
- Bên trong transaction đang mở thì đọc thẳng database.
- Chỉ dùng cho dữ liệu đọc nhiều, ít đổi. **Không** cache tồn kho, số dư, số chứng từ, khóa sổ.
- Ghi bằng Dapper / SQL thuần thì phải gọi `cache.InvalidateTables("erp_supplier")`.
- Sửa thẳng trong pgAdmin thì cache không biết: khởi động lại backend.

**Không làm trong service**: gán `CreatedAt / CreatedBy / UpdatedAt / UpdatedBy`, gọi ghi nhật ký, kiểm tra quyền. `CoreContext` và controller đã làm. Chỉ ghi nhật ký bằng tay (`IAuditLog`) khi dùng `ExecuteUpdate` / `ExecuteDelete` / SQL thuần, vì các lệnh này không đi qua EF (ví dụ `CurrencyService.SaveAsync`). Lưu nhiều bước (EF + SQL thuần) thì gói trong `IUnitOfWork.ExecuteAsync(...)`.

### 2.6. Đăng ký service và tra cứu — `Core.Infrastructure/DependencyInjection.cs` (sửa)

```csharp
services.AddScoped<IUomService, UomService>();
services.AddScoped<ISupplierService, SupplierService>();
```

**Tra cứu** (ô chọn mã + F2 ở màn khác). Thêm một dòng cạnh dòng `"uoms"`:

```csharp
services.AddLookup(new LookupDefinition("suppliers", db => db.Suppliers.Select(x =>
    new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.TaxCode, Extra2 = x.Phone }),
    "taxCode", "phone"));
```

- `"suppliers"` là tên tra cứu, dùng ở URL và ở `CatalogLookup lookup="suppliers"`.
- `Extra1..3`: tối đa 3 cột phụ hiện trong hộp tra cứu; các chuỗi cuối (`"taxCode"`, `"phone"`) là tên của chúng trong kết quả (`extra.taxCode`).
- Phép chiếu `Select` được dịch thành SQL, nên chỉ dùng cột của bảng, không gọi hàm C#.

Không phải viết controller cho tra cứu. API chung `Core/Modules/Lookups/LookupsController.cs` có sẵn, mở cho **mọi người đã đăng nhập**:

| API | Trả về |
| --- | --- |
| `GET /api/lookups/suppliers?q=abc&page=1&pageSize=20&includeInactive=false` | `{ items: [{ code, name, isActive, extra: { taxCode, phone } }], total }`. Tìm một phần chữ trong mã hoặc tên, không phân biệt hoa thường; mã trùng khớp đứng đầu, rồi mã bắt đầu bằng chữ tìm; mặc định bỏ bản ghi ngừng dùng |
| `GET /api/lookups/suppliers/codes?codes=NCC001,NCC002` | Các bản ghi theo danh sách mã (để hiện tên cạnh mã đã lưu) |

### 2.7. Controller — `Core/Modules/Inventory/SuppliersController.cs` (thêm mới)

```csharp
using Core.Application.Common.Catalogs;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục nhà cung cấp (function inv_supplier_cat).</summary>
[Route("api/inventory/suppliers")]
public sealed class SuppliersController(ISupplierService suppliers, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_supplier_cat";

    /// <summary>The full catalog, for users who may view it. Other screens pick suppliers with the lookup
    /// (GET /api/lookups/suppliers).</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<SupplierDto>> GetAll(CancellationToken ct) => suppliers.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<SupplierDto> Create(SaveSupplierRequest request, CancellationToken ct) => suppliers.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<SupplierDto> Update(string code, SaveSupplierRequest request, CancellationToken ct) =>
        suppliers.UpdateAsync(code, request, ct);

    /// <summary>Nhập Excel. Mode "upsert" also updates existing codes and needs the edit right too.</summary>
    [HttpPost("import"), RequirePermission(Function, PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<SaveSupplierRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert) await permissions.EnsureAllowedAsync(CurrentUserId, Function, PermissionAction.Edit, ct);
        return await suppliers.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), RequirePermission(Function, PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) =>
        suppliers.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await suppliers.DeleteAsync(code, ct);
        return NoContent();
    }
}
```

- Kế thừa `ApiControllerBase`: bắt buộc đăng nhập và có quyền vào đơn vị cơ sở của phiên.
- `private const string Function` là bắt buộc: `ReadAccessContractTests` dựa vào nó để kiểm tra mọi `GET`.
- Controller chỉ gắn quyền và gọi service, không chứa logic.

Quyền của từng API:

| API | Quyền | Ghi chú |
| --- | --- | --- |
| `GET` | **Xem** | Danh sách đầy đủ. Màn khác chọn mã qua tra cứu (2.6), không gọi API này |
| `POST` | **Thêm** | |
| `PUT /{code}` | **Sửa** | |
| `DELETE /{code}` | **Xóa** | |
| `POST /import` | **Thêm**; chế độ `upsert` cần thêm **Sửa** | Body `{ rows: [...], mode: "create" \| "upsert" }` |
| `POST /delete-many` | **Xóa** | Body `{ keys: ["NCC001", ...] }` |

**Quy tắc đọc dữ liệu.** `GET` của controller có `Function` luôn phải có `RequirePermission`. Người chỉ cần chọn mã (người lập phiếu) dùng tra cứu: chỉ có mã, tên, vài cột khai báo, phân trang, nên không kéo được cả danh mục về. `ReadAccessContractTests` báo đỏ khi thiếu; ngoại lệ thật sự cần thì ghi vào danh sách `Exempt` của test kèm lý do.

### 2.8. Thông báo lỗi — `Core.Application/Common/Localization/Messages.vi.json` và `Messages.en.json` (sửa cả hai)

```json
"field.supplierCode": "mã nhà cung cấp",
"field.supplierName": "tên nhà cung cấp",
"supplier.notFound": "Nhà cung cấp không tồn tại.",
"supplier.codeExists": "Mã nhà cung cấp {0} đã tồn tại.",
"supplier.nameExists": "Tên nhà cung cấp \"{0}\" đã tồn tại.",
"supplier.inUse": "Nhà cung cấp \"{0}\" đang được dùng. Hãy đặt ngừng sử dụng thay vì xóa.",
"dbfield.tax_code": "Mã số thuế"
```

- Bản tiếng Anh thêm đúng các khóa đó (`"supplier.notFound": "The supplier does not exist."`...).
- `{0}`, `{1}` là tham số truyền vào `BusinessRuleException`.
- Khóa có sẵn thì dùng lại, không thêm trùng: `field.phone`, `field.address`, `field.taxCode`, `field.note`... (tìm trong file trước khi thêm).
- `dbfield.*` chỉ cần cho cột có unique index mà chưa có khóa.
- `MessagesTests` báo đỏ khi một khóa thiếu ở một trong hai file, hoặc `throw` chứa câu tiếng Việt.

### 2.9. Quyền đặc biệt (chỉ khi cần) — `Core.Application/Common/Permissions/SpecialRightCatalog.cs`

Ví dụ "xem giá", "sửa phiếu đã duyệt". Mã dạng `{chức năng}:{MÃ}` (`inv_supplier_cat:VIEW_DEBT`), kiểm tra bằng `[RequireRight(...)]` ở controller và `hasRight(...)` ở frontend. Danh mục thường không cần.

---

## Phần 3. Frontend (`Frontend/src/`)

### 3.1. Mã chức năng — `types/index.ts` (sửa)

Thêm vào kiểu `SubMenuKey`:

```ts
  | 'inv_supplier_cat'          // Danh mục nhà cung cấp
```

### 3.2. Đăng ký chức năng — `config/functions.ts` (sửa)

```ts
  inv_supplier_cat: fn('inventory', '/inventory/suppliers', 'Nhà cung cấp', 'catalog'),
```

Tham số: phân hệ, đường dẫn, tên, loại (`'catalog'` cho danh mục). Từ dòng này hệ thống tự có route, tiêu đề, breadcrumb và dòng trong ma trận phân quyền. Thiếu dòng này thì `npm run lint` báo lỗi (`FUNCTION_REGISTRY` có kiểu `Record<SubMenuKey, …>`).

Tên tiếng Anh — `locales/en/common.json` (sửa), mục `function`:

```json
"inv_supplier_cat": "Suppliers"
```

Tên trên menu / tab theo ngôn ngữ — `locales/vi/common.json` và `locales/en/common.json` (sửa cả hai), mục `menu.subMenus` (cạnh `inv_uom_cat`):

```json
"inv_supplier_cat": "Danh mục nhà cung cấp"
```

### 3.3. Mục menu — `mock/initialMenuData.ts` (sửa)

Thêm vào nhóm danh mục của phân hệ (copy mục `MNU_INV_UOM`):

```ts
          {
            id: 'MNU_INV_SUPPLIER',
            subKey: 'inv_supplier_cat',
            titleVi: 'Danh mục nhà cung cấp',
            titleEn: 'Suppliers',
            icon: 'Truck',
            orderNo: 55,
            isActive: true
          },
```

- `icon` là tên icon của lucide-react. Icon chưa dùng ở đâu thì thêm tên đó vào **cả hai chỗ** trong `components/common/DynamicIcon.tsx` (dòng `import` và bảng tên icon); không thêm thì menu hiện icon mặc định.
- `orderNo` quyết định thứ tự trong nhóm.
- Menu chỉ hiện với người có quyền Xem chức năng.

### 3.4. Thư mục chức năng — `modules/inventory/suppliers/` (thêm mới, copy từ `modules/inventory/uom/`)

#### `types.ts`

Khớp với DTO và request của backend (2.4), tên trường camelCase.

```ts
import type { RecordStamp } from '../../../components/common/RecordStamp';

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

Mọi lệnh gọi backend đi qua `apiRequest` (gắn token, ngôn ngữ, xử lý 401); **không gọi `fetch` trực tiếp**.

```ts
// Kho › Danh mục nhà cung cấp (backend /api/inventory/suppliers, function inv_supplier_cat).
import { apiRequest } from '../../../services/apiClient';
import type { CatalogScreenApi, DeleteManyResult, ImportMode, ImportResult } from '../../../components/catalog/catalogTypes';
import { SaveSupplierInput, Supplier } from './types';

export const suppliersApi: CatalogScreenApi<Supplier, SaveSupplierInput> = {
  /** Full catalog: needs the view right. Other screens pick suppliers with CatalogLookup lookup="suppliers". */
  getAll: () => apiRequest<Supplier[]>('GET', '/api/inventory/suppliers'),
  create: (input: SaveSupplierInput) => apiRequest<Supplier>('POST', '/api/inventory/suppliers', input),
  update: (code: string, input: SaveSupplierInput) =>
    apiRequest<Supplier>('PUT', `/api/inventory/suppliers/${encodeURIComponent(code)}`, input),
  remove: (code: string) => apiRequest<void>('DELETE', `/api/inventory/suppliers/${encodeURIComponent(code)}`),
  /** Nhập Excel: all rows saved or none; errors by row. */
  importMany: (rows: SaveSupplierInput[], mode: ImportMode) =>
    apiRequest<ImportResult>('POST', '/api/inventory/suppliers/import', { rows, mode }),
  removeMany: (keys: string[]) => apiRequest<DeleteManyResult>('POST', '/api/inventory/suppliers/delete-many', { keys })
};
```

Không có `importMany` thì màn ẩn nút Nhập Excel; không có `removeMany` thì không có ô chọn nhiều dòng để xóa.

#### `SupplierCategoryView.tsx`

Màn danh mục chỉ **khai báo** một `CatalogDefinition` rồi giao cho `CatalogScreen`. Không tự viết thanh công cụ, tìm kiếm, lọc, Excel, xóa nhiều, hộp xác nhận hay kiểm tra quyền.

```tsx
// Kho › Danh mục nhà cung cấp (inv_supplier_cat), backed by the API (erp_supplier). See docs/them-danh-muc.md.
import React, { useMemo } from 'react';
import { Truck } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import { UserProfile } from '../../../types';
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
    searchText: s => `${s.code} ${s.name} ${s.taxCode ?? ''} ${s.phone ?? ''} ${s.address ?? ''}`,
    filters: [{
      key: 'hasTaxCode', label: t('suppliers.taxCode'),
      options: [{ value: 'yes', label: t('suppliers.hasTaxCode') }, { value: 'no', label: t('suppliers.noTaxCode') }],
      match: (s, value) => (value === 'yes') === !!s.taxCode
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
| `searchText` | Chữ ô tìm kiếm tìm trong; gõ không dấu vẫn tìm được. Bỏ trống thì tìm mọi trường chữ / số |
| `filters` | Bộ lọc thêm (`key`, `label`, `options`, `match`). Bộ lọc **Trạng thái** có sẵn khi bản ghi có `isActive` |
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

| Phần | Cần quyền |
| --- | --- |
| Nạp lại, ô tìm kiếm, đếm số dòng, bộ lọc, phân trang | Xem |
| Nút **Cột**: ẩn / hiện, đổi thứ tự cột, kéo mép tiêu đề đổi độ rộng, sắp xếp, số dòng mỗi trang; lưu theo từng người trên server (`sys_grid_layout`). Quản trị viên lưu được **bố cục mặc định cho cả công ty** | Xem |
| Nút Thêm, form thêm | Thêm |
| Nút sửa, bấm vào dòng để sửa; chống ghi đè (có người sửa trước thì báo và tải lại) | Sửa |
| Nút xóa; chọn nhiều dòng → **Xóa các dòng đã chọn** (có dòng không xóa được thì không xóa dòng nào) | Xóa |
| **Xuất Excel** (`.xlsx` thật, đúng danh sách đang lọc và tìm) | Xuất |
| **Nhập Excel**: tải file mẫu, chọn file, xem trước từng dòng và lỗi, chọn "Chỉ thêm mới" hoặc "Thêm mới và cập nhật mã đã có" (cần thêm quyền Sửa); lỗi từ server hiện đúng số dòng Excel | Thêm |
| Thông báo lưu / xóa, lỗi từ API, dòng "Tạo: … · Sửa: …" trong form | |

Việc ẩn nút ở frontend chỉ để hiển thị; quyền thật được backend kiểm tra ở controller (2.7).

### 3.6. Chữ hiển thị — `locales/vi/inventory.json` và `locales/en/inventory.json` (sửa cả hai)

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

```tsx
import { SupplierCategoryView } from './suppliers';
...
      case 'inv_supplier_cat':
        return <SupplierCategoryView currentUser={currentUser} />;
```

- Danh mục thuộc phân hệ khác: sửa file `*Module.tsx` của phân hệ đó.
- Danh mục thuộc Cài đặt: thêm `case` vào `renderScreen` trong `modules/settings/SettingsModule.tsx`.
- Trước đó danh mục này là dữ liệu mẫu (mock): bỏ prop dữ liệu mẫu truyền vào màn. Dữ liệu mẫu trong `mock/initialERPData.ts` chỉ giữ lại nếu màn khác chưa chuyển lên backend vẫn còn đọc.

---

## Phần 4. Dùng danh mục ở màn khác (tra cứu)

Màn khác **không** gọi `suppliersApi.getAll` (cần quyền Xem danh mục). Dùng ô tra cứu với tên đã đăng ký ở 2.6. Cả hai nằm trong `components/catalog/CatalogLookup.tsx`.

### 4.1. Chọn một mã — `CatalogLookup`

Ví dụ ô nhà cung cấp trên phiếu nhập kho:

```tsx
import { CatalogLookup } from '../../../components/catalog/CatalogLookup';

<CatalogLookup lookup="suppliers" label={t('receipts.supplier')} required value={form.supplierCode}
  onChange={(code, item) => setForm({ ...form, supplierCode: code })}
  extraColumns={[{ key: 'taxCode', title: t('suppliers.taxCode') }]} />
```

- Gõ mã rồi Enter (hoặc rời ô): nhận nếu đúng mã đang dùng, sai thì báo.
- F2 hoặc nút kính lúp: mở hộp tìm trên server (↑ ↓ chọn, Enter lấy, Esc đóng).
- Tên hiện bên cạnh mã. `item` (tham số thứ hai) có `name` và `extra` nếu cần điền thêm ô khác.
- `extraColumns`: cột phụ trong hộp tìm, `key` là tên đã khai báo ở `AddLookup`.

### 4.2. Chọn nhiều mã — `CatalogMultiLookup`

Ví dụ lọc báo cáo theo nhiều nhà cung cấp; giá trị là mảng mã:

```tsx
import { CatalogMultiLookup } from '../../../components/catalog/CatalogLookup';

<CatalogMultiLookup lookup="suppliers" label={t('report.suppliers')} value={filter.suppliers}
  onChange={(codes, items) => setFilter({ ...filter, suppliers: codes })} max={50} />
```

- Mã đã chọn hiện thành thẻ: × để bỏ, Backspace bỏ mã cuối.
- Gõ nhiều mã cách nhau bằng dấu phẩy rồi Enter để thêm nhanh; mã không có hoặc ngừng dùng sẽ được báo.
- F2 mở hộp tìm có ô tích từng dòng, ô tích các dòng đang hiện, giữ lựa chọn khi tìm chữ khác, nút **Bỏ chọn tất cả** và **Xong** (hoặc Ctrl+Enter).
- `max` (tùy chọn) giới hạn số mã.

Props chung của hai control: `lookup`, `label`, `required`, `disabled`, `placeholder`, `extraColumns`, `title` (tiêu đề hộp tìm), `className`.

---

## Phần 5. Danh mục có trường tham chiếu danh mục khác

Ví dụ nhà cung cấp có **nhóm nhà cung cấp** (`group_code`, tra cứu `supplierGroups`). Không có khóa ngoại, nên tự làm 4 việc:

1. **SQL**: thêm cột và index.
   ```sql
   ALTER TABLE erp_supplier ADD COLUMN IF NOT EXISTS group_code varchar(20);
   CREATE INDEX IF NOT EXISTS ix_erp_supplier_group_code ON erp_supplier (group_code);
   ```
2. **Service danh mục con**: khi lưu, kiểm tra mã có và đang dùng.
   ```csharp
   row.GroupCode = Guard.Optional(request.GroupCode, 20, "field.supplierGroup")?.ToUpperInvariant();
   if (row.GroupCode is not null && !await db.SupplierGroups.AnyAsync(x => x.Code == row.GroupCode && x.IsActive, ct))
       throw new BusinessRuleException("supplierGroup.notFound", row.GroupCode);
   ```
3. **Service danh mục cha**: chặn xóa khi còn được dùng.
   ```csharp
   if (await db.Suppliers.AnyAsync(x => x.GroupCode == row.Code, ct))
       throw new BusinessRuleException("supplierGroup.inUse", row.Name);
   ```
4. **Form**: dùng `CatalogLookup` trong `renderForm`, thêm cột vào `excel.columns` (người dùng nhập mã nhóm trong file; sai mã thì lỗi hiện đúng dòng).
   ```tsx
   <CatalogLookup lookup="supplierGroups" label={t('suppliers.group')} value={form.groupCode}
     onChange={groupCode => setForm({ ...form, groupCode })} />
   ```

Muốn hiện **tên** nhóm trong lưới: trả thêm `GroupName` trong DTO (đọc tên các nhóm bằng một truy vấn trong `LoadAllAsync`, giống `RecordStamps.ForAsync`). Khi đó thêm `"erp_supplier_group"` vào danh sách bảng của `CachedAsync`, để đổi tên nhóm thì danh sách nhà cung cấp cũng làm mới.

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
| `ReadAccessContractTests` | `GET` của controller có `Function` thiếu `RequirePermission` |
| `EveryEntityDeclaresItsChangeLog` | Entity thiếu `[Audited]` / `[NotAudited]` |
| `AuditDeclarationsNameExistingProperties` | Mã chức năng trong `[Audited]` chưa có ở `FunctionCatalog`, hoặc `Label` dùng property không tồn tại |
| `MessagesTests` | Khóa thông báo thiếu ở `Messages.vi.json` / `Messages.en.json`, hoặc `throw` viết câu tiếng Việt |
| `npm run lint` | Thiếu mã trong `SubMenuKey` / `FUNCTION_REGISTRY`, sai kiểu giữa `types.ts` và `CatalogDefinition` |
| `npm run check-i18n` | Khóa có ở tiếng Việt mà thiếu ở tiếng Anh; chữ tiếng Việt gõ cứng trong màn (hiện chỉ quét phần dùng chung và Cài đặt) |

### 7.2. Chạy thử trên trình duyệt

1. Khởi động lại backend, mở `http://localhost:3000`, đăng nhập `admin`.
2. Menu có mục mới. Thêm, sửa, xóa một bản ghi; thử trùng mã / trùng tên: phải ra thông báo dễ hiểu.
3. **Chống ghi đè**: mở cùng một bản ghi ở hai tab, lưu ở tab 1 rồi lưu ở tab 2: tab 2 báo bản ghi đã bị người khác sửa và tải lại.
4. **Xuất Excel** ra `.xlsx` đúng danh sách đang lọc. **Tải file mẫu**, điền vài dòng (có một dòng sai), **Nhập Excel**: dòng sai báo lỗi đúng số dòng và không dòng nào được lưu; sửa file rồi nhập lại thành công.
5. Chọn vài dòng → **Xóa các dòng đã chọn**.
6. Nút **Cột**: ẩn một cột, kéo đổi độ rộng, tải lại trang: bố cục còn nguyên.
7. Cột **Người tạo / Người sửa** có tên và giờ.
8. **Cài đặt › Nhật ký thay đổi**: lọc chức năng "Danh mục nhà cung cấp", thấy đủ Tạo mới / Sửa / Xóa với trường trước → sau.
9. Đăng nhập tài khoản thiếu quyền: nút tương ứng phải ẩn (không có Thêm thì ẩn Thêm và Nhập Excel, không có Xuất thì ẩn Xuất Excel...). Không có quyền Xem thì không thấy menu, gọi `GET /api/inventory/suppliers` bị 403 nhưng `GET /api/lookups/suppliers` vẫn được.

Thử xong thì xóa dữ liệu thử (bản ghi, tài khoản thử).

### 7.3. Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| Menu không có mục mới | Thiếu mục trong `initialMenuData.ts`, hoặc tài khoản chưa có quyền Xem |
| Mở màn báo không có quyền dù đã cấp | Backend chưa khởi động lại nên mã chưa có trong `sys_command`; hoặc mã ở frontend và `FunctionCatalog.cs` khác nhau |
| API lỗi 500 "column ... does not exist" | Chưa chạy script SQL, hoặc tên trong `[Column("...")]` khác tên cột |
| `/api/lookups/suppliers` trả 404 "Không có danh mục tra cứu" | Thiếu dòng `AddLookup`, hoặc tên tra cứu khác nhau giữa backend và `lookup="..."` |
| Lưu báo "bản ghi đã bị thay đổi" dù chỉ một người sửa | `toInput` hoặc `normalize` làm mất `version`; hoặc DTO không trả `Version` |
| Thông báo lỗi hiện khóa thô (`supplier.codeExists`) | Thiếu khóa trong `Messages.*.json` |
| Màn hiện chữ dạng `suppliers.title` | Thiếu khóa trong `locales/*/inventory.json` |
| Sửa thẳng trong pgAdmin mà màn vẫn hiện dữ liệu cũ | Cache không biết lệnh ngoài API; khởi động lại backend |
| Nhập Excel báo cột thiếu | Tiêu đề cột trong file khác `header` (hoặc `key`) của `excel.columns`; dùng file mẫu |

---

## Danh sách kiểm tra nhanh

**Thêm mới**
- [ ] `ServerService/sql/postgresql/NN-<ten>.sql` (đã chạy trên database)
- [ ] `Core.Domain/Modules/<PhanHe>/<Ten>.cs` (`: ErpEntity`, `[Audited]`)
- [ ] `Core.Application/Modules/<PhanHe>/<Ten>Contracts.cs` (DTO có `Stamp`, `uint Version`; request có `uint? Version = null`; interface có `ImportAsync` / `DeleteManyAsync`)
- [ ] `Core.Infrastructure/Modules/<PhanHe>/<Ten>Service.cs` (`Guard`, `ExpectVersion` trong `UpdateAsync`, chặn xóa khi đang dùng, `CatalogBatch`, `CachedAsync`)
- [ ] `Core/Modules/<PhanHe>/<Ten>sController.cs` (`const string Function`, `GET` cần Xem, `import`, `delete-many`)
- [ ] `Frontend/src/modules/<phan-he>/<ten>/`: `types.ts` (có `stamp`, `version`), `api.ts` (`CatalogScreenApi`, `importMany` / `removeMany`), `<Ten>CategoryView.tsx` (`CatalogDefinition` cho `CatalogScreen`), `index.ts`

**Sửa**
- [ ] `FunctionCatalog.cs`: mã chức năng
- [ ] `Messages.vi.json` + `Messages.en.json`: khóa lỗi, `field.*`, `dbfield.*` (nếu cần), `function.<mã>` (bản en)
- [ ] `CoreContext.cs`: `DbSet`
- [ ] `DependencyInjection.cs`: đăng ký service + `AddLookup`
- [ ] `types/index.ts`: `SubMenuKey`
- [ ] `config/functions.ts`: `FUNCTION_REGISTRY`
- [ ] `locales/vi|en/common.json`: `menu.subMenus.<mã>` (cả hai), `function.<mã>` (en); tùy chọn `audit.objectType.*` (cả hai)
- [ ] `mock/initialMenuData.ts`: mục menu (+ `DynamicIcon.tsx` nếu icon mới)
- [ ] `locales/vi|en/<phan-he>.json`: chữ của màn
- [ ] `modules/<phan-he>/<PhanHe>Module.tsx`: `case` mở màn
- [ ] Cài đặt › Người dùng & phân quyền: cấp quyền cho vai trò

**Không phải làm** (hệ thống tự có): ghi nhật ký thay đổi, điền người tạo / người sửa, chống ghi đè ở màn hình, báo trùng từ database, xóa cache, dòng trong ma trận phân quyền, route và breadcrumb, ẩn nút theo quyền, hộp xác nhận xóa, tìm kiếm / lọc / phân trang, Excel, xóa nhiều, chọn cột và lưu bố cục, API tra cứu.
