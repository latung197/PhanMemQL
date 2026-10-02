# Phân quyền S-ERP: nghiệp vụ và thiết kế

Tài liệu mô tả **ai được làm gì, ở đâu, trên dữ liệu nào** trong S-ERP:
- Phần A dành cho người làm nghiệp vụ và quản trị hệ thống: các khái niệm, quy tắc, ví dụ.
- Phần B dành cho lập trình viên: bảng dữ liệu, API, code, cách mở rộng.

Mọi điều dưới đây đúng với code hiện tại. Những gì đã thống nhất nhưng **chưa làm** được ghi rõ ở mục A10.

---

# Phần A. Nghiệp vụ

## A1. Các lớp kiểm soát

Mỗi thao tác của người dùng đi qua các lớp kiểm tra theo thứ tự. Trượt ở lớp nào thì dừng ở lớp đó.

| # | Lớp | Câu hỏi | Ví dụ bị chặn |
| --- | --- | --- | --- |
| 1 | **Đăng nhập** | Tài khoản có đúng, còn hoạt động, phiên còn hiệu lực không? | Tài khoản bị khóa; mật khẩu vừa bị đặt lại nên phiên cũ hết hiệu lực |
| 2 | **Đơn vị cơ sở** | Người này có được làm việc ở đơn vị đang chọn không? | Nhân viên chi nhánh Hà Nội chuyển sang đơn vị Hồ Chí Minh |
| 3 | **Chức năng + hành động** | Có quyền Xem / Thêm / Sửa / Xóa / Duyệt / In / Xuất trên chức năng này không? | Thủ kho chỉ có quyền Xem nên không thấy nút Thêm danh mục kho |
| 4 | **Quyền đặc biệt** | Có quyền riêng của chức năng không (xem giá, xem phiếu người khác, ghi sổ...)? | Thủ kho thấy phiếu nhập nhưng không thấy cột đơn giá |
| 5 | **Trạng thái phiếu** | Phiếu đang ở trạng thái này thì có được làm việc đó không? | Không sửa được phiếu đã ghi sổ |
| 6 | **Phê duyệt** | Người này có phải người duyệt của cấp hiện tại không? | Trưởng phòng A không duyệt được phiếu của phòng B |

Lớp 1–4 áp dụng cho mọi chức năng. Lớp 5–6 chỉ áp dụng cho chứng từ (phiếu).

**Kiểm tra thật nằm ở máy chủ.** Màn hình chỉ ẩn hoặc mờ nút để dễ dùng. Gọi thẳng API mà không có quyền vẫn bị từ chối (lỗi 403).

## A2. Chức năng

**Chức năng** là một mục trên menu, ví dụ Phiếu nhập kho, Danh mục đơn vị tính, Người dùng và phân quyền.

- Mỗi chức năng có một **mã**, ví dụ `inv_receipt`, `inv_uom_cat`, `sys_users`. Mã dùng chung cho menu, đường dẫn, quyền, nhật ký, thông báo và quy tắc duyệt.
- Danh sách chức năng do phần mềm quy định. Người dùng không thêm hay xóa chức năng.
- Phân hệ hiện có: Tổng quan, Kho, Bán hàng, Tài chính, Nhân sự, Báo cáo, Trợ lý AI, Cài đặt.
- **Bàn tổng quan** (`overview_main`) luôn được xem, dù ma trận ghi gì, vì đó là trang mở đầu sau khi đăng nhập.

Một số chức năng gom nhiều màn quản trị:

| Chức năng | Bao gồm |
| --- | --- |
| Người dùng và phân quyền (`sys_users`) | Tài khoản, vai trò, ma trận quyền, quyền đặc biệt, **quy tắc duyệt** |
| Cài đặt mặc định (`sys_default_config`) | Cài đặt mặc định, **đánh số chứng từ** |
| Nhật ký thay đổi (`sys_audit_log`) | Xem nhật ký, cài đặt thời gian lưu trữ |

## A3. Bảy hành động

Mỗi chức năng có 7 quyền bật / tắt riêng:

| Hành động | Cho phép | Ghi chú |
| --- | --- | --- |
| **Xem** | Mở màn, xem danh sách và chi tiết, tìm, lọc | Không có Xem thì menu ẩn chức năng đó |
| **Thêm** | Tạo bản ghi mới, **sao chép**, **nhập Excel** (chế độ chỉ thêm mới) | |
| **Sửa** | Sửa bản ghi đã lưu | Nhập Excel chế độ "thêm mới và cập nhật" cần cả Thêm lẫn Sửa |
| **Xóa** | Xóa một hoặc nhiều bản ghi; hủy phiếu nháp của chính mình | |
| **Duyệt** | Duyệt / từ chối phiếu | Chỉ có nghĩa với chứng từ |
| **In** | In phiếu, in báo cáo | |
| **Xuất** | Xuất dữ liệu ra file (Excel...) | Tách riêng với In vì xuất file là mang dữ liệu ra ngoài |

