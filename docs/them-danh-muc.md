# Thêm một danh mục mới

Hướng dẫn từng bước thêm một danh mục chạy thật trên backend, ví dụ **Danh mục nhà cung cấp**. Mẫu để copy là **Danh mục đơn vị tính**, mẫu đầy đủ và mới nhất. Nó có bảng `erp_*`, nhật ký tự động, cột người tạo / người sửa và hai ngôn ngữ. File gốc:

| Lớp | File mẫu |
| --- | --- |
| SQL | `ServerService/sql/postgresql/13-inventory-uom.sql` |
| Entity | `ServerService/Core.Domain/Modules/Inventory/Uom.cs` |
| Contract | `ServerService/Core.Application/Modules/Inventory/UomContracts.cs` |
| Service | `ServerService/Core.Infrastructure/Modules/Inventory/UomService.cs` |
| Controller | `ServerService/Core/Modules/Inventory/UomsController.cs` |
| Màn hình | `Frontend/src/modules/inventory/uom/` (`UomCategoryView.tsx`, `api.ts`, `types.ts`, `index.ts`) |

Trong ví dụ dưới đây:

| Thông tin | Giá trị ví dụ | Ghi chú |
| --- | --- | --- |
| Mã chức năng | `inv_supplier_cat` | Khóa chung của menu, route, phân quyền, nhật ký. Chữ thường, `_` |
| Bảng | `erp_supplier` | Bảng nghiệp vụ `erp_*`, cột `snake_case` |
| Entity / loại đối tượng | `Supplier` / `supplier` | `supplier` hiện ở màn Nhật ký thay đổi |
| Phân hệ backend | `Inventory` | Thư mục `Modules/Inventory/` |
| API | `api/inventory/suppliers` | |
| Đường dẫn màn | `/inventory/suppliers` | |

Đổi các tên này cho danh mục của bạn. Thêm theo thứ tự: **SQL → backend → frontend → kiểm tra**.

---

## Phần 1. Database

### 1.1. Tạo script SQL — `ServerService/sql/postgresql/NN-<ten>.sql` (thêm mới)

`NN` là số tiếp theo trong thư mục (hiện có đến `13`). Script phải **chạy lại nhiều lần không lỗi** (`IF NOT EXISTS`).

```sql
-- Inventory: supplier catalog (danh mục nhà cung cấp, function inv_supplier_cat). Safe to rerun.

CREATE TABLE IF NOT EXISTS erp_supplier (
    code varchar(20) PRIMARY KEY,
    name varchar(200) NOT NULL,
    tax_code varchar(30),
    phone varchar(30),
    address varchar(300),
    note varchar(300),
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    -- 4 cột bắt buộc của mọi bảng erp_* (ErpEntity), API tự điền
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_supplier_name ON erp_supplier (lower(name));
```

Quy tắc:
- **Không tạo khóa ngoại.** Liên kết bằng cột mã; service tự kiểm tra (xem 2.4).
- Cột nào hay dùng để tìm hoặc liên kết thì tạo index.
- Dữ liệu mặc định (nếu có): chỉ chèn khi bảng còn trống (`WHERE NOT EXISTS (SELECT 1 FROM erp_supplier)`), để bản ghi đã xóa không quay lại khi chạy lại script.
- Đổi cấu trúc về sau: sửa luôn file này, thêm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` (xem cuối file `13-inventory-uom.sql`). Dự án không dùng EF migrations.

### 1.2. Chạy script

```bash
"C:/Program Files/PostgreSQL/15/bin/psql.exe" -h localhost -U postgres -d erp_dev -f ServerService/sql/postgresql/14-inventory-supplier.sql
```

---

## Phần 2. Backend (`ServerService/`)

### 2.1. Khai báo mã chức năng — `Core.Application/Common/Permissions/FunctionCatalog.cs` (sửa)

Thêm một dòng vào danh sách:

```csharp
["inv_supplier_cat"] = "Danh mục nhà cung cấp",
```

Khi khởi động, API tự thêm mã vào bảng `sys_command`. Mã sẽ hiện trong ma trận phân quyền.

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

Hai điểm bắt buộc, thiếu là test báo lỗi:
- **`: ErpEntity`** cho 4 cột `created_at / created_by / updated_at / updated_by`. `CoreContext` tự điền khi lưu, không gán tay.
- **`[Audited("mã chức năng", "loại đối tượng", Label = ...)]`**: mọi thêm / sửa / xóa tự ghi vào **Nhật ký thay đổi** (ai, lúc nào, trường nào trước → sau). Nếu bảng không cần nhật ký thì ghi `[NotAudited("lý do")]`.

Tùy chọn khi cần:

| Khai báo | Khi nào dùng |
| --- | --- |
| `[AuditIgnore]` trên property | Cột không được ghi nhật ký (mật khẩu, token, cột kỹ thuật) |
| `[AuditField("tên")]` | Đặt tên trường dễ đọc cho cột tên xấu |
| `[AuditJson]` | Cột chứa JSON: ghi từng khóa thay đổi |
| `SoftDelete = nameof(Cột)` trong `[Audited]` | Danh mục xóa mềm: cờ về 0 / false thì ghi là "Xóa" |

### 2.3. Đăng ký bảng — `Core.Infrastructure/Common/Persistence/CoreContext.cs` (sửa)

```csharp
using Core.Domain.Modules.Inventory;   // đã có nếu cùng phân hệ
...
    // Inventory
    public DbSet<Uom> Uoms => Set<Uom>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
