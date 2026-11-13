# Trạng thái chứng từ và quyền theo trạng thái, theo đơn vị cơ sở

Mỗi chứng từ (phiếu nhập kho, phiếu xuất kho, phiếu yêu cầu xuất kho...) đi qua các **trạng thái**: Lập chứng từ → Chờ duyệt → [Duyệt cấp 1] → [Duyệt cấp 2] → Đã duyệt → Đã ghi sổ, hoặc Hủy (hai cấp trong ngoặc mặc định tắt). Tài liệu này mô tả hai thứ gắn với **từng đơn vị cơ sở**:

1. **Danh mục trạng thái chứng từ**: mỗi đơn vị đổi tên trạng thái, tắt bước "Chờ duyệt" và bật các cấp duyệt trung gian. **Số cấp duyệt = số bước duyệt đơn vị đang dùng** (mục 2.4).
2. **Quyền theo trạng thái**: quyền cấp đến trạng thái nào thì khi lập chứng từ, người dùng lưu được đến trạng thái đó. Quyền được cấp riêng cho từng đơn vị.

Tổng quan phân quyền: `docs/he-thong/phan-quyen.md`. Thêm một chứng từ mới: `docs/phat-trien/them-chung-tu.md`. Script: `ServerService/sql/postgresql/43-voucher-status.sql`, `63-approval-levels.sql` (hai cấp duyệt trung gian).

## 1. Danh mục trạng thái chứng từ (Cài đặt › Trạng thái chứng từ)

- Các trạng thái của từng loại chứng từ do **code khai báo** (`VoucherStatusCatalog`): vì code phải biết trạng thái nào làm sổ kho chạy. Đơn vị chỉ **đổi tên** (kèm tên tiếng Anh), **tắt bước Chờ duyệt** và **bật / tắt hai cấp duyệt trung gian**; không thêm trạng thái mới.
- Mọi chứng từ có 7 trạng thái: Lập chứng từ, Chờ duyệt, **Duyệt cấp 1** (`Approved1`), **Duyệt cấp 2** (`Approved2`), Đã duyệt, Đã ghi sổ, Hủy. Chứng từ không ghi sổ (yêu cầu xuất kho, yêu cầu mua, đơn mua, hóa đơn mua, đơn bán, lệnh điều chuyển) không có Đã ghi sổ, và cũng không có quyền ghi sổ / bỏ ghi sổ.
- **Duyệt cấp 1** và **Duyệt cấp 2** mặc định **tắt** (đơn vị chưa có dòng = tắt). Bật lên khi phiếu cần duyệt nhiều cấp, và đặt tên theo người duyệt, ví dụ phiếu yêu cầu mua hàng: "Duyệt cấp 1" đặt tên "Trưởng bộ phận duyệt", "Đã duyệt" đổi tên "Giám đốc duyệt". Hai cấp này chỉ có tác dụng khi bước Chờ duyệt đang dùng.
- **Lập chứng từ**, **Đã duyệt**, **Đã ghi sổ**, **Hủy** không tắt được (phiếu luôn bắt đầu ở Lập, phải còn cách hủy, và sổ kho dựa vào Đã duyệt / Đã ghi sổ). Chỉ tắt được **Chờ duyệt** và hai cấp duyệt trung gian; Chờ duyệt không tắt được khi đơn vị đang bắt buộc duyệt trước khi ghi sổ (Cài đặt mặc định › "Duyệt trước khi ghi sổ").
- Màn hình chọn một đơn vị rồi sửa tên từng trạng thái của từng chứng từ. Tên đã đổi hiện ở danh sách phiếu, ô "Trạng thái" của phiếu và chuỗi "Lưu và …" trên nút lưu. Quyền xem và sửa là chức năng `sys_voucher_status`.
- **Bật / tắt Chờ duyệt** đổi cách chạy của đơn vị đó:
  - Chứng từ không còn nút "Gửi duyệt"; lưu ở trạng thái Chờ duyệt và gọi `submit` bị từ chối (`voucherStatus.disabled`).
  - Người có quyền trạng thái **Đã duyệt** lưu thẳng ở Đã duyệt (hoặc Đã ghi sổ) mà **không cần là người duyệt** theo quy tắc phê duyệt và không có bước duyệt nào được ghi (nhật ký ghi "Lưu thẳng ở trạng thái đã duyệt: đơn vị cơ sở này không dùng bước chờ duyệt").

