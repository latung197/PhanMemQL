# Chống ghi đè khi nhiều người cùng sửa

Tài liệu này giải thích cơ chế chống "mất dữ liệu do lưu đè" và các bước cần làm khi thêm chức năng mới. Phần kiểm tra là bắt buộc: thiếu bước nào thì `dotnet test` báo đỏ, kèm hướng dẫn sửa.

---

## 1. Vấn đề cần giải quyết

| Thời điểm | Người A | Người B |
| --- | --- | --- |
| 9:00 | Mở form sửa nhà cung cấp `NCC01` (SĐT cũ) | Mở form sửa `NCC01` |
| 9:01 | Sửa **số điện thoại**, bấm Lưu → thành công | |
| 9:02 | | Sửa **địa chỉ**, bấm Lưu |

Nếu không có cơ chế này, lần lưu của B gửi lên cả số điện thoại **cũ** đang hiện trên form của B, nên số điện thoại A vừa sửa bị mất mà không ai biết.

Khi có cơ chế này, lần lưu của B bị từ chối với thông báo:

> Dữ liệu này vừa được người khác thay đổi hoặc xóa sau khi bạn mở. Hãy tải lại rồi thực hiện lại thay đổi của bạn.

B mở lại form, thấy số điện thoại mới của A, rồi sửa lại địa chỉ.

---

## 2. Cách hoạt động

1. **Phiên bản bản ghi.** Mỗi dòng trong PostgreSQL có cột hệ thống `xmin`, tự đổi giá trị **mỗi khi dòng bị sửa** (kể cả khi sửa bằng SQL tay). Hệ thống dùng nó làm số phiên bản, nên **không cần thêm cột nào trong bảng**.
2. **Tải dữ liệu.** API trả về mỗi bản ghi kèm `version`, ví dụ `"version": 74527`.
3. **Lưu.** Màn hình gửi lại `version` của bản ghi lúc mở form.
4. **Kiểm tra ở backend.** Gồm 2 lớp:
   - `db.ExpectVersion(...)` so `version` gửi lên với bản ghi vừa đọc từ DB. Khác nhau thì báo lỗi ngay.
   - Lệnh `UPDATE` có thêm điều kiện `WHERE xmin = <version>`. Nếu ai đó lưu chen vào đúng lúc giữa lần đọc và lần ghi, lệnh không sửa được dòng nào và EF báo lỗi. Lớp này chặn được cả khi nhiều người bấm Lưu cùng một mili giây.
5. **Kết quả.** Lỗi trả về **HTTP 409** với thông báo `record.changed` (tiếng Việt hoặc tiếng Anh theo ngôn ngữ người dùng). **Không có gì được ghi**, kể cả nhật ký thay đổi.
6. **Lưu thành công** thì API trả về bản ghi với `version` mới, và màn hình dùng version mới đó cho lần lưu sau.

```
Màn hình            API (service)                         PostgreSQL
  │ GET danh sách ─────►                                   
  │ ◄──── {..., version: 100}                              
  │ PUT {..., version: 100} ─►  đọc bản ghi (xmin = 105?)   
  │                           ExpectVersion: 100 ≠ 105 → 409
  │                           (hoặc) UPDATE ... WHERE xmin = 100
  │                                  → 0 dòng → 409         
  │ ◄──── 409 "Dữ liệu này vừa được người khác thay đổi..." 
```

---

## 3. Các thành phần

