# Tham chiếu cột và quy trình tạo danh mục

Tài liệu chuẩn về cách S-ERP biết **bảng nào dùng mã của danh mục nào**, và quy trình thêm một danh mục (hoặc một cột trỏ sang danh mục) cho đúng chuẩn. Phần này làm cho việc xóa an toàn: không thể xóa đơn vị tính khi quy đổi hay phiếu nhập còn dùng nó, và không thể lưu một mã không tồn tại. Các bước viết code từng file nằm ở `docs/them-danh-muc.md`; tài liệu này nói về khai báo tham chiếu, quy ước đặt tên và quy trình tổng thể.

---

## 1. Vấn đề và cách giải quyết

Database **không dùng khóa ngoại** (quy ước của dự án), nên PostgreSQL không biết `erp_uom_conversion.from_uom_code` trỏ về `erp_uom`. Trước đây mỗi danh mục tự viết đoạn kiểm tra "đang dùng" trong `BeforeDeleteAsync`, rất dễ quên một bảng. Chẳng hạn xóa đơn vị tính chỉ được chặn khi có quy đổi, còn phiếu nhập kho thì không.

Cách làm hiện nay: **mỗi cột trỏ sang danh mục tự khai báo bằng một thuộc tính trên entity**.

```csharp
[References<Uom>]
[Column("from_uom_code"), MaxLength(20)] public string FromUomCode { get; set; } = string.Empty;
```

Từ các khai báo đó, hệ thống tự làm:

| Việc | Khi nào |
| --- | --- |
| Từ chối xóa dòng danh mục khi bảng khác còn dùng mã, kèm tên bảng và số dòng | Mỗi lần xóa (kể cả xóa nhiều) |
| Kiểm tra mã tham chiếu có tồn tại | Mỗi lần tạo / sửa, chỉ cột mới hoặc đã đổi |
| Ghi bản đồ tham chiếu vào bảng `sys_table_ref` để xem bằng mắt | Mỗi lần backend khởi động |
| Báo đỏ khi cột `*_code` mới thiếu khai báo, hoặc thiếu chỉ mục | Khi chạy `dotnet test` |

---

## 2. Quy ước đặt tên

| Đối tượng | Quy ước | Ví dụ |
| --- | --- | --- |
| Bảng hệ thống / nghiệp vụ | `sys_*` / `erp_*`, số ít, snake_case | `erp_uom`, `sys_currency` |
| Khóa và tên của danh mục | Luôn là `code` và `name` (khung dựa vào đó) | `erp_uom.code`, `erp_uom.name` |
| Cột trỏ sang danh mục | `<tên bảng đích bỏ tiền tố erp_ / sys_>_code` | `uom_code`, `warehouse_code`, `currency_code` |
| Một bảng trỏ **nhiều lần** vào cùng danh mục | Thêm tiền tố vai trò, tên **vẫn kết thúc** bằng tên đích | `from_uom_code`, `to_uom_code`, `base_uom_code` |
| Chỉ mục của cột tham chiếu | `ix_<bảng>_<ý nghĩa>`, bắt đầu bằng chính cột đó | `ix_erp_goods_receipt_currency (currency_code)` |
| Khóa ngoại | Không dùng; thuộc tính `[References]` thay vai trò khai báo | |

Hai điều cần nhớ:

- **Không đặt tên khác tên bảng đích.** Ví dụ cột trỏ đơn vị tính là `uom_code`, không phải `ums_code` hay `ma_dvt`. Test `ColumnNamesEndWithTheNameOfTheirTargetTable` báo đỏ khi tên lệch.
- Ngoại lệ duy nhất hiện có là `unit_code` (trỏ `sys_company_unit`), vì cả hệ thống gọi đơn vị cơ sở là "unit". Ngoại lệ khác phải thêm vào danh sách `LegacyNames` của test kèm lý do, và nên tránh.

---

## 3. Khai báo trên entity

Có hai thuộc tính, ở `Core.Domain/Common/ReferenceAttributes.cs`.

| Thuộc tính | Dùng khi |
| --- | --- |
| `[References<T>]` | Cột chứa `code` của một dòng thuộc entity `T` |
| `[NotReference("lý do")]` | Cột tên `*_code` nhưng **không** phải tham chiếu danh mục |