### Bảng `sys_voucher_status`

Chỉ có dòng cho cái đơn vị **đã đổi**; trạng thái không có dòng thì tên mặc định và trạng thái mặc định (đang dùng, trừ hai cấp duyệt trung gian). Khóa duy nhất: `unit_code` + `voucher_type` + `status_code`.

| Cột | Ý nghĩa |
|---|---|
| `unit_code` | Đơn vị cơ sở (`[References<CompanyUnit>]`) |
| `voucher_type` | Loại chứng từ ở `VoucherCatalog` (PNK, PXK, YCX...) |
| `status_code` | `Draft`, `Pending`, `Approved1`, `Approved2`, `Approved`, `Posted`, `Cancelled` (khai ở code) |
| `name`, `name_en` | Tên đơn vị đặt; trống = tên mặc định (`voucherStatus.<Status>` trong `Messages.*.json`) |
| `is_enabled` | Đang dùng (chỉ có ý nghĩa với `Pending`, `Approved1`, `Approved2`). Không có dòng: `Approved1` / `Approved2` là tắt, các trạng thái khác là đang dùng (`VoucherStatusCatalog.EnabledByDefault`) |
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
| `ST_APPROVED1` (Duyệt cấp 1) | Duyệt phiếu từ Chờ duyệt lên Duyệt cấp 1, lưu phiếu ở Duyệt cấp 1, sửa phiếu ở Duyệt cấp 1 (chỉ khi đơn vị bật cấp này) |
| `ST_APPROVED2` (Duyệt cấp 2) | Như trên với Duyệt cấp 2 (gồm cả cấp 1) |
| `ST_APPROVED` (Đã duyệt) | Duyệt phiếu đến Đã duyệt (gồm mọi cấp trung gian), lưu phiếu thẳng ở Đã duyệt, sửa phiếu đã duyệt chưa ghi sổ |
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
| `ST_APPROVED1` | thêm Duyệt cấp 1 (khi đơn vị bật cấp này) |
| `ST_APPROVED2` | thêm Duyệt cấp 2 (khi đơn vị bật cấp này) |
| `ST_APPROVED` | thêm Đã duyệt |
| `ST_POSTED` | thêm Đã ghi sổ |

Phải có quyền **Thêm** hoặc **Sửa** của chức năng thì mới lưu ở trạng thái sau Lập. Lưu ở trạng thái nào thì server chạy các bước đó trong **một giao dịch**; bước nào bị từ chối thì cả phiếu không được lưu.

### Duyệt và ghi sổ theo quyền trạng thái

**Được phân quyền đến trạng thái nào thì chuyển chứng từ đến trạng thái đó**, ở đơn vị của phiếu:

| Có quyền | Làm được |
|---|---|
| `ST_APPROVED1` / `ST_APPROVED2` | Duyệt phiếu lên cấp đó (khi đơn vị bật cấp đó), từ chối phiếu đang chờ cấp đó. **Kể cả phiếu mình lập** |
| `ST_APPROVED` | Duyệt phiếu đến **Đã duyệt** từ Lập / Chờ duyệt / Duyệt cấp 1 / Duyệt cấp 2 (các cấp còn lại được duyệt luôn, ghi tên người này), từ chối phiếu đang duyệt |
| `ST_POSTED` | Như trên, và **ghi sổ** phiếu Lập / đang duyệt / Đã duyệt: hệ thống ghi luôn các bước duyệt còn thiếu rồi ghi sổ, trong một giao dịch |