Thêm và Sửa tách riêng. Ví dụ nhân viên nhập liệu được **Thêm** phiếu nhưng không được **Sửa** phiếu đã lưu; muốn sửa phải nhờ người có quyền.

Một hành động thường cần **Xem** đi kèm. Có Sửa mà không có Xem thì không mở được màn để sửa.

## A4. Vai trò và ngoại lệ

### Vai trò

**Vai trò** là bộ quyền mẫu cho một nhóm công việc, ví dụ Thủ kho, Kế toán kho, Trưởng phòng kinh doanh. Một vai trò gồm:
- mã và tên;
- **ma trận quyền**: 7 hành động × mọi chức năng;
- **quyền đặc biệt** (A5).

Mỗi người dùng được gán **một vai trò** (hoặc không có vai trò nào).

**Quản trị viên** là vai trò có mã `ADMIN`. Quản trị viên có **toàn quyền** trên mọi chức năng và mọi quyền đặc biệt, không phụ thuộc ma trận. Tài khoản cũ có cờ quản trị kiểu cũ (`auth_fl` chứa `0`) cũng được coi là quản trị viên.

### Ngoại lệ theo người

Khi một người cần khác vai trò ở vài chỗ, quản trị viên sửa thẳng trên ma trận của người đó. Hệ thống **chỉ lưu những chỗ khác vai trò** (gọi là ngoại lệ):

| Loại ngoại lệ | Ý nghĩa |
| --- | --- |
| Dòng chức năng riêng | **Thay hẳn** quyền của vai trò cho đúng chức năng đó; các chức năng khác vẫn theo vai trò |
| Quyền đặc biệt được cấp thêm | Có quyền dù vai trò không có |
| Quyền đặc biệt bị bỏ | Mất quyền dù vai trò có |

**Quyền thực tế** = quyền của vai trò, rồi áp các ngoại lệ lên.

Cách này có lợi: **sửa vai trò thì mọi người giữ vai trò đều được cập nhật**, trừ những chức năng người đó có ngoại lệ riêng. Ví dụ thêm quyền Xem báo cáo mới cho vai trò Thủ kho thì tất cả thủ kho thấy ngay, không phải sửa từng người.

**Ví dụ tính quyền thực tế.** Anh An giữ vai trò Thủ kho:

| Chức năng | Vai trò Thủ kho | Ngoại lệ của An | Quyền thực tế của An |
| --- | --- | --- | --- |
| Phiếu nhập kho | Xem, Thêm, Sửa, In | — | Xem, Thêm, Sửa, In |
| Phiếu xuất kho | Xem, Thêm, In | Xem, Thêm, Sửa, Xóa, In | Xem, Thêm, Sửa, Xóa, In (dòng riêng thay hẳn vai trò) |
| Danh mục kho | Xem | — | Xem |
| Báo cáo tồn kho | Xem, In | Không có quyền nào | Không có quyền nào (bị bỏ riêng cho An) |
| Phiếu nhập kho: xem giá | Không | Cấp thêm | Có |

**Đồng bộ người dùng theo vai trò** (nút trên màn vai trò): xóa mọi ngoại lệ của những người giữ vai trò, đưa họ về đúng quyền của vai trò. Thao tác này có thể trả lại quyền đã cố ý bỏ, nên người không phải quản trị viên chỉ làm được khi việc đó không cấp thêm quyền họ không có. Đồng bộ một vai trò có người là quản trị viên thì chỉ quản trị viên làm được.

## A5. Quyền đặc biệt

Quyền riêng của từng chức năng, ngoài 7 hành động. Chia 4 nhóm:

| Nhóm | Mã | Ý nghĩa | Có ở |
| --- | --- | --- | --- |
| **Dữ liệu** (thấy giá trị nào) | `VIEW_PRICE` | Xem đơn giá, thành tiền | Mọi chứng từ; danh mục vật tư; các báo cáo kho; báo cáo doanh số |
| | `VIEW_COST` | Xem giá vốn | Phiếu xuất kho, xuất điều chuyển, đơn hàng, giao hàng; danh mục vật tư; báo cáo |
| **Phạm vi** (thấy phiếu nào) | `VIEW_ALL` | Xem phiếu của mọi người. Không có thì chỉ thấy phiếu mình lập | Mọi chứng từ |
| **Trạng thái** (làm gì theo trạng thái) | `EDIT_PENDING` | Sửa phiếu đang chờ duyệt | Mọi chứng từ |
| | `EDIT_APPROVED` | Sửa phiếu đã duyệt | |
| | `POST` | Ghi sổ phiếu đã duyệt | |
| | `UNPOST` | Bỏ ghi sổ | |
| | `CANCEL` | Hủy phiếu (trừ phiếu nháp của chính mình, chỉ cần Xóa) | |
| **Tính năng** | `SEND_NOTIFICATION` | Gửi thông báo cho một số người | Bàn tổng quan |
| | `SEND_NOTIFICATION_ALL` | Gửi thông báo cho tất cả | |

Quyền đặc biệt ghi dạng `{chức năng}:{mã}`, ví dụ `inv_receipt:VIEW_PRICE` là xem giá trên phiếu nhập kho.

**Quyền đặc biệt chỉ có hiệu lực khi có quyền Xem chức năng đó.** Không xem được phiếu nhập thì quyền "xem giá phiếu nhập" cũng không có tác dụng.

Chứng từ hiện khai báo:

| Mã chức năng | Loại phiếu | Tên |
| --- | --- | --- |
| `inv_receipt` | PNK | Phiếu nhập kho |
| `inv_issue` | PXK | Phiếu xuất kho |
| `inv_transfer_order` | LDC | Lệnh điều chuyển kho |
| `inv_transfer_issue` | PXDC | Phiếu xuất điều chuyển |
| `inv_transfer_receipt` | PNDC | Phiếu nhập điều chuyển |
| `inv_audit_count` | PKK | Phiếu kiểm kê |
| `sales_orders` | SO | Đơn bán hàng |
| `sales_delivery` | PGH | Phiếu giao hàng |
| `fin_receipt_voucher` | PT | Phiếu thu |
| `fin_payment_voucher` | PC | Phiếu chi |

## A6. Đơn vị cơ sở

Công ty có nhiều **đơn vị cơ sở** (chi nhánh, nhà máy, công ty con). Dữ liệu nghiệp vụ thuộc về từng đơn vị.

- Mỗi người dùng có **danh sách đơn vị được làm việc** và một **đơn vị mặc định**.
- Lúc đăng nhập chọn một đơn vị; trong phiên đổi đơn vị ở thanh đầu trang. Mọi thao tác chỉ làm trên đơn vị đang chọn.
- Đơn vị bị ngừng hoạt động thì không ai vào được, kể cả người có quyền.
- Quản trị viên vào được mọi đơn vị đang hoạt động.
- **Quyền chức năng giống nhau ở mọi đơn vị.** Không có kiểu "ở Hà Nội được sửa, ở Hồ Chí Minh chỉ được xem". Cần khác nhau thì tạo hai tài khoản, hoặc chờ phân quyền theo đơn vị (A10).

Gắn với đơn vị: khóa sổ theo tháng, quy tắc duyệt riêng, cài đặt riêng (kho mặc định, cho phép xuất âm).

## A7. Trạng thái phiếu

Vòng đời của mọi phiếu:

```
 Lập ──gửi duyệt──► Chờ duyệt ──duyệt hết các cấp──► Đã duyệt ──ghi sổ──► Đã ghi sổ
  ▲                    │                                                    │
  └────bị từ chối──────┘                                       bỏ ghi sổ ◄──┘
 (mọi trạng thái trừ Đã ghi sổ) ──hủy──► Hủy
```

Được làm gì ở từng trạng thái:

| Thao tác | Lập | Chờ duyệt | Đã duyệt | Đã ghi sổ | Hủy |
| --- | --- | --- | --- | --- | --- |
| Xem | Xem (+ `VIEW_ALL` nếu phiếu người khác) | như Lập | như Lập | như Lập | như Lập |
| Sửa | Sửa | Sửa + `EDIT_PENDING` | Sửa + `EDIT_APPROVED` | Không ai | Không ai |
| Gửi duyệt | Thêm hoặc Sửa | — | — | — | — |
| Duyệt / Từ chối | — | Người duyệt cấp hiện tại, **không phải người lập** | — | — | — |
| Ghi sổ | — | — | `POST` | — | — |
| Bỏ ghi sổ | — | — | — | `UNPOST` | — |
| Hủy | Người lập có Xóa; người khác cần `CANCEL` | `CANCEL` | `CANCEL` | Không (bỏ ghi sổ trước) | — |