Quy tắc bắt buộc: **mọi cột có tên kết thúc bằng `_code` phải có một trong hai thuộc tính** (trừ khóa `code` của chính bảng). Test `EveryCodeColumnSaysWhatItPointsTo` báo đỏ nếu thiếu, và nêu đúng `bảng.cột`.

Điều kiện của bảng đích `T`: khóa chính là **một cột duy nhất tên `code`**. Danh mục dùng khung (`ICatalogRecord`) đã thỏa; danh mục cũ như phòng ban, ngoại tệ, đơn vị cơ sở, kho cũng thỏa.

### 3.1. Các trường hợp thường gặp

**Tham chiếu bình thường** (bắt buộc có mã, xóa danh mục đích bị chặn khi còn dùng):

```csharp
[References<Uom>]
[Required, Column("from_uom_code"), MaxLength(20)] public string FromUomCode { get; set; } = string.Empty;
[References<Uom>]
[Required, Column("to_uom_code"), MaxLength(20)] public string ToUomCode { get; set; } = string.Empty;
```

**Có thể để trống** (mã khác rỗng vẫn bị kiểm tra):

```csharp
[References<WarehouseType>(Optional = true)]
[Column("warehouse_type_code"), MaxLength(20)] public string? WarehouseTypeCode { get; set; }
```

**Bảng dòng con tự xóa cùng dòng cha, ví dụ bản dịch** (không được tính là "đang dùng", nếu không danh mục có bản dịch sẽ không bao giờ xóa được):

```csharp
[References<Uom>(BlocksDelete = false)]
[Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
```

Danh mục cha phải xóa các dòng con này trong `BeforeDeleteAsync` (xem `UomService`).

**Lịch sử không chặn xóa danh mục** (thông báo, nhật ký giữ lại mã lúc ghi):

```csharp
[References<CompanyUnit>(Optional = true, BlocksDelete = false)]
[Column("unit_code"), MaxLength(20)] public string? UnitCode { get; set; }
```

**Cột `*_code` không phải tham chiếu**:

```csharp
[NotReference("mã số thuế, không phải mã danh mục")]
[Column("tax_code"), MaxLength(30)] public string? TaxCode { get; set; }

[NotReference("mã chức năng (FunctionCatalog), không phải danh mục")]
[Column("function_code"), MaxLength(64)] public string FunctionCode { get; set; } = string.Empty;
```

**Danh mục đích chưa có backend** (vật tư còn là dữ liệu mẫu trong trình duyệt): ghi `NotReference` kèm lý do, và đổi thành `[References<Material>]` khi vật tư có bảng thật:

```csharp
[NotReference("vật tư còn là dữ liệu mẫu trong trình duyệt; thêm [References<Material>] khi vật tư có backend")]
[Column("material_code"), MaxLength(50)] public string? MaterialCode { get; set; }
```

### 3.2. `BlocksDelete` chọn thế nào

| Bảng chứa cột | `BlocksDelete` | Lý do |
| --- | --- | --- |
| Danh mục khác, chứng từ, dòng chứng từ, sổ cái | `true` (mặc định) | Dữ liệu còn dùng mã thì không được xóa |
| Bản dịch, dòng con của chính danh mục | `false` | Xóa cùng dòng cha |
| Thông báo, nhật ký (lịch sử) | `false` | Chỉ là dấu vết, mã không cần còn tồn tại |
| Cột được dịch vụ riêng kiểm tra theo điều kiện đặc biệt | `false` + kiểm tra riêng | Ví dụ `sys_users.department_code`: `DepartmentService` chỉ tính người dùng còn hiệu lực |

---

## 4. Khung kiểm tra gì

### 4.1. Xóa

`CatalogService.DeleteAsync` gọi `EnsureNotInUseAsync<TEntity>` **trước** `BeforeDeleteAsync`. Nó tìm trong danh sách khai báo mọi cột có `BlocksDelete = true` trỏ vào bảng của entity, và với mỗi cột chạy một truy vấn tham số hóa, dừng ở 1.000 dòng:

```sql
SELECT count(*) FROM (SELECT 1 FROM "erp_uom_conversion" WHERE "from_uom_code" = @code LIMIT 1000) AS used
```