- Không cần cột **Duyệt** trong ma trận quyền, không cần có tên trong quy tắc phê duyệt. Cột Duyệt chỉ còn để mở các màn Phê duyệt riêng.
- Mọi bước vẫn được ghi vào lịch sử duyệt và nhật ký thay đổi (ai, lúc nào, cấp mấy trên mấy cấp).
- Mã nguồn: `DocumentStatusPolicy` (Approve / Reject / Post), `IDocumentApprovalService` (`ApproveAsync`, `ApproveNextAsync`, `ApproveDraftToAsync`, `ApproveToEndAsync`), `ApprovalResolver` (các cấp và người được báo).

### Duyệt nhiều cấp theo trạng thái chứng từ

Hướng dẫn đầy đủ (cài đặt từng bước, người được báo, màn hình, API, lỗi, kiểm tra): [duyet-nhieu-cap.md](duyet-nhieu-cap.md). Tóm tắt:

**Số cấp duyệt là số bước duyệt đơn vị đang dùng** cho loại phiếu đó, theo thứ tự: Duyệt cấp 1 (nếu bật), Duyệt cấp 2 (nếu bật), Đã duyệt. Cấp k là bước thứ k (`IVoucherStatusService.ApprovalLevelsAsync`).

| Đơn vị bật | Số cấp | Phiếu đi qua |
|---|---|---|
| không bật cấp nào (mặc định) | 1 | Chờ duyệt → Đã duyệt |
| Duyệt cấp 1 | 2 | Chờ duyệt → Duyệt cấp 1 → Đã duyệt |
| Duyệt cấp 1 và Duyệt cấp 2 | 3 | Chờ duyệt → Duyệt cấp 1 → Duyệt cấp 2 → Đã duyệt |
| tắt Chờ duyệt | 0 | Lập chứng từ → Đã duyệt (không có vòng duyệt) |

Ví dụ theo URD, phiếu yêu cầu mua hàng duyệt hai cấp:

1. Cài đặt › Trạng thái chứng từ, đơn vị DVCS01, loại YCM: bật **Duyệt cấp 1**, đặt tên "Trưởng bộ phận duyệt"; đổi tên **Đã duyệt** thành "Giám đốc duyệt".
2. Cài đặt › Người dùng & phân quyền, ở đơn vị DVCS01: người lập có `ST_PENDING`; trưởng bộ phận có `ST_APPROVED1` (và `VIEW_ALL` để xem phiếu người khác); giám đốc có `ST_APPROVED`.
3. Người lập gửi duyệt → phiếu **Chờ duyệt**, trưởng bộ phận được báo. Trưởng bộ phận bấm Duyệt → phiếu **Trưởng bộ phận duyệt**, giám đốc được báo. Giám đốc bấm Duyệt → **Giám đốc duyệt** (= Đã duyệt), người lập được báo.

Cách chạy:

