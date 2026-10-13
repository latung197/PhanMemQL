# Trạng thái chứng từ và quyền theo trạng thái, theo đơn vị cơ sở

Mỗi chứng từ (phiếu nhập kho, phiếu xuất kho, phiếu yêu cầu xuất kho...) đi qua các **trạng thái**: Lập chứng từ → Chờ duyệt → Đã duyệt → Đã ghi sổ, hoặc Hủy. Tài liệu này mô tả hai thứ gắn với **từng đơn vị cơ sở**:

1. **Danh mục trạng thái chứng từ**: mỗi đơn vị đổi tên trạng thái và tắt bước "Chờ duyệt".
2. **Quyền theo trạng thái**: quyền cấp đến trạng thái nào thì khi lập chứng từ, người dùng lưu được đến trạng thái đó. Quyền được cấp riêng cho từng đơn vị.

Tổng quan phân quyền: `docs/he-thong/phan-quyen.md`. Thêm một chứng từ mới: `docs/phat-trien/them-chung-tu.md`. Script: `ServerService/sql/postgresql/43-voucher-status.sql`.

## 1. Danh mục trạng thái chứng từ (Cài đặt › Trạng thái chứng từ)

- Các trạng thái của từng loại chứng từ do **code khai báo** (`VoucherStatusCatalog`): vì code phải biết trạng thái nào làm sổ kho chạy. Đơn vị chỉ **đổi tên** (kèm tên tiếng Anh) và **tắt bước Chờ duyệt**; không thêm trạng thái mới.
- Mặc định mọi chứng từ có 5 trạng thái. Chứng từ không ghi sổ (hiện là **phiếu yêu cầu xuất kho**) chỉ có 4: không có Đã ghi sổ, và cũng không có quyền ghi sổ / bỏ ghi sổ.
- **Lập chứng từ**, **Đã duyệt**, **Đã ghi sổ**, **Hủy** không tắt được (phiếu luôn bắt đầu ở Lập, phải còn cách hủy, và sổ kho dựa vào Đã duyệt / Đã ghi sổ). Chỉ tắt được **Chờ duyệt**, và không tắt được khi đơn vị đang bắt buộc duyệt trước khi ghi sổ (Cài đặt mặc định › "Duyệt trước khi ghi sổ").
- Màn hình chọn một đơn vị rồi sửa tên từng trạng thái của từng chứng từ. Tên đã đổi hiện ở danh sách phiếu, ô "Trạng thái" của phiếu và chuỗi "Lưu và …" trên nút lưu. Quyền xem và sửa là chức năng `sys_voucher_status`.
- **Bật / tắt Chờ duyệt** đổi cách chạy của đơn vị đó:
  - Chứng từ không còn nút "Gửi duyệt"; lưu ở trạng thái Chờ duyệt và gọi `submit` bị từ chối (`voucherStatus.disabled`).
  - Người có quyền trạng thái **Đã duyệt** lưu thẳng ở Đã duyệt (hoặc Đã ghi sổ) mà **không cần là người duyệt** theo quy tắc phê duyệt và không có bước duyệt nào được ghi (nhật ký ghi "Lưu thẳng ở trạng thái đã duyệt: đơn vị cơ sở này không dùng bước chờ duyệt").

### Bảng `sys_voucher_status`

Chỉ có dòng cho cái đơn vị **đã đổi**; trạng thái không có dòng thì tên mặc định và đang dùng. Khóa duy nhất: `unit_code` + `voucher_type` + `status_code`.

| Cột | Ý nghĩa |
|---|---|
| `unit_code` | Đơn vị cơ sở (`[References<CompanyUnit>]`) |
| `voucher_type` | Loại chứng từ ở `VoucherCatalog` (PNK, PXK, YCX...) |
| `status_code` | `Draft`, `Pending`, `Approved`, `Posted`, `Cancelled` (khai ở code) |
| `name`, `name_en` | Tên đơn vị đặt; trống = tên mặc định (`voucherStatus.<Status>` trong `Messages.*.json`) |
| `is_enabled` | Đang dùng (`false` chỉ có ý nghĩa với `Pending`) |
| 4 cột dấu vết, `version` | Như mọi bảng khác; sửa dùng phiên bản để không ghi đè nhau |

Thay đổi được ghi tự động ở Nhật ký thay đổi (Cài đặt › Nhật ký thay đổi, đối tượng `voucherStatus`).

### API