| Thành phần | File | Vai trò |
| --- | --- | --- |
| Giao diện `IVersioned` | `ServerService/Core.Domain/Common/IVersioned.cs` | Entity có `uint Version`. `ErpEntity` đã có sẵn. |
| Ánh xạ `xmin` | `CoreContext.OnModelCreating` | Mọi entity `IVersioned` có `Version` → cột `xmin`, kiểu `xid`, dùng làm concurrency token. |
| Chuyển lỗi | `CoreContext.SaveChangesAsync` | `DbUpdateConcurrencyException` → `ConflictException("record.changed")`. |
| Hàm kiểm tra | `Core.Infrastructure/Common/Persistence/RowVersions.cs` | `db.ExpectVersion(entity, version, touch)`. |
| Lỗi 409 | `ConflictException` (`AppExceptions.cs`), `AppExceptionFilter` | Trả `{ message }` với mã 409. |
| Thông báo | `Messages.vi.json` / `Messages.en.json`, khóa `record.changed` | |
| Màn hình danh mục | `Frontend/src/hooks/useCatalog.ts` | Tự gửi `version` của bản ghi đang sửa. Khi gặp 409 thì tự tải lại danh sách. |
| Test bắt buộc | `tests/Core.Tests/Common/ConcurrencyContractTests.cs`, `CoreContextModelTests.VersionedRecordsUseXminAsConcurrencyToken` | Báo đỏ khi chức năng mới thiếu một bước. |

**Đang áp dụng cho:** đơn vị tính, phòng ban, tiền tệ, tỷ giá, ngôn ngữ, đơn vị (DVCS), đánh số chứng từ, quy tắc duyệt, vai trò (kèm ma trận quyền), thông tin người dùng, phân quyền người dùng.

---

## 4. Thêm cho chức năng mới

### 4.1. Danh mục / bảng `erp_*` (trường hợp thường gặp)

Entity kế thừa `ErpEntity` nên **đã có `Version`**, và database không cần sửa gì. Chỉ cần làm 3 bước ở backend và 1 bước ở frontend. Ví dụ dưới đây dùng nhà cung cấp, xem thêm [them-danh-muc.md](them-danh-muc.md).

**Bước 1. DTO trả về có `Version`** (`Core.Application/Modules/<Phân hệ>/<Tên>Contracts.cs`):

```csharp
public sealed record SupplierDto(string Code, string Name, ..., RecordStampDto Stamp, uint Version);
```

**Bước 2. Request lưu nhận `Version`.** Đặt ở cuối, kiểu `uint?`, mặc định `null`:

```csharp
public sealed record SaveSupplierRequest(string Code, string Name, ..., bool IsActive = true, uint? Version = null);
```

**Bước 3. Service kiểm tra** (`Core.Infrastructure/Modules/<Phân hệ>/<Tên>Service.cs`):

```csharp
public async Task<SupplierDto> UpdateAsync(string code, SaveSupplierRequest request, CancellationToken ct)
{
    var row = await FindAsync(code, ct);          // tải bản ghi (có tracking)
    db.ExpectVersion(row, request.Version);       // ← ngay sau khi tải, TRƯỚC khi sửa / kiểm tra khác
    await ApplyAsync(row, request, ct);
    await db.SaveChangesAsync(ct);
    return ToDto(row, ...);                       // ToDto điền x.Version (phiên bản mới sau khi lưu)
}

private static SupplierDto ToDto(Supplier x, RecordStampDto stamp) => new(x.Code, x.Name, ..., stamp, x.Version);
```

**Bước 4. Frontend.** Thêm `version` vào kiểu dữ liệu (`types.ts`):

```ts
export interface Supplier {
  ...
  stamp: RecordStamp;
  version: number;        // phiên bản bản ghi
}

export interface SaveSupplierInput {
  ...
  version?: number;
}
```

Màn hình dùng `useCatalog` (như `UomCategoryView.tsx`) thì **không phải làm gì thêm**: `catalog.save(input, editing)` tự lấy `editing.version` gửi lên và tự tải lại danh sách khi gặp 409.

### 4.2. Bảng `sys_*` cũ (không kế thừa `ErpEntity`)

Thêm `IVersioned` vào entity:

```csharp
public class Department : IVersioned
{
    /// <summary>Row version (xmin) against lost updates; see IVersioned.</summary>
    public uint Version { get; set; }
    ...
}
```

Phần còn lại giống 4.1. `CoreContext` tự ánh xạ `Version` → `xmin`, không cần sửa SQL.

### 4.3. Lưu kèm các dòng con (danh sách chi tiết)