```

### 2.4. Contract — `Core.Application/Modules/Inventory/SupplierContracts.cs` (thêm mới)

```csharp
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

/// <summary>Stamp = người tạo / người sửa và thời điểm (tự có cho mọi bảng erp_*).</summary>
public sealed record SupplierDto(string Code, string Name, string? TaxCode, string? Phone, string? Address,
    string? Note, bool IsActive, RecordStampDto Stamp);

public sealed record SaveSupplierRequest(string Code, string Name, string? TaxCode, string? Phone, string? Address,
    string? Note, bool IsActive = true);

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierDto>> GetAllAsync(CancellationToken ct);
    Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct);
    /// <summary>The code is the key and cannot be changed.</summary>
    Task<SupplierDto> UpdateAsync(string code, SaveSupplierRequest request, CancellationToken ct);
    /// <summary>Refused while other data uses it (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);
}
```

### 2.5. Service — `Core.Infrastructure/Modules/Inventory/SupplierService.cs` (thêm mới)

Copy `UomService.cs`, đổi tên. Khung chính:

```csharp
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

public sealed class SupplierService(CoreContext db) : ISupplierService
{
    public async Task<IReadOnlyList<SupplierDto>> GetAllAsync(CancellationToken ct)
    {
        var rows = await db.Suppliers.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var stamp = await RecordStamps.ForAsync(db, rows, ct);          // tên người tạo / sửa, 1 truy vấn
        return rows.Select(x => ToDto(x, stamp(x))).ToList();
    }

    public async Task<SupplierDto> CreateAsync(SaveSupplierRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.supplierCode");  // bắt buộc, viết hoa, không khoảng trắng
        if (await db.Suppliers.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("supplier.codeExists", code);
        var row = new Supplier { Code = code, SortOrder = (await db.Suppliers.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        db.Suppliers.Add(row);
        await db.SaveChangesAsync(ct);                                  // nhật ký + created_* tự ghi ở đây
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct));
    }

    public async Task<SupplierDto> UpdateAsync(string code, SaveSupplierRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        await ApplyAsync(row, request, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct));
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        // Không có khóa ngoại: kiểm tra mọi bảng tham chiếu đến danh mục này trước khi xóa, ví dụ
        // if (await db.GoodsReceipts.AnyAsync(x => x.SupplierCode == row.Code, ct))
        //     throw new BusinessRuleException("supplier.inUse", row.Name);
        db.Suppliers.Remove(row);
        await db.SaveChangesAsync(ct);
    }

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
        new(x.Code, x.Name, x.TaxCode, x.Phone, x.Address, x.Note, x.IsActive, stamp);
}
```

Quy tắc:
- Kiểm tra dữ liệu bằng `Guard` (`Required`, `Optional`, `Code`). Lỗi nghiệp vụ dùng `throw new BusinessRuleException("khóa", tham số)`, **không viết câu văn**. Khóa đặt ở 2.7.
- Không gán `CreatedAt / CreatedBy / UpdatedAt / UpdatedBy` và không gọi ghi nhật ký: `CoreContext` tự làm.
- Chỉ ghi nhật ký bằng tay (`IAuditLog`) khi dùng `ExecuteUpdate` / `ExecuteDelete` / SQL thuần, vì các lệnh này không đi qua EF. Ví dụ ở `CurrencyService.SaveAsync`.
- Lưu nhiều bước thì gói trong `IUnitOfWork.ExecuteAsync(...)` để cùng một transaction.

Đăng ký service — `Core.Infrastructure/DependencyInjection.cs` (sửa):

```csharp
services.AddScoped<IUomService, UomService>();
services.AddScoped<ISupplierService, SupplierService>();
```

### 2.6. Controller — `Core/Modules/Inventory/SuppliersController.cs` (thêm mới)

```csharp
using Core.Application.Modules.Inventory;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục nhà cung cấp (function inv_supplier_cat).</summary>
[Route("api/inventory/suppliers")]
public sealed class SuppliersController(ISupplierService suppliers) : ApiControllerBase
{
    private const string Function = "inv_supplier_cat";