| Việc | Lệnh | Quyền |
|---|---|---|
| Liệt kê trạng thái của một đơn vị | `GET /api/voucher-statuses?unit=DVCS01` | `sys_voucher_status` Xem |
| Đổi tên / bật tắt | `PUT /api/voucher-statuses/{loại}/{trạng thái}?unit=DVCS01` kèm `{name, nameEn, isEnabled, version}` | `sys_voucher_status` Sửa |
| Tên và trạng thái dùng cho màn phiếu (đơn vị đang làm việc) | `GET /api/voucher-statuses/current` | người đã đăng nhập |

Chỉ làm việc được với đơn vị mà người dùng có quyền vào (admin: mọi đơn vị đang hoạt động). Frontend nạp `current` lúc đăng nhập và khi đổi đơn vị (`services/voucherStatusService.ts`).

## 2. Quyền theo trạng thái, theo đơn vị

### Các quyền

Mỗi chứng từ có (mã trong `SpecialRightCatalog`, nhóm "Trạng thái chứng từ"):

| Mã | Cho phép |
|---|---|
| `ST_PENDING` (Chờ duyệt) | Gửi phiếu đi duyệt, lưu phiếu ở Chờ duyệt, sửa phiếu đang chờ duyệt |
| `ST_APPROVED` (Đã duyệt) | Lưu phiếu thẳng ở Đã duyệt (vẫn phải đúng người duyệt khi đơn vị dùng bước duyệt), sửa phiếu đã duyệt chưa ghi sổ |
| `ST_POSTED` (Đã ghi sổ) | Ghi sổ phiếu đã duyệt, lưu phiếu thẳng ở Đã ghi sổ (chỉ chứng từ có ghi sổ) |
| `ST_CANCELLED` (Hủy phiếu) | Hủy phiếu chưa ghi sổ, kể cả phiếu người khác lập (người lập hủy / xóa phiếu nháp của mình chỉ cần quyền Xóa) |
| `ST_UNPOST` (Bỏ ghi sổ) | Bước **lùi**: đưa phiếu đã ghi sổ về Đã duyệt (chỉ chứng từ có ghi sổ) |

Các quyền này **thay** `EDIT_PENDING`, `EDIT_APPROVED`, `POST`, `UNPOST`, `CANCEL` cũ. Các quyền đặc biệt khác (`VIEW_PRICE`, `VIEW_COST`, `VIEW_ALL`, gửi thông báo) giữ nguyên và **không** theo đơn vị.

### Cấp đến trạng thái nào thì lưu được đến đó

Quyền của trạng thái sau **bao gồm các bước trước**: người có `ST_POSTED` cũng gửi duyệt, lưu ở Đã duyệt được. Khi lập chứng từ, ô "Trạng thái" của phiếu chỉ hiện những trạng thái mà quyền của người đó, **tại đơn vị đang làm việc**, với tới:

| Quyền người dùng có (ở đơn vị đó) | Lưu phiếu được ở |
|---|---|
| chỉ Thêm / Sửa, không quyền trạng thái | Lập chứng từ |
| `ST_PENDING` | Lập, Chờ duyệt |
| `ST_APPROVED` (và là người duyệt) | thêm Đã duyệt |
| `ST_POSTED` (và là người duyệt) | thêm Đã ghi sổ |

Phải có quyền **Thêm** hoặc **Sửa** của chức năng thì mới lưu ở trạng thái sau Lập. Lưu ở trạng thái nào thì server chạy các bước đó trong **một giao dịch**; bước nào bị từ chối thì cả phiếu không được lưu. Người duyệt vẫn phải đúng quy tắc phê duyệt (cấp duyệt theo số tiền, không tự duyệt phiếu mình lập), trừ khi đơn vị đã tắt bước Chờ duyệt.

### Quyền theo từng đơn vị: mã có kèm đơn vị

Quyền trạng thái được cấp riêng cho từng đơn vị: cùng một người, ở đơn vị A ghi sổ được, ở đơn vị B chỉ lập được. Để dùng nguyên bộ máy quyền sẵn có (bảng `sys_role_right` / `sys_user_right`, `GrantGuard`, nhật ký, danh sách `specialRights` trong hồ sơ), **mã đơn vị nằm trong mã quyền**:

```
inv_receipt:ST_POSTED@DVCS01     (chức năng : mã quyền @ đơn vị)
```