Quy tắc chung:
- Mọi thao tác (trừ duyệt / từ chối) cần quyền **Xem** chức năng.
- Phiếu của người khác chỉ thấy và thao tác được khi có **`VIEW_ALL`**.
- **Không ai tự duyệt phiếu mình lập**, kể cả quản trị viên.
- Người duyệt **không cần** Xem chức năng hay `VIEW_ALL`: duyệt từ màn Phê duyệt là đủ.

Cài đặt **"Duyệt trước khi ghi sổ"** (Cài đặt mặc định) quyết định phiếu chưa duyệt có được ghi sổ không.

## A8. Phê duyệt nhiều cấp

### Quy tắc duyệt

Đặt ở Cài đặt › Người dùng và phân quyền › Quy tắc duyệt. Mỗi quy tắc đọc là:

> Phiếu **[chức năng]** do **[ai]** lập ở **[đơn vị]**, có giá trị **từ [số tiền]**, được duyệt ở **cấp [n]** bởi **[người / vai trò]**.

| Thành phần | Lựa chọn |
| --- | --- |
| Chức năng | Một loại chứng từ |
| Đơn vị | Một đơn vị, hoặc để trống = mọi đơn vị |
| Người lập | Bất kỳ ai; một người; một vai trò; một phòng ban |
| Số tiền từ | Để trống = mọi giá trị |
| Cấp | 1, 2, 3... |
| Người duyệt | Một người, hoặc một vai trò (mọi người giữ vai trò đó **và được làm việc ở đơn vị của phiếu**) |

### Cách chạy

1. Khi phiếu được gửi duyệt, hệ thống lấy mọi quy tắc **khớp** (đúng chức năng, đơn vị, người lập, số tiền) và gom theo cấp.
2. Các cấp chạy **lần lượt** 1 → 2 → 3. Trong một cấp, **một người** trong danh sách duyệt là đủ để qua cấp.
3. Duyệt xong cấp cuối thì phiếu thành **Đã duyệt**. Bị từ chối ở bất kỳ cấp nào thì phiếu về **Lập**, người lập sửa rồi gửi lại (lượt mới).
4. Người lập (hoặc quản trị viên) rút lại được khi phiếu đang chờ.
5. Không có quy tắc nào khớp thì phiếu không cần duyệt.

Mỗi bước gửi thông báo, theo ngôn ngữ của từng người:
- người duyệt cấp kế tiếp nhận yêu cầu duyệt;
- người lập nhận kết quả (đã duyệt hết, hoặc bị từ chối kèm lý do).

**Ví dụ.** Phiếu xuất kho ở Hà Nội:
- Quy tắc 1: mọi người lập, mọi giá trị, cấp 1, vai trò Trưởng kho.
- Quy tắc 2: mọi người lập, từ 100.000.000, cấp 2, Giám đốc.

Phiếu 30 triệu: chỉ cần Trưởng kho duyệt. Phiếu 150 triệu: Trưởng kho duyệt, rồi đến Giám đốc.

### Màn Phê duyệt

Menu Phê duyệt có các màn gom phiếu cần duyệt: Phê duyệt nhập kho, Phê duyệt xuất kho, Phê duyệt điều chuyển.

Quyền **Duyệt** trên màn phê duyệt có tác dụng như quyền Duyệt trên chính chứng từ. Nhờ vậy giám đốc chỉ cần quyền ở màn phê duyệt, không cần vào màn phiếu xuất kho. Quyền **Xem** trên màn phê duyệt cho phép xem phiếu đang chờ để duyệt.

## A9. Quản trị phân quyền an toàn

### Ai được cấp quyền

Người có quyền ở chức năng **Người dùng và phân quyền** quản lý tài khoản, vai trò, quy tắc duyệt. Có các giới hạn:

| Giới hạn | Mục đích |
| --- | --- |
| **Không cấp quá quyền mình có.** Người không phải quản trị viên chỉ thêm được hành động, quyền đặc biệt, đơn vị mà chính họ có. Những gì người kia đã có từ trước thì được giữ | Không ai tự "đẻ" ra quyền lớn hơn mình |
| **Không tự sửa quyền của mình** (trừ quản trị viên) | Không tự nâng quyền |
| **Chỉ quản trị viên** gán vai trò quản trị, hoặc sửa / khóa / đặt mật khẩu tài khoản quản trị viên | Bảo vệ tài khoản cao nhất |
| **Không khóa / xóa quản trị viên cuối cùng** | Luôn còn người vào được hệ thống |
| Không tự khóa, tự xóa tài khoản mình; đổi mật khẩu của mình qua màn Tài khoản, không qua "đặt lại mật khẩu" | Tránh tự khóa nhầm |
| Mật khẩu ít nhất 8 ký tự | |

### Thay đổi có hiệu lực ngay