    /// <summary>Mọi người đã đăng nhập đều đọc được (các phiếu cần chọn nhà cung cấp).</summary>
    [HttpGet]
    public Task<IReadOnlyList<SupplierDto>> GetAll(CancellationToken ct) => suppliers.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<SupplierDto> Create(SaveSupplierRequest request, CancellationToken ct) => suppliers.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<SupplierDto> Update(string code, SaveSupplierRequest request, CancellationToken ct) =>
        suppliers.UpdateAsync(code, request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await suppliers.DeleteAsync(code, ct);
        return NoContent();
    }
}
```

- Kế thừa `ApiControllerBase`: bắt buộc đăng nhập và có quyền vào đơn vị cơ sở của phiên.
- Danh mục không cần cho màn khác tra cứu thì thêm `RequirePermission(Function, PermissionAction.View)` cho `GET`.

### 2.7. Thông báo lỗi — `Core.Application/Common/Localization/Messages.vi.json` và `Messages.en.json` (sửa cả hai)

```json
"field.supplierCode": "mã nhà cung cấp",
"field.supplierName": "tên nhà cung cấp",
"supplier.notFound": "Nhà cung cấp không tồn tại.",
"supplier.codeExists": "Mã nhà cung cấp {0} đã tồn tại.",
"supplier.nameExists": "Tên nhà cung cấp \"{0}\" đã tồn tại.",
"supplier.inUse": "Nhà cung cấp \"{0}\" đang được dùng. Hãy đặt ngừng sử dụng thay vì xóa."
```

Bản tiếng Anh thêm đúng các khóa đó (`"supplier.notFound": "The supplier does not exist."`...). `{0}`, `{1}` là tham số truyền vào `BusinessRuleException`. Khóa `field.*` dùng cho thông báo của `Guard` (ví dụ "Vui lòng nhập tên nhà cung cấp"). Khóa có sẵn như `field.phone`, `field.address`, `field.taxCode`, `field.note` thì dùng lại. Test `MessagesTests` báo lỗi nếu thiếu khóa ở một trong hai file.

### 2.8. Quyền đặc biệt (chỉ khi cần) — `Core.Application/Common/Permissions/SpecialRightCatalog.cs`

Ví dụ "xem giá", "sửa phiếu đã duyệt". Danh mục thường không cần.

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

Từ dòng này, hệ thống tự có route, tiêu đề, breadcrumb và dòng trong ma trận phân quyền. Thiếu dòng này thì `npm run lint` báo lỗi.

Tên tiếng Anh của chức năng — `locales/en/common.json` (sửa), mục `function`:

```json
"inv_supplier_cat": "Suppliers"
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

`icon` là tên icon của lucide-react. Nếu icon chưa dùng ở đâu, thêm tên đó vào **cả hai chỗ** trong `components/common/DynamicIcon.tsx` (dòng `import` và bảng tên icon). Không thêm thì menu hiện icon mặc định.

### 3.4. Thư mục chức năng — `modules/inventory/suppliers/` (thêm mới, copy từ `modules/inventory/uom/`)

**`types.ts`**

```ts
import type { RecordStamp } from '../../../components/common/RecordStamp';

export interface Supplier {
  code: string;
  name: string;
  taxCode?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  isActive: boolean;
  /** Người tạo / người sửa (backend tự điền). */
  stamp: RecordStamp;
}

export interface SaveSupplierInput {
  code: string;
  name: string;
  taxCode: string;
  phone: string;
  address: string;
  note: string;
  isActive: boolean;
}
```