Tên bảng và cột chỉ lấy từ mô hình EF (đã kiểm tra mẫu `^[a-z][a-z0-9_]*$`), **không bao giờ từ yêu cầu của người dùng**; mã là tham số. Nếu có nơi dùng, trả HTTP 400:

> "Thu A" đang được dùng ở: Quy đổi đơn vị tính (1). Hãy đặt ngừng sử dụng thay vì xóa.

Xóa nhiều (`delete-many`) đi qua cùng đường này, từng dòng.

### 4.2. Lưu

`CatalogService` gọi `EnsureReferencesExistAsync` sau `ApplyAsync`, trước khi ghi. Với mỗi cột `[References]`:

- dòng **mới**: kiểm mọi cột có giá trị;
- dòng **sửa**: chỉ kiểm cột đã đổi (một giá trị cũ không hợp lệ vẫn lưu được khi không đụng tới nó);
- mã không tồn tại → HTTP 400 `ref.notFound`: *Mã "NOPE" của uom_code không tồn tại trong Đơn vị tính.* Tên trường lấy từ khóa `dbfield.<cột>` nếu có.

Kiểm tra này chỉ xét **mã tồn tại**. Muốn thêm điều kiện "đang sử dụng" hay lọc theo đơn vị cơ sở thì viết tiếp trong `ApplyAsync` (như `UomConversionService` làm cho đơn vị tính ngừng dùng).

### 4.3. Dùng ngoài `CatalogService`

Mọi danh mục hiện có đều kế thừa `CatalogService` nên đã được chặn xóa sẵn. Một dịch vụ **không** kế thừa nó (ví dụ phiếu, hoặc một danh mục có luồng xóa riêng) dùng cùng hàm:

```csharp
using Core.Infrastructure.Common.References;

public async Task DeleteAsync(string code, CancellationToken ct)
{
    var row = await FindAsync(code, ct);
    await db.EnsureNotInUseAsync<Warehouse>(code, row.Name, ct);   // throws record.inUse
    db.Warehouses.Remove(row);
    await db.SaveChangesAsync(ct);
}
```

Chỉ lấy danh sách nơi dùng, không ném lỗi: `await db.UsagesAsync<Uom>(code, ct)` trả `TableUsage(Table, Count)`. Có thể dùng cho nút "Xem nơi sử dụng" sau này.

### 4.4. Những chỗ còn kiểm tra riêng bên cạnh bản đồ

Một số cột không phải `*_code` hoặc có điều kiện riêng nên vẫn kiểm tra trong `BeforeDeleteAsync` của dịch vụ (sau lần kiểm tra chung):

| Danh mục | Kiểm tra riêng | Vì sao |
| --- | --- | --- |
| Phòng ban | Người dùng còn hiệu lực (`department.hasUsers`), quy tắc duyệt theo phòng ban | `sys_users.department_code` chỉ tính tài khoản chưa xóa (nên `BlocksDelete = false`); quy tắc duyệt lưu mã trong cột giá trị chung |
| Ngôn ngữ | Người dùng chọn ngôn ngữ (`language.inUse`), ngôn ngữ mặc định | `sys_users.language` không phải cột `*_code` |
| Đơn vị cơ sở | `ma_dvcs` của người dùng, cài đặt riêng của đơn vị, đơn vị hoạt động cuối cùng | cột cũ `ma_dvcs`, bảng cài đặt khóa theo phạm vi |
| Ngoại tệ | Đồng tiền hạch toán không xóa được | quy tắc nghiệp vụ |

---

## 5. Xem bản đồ tham chiếu trong database

### 5.1. Bảng `sys_table_ref`

Mỗi dòng là một khai báo. **Không sửa tay**: backend đồng bộ lại mỗi lần khởi động (thêm dòng mới, sửa dòng đổi, xóa dòng không còn khai báo) và ghi log `Đã đồng bộ N dòng tham chiếu cột vào sys_table_ref`.

| Cột | Ý nghĩa |
| --- | --- |
| `table_name`, `column_name` | Bảng và cột chứa mã |
| `ref_table`, `ref_column` | Danh mục đích và cột khóa (luôn `code`) |
| `table_kind` | `catalog` (danh mục), `translation` (bản dịch), `system` (bảng `sys_*` khác) hoặc `document` (chứng từ, dòng chứng từ, `erp_*` khác) |
| `blocks_delete` | Có chặn xóa danh mục đích hay không |
| `optional` | Cột được để trống |
| `entity_type` | Lớp C# khai báo |