Ví dụ: vai trò kèm ma trận quyền, người dùng kèm đơn vị được vào, **phiếu nhập kho kèm các dòng hàng** (sắp làm).

Nếu lần lưu chỉ sửa các dòng con mà dòng chính không đổi, dòng chính không bị `UPDATE` nên phiên bản không đổi, và người lưu sau sẽ không bị chặn. Cách xử lý là dùng `touch: true`:

```csharp
var voucher = await FindAsync(id, ct);
db.ExpectVersion(voucher, request.Version, touch: true);   // luôn cập nhật dòng chính (cột updated_at / updatetime)
```

Với `touch: true`, dòng chính luôn được ghi (chỉ cột thời gian sửa), nên phiên bản luôn đổi và việc kiểm tra luôn chạy. Xem `RoleService.UpdateAsync` và `UserService.SetPermissionsAsync`.

> Với phiếu: **mọi thao tác trên phiếu** (sửa, đổi trạng thái, duyệt, hủy) đều nên gọi `ExpectVersion` trên dòng đầu phiếu, để không ai duyệt một phiếu vừa bị người khác sửa.

### 4.4. Màn hình không dùng `useCatalog`

Tự truyền `version` của bản ghi **lúc mở form** (không phải lúc bấm Lưu) và nhận bản ghi mới trả về:

```ts
const result = await rolesApi.update(role.id, { ...draft, version: role.version });
onSaved(result);          // thay bản ghi trong danh sách bằng bản mới → version mới cho lần lưu sau
```

Ví dụ trong code: `RoleDetailPanel.tsx`, `UserDetailPanel.tsx` (`usersApi.setPermissions(..., user.version)`), `UserAccountModals.tsx`, `VoucherNumberingPanel.tsx`, `ApprovalRulesPanel.tsx` (form chép cả bản ghi nên đã có `version`).

Khi gặp 409, nên tải lại dữ liệu để người dùng thấy bản mới nhất. Lỗi có `status`:

```ts
import { ApiError, getErrorMessage } from '../../services/apiClient';

catch (e) {
  showToast.error(getErrorMessage(e));
  if (e instanceof ApiError && e.status === 409) void reload();
}
```

### 4.5. Bản ghi không có form sửa

Những bảng như bộ đếm số chứng từ, thông báo, nhật ký, quan hệ người dùng–vai trò không cần cơ chế này: không implement `IVersioned` và không có `UpdateAsync`.

Nếu service có hàm `UpdateAsync` nhưng không phải để sửa một bản ghi mở trên form, thêm vào danh sách miễn trừ `Exempt` trong `ConcurrencyContractTests.cs`, **kèm lý do**:

```csharp
private static readonly Dictionary<string, string> Exempt = new(StringComparer.Ordinal)
{
    ["IStockService.UpdateAsync"] = "Tính lại tồn kho từ chứng từ, không phải form sửa",
};
```

---

## 5. Test tự động (không cần nhớ)

`dotnet test` sẽ báo đỏ khi thêm chức năng mới mà thiếu bước:

| Test | Kiểm tra | Thông báo khi thiếu |
| --- | --- | --- |
| `UpdateRequestsCarryTheLoadedVersion` | Mọi `I...Service.UpdateAsync` có request với `uint? Version` | `SaveXxxRequest needs uint? Version = null` |
| `UpdateResultsReturnTheNewVersion` | DTO trả về của `UpdateAsync` có `uint Version` | `XxxDto ... needs uint Version` |
| `UpdateMethodsCheckTheVersion` | Thân hàm `UpdateAsync` trong service có gọi `ExpectVersion(` | `XxxService.UpdateAsync must call db.ExpectVersion(...)` |
| `VersionedRecordsUseXminAsConcurrencyToken` | Mọi `IVersioned` ánh xạ đúng `xmin`; mọi bảng `erp_*` đều có | |

Quy ước để test nhận ra: hàm sửa của service **đặt tên `UpdateAsync`**, nằm trong interface tên `I...Service`, tham số request tên `...Request`.