- **Đổi quyền, vai trò, đơn vị**: có hiệu lực từ thao tác kế tiếp của người kia, không phải đăng nhập lại.
- **Khóa tài khoản, đặt lại / đổi mật khẩu, xóa tài khoản**: **mọi phiên** của người đó hết hiệu lực ngay, phải đăng nhập lại.
- Đăng nhập và đổi mật khẩu giới hạn **10 lần mỗi phút cho mỗi địa chỉ IP**.

### Nhật ký

Mọi thay đổi về quyền được ghi ở Cài đặt › Nhật ký thay đổi:
- Thêm / sửa / xóa vai trò, kèm các quyền thay đổi.
- Thay đổi quyền của một người, ghi theo **quyền thực tế được thêm hoặc mất**, không ghi theo dòng ngoại lệ kỹ thuật. Ví dụ: "Phiếu xuất kho: + Xóa", "Phiếu nhập kho: xem giá → bỏ".
- Đổi vai trò, đổi đơn vị được làm việc, khóa / mở tài khoản, đặt lại mật khẩu.
- Đồng bộ người dùng theo vai trò: mỗi người một dòng về quyền họ được thêm / mất.
- Thao tác duyệt: gửi, duyệt, từ chối, rút lại, kèm cấp và ghi chú.

## A10. Chưa làm và hướng phát triển

| Nội dung | Tình trạng |
| --- | --- |
| **Danh mục trạng thái chứng từ** theo từng loại phiếu: đổi tên, bật / tắt trạng thái; mỗi trạng thái có quyền riêng "được chuyển phiếu sang trạng thái này" (thay `EDIT_PENDING`, `EDIT_APPROVED`, `POST`, `CANCEL`); quyền riêng cho **từng bước lùi** (bỏ ghi sổ, mở lại phiếu hủy...); tắt "Chờ duyệt" thì phiếu đó không cần duyệt | Đã thống nhất thiết kế, làm khi làm phiếu kho thật |
| Phiếu, màn phê duyệt trên giao diện | API duyệt đã có, màn phiếu chưa gọi (phiếu còn là dữ liệu mẫu) |
| Chính sách mật khẩu (độ phức tạp, hết hạn), khóa tài khoản sau N lần sai theo tài khoản, tự đăng xuất khi không dùng, lịch sử đăng nhập | Chưa có |
| Quyền khác nhau theo đơn vị cơ sở | Chưa có; hiện quyền giống nhau ở mọi đơn vị |
| Phạm vi dữ liệu chi tiết hơn "của mình / tất cả" (theo kho, theo phòng ban) | Chưa có |
| Nhiều vai trò cho một người | Bảng dữ liệu cho phép, màn hình và API hiện chỉ gán một vai trò |
| Danh sách đầy đủ của các danh mục hệ thống (đơn vị, ngoại tệ, tỷ giá, phòng ban) cần quyền Xem | Đang mở cho mọi người đăng nhập vì form khác còn đọc; chuyển sang ô tra cứu khi làm lại các màn đó |

---

# Phần B. Thiết kế kỹ thuật

## B1. Bảng dữ liệu

| Bảng | Nội dung | Khóa |
| --- | --- | --- |
| `sys_users` | Tài khoản. `security_version` tăng thì token cũ hết hiệu lực; `is_active`, `validflg` (xóa mềm); `auth_fl` (cờ quản trị kiểu cũ) | `user_id` |
| `sys_role` | Vai trò. `role_code = 'ADMIN'` là quản trị viên | `role_id`; unique `role_code`, `role_name` |
| `sys_user_role` | Người ↔ vai trò | (`user_id`, `role_id`) |
| `sys_command` | Danh mục chức năng (`menuid0` = mã chức năng). API tự chèn mã mới khi khởi động | `menuid0` |
| `sys_role_command` | Ma trận của vai trò, một dòng / chức năng | (`role_id`, `menuid0`) |
| `sys_user_command` | **Ngoại lệ** ma trận của người, một dòng thay hẳn chức năng đó | (`user_id`, `menuid0`) |
| `sys_role_right` | Quyền đặc biệt của vai trò (có dòng = có quyền) | (`role_id`, `menuid0`, `right_code`) |
| `sys_user_right` | **Ngoại lệ** quyền đặc biệt của người: `is_granted` true = thêm, false = bỏ | (`user_id`, `menuid0`, `right_code`) |
| `sys_user_company_unit` | Đơn vị được làm việc của người | (`user_id`, `unit_code`) |
| `sys_approval_rule` | Quy tắc duyệt | `id` |
| `sys_document_approval` | Các bước duyệt của từng lượt gửi của từng phiếu | `id` |
| `sys_audit_log` | Nhật ký thay đổi (dùng chung) | `id` |