### 5.2. View `sys_v_columns`

Ghép cấu trúc thật của database (`information_schema`) với `sys_table_ref`, để kiểm tra bằng một truy vấn:

```sql
-- Cấu trúc một bảng, cột nào trỏ đi đâu, có chỉ mục không
select * from sys_v_columns where table_name = 'erp_uom_conversion';

-- Mọi cột đang dùng đơn vị tính
select table_name, column_name, blocks_delete from sys_v_columns where ref_table = 'erp_uom';

-- Cột tham chiếu mà thiếu chỉ mục (kết quả phải rỗng)
select table_name, column_name from sys_v_columns where ref_table is not null and blocks_delete and not indexed;
```

Cả bảng và view nằm trong `sql/postgresql/24-table-ref.sql` (chạy lại được).

---

## 6. Quy trình chuẩn

### 6.1. Thêm một danh mục mới

Theo `docs/them-danh-muc.md` (ví dụ đầy đủ nhà cung cấp), thêm các việc về tham chiếu:

| Bước | Việc | Phần tham chiếu |
| --- | --- | --- |
| 1 | Script SQL tạo bảng | Cột trỏ danh mục khác có `CREATE INDEX` bắt đầu bằng chính cột đó |
| 2 | Entity | Mỗi cột `*_code`: `[References<T>]` hoặc `[NotReference("lý do")]` |
| 3 | Service | Không viết kiểm tra mã tồn tại (khung làm); không viết kiểm tra "đang dùng" ở danh mục cha |
| 4 | Thông báo | Nếu danh mục **sẽ được bảng khác trỏ tới**: thêm `table.<tên bảng>` vào cả hai file thông báo |
| 5 | Chạy `dotnet test` | `TableReferenceTests` báo đúng bảng và cột còn thiếu |
| 6 | Thử | Tạo bản ghi, dùng ở nơi trỏ tới, thử xóa (phải bị chặn kèm tên bảng), gỡ chỗ dùng rồi xóa lại |

### 6.2. Thêm cột trỏ sang danh mục vào bảng có sẵn

1. Thêm cột và chỉ mục trong script SQL (một script mới hoặc script của bảng đó):
   ```sql
   ALTER TABLE erp_supplier ADD COLUMN IF NOT EXISTS group_code varchar(20);
   CREATE INDEX IF NOT EXISTS ix_erp_supplier_group ON erp_supplier (group_code);
   ```
2. Thêm property vào entity với `[References<SupplierGroup>(Optional = true)]`.
3. Thêm `table.erp_supplier` (nếu chưa có) vào hai file thông báo.
4. Ở service, chuẩn hóa mã trong `ApplyAsync` (`ToUpperInvariant`); không cần kiểm mã tồn tại.
5. Form dùng `CatalogLookup` (xem `docs/them-danh-muc.md`, Phần 4 và 5).
6. Chạy `dotnet test` và khởi động lại backend (đồng bộ `sys_table_ref`).

### 6.3. Chứng từ dùng danh mục

Bảng chứng từ và dòng chứng từ khai `[References<T>]` cho mọi cột `*_code`: kho, đơn vị tính, ngoại tệ, đơn vị cơ sở... Từ đó mọi danh mục đó tự được bảo vệ khỏi xóa nhầm, và chứng từ không lưu được một mã không có thật. Ví dụ phiếu nhập kho: `unit_code` → `CompanyUnit`, `warehouse_code` → `Warehouse`, `currency_code` → `Currency`; dòng phiếu: `uom_code` → `Uom` (thêm cột này khi bảng dòng phiếu có đơn vị tính).

---

## 7. Các test bảo vệ