> Test không kiểm tra được frontend. Màn hình dùng `useCatalog` thì tự đúng. Màn hình tự viết thì cần nhớ bước 4.4.

---

## 6. Tự kiểm tra một chức năng

Có thể thử bằng 2 tab trình duyệt:

1. Tab 1 và tab 2 cùng mở form sửa một bản ghi.
2. Tab 1 sửa và lưu → thành công.
3. Tab 2 sửa và lưu → phải hiện thông báo "Dữ liệu này vừa được người khác thay đổi..." và danh sách phía sau tự tải lại.
4. Vào **Cài đặt › Nhật ký thay đổi**: chỉ có 1 dòng sửa của tab 1.

Hoặc thử bằng API: gọi `PUT` 2 lần với cùng một `version`. Lần đầu trả 200, lần sau trả 409.

---

## 7. Lưu ý và giới hạn hiện tại

- **Không gửi `version` thì không kiểm tra.** Đây là chủ ý, để phục vụ nhập khẩu, khôi phục bản sao lưu và client cũ. Màn hình phải luôn gửi `version`.
- **Xóa chưa kiểm tra phiên bản.** Xóa một bản ghi người khác vừa sửa vẫn được. Ngược lại, sửa một bản ghi đã bị người khác xóa thì báo lỗi "không tìm thấy" hoặc 409.
- **Chưa áp dụng cho:**
  - các mục cài đặt dạng JSON (`sys_setting`: hồ sơ công ty, cấu hình mặc định, năm tài chính, định dạng số);
  - khóa sổ theo tháng, vì chỉ là bật/tắt nên ít rủi ro.
- **Sửa bằng `ExecuteUpdate` / SQL tay** vẫn làm `xmin` đổi, nên người đang mở form sẽ bị chặn khi lưu. Đây là điều mong muốn. Ngược lại, lệnh `ExecuteUpdate` không tự kiểm tra phiên bản; nếu cần, thêm điều kiện `xmin` vào `WHERE`.
- **Người dùng tự đổi giao diện, ngôn ngữ hoặc mật khẩu** cũng làm đổi phiên bản bản ghi `sys_users` của họ. Nếu admin đang mở form sửa đúng người đó, admin sẽ nhận 409 và chỉ cần mở lại form.
- Sau khi gặp 409, form vẫn giữ nội dung người dùng đã nhập, nhưng **phải đóng form rồi mở lại** để lấy phiên bản mới. Bấm Lưu lại ngay trong form cũ vẫn bị từ chối.
- Khôi phục database từ bản dump thì mọi `xmin` thay đổi. Người đang mở form lúc đó chỉ cần mở lại.

---

## 8. Câu hỏi thường gặp

**Vì sao dùng `xmin` mà không thêm cột `version`?**
`xmin` có sẵn ở mọi bảng và do PostgreSQL tự đổi khi dòng bị sửa, kể cả bị sửa bằng SQL tay hay script. Nhờ vậy không cần sửa cấu trúc bảng, không phải nhớ tăng số phiên bản, và không có cách nào sửa dữ liệu mà không đổi phiên bản.

**`version` có phải số thứ tự 1, 2, 3 không?**
Không. Đó là mã giao dịch của PostgreSQL, chỉ dùng để so sánh bằng hay khác, không mang ý nghĩa thứ tự.

**Có làm chậm hệ thống không?**
Không đáng kể: chỉ thêm một điều kiện `xmin = ...` vào câu `UPDATE` theo khóa chính, và đọc `xmin` khi tải dữ liệu.

**Có thay cho khóa dòng (`SELECT ... FOR UPDATE`) khi trừ tồn kho không?**
Không. Cơ chế này chống người dùng **đè dữ liệu của nhau trên form**. Còn tồn kho và số dư là các con số tính dồn, cần khóa dòng hoặc cập nhật nguyên tử trong cùng giao dịch. Việc đó sẽ làm khi chuyển phân hệ Kho lên backend.