SQL: `sql/postgresql/01-users.sql`, `02-company-units.sql`, `05-approvals.sql`, `10-permission-exceptions.sql`, `12-audit-log.sql`. Không có khóa ngoại; service kiểm tra liên kết.

**11 cờ cũ ↔ 7 hành động.** Bảng `sys_role_command` / `sys_user_command` giữ 11 cột cờ của hệ thống cũ. `CommandPermission` chuyển đổi hai chiều:

| Hành động | Cột khi đọc | Cột được ghi |
| --- | --- | --- |
| Xem | `can_view` | `can_view`, `can_search`, `can_reload` |
| Thêm | `can_add` | `can_add`, `can_copy`, `can_import` |
| Sửa | `can_edit` | `can_edit` |
| Xóa | `can_delete` | `can_delete` |
| Duyệt | `can_approve` | `can_approve` |
| In | `can_print` | `can_print` |
| Xuất | `can_export` | `can_export` |

JSON kiểu cũ (`createEdit`, `printExport` trong file seed, bản sao lưu cài đặt) vẫn đọc được qua `ActionPermissionsJsonConverter`.

## B2. Nơi khai báo (code là nguồn gốc)

| Nội dung | Backend | Frontend |
| --- | --- | --- |
| Danh sách chức năng | `Core.Application/Common/Permissions/FunctionCatalog.cs` | `src/types/index.ts` (`SubMenuKey`), `src/config/functions.ts` (`FUNCTION_REGISTRY`) |
| 7 hành động | `Core.Domain/Modules/Users/ActionPermissions.cs` (`PermissionAction`, `ActionPermissions`) | `src/types/index.ts` (`ActionPermissions`) |
| Quyền đặc biệt | `Core.Application/Common/Permissions/SpecialRightCatalog.cs`; tên và mô tả `right.*` trong `Messages.*.json` | Tải từ `GET /api/settings/permission-catalog` |
| Chứng từ, màn phê duyệt | `Core.Application/Common/Documents/VoucherCatalog.cs` | `src/utils/permissions.ts` (`APPROVAL_SCREENS`) |
| Quy tắc trạng thái phiếu | `Core.Application/Common/Permissions/DocumentStatusPolicy.cs` | `src/utils/documentPolicy.ts` |
| Ca kiểm thử trạng thái chung | `tests/Core.Tests/Common/DocumentPolicyCases.json` | `npm run check-policy` |

## B3. Tính quyền thực tế

`Core.Application/Common/Permissions/PermissionMatrix.cs` (logic thuần, không truy cập database):

```
Resolve(isAdmin, own, fromRoles):
    isAdmin                  → mọi chức năng = Full
    matrix = Build(fromRoles)  // OR các vai trò; thiếu chức năng = None
    với mỗi dòng own          → matrix[chức năng] = dòng own (thay hẳn)
    overview_main.View = true

ResolveRights(isAdmin, fromRoles, granted, denied):
    isAdmin → mọi quyền đặc biệt
    (vai trò ∪ granted) \ denied

VisibleRights(rights, matrix): chỉ giữ quyền của chức năng có View
```

Khi lưu quyền một người, màn hình gửi **ma trận mong muốn đầy đủ**. Backend chỉ lưu phần khác vai trò:
- `PermissionMatrix.Overrides(roleMatrix, wanted)`: các dòng chức năng khác vai trò;
- `PermissionMatrix.RightOverrides(roleRights, wanted)`: quyền được thêm / bỏ.

`PermissionService` (`Core.Infrastructure/Modules/Users/`) đọc dữ liệu và gọi các hàm trên.

## B4. Kiểm tra ở API

**Mặc định của mọi controller.** Kế thừa `ApiControllerBase` = bắt buộc đăng nhập **và** đơn vị trong token đang hoạt động, người dùng được vào (`UnitAccessHandler`).

**Gắn quyền cho từng API** (`Core/Common/Authorization/`):

```csharp
[HttpGet, RequirePermission(Function, PermissionAction.View)]
[HttpPost, RequirePermission(Function, PermissionAction.Create)]
[HttpPut("{id}"), RequirePermission(Function, PermissionAction.Edit)]
[HttpDelete("{id}"), RequirePermission(Function, PermissionAction.Delete)]
[RequireRight("inv_receipt", SpecialRightCatalog.EditApproved)]
[Authorize(Policy = Policies.Admin)]          // chỉ quản trị viên
```