- **Bấm Duyệt** đưa phiếu lên **cấp cao nhất đang dùng mà quyền của người đó với tới**; các cấp đi qua được ghi là do người đó duyệt. Giám đốc bấm Duyệt trên phiếu còn Chờ duyệt thì phiếu lên thẳng Đã duyệt (cả hai cấp ghi tên giám đốc). Không với tới cấp kế tiếp thì bị từ chối (`approval.nothingToApprove`, nêu tên cấp đó).
- **Lưu thẳng** ở một cấp (ô "Trạng thái" của phiếu) cũng vậy: các cấp đến đó ghi là do người lưu duyệt, cấp sau được báo. Chỉ lưu được ở cấp đơn vị đang bật (`voucherStatus.disabled`).
- **Từ chối** cần quyền duyệt **cấp đang chờ**; phiếu về Lập chứng từ. **Rút lại** (người trình) được ở Chờ duyệt và ở các cấp trung gian; muốn **hủy** phiếu đang duyệt phải rút lại trước.
- **Người được báo** ở mỗi cấp: theo quy tắc phê duyệt của cấp đó (Cài đặt › Quy trình phê duyệt, cấp 1 đến 3) nếu có; không có quy tắc thì là những người có quyền **dừng đúng ở cấp đó** (với tới cấp đó nhưng không với tới cấp sau), không có ai thì mọi người với tới cấp đó. Quy tắc của cấp mà đơn vị không dùng bị bỏ qua. Chỉ người đang làm việc ở đơn vị và có quyền của cấp đó được báo; người trình không bị báo.
- Phiếu đang ở cấp trung gian **chưa phải đã duyệt**: chưa lấy sang phiếu sau được (đơn mua, phiếu xuất...), chưa tính vào tồn giữ chỗ; dashboard đếm chung vào "Chờ duyệt".
- Mỗi bước duyệt (`sys_document_approval`) lưu `target_status`: trạng thái phiếu sau khi bước đó xong. Vòng duyệt đang dở từ trước script 63 không có cột này và được coi là "Đã duyệt" (như cách cũ). Đổi số cấp của đơn vị không làm thay đổi vòng duyệt đang chạy: vòng mới (gửi duyệt lần sau) mới theo số cấp mới.

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
| Sửa phiếu Chờ duyệt / Duyệt cấp 1 / Duyệt cấp 2 | Sửa + với tới trạng thái đó (quyền của nó hoặc quyền sau nó) |
| Sửa phiếu Đã duyệt | Sửa + với tới Đã duyệt |
| Gửi duyệt | Phiếu Lập, Thêm hoặc Sửa, với tới Chờ duyệt, bước Chờ duyệt đang dùng |
| Duyệt | Phiếu đang duyệt (Chờ duyệt / Duyệt cấp 1 / Duyệt cấp 2; không cần Xem / `VIEW_ALL`) hoặc Lập chứng từ (cần Xem, phiếu người khác cần `VIEW_ALL`) + với tới **cấp kế tiếp** trong chuỗi (`DocumentStatuses.NextApproval`); dịch vụ còn kiểm cấp đó đơn vị có dùng không; **kể cả người lập**, không cần cột Duyệt hay có tên trong quy tắc |
| Từ chối | Phiếu đang duyệt + với tới cấp kế tiếp |
| Ghi sổ | Phiếu Lập / đang duyệt / Đã duyệt + `ST_POSTED` (phiếu chưa duyệt được duyệt luôn trong cùng giao dịch) |
| Bỏ ghi sổ | Phiếu Đã ghi sổ + `ST_UNPOST` |
| Hủy | Người lập hủy phiếu nháp của mình cần Xóa; trường hợp khác cần `ST_CANCELLED`; phiếu Đã ghi sổ phải bỏ ghi sổ trước |
| Khôi phục (Hủy → Lập chứng từ) | Chỉ phiếu đã hủy; cần `ST_CANCELLED` của đơn vị (ai hủy được thì khôi phục được) |
| Lưu thẳng ở trạng thái (`TargetStatus`) | `DocumentStatusPolicy.CheckTarget`: Thêm hoặc Sửa + với tới trạng thái đó; ghi sổ còn kiểm như thao tác Ghi sổ; Chờ duyệt, Duyệt cấp 1 / 2 cần bước đó đang dùng |

"Với tới" một trạng thái = có quyền của trạng thái đó hoặc của trạng thái sau nó trong chuỗi Chờ duyệt < Duyệt cấp 1 < Duyệt cấp 2 < Đã duyệt < Đã ghi sổ (`DocumentActor.Reaches`). Hủy không nằm trong chuỗi.

## 5. Mã nguồn