**`api.ts`**: mọi lệnh gọi backend đi qua `apiRequest`, không gọi `fetch` trực tiếp.

```ts
import { apiRequest } from '../../../services/apiClient';
import { SaveSupplierInput, Supplier } from './types';

export const suppliersApi = {
  getAll: () => apiRequest<Supplier[]>('GET', '/api/inventory/suppliers'),
  create: (input: SaveSupplierInput) => apiRequest<Supplier>('POST', '/api/inventory/suppliers', input),
  update: (code: string, input: SaveSupplierInput) =>
    apiRequest<Supplier>('PUT', `/api/inventory/suppliers/${encodeURIComponent(code)}`, input),
  remove: (code: string) => apiRequest<void>('DELETE', `/api/inventory/suppliers/${encodeURIComponent(code)}`)
};
```

**`SupplierCategoryView.tsx`**: copy `UomCategoryView.tsx`, rồi đổi:
- `uomsApi` → `suppliersApi`, kiểu `Uom` → `Supplier`, `SaveUomInput` → `SaveSupplierInput`, `EMPTY` theo các trường mới;
- `getActionPermission(currentUser, 'inv_supplier_cat')`;
- khóa chữ `uoms.*` → `suppliers.*` (3.5);
- `columns`: một cột cho mỗi trường cần hiện. Giữ `...recordStampColumns<Supplier>(t)` ở cuối để có cột Người tạo / Người sửa;
- form: một `TextInput` / `TextArea` / `Checkbox` cho mỗi trường. Giữ `<RecordStampLine stamp={editing?.stamp} />` trên hàng nút.

Những phần đã có sẵn, không phải viết: `useCatalog` lo tải, lưu, xóa, hộp xác nhận và thông báo. `GridView` lo tìm kiếm, sắp xếp, phân trang. Nút thêm / sửa / xóa ẩn hiện theo quyền `createEdit` / `delete`.

**`index.ts`**

```ts
export * from './SupplierCategoryView';
export * from './types';
```

### 3.5. Chữ hiển thị — `locales/vi/inventory.json` và `locales/en/inventory.json` (sửa cả hai)