- `RequirePermission` tạo policy `perm:{chức năng}:{hành động}`, `RequireRight` tạo `right:{chức năng}:{mã}` (`PermissionPolicyProvider`). Cả hai kèm kiểm tra đơn vị.
- Kiểm tra trong service khi điều kiện phụ thuộc dữ liệu:
  - `IPermissionService.EnsureAllowedAsync(userId, fn, action)`, ví dụ nhập Excel chế độ upsert cần thêm Edit;
  - `EnsureAnyAllowedAsync(userId, fn, [Create, Edit])`, ví dụ gửi duyệt;
  - `HasRightAsync(userId, fn, code)`, `EnsureAdminAsync(userId)`.
- Phiếu: dựng `DocumentActor.For(matrix, rights, function, isOwner)` rồi gọi `DocumentStatusPolicy.Check(action, status, actor)`. Bị từ chối thì trả lý do theo ngôn ngữ người dùng.
- Lỗi: không đủ quyền → `ForbiddenException` → 403; chưa đăng nhập / token hết hiệu lực → 401.

**Quy ước theo phương thức HTTP:**

| HTTP | Quyền |
| --- | --- |
| `GET` danh sách / chi tiết của chức năng | Xem |
| `POST` tạo, sao chép, `.../import` | Thêm (`import` chế độ upsert cần thêm Sửa) |
| `PUT`, lưu cài đặt | Sửa |
| `DELETE`, `.../delete-many` | Xóa |
| Gửi duyệt | Thêm **hoặc** Sửa |
| Xuất file ở server | Xuất |

**Quy tắc đọc dữ liệu.** Danh sách đầy đủ của một chức năng cần quyền Xem. Màn khác chọn mã qua **tra cứu** `GET /api/lookups/{tên}`: mở cho mọi người đã đăng nhập, chỉ trả mã, tên và vài cột, có phân trang.

**Test tự kiểm tra:**

| Test | Báo đỏ khi |
| --- | --- |
| `ReadAccessContractTests` | `GET` của controller có `const string Function` mà thiếu `RequirePermission` (ngoại lệ ghi lý do trong danh sách `Exempt`) |
| `PermissionMatrixTests` | Sai quy tắc vai trò + ngoại lệ |
| Ca trong `DocumentPolicyCases.json` | Quy tắc trạng thái backend và frontend lệch nhau |

## B5. Phiên đăng nhập và hiệu lực tức thì

- Đăng nhập (`POST /api/auth/login`, giới hạn 10 lần / phút / IP) trả **JWT** chứa id người dùng, **đơn vị đang chọn**, `security_version`.
- Đổi đơn vị: `POST /api/auth/switch-unit` cấp token mới.
- Mỗi request kiểm tra token còn đúng `security_version` và tài khoản còn hoạt động. `security_version` tăng khi: khóa / mở tài khoản, đặt lại mật khẩu, đổi mật khẩu, xóa tài khoản, quản trị viên khởi động lại ở môi trường dev.
- **Cache quyền.** `PermissionService` giữ một "ảnh" quyền mỗi người trong bộ nhớ: trạng thái tài khoản, quản trị viên, ma trận, quyền đặc biệt, đơn vị. Ảnh này được đọc ở hầu hết mọi request. `CacheInvalidationInterceptor` xóa ảnh **ngay khi** có ghi vào bảng tài khoản, vai trò, quyền, đơn vị (`CacheTables.UserAccess`), nên thu hồi quyền có hiệu lực từ request kế tiếp.
- Giới hạn: cache nằm trong một tiến trình. Chạy nhiều máy chủ backend thì cần cache dùng chung (Redis hoặc PostgreSQL LISTEN/NOTIFY). Sửa thẳng database ngoài API thì phải khởi động lại backend.

## B6. Bảo vệ khi cấp quyền

`Core.Infrastructure/Modules/Users/GrantGuard.cs`:

| Hàm | Quy tắc |
| --- | --- |
| `EnsureCanGrantAsync(actor, before, after, rightsBefore, rightsAfter)` | Người không phải quản trị viên: mỗi hành động / quyền đặc biệt **mới** phải là thứ actor đang có |
| `EnsureCanAssignUnitsAsync(actor, before, after)` | Đơn vị mới phải là đơn vị actor được làm việc |
| `EnsureNotSelfAsync(actor, target)` | Không tự sửa quyền mình (trừ quản trị viên) |

`UserService` còn có: chỉ quản trị viên động vào tài khoản / vai trò quản trị (`EnsureActorMayManageAsync`), không khóa / xóa quản trị viên cuối (`EnsureNotLastAdminAsync`), không tự khóa / tự xóa.