| Việc | Tệp |
|---|---|
| Khai báo trạng thái của chứng từ | `Core.Application/Common/Documents/VoucherStatusCatalog.cs` |
| Quyền ST_* và mã có đơn vị | `Core.Application/Common/Permissions/SpecialRightCatalog.cs` |
| Chính sách và `DocumentActor` | `Core.Application/Common/Permissions/DocumentStatusPolicy.cs` |
| Danh mục theo đơn vị | `Core.Domain/Modules/VoucherStatuses/VoucherStatus.cs`, `Core.Application/Modules/VoucherStatuses/`, `Core.Infrastructure/Modules/VoucherStatuses/VoucherStatusService.cs`, `Core/Modules/VoucherStatuses/VoucherStatusesController.cs` |
| Các cấp duyệt theo trạng thái | `VoucherStatusService.ApprovalLevelsAsync`, `ApprovalResolver`, `DocumentApprovalService` (`ApproveStepsAsync`; bỏ qua bước duyệt: `ApproveWithoutFlowAsync`), cột `sys_document_approval.target_status` (script 63) |
| Phiếu dùng danh mục và quyền | `EnsureTargetAllowedAsync`, `AdvanceAsync`, `EnsureActionAsync` của `GoodsReceiptService`, `GoodsIssueService`, `IssueRequestService` |
| Quyền admin theo đơn vị | `PermissionService`, `UserProfileBuilder`, `RoleService` (`SpecialRightCatalog.KeysFor`) |
| Màn hình | `modules/settings/VoucherStatusView.tsx`, `modules/inventory/documents/{SaveStatusSelect.tsx, VoucherStatusBadge.tsx, voucherStatusLabels.ts}` (nhãn, nút Duyệt `canApproveVoucher`, ô lọc `approvalLevelOptions`), `modules/settings/permissions/PermissionMatrixTable.tsx` (ô đơn vị), `utils/permissions.ts` (`hasStatusRight`), `utils/documentPolicy.ts` (`reachesStatus`) |
| Chuyển dữ liệu | `sql/postgresql/43-voucher-status.sql` |

Thêm một chứng từ mới ở `VoucherCatalog` thì có đủ trạng thái và quyền `ST_*` (chứng từ không ghi sổ thì thêm vào `NonPosting` của `VoucherStatusCatalog`); không cần khai thêm gì.

## 6. Giới hạn hiện tại

- Chỉ tắt được bước Chờ duyệt và hai cấp duyệt trung gian; nhiều nhất 3 cấp duyệt. Đã ghi sổ tắt được cho chứng từ không làm sổ kho sẽ làm sau khi có loại chứng từ cần.
- **Khôi phục phiếu đã hủy** (`DocumentAction.Reopen`, nút "Khôi phục" trên danh sách): đưa phiếu về Lập chứng từ để sửa và duyệt lại, dùng quyền `ST_CANCELLED`. Kỳ phải chưa khóa; phiếu có dòng lấy từ phiếu khác (phiếu xuất lấy từ yêu cầu, phiếu nhập lấy từ đơn mua, đơn mua lấy từ yêu cầu mua, phiếu xuất / nhập điều chuyển) chỉ khôi phục được khi phiếu nguồn còn hiệu lực và còn đủ số lượng cho các dòng đó (`reopen.sourceNotReady`, `reopen.exceedsSource`). Vòng duyệt cũ không tính: gửi duyệt lại bắt đầu vòng mới.
- **Hỏi xác nhận**: nút Hủy và Bỏ ghi sổ trên danh sách hiện hộp xác nhận trước khi thực hiện (Xóa vốn đã có hộp xác nhận).
- Quyền theo đơn vị chỉ áp dụng cho quyền trạng thái; bảy quyền chức năng (Xem, Thêm, Sửa...) và các quyền xem giá, phạm vi vẫn chung cho mọi đơn vị của người dùng.
- Tên quyền ở màn phân quyền là tên trạng thái mặc định; tên đơn vị đã đổi chưa hiện ở đó.
- Màn phiếu nhập kho dùng tên trạng thái do đơn vị đặt ở danh sách và ô trạng thái; bản in phiếu vẫn dùng tên cố định.