| Test | Báo đỏ khi |
| --- | --- |
| `EveryCodeColumnSaysWhatItPointsTo` | Cột `*_code` thiếu `[References]` / `[NotReference]` |
| `EveryReferenceTargetsTheCodeOfAnotherTable` | Tham chiếu không trỏ vào cột `code` hoặc trỏ vào chính bảng của nó |
| `ColumnNamesEndWithTheNameOfTheirTargetTable` | Tên cột không kết thúc bằng tên bảng đích |
| `TheDeclaredMapIsWhatTheCatalogsRelyOn` | Mất các khai báo quan trọng (quy đổi → đơn vị tính, phiếu nhập → kho...) |
| `TablesThatKeepARowInUseHaveAMessageLabel` | Bảng chặn xóa chưa có nhãn `table.<tên bảng>` (vi, en) |
| `EveryReferenceColumnIsIndexed` | Cột tham chiếu chặn xóa chưa có chỉ mục trong `sql/postgresql/*.sql` |
| `MessagesTests` | Thiếu khóa `record.inUse`, `ref.notFound` ở một ngôn ngữ |

Chạy: `dotnet test tests/Core.Tests/Core.Tests.csproj --filter "FullyQualifiedName~TableReference"` trong `ServerService/`.

---

## 8. Giới hạn cần biết

| Giới hạn | Cách xử lý |
| --- | --- |
| Tham chiếu chỉ theo **mã** (`code`) | Khóa số (`user_id`, `created_by`) không thuộc cơ chế này |
| Cột JSON chứa mã | Không kiểm tra được; ghi `[NotReference]` nếu cột tên `*_code` |
| Tham chiếu đa hình (mã loại chứng từ, mã chức năng) | `[NotReference]` kèm lý do |
| Danh mục theo từng đơn vị cơ sở (hai đơn vị có thể trùng mã) | Chưa có điều kiện `ma_dvcs` trong kiểm tra "đang dùng"; xử lý khi chốt việc kho dùng chung hay theo đơn vị |
| Tranh chấp: có người thêm dòng dùng mã ngay giữa lúc kiểm tra và xóa | Xác suất rất nhỏ; xóa và kiểm tra nên nằm trong một giao dịch khi làm chứng từ thật |
| Dữ liệu còn nằm trong trình duyệt (vật tư, phiếu xuất...) | Chưa chặn được; khai `[References]` ngay khi bảng có backend |
| `sys_table_ref` chỉ cập nhật khi khởi động | Đổi khai báo xong phải khởi động lại backend để thấy trong bảng; việc chặn xóa dùng khai báo trong code nên có hiệu lực ngay |

---

## 9. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| `dotnet test` báo "A *_code column must say [References...]" | Cột `*_code` mới chưa khai báo: thêm `[References<T>]` hoặc `[NotReference("lý do")]` |
| Báo "Name a reference column ..." | Tên cột lệch tên bảng đích; đổi tên cột hoặc, nếu thật sự đặc biệt, thêm vào `LegacyNames` kèm lý do |
| Báo "each needs an index" | Thiếu `CREATE INDEX ... ON <bảng> (<cột>)` trong script SQL |
| Báo "Add table.<tên bảng> to Messages" | Thêm nhãn bảng vào `Messages.vi.json` và `Messages.en.json` |
| Xóa danh mục báo "đang được dùng ở: X (n)" nhưng bạn tin là không còn dùng | Chạy `select * from <bảng X> where <cột> = '<mã>'`; xóa hoặc đặt ngừng sử dụng các dòng đó |
| Danh mục có bản dịch không xóa được | Bảng bản dịch thiếu `BlocksDelete = false`, hoặc danh mục cha chưa xóa bản dịch trong `BeforeDeleteAsync` |
| Xóa bị lỗi `relation ... does not exist` hoặc cột không tồn tại | Entity khai báo cột chưa có trong database: chạy script SQL của bạn |
| `sys_table_ref` thiếu dòng của khai báo mới | Chưa khởi động lại backend sau khi thêm khai báo |

---

## 10. Việc tiếp theo (giai đoạn 2)

Giai đoạn này chưa làm. Khi có khoảng mười danh mục thật, viết **công cụ sinh mã** đọc một tệp khai báo (YAML) rồi tạo script SQL nháp (kèm chỉ mục cho cột tham chiếu), entity (kèm `[References]`), DTO, service, controller, `CatalogDefinition`, dòng menu và khóa thông báo. Phần chỉnh hiển thị lúc chạy (tên, thứ tự cột) sẽ nằm trong bảng riêng theo hướng ba tầng đã bàn. Các khai báo tham chiếu hiện nay chính là dữ liệu đầu vào mà công cụ đó cần.