Thêm mục `suppliers` có cùng khóa ở hai file (copy mục `uoms` rồi sửa chữ):

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
  "phone": "Điện thoại",
  "address": "Địa chỉ",
  "note": "Ghi chú",
  "status": "Trạng thái",
  "active": "Đang dùng",
  "inactive": "Ngừng sử dụng",
  "isActive": "Đang sử dụng",
  "isActiveHint": "Nhà cung cấp ngừng sử dụng không chọn được trên phiếu mới",
  "edit": "Sửa",
  "delete": "Xóa",
  "cancel": "Hủy",
  "saving": "Đang lưu...",
  "save": "Lưu"
}
```

Màn hình không gõ cứng chữ tiếng Việt; mọi chữ lấy bằng `t('suppliers.xxx')`. Danh mục thuộc Cài đặt thì đặt chữ ở `locales/*/settings.json`.

Nhãn ở màn **Nhật ký thay đổi** (tùy chọn) — `locales/vi/common.json` và `locales/en/common.json`:
- `audit.objectType.supplier`: "Nhà cung cấp" / "Supplier";
- `audit.field.<tên trường>` cho trường chưa có nhãn (ví dụ `taxCode`, `address` đã có sẵn).

Không thêm thì màn nhật ký hiện tên gốc (`supplier`, `taxCode`).

### 3.6. Gắn màn vào phân hệ — `modules/inventory/InventoryModule.tsx` (sửa)

```tsx
import { SupplierCategoryView } from './suppliers';
...
      case 'inv_supplier_cat':
        return <SupplierCategoryView currentUser={currentUser} />;
```

Danh mục thuộc phân hệ khác thì sửa file `*Module.tsx` của phân hệ đó. Danh mục thuộc Cài đặt thì thêm `case` vào `renderScreen` trong `modules/settings/SettingsModule.tsx`, và màn nhận `SettingsViewProps` (`canEdit`, `canDelete`) như `DepartmentCategoryView`.

Nếu trước đó danh mục này là dữ liệu mẫu (mock): bỏ prop dữ liệu mẫu truyền vào màn. Dữ liệu mẫu trong `mock/initialERPData.ts` chỉ giữ lại nếu màn khác chưa chuyển lên backend vẫn còn đọc.

---

## Phần 4. Kiểm tra

Chạy theo thứ tự:

```bash
cd ServerService
dotnet build Core.sln
dotnet test tests/Core.Tests/Core.Tests.csproj
```

```bash
cd Frontend
npm run lint
npm run check-i18n
```

Test tự kiểm tra các điểm hay quên:

| Test | Báo lỗi khi |
| --- | --- |
| `TablesAndColumnsFollowNamingConvention` | Tên bảng không phải `sys_*` / `erp_*`, cột không `snake_case` |
| `BusinessTablesHaveRecordStamps` | Bảng `erp_*` không kế thừa `ErpEntity` |
| `EveryEntityDeclaresItsChangeLog` | Entity thiếu `[Audited]` / `[NotAudited]` |
| `AuditDeclarationsNameExistingProperties` | Mã chức năng trong `[Audited]` chưa có ở `FunctionCatalog`, hoặc `Label` dùng property không tồn tại |
| `MessagesTests` | Khóa thông báo thiếu ở `Messages.vi.json` / `Messages.en.json`, hoặc `throw` viết câu tiếng Việt |
| `npm run lint` | Thiếu mã trong `SubMenuKey` / `FUNCTION_REGISTRY`, sai kiểu |
| `npm run check-i18n` | Khóa có ở tiếng Việt mà thiếu ở tiếng Anh, hoặc màn gõ cứng chữ tiếng Việt |

Chạy thử trên trình duyệt:
1. Khởi động lại backend (để mã chức năng mới vào `sys_command`), mở `http://localhost:3000`.
2. Đăng nhập `admin`: menu có mục mới; thêm, sửa, xóa một bản ghi; thử trùng mã / trùng tên phải ra thông báo dễ hiểu.
3. Cột **Người tạo / Người sửa** có tên và giờ.
4. **Cài đặt › Nhật ký thay đổi**: lọc chức năng "Danh mục nhà cung cấp", thấy đủ Tạo mới / Sửa / Xóa với trường trước → sau.
5. **Cài đặt › Người dùng & phân quyền**: cấp quyền Xem / Thêm-Sửa / Xóa của chức năng mới cho vai trò cần dùng (quản trị viên có sẵn toàn quyền). Đăng nhập bằng tài khoản không có quyền Thêm-Sửa: nút thêm / sửa phải ẩn, gọi thẳng API thì bị từ chối.

---

## Danh sách kiểm tra nhanh

**Thêm mới**
- [ ] `ServerService/sql/postgresql/NN-<ten>.sql` (đã chạy)
- [ ] `Core.Domain/Modules/<PhanHe>/<Ten>.cs` (`: ErpEntity`, `[Audited]`)
- [ ] `Core.Application/Modules/<PhanHe>/<Ten>Contracts.cs`
- [ ] `Core.Infrastructure/Modules/<PhanHe>/<Ten>Service.cs`
- [ ] `Core/Modules/<PhanHe>/<Ten>sController.cs`
- [ ] `Frontend/src/modules/<phan-he>/<ten>/` gồm `types.ts`, `api.ts`, `<Ten>CategoryView.tsx`, `index.ts`

**Sửa**
- [ ] `FunctionCatalog.cs`: mã chức năng
- [ ] `Messages.vi.json` + `Messages.en.json`: khóa lỗi, `field.*`, `function.<mã>` (bản en)
- [ ] `CoreContext.cs`: `DbSet`
- [ ] `DependencyInjection.cs`: đăng ký service
- [ ] `types/index.ts`: `SubMenuKey`
- [ ] `config/functions.ts`: `FUNCTION_REGISTRY`
- [ ] `locales/en/common.json`: `function.<mã>`; tùy chọn `audit.objectType.*` (cả vi)
- [ ] `mock/initialMenuData.ts`: mục menu (+ `DynamicIcon.tsx` nếu icon mới)
- [ ] `locales/vi|en/<phan-he>.json`: chữ của màn
- [ ] `modules/<phan-he>/<PhanHe>Module.tsx`: `case` mở màn

**Không phải làm** (hệ thống tự có): ghi nhật ký thay đổi, điền người tạo / người sửa, dòng trong ma trận phân quyền, route và breadcrumb, kiểm tra quyền ẩn nút, hộp xác nhận xóa, tìm kiếm / phân trang của lưới.