- `SpecialRightCatalog.UnitKey(function, code, unit)` tạo mã; `SplitUnit` tách mã và đơn vị; `IsKnown` nhận mã có đơn vị cho các quyền `PerUnit` và từ chối mã không đơn vị.
- Khi kiểm quyền, `DocumentActor.For(..., unitCode)` chỉ giữ quyền của **đơn vị của phiếu** (và các quyền không theo đơn vị); quyền cấp cho đơn vị khác không tính (ví dụ phiếu của DVCS01 không dùng quyền `ST_POSTED@DVCS02`).
- Quản trị viên có quyền ở **mọi đơn vị đang hoạt động** (`SpecialRightCatalog.KeysFor(đơn vị)`). Đơn vị mới thêm sau: chỉ quản trị viên có quyền trạng thái ở đó cho tới khi cấp cho vai trò / người dùng.
- Vai trò cấp quyền trạng thái cho các đơn vị nào thì mọi người giữ vai trò đó có quyền ở những đơn vị đó (nếu họ được vào đơn vị). Ngoại lệ theo người dùng (cấp thêm / rút bớt) cũng theo đơn vị.

### Màn phân quyền

Cài đặt › Người dùng & phân quyền (tab Người dùng và tab Vai trò): trên thanh công cụ của ma trận có ô **"Đơn vị cho quyền trạng thái"**. Mở "quyền đặc biệt" của một chứng từ thì nhóm "Trạng thái chứng từ" hiện các quyền của **đơn vị đang chọn** (ví dụ "Đã ghi sổ (DVCS01)"); đổi ô đơn vị để cấp cho đơn vị khác. Dòng phụ cho biết quyền đó còn được cấp ở bao nhiêu đơn vị khác. Với người dùng, danh sách đơn vị là các đơn vị tài khoản được vào; với vai trò là mọi đơn vị đang hoạt động. Nút "Toàn quyền" cấp quyền trạng thái của mọi đơn vị trong danh sách. Quyền chỉ có hiệu lực khi người đó có quyền **Xem** chức năng.

Chỉ cấp được quyền mà mình đang có (`GrantGuard`): quản lý người dùng không có `ST_POSTED@DVCS01` thì không cấp được nó.

## 3. Chuyển dữ liệu từ quyền cũ

Lần chạy đầu của script 43 (dấu hiệu: bảng `sys_voucher_status` chưa có) đổi quyền cũ sang quyền mới để **không ai mất quyền đang có**:

| Quyền cũ | Quyền mới |
|---|---|
| `EDIT_PENDING` | `ST_PENDING` |
| `EDIT_APPROVED` | `ST_APPROVED` |
| `POST` | `ST_POSTED` |
| `UNPOST` | `ST_UNPOST` |
| `CANCEL` | `ST_CANCELLED` |
| có quyền Thêm hoặc Sửa chức năng | cũng được `ST_PENDING` (trước đây ai lập được thì gửi duyệt được) |
| có quyền Duyệt trên phiếu hoặc trên màn phê duyệt của nó | cũng được `ST_APPROVED` (trước đây lưu thẳng ở Đã duyệt chỉ cần Duyệt) |

- Vai trò: mỗi quyền được mở cho **mọi đơn vị hiện có**. Ngoại lệ người dùng (cấp hoặc rút): mở cho các đơn vị của người đó. Sau đó quản trị viên thu hẹp lại theo từng đơn vị.
- Phiếu yêu cầu xuất kho không nhận `ST_POSTED`, `ST_UNPOST`.
- Mã quyền cũ bị xóa khỏi `sys_role_right` / `sys_user_right`. Chạy lại script không đổi gì thêm.
- Máy mới (seed demo): `DatabaseSeeder` cấp quyền trạng thái ban đầu theo ma trận (`SpecialRightCatalog.InitialStatusKeysFor`): `ST_PENDING` cho ai thêm / sửa được, các quyền còn lại cho ai có Duyệt, cho mọi đơn vị.

## 4. Quy tắc chính sách (backend và frontend)

`DocumentStatusPolicy` (`Core.Application/Common/Permissions/DocumentStatusPolicy.cs`) và bản sao `Frontend/src/utils/documentPolicy.ts` quyết định thao tác nào cho phép ở trạng thái nào; hai bên được kiểm bằng cùng một tệp ca (`ServerService/tests/Core.Tests/Common/DocumentPolicyCases.json`: `dotnet test`, `npm run check-policy`). Trong tệp ca, quyền trạng thái viết cả đơn vị (`ST_POSTED@DVCS01`), phiếu thuộc đơn vị DVCS01.