`RoleService.SyncUsersAsync`: kiểm tra `EnsureCanGrantAsync` cho từng người trước khi xóa ngoại lệ.

## B7. API quản trị

| API | Quyền |
| --- | --- |
| `GET /api/settings/permission-catalog` (chức năng, quyền đặc biệt) | Đã đăng nhập |
| `GET/POST /api/settings/users`, `PUT /{id}`, `DELETE /{id}` | `sys_users` Xem / Thêm / Sửa / Xóa |
| `PUT /api/settings/users/{id}/permissions` `{ roleId, permissions, specialRights, version }` | `sys_users` Sửa |
| `PUT /api/settings/users/{id}/password` | `sys_users` Sửa |
| `GET/POST /api/settings/roles`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/sync-users` | `sys_users` |
| `GET/POST/PUT/DELETE /api/settings/approval-rules`, `POST .../preview` | `sys_users` |
| `GET /api/approvals/pending`, `GET /{fn}/{id}`, `POST /submit`, `POST /{fn}/{id}/approve \| reject \| withdraw` | Đăng nhập; kiểm tra trong `DocumentApprovalService` |

Lưu quyền và vai trò có **chống ghi đè**: gửi `version` lúc mở. Người khác đã sửa trong lúc đó thì nhận 409 và màn tải lại.

## B8. Phê duyệt (code)

| Phần | File |
| --- | --- |
| Chọn quy tắc khớp, gom theo cấp (logic thuần) | `Core.Application/Modules/Approvals/ApprovalRuleEngine.cs` |
| Đổi vai trò người duyệt thành danh sách người | `Core.Infrastructure/Modules/Approvals/ApprovalResolver.cs` |
| Gửi / duyệt / từ chối / rút, thông báo, nhật ký (một transaction mỗi bước) | `Core.Infrastructure/Modules/Approvals/DocumentApprovalService.cs` |

`sys_document_approval`:
- Mỗi lượt gửi (`round`) có một dòng cho mỗi cấp.
- `approver_user_ids` là danh sách người được duyệt cấp đó, chốt lúc gửi.
- `status`: `WAITING` (cấp sau chưa tới) → `PENDING` (đang chờ) → `APPROVED` / `REJECTED` / `CANCELLED`.

## B9. Frontend

- Hồ sơ người dùng sau đăng nhập (`/api/auth/me`) mang ma trận thực tế và quyền đặc biệt. Các hàm trong `src/utils/permissions.ts`: `canView`, `getActionPermission`, `hasRight`.
- Màn hình chỉ dùng để **ẩn / mờ nút**:
  - nút Thêm, Nhập Excel → `perms.create`;
  - Sửa → `perms.edit`;
  - Xóa → `perms.delete`;
  - Xuất Excel → `perms.export`;
  - In → `perms.print`.
- Danh mục dùng khung chung (`CatalogScreen`) tự áp dụng các quy tắc này.
- Màn quản trị: `src/modules/settings/UserPermissionManager.tsx` và thư mục `permissions/`:
  - `UserListPanel`, `UserDetailPanel`, `RoleListPanel`, `RoleDetailPanel`;
  - `PermissionMatrixTable`: ma trận 7 cột, nhóm theo phân hệ;
  - `ApprovalRulesPanel`, `SaveBar`.
- Chữ của quyền đặc biệt lấy theo ngôn ngữ từ backend.

## B10. Thêm mới

**Một chức năng mới.** Khai báo mã ở `FunctionCatalog.cs` và `functions.ts`. Mã tự có trong ma trận với 7 hành động; chỉ cần gắn `RequirePermission` cho từng API (danh mục: theo skill `/them-danh-muc`, [them-danh-muc.md](them-danh-muc.md)).

**Một chứng từ mới.** Thêm vào `VoucherCatalog.All`. Tự có: dãy số phiếu, đủ bộ quyền đặc biệt của chứng từ, chỗ trong quy tắc duyệt. Có màn phê duyệt riêng thì thêm vào `ApprovalScreens` (và `APPROVAL_SCREENS` ở frontend).

**Một quyền đặc biệt mới.** Thêm vào `SpecialRightCatalog.Build()` và khóa `right.<textKey>.name` / `.description` ở `Messages.vi.json` + `Messages.en.json`. Màn phân quyền tự hiện. Dùng ở API bằng `[RequireRight(fn, code)]` hoặc `HasRightAsync`, ở frontend bằng `hasRight`.

**Đổi quy tắc trạng thái phiếu.** Sửa cùng lúc `DocumentStatusPolicy.cs`, `documentPolicy.ts`, `DocumentPolicyCases.json`, rồi chạy `dotnet test` và `npm run check-policy`.