| Thao tác | Điều kiện (ngoài quyền Xem và phạm vi phiếu) |
|---|---|
| Sửa phiếu Lập | Sửa |
| Sửa phiếu Chờ duyệt | Sửa + với tới Chờ duyệt (`ST_PENDING` hoặc quyền sau nó) |
| Sửa phiếu Đã duyệt | Sửa + với tới Đã duyệt |
| Gửi duyệt | Phiếu Lập, Thêm hoặc Sửa, với tới Chờ duyệt, bước Chờ duyệt đang dùng |
| Duyệt / từ chối | Như cũ: phiếu Chờ duyệt, không phải người lập, có quyền Duyệt (trên phiếu hoặc màn phê duyệt), đúng cấp duyệt |
| Ghi sổ | Phiếu Đã duyệt + `ST_POSTED` |
| Bỏ ghi sổ | Phiếu Đã ghi sổ + `ST_UNPOST` |
| Hủy | Người lập hủy phiếu nháp của mình cần Xóa; trường hợp khác cần `ST_CANCELLED`; phiếu Đã ghi sổ phải bỏ ghi sổ trước |
| Lưu thẳng ở trạng thái (`TargetStatus`) | `DocumentStatusPolicy.CheckTarget`: Thêm hoặc Sửa + với tới trạng thái đó; ghi sổ còn kiểm như thao tác Ghi sổ; Chờ duyệt cần bước đang dùng |

"Với tới" một trạng thái = có quyền của trạng thái đó hoặc của trạng thái sau nó trong chuỗi Chờ duyệt < Đã duyệt < Đã ghi sổ (`DocumentActor.Reaches`). Hủy không nằm trong chuỗi.

## 5. Mã nguồn

| Việc | Tệp |
|---|---|
| Khai báo trạng thái của chứng từ | `Core.Application/Common/Documents/VoucherStatusCatalog.cs` |
| Quyền ST_* và mã có đơn vị | `Core.Application/Common/Permissions/SpecialRightCatalog.cs` |
| Chính sách và `DocumentActor` | `Core.Application/Common/Permissions/DocumentStatusPolicy.cs` |
| Danh mục theo đơn vị | `Core.Domain/Modules/VoucherStatuses/VoucherStatus.cs`, `Core.Application/Modules/VoucherStatuses/`, `Core.Infrastructure/Modules/VoucherStatuses/VoucherStatusService.cs`, `Core/Modules/VoucherStatuses/VoucherStatusesController.cs` |
| Bỏ qua bước duyệt | `DocumentApprovalService.ApproveWithoutFlowAsync` |
| Phiếu dùng danh mục và quyền | `EnsureTargetAllowedAsync`, `AdvanceAsync`, `EnsureActionAsync` của `GoodsReceiptService`, `GoodsIssueService`, `IssueRequestService` |
| Quyền admin theo đơn vị | `PermissionService`, `UserProfileBuilder`, `RoleService` (`SpecialRightCatalog.KeysFor`) |
| Màn hình | `modules/settings/VoucherStatusView.tsx`, `modules/inventory/documents/{SaveStatusSelect.tsx, VoucherStatusBadge.tsx}`, `modules/settings/permissions/PermissionMatrixTable.tsx` (ô đơn vị), `utils/permissions.ts` (`hasStatusRight`), `utils/documentPolicy.ts` (`reachesStatus`) |
| Chuyển dữ liệu | `sql/postgresql/43-voucher-status.sql` |

Thêm một chứng từ mới ở `VoucherCatalog` thì có đủ trạng thái và quyền `ST_*` (chứng từ không ghi sổ thì thêm vào `NonPosting` của `VoucherStatusCatalog`); không cần khai thêm gì.

## 6. Giới hạn hiện tại

- Chỉ tắt được bước Chờ duyệt; Đã ghi sổ tắt được cho chứng từ không làm sổ kho sẽ làm sau khi có loại chứng từ cần.
- Quyền "mở lại phiếu đã hủy" chưa có (chưa có thao tác mở lại).
- Quyền theo đơn vị chỉ áp dụng cho quyền trạng thái; bảy quyền chức năng (Xem, Thêm, Sửa...) và các quyền xem giá, phạm vi vẫn chung cho mọi đơn vị của người dùng.
- Tên quyền ở màn phân quyền là tên trạng thái mặc định; tên đơn vị đã đổi chưa hiện ở đó.
- Màn phiếu nhập kho dùng tên trạng thái do đơn vị đặt ở danh sách và ô trạng thái; bản in phiếu vẫn dùng tên cố định.
