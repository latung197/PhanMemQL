# Phân quyền S-ERP: nghiệp vụ và thiết kế

Tài liệu mô tả **ai được làm gì, ở đâu, trên dữ liệu nào** trong S-ERP:
- Phần A dành cho người làm nghiệp vụ và quản trị hệ thống: các khái niệm, quy tắc, ví dụ.
- Phần B dành cho lập trình viên: bảng dữ liệu, API, code, cách mở rộng.
- **Phần C: các luồng làm từng bước** (tạo vai trò, đưa nhân viên mới vào, cấp quyền theo đơn vị, quy tắc duyệt, đường đi của phiếu, báo cáo, danh mục, thu hồi quyền, gỡ rối, danh sách kiểm tra).

**Muốn làm ngay thì đọc Phần C** (bắt đầu từ mục C1). Mọi điều dưới đây đúng với code hiện tại. Những gì đã thống nhất nhưng **chưa làm** được ghi rõ ở mục A10.

| Tôi muốn... | Xem |
| --- | --- |
| Hiểu quyền hoạt động thế nào | A1 – A9, C1 |
| Đưa nhân viên mới vào, tạo vai trò | C2, C3 |
| Cấp quyền riêng, quyền theo đơn vị | C4, C5 |
| Đặt người duyệt phiếu | C6, A8 |
| Biết ai cần quyền gì ở từng bước của phiếu | C7, C8 |
| Cho người xem báo cáo, làm việc với danh mục | C9, C10 |
| Khóa nhân viên nghỉ việc | C11 |
| Tìm lý do "không thấy / không bấm được" | C12 |

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

Áp dụng cho từng loại màn:
- **Danh mục**: Xem (danh sách, tìm, lọc), Thêm (thêm, sao chép, nhập Excel), Sửa, Xóa (kể cả xóa nhiều), Xuất (Excel, cần cả Xem).
- **Chứng từ**: như danh mục, thêm Duyệt; các thao tác theo trạng thái cần thêm quyền đặc biệt (A5, A7).
- **Báo cáo / màn tính toán**: Xem để mở, Xuất để tải Excel, In để in. Riêng **Tính tồn kho tức thời**: nút "Dựng lại số dư" cần **Sửa**. Giá trị tiền do quyền đặc biệt quyết định, không do 7 hành động.

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
| **Dữ liệu** (thấy giá trị nào) | `VIEW_PRICE` | Xem đơn giá, thành tiền | Mọi chứng từ; danh mục vật tư; năm báo cáo kho và Tính giá trung bình tháng; báo cáo doanh số, chi phí dự án, công nợ phải trả |
| | `VIEW_COST` | Xem giá vốn (và mọi cột tiền của báo cáo). Không có thì số lượng vẫn xem được, cột tiền để trống | Phiếu xuất kho, xuất điều chuyển, nhập điều chuyển, kiểm kê, đơn bán hàng, phiếu giao hàng; danh mục vật tư; từng báo cáo (**cấp riêng cho từng báo cáo**) |
| **Phạm vi** (thấy phiếu nào) | `VIEW_ALL` | Xem phiếu của mọi người. Không có thì chỉ thấy phiếu mình lập | Mọi chứng từ |
| **Trạng thái** (làm gì theo trạng thái, **cấp riêng từng đơn vị cơ sở**) | `ST_PENDING` | Gửi duyệt, lưu ở Chờ duyệt, sửa phiếu đang chờ duyệt | Mọi chứng từ |
| | `ST_APPROVED` | Lưu thẳng ở Đã duyệt, sửa phiếu đã duyệt | |
| | `ST_POSTED` | Ghi sổ phiếu đã duyệt, lưu thẳng ở Đã ghi sổ | Chứng từ có ghi sổ |
| | `ST_UNPOST` | Bỏ ghi sổ (bước lùi) | Chứng từ có ghi sổ |
| | `ST_EDIT_POSTED` | Sửa hoặc xóa phiếu **đã ghi sổ** (hệ thống đảo ghi sổ cũ, ghi sổ lại bản mới; từ chối nếu làm âm kho) | Phiếu nhập kho, phiếu xuất kho, xuất điều chuyển, nhập điều chuyển |
| | `ST_CANCELLED` | Hủy phiếu (trừ phiếu nháp của chính mình, chỉ cần Xóa) và **khôi phục** phiếu đã hủy về Lập | Mọi chứng từ |
| **Tính năng** | `CHANGE_CODE` | Đổi mã, gộp mã của danh mục (cần thêm quyền Sửa) | Nhà cung cấp, nhóm nhà cung cấp, dự án, điều khoản thanh toán, loại kho, nhóm / loại vật tư, khách hàng, nhóm khách hàng |
| | `SEND_NOTIFICATION` | Gửi thông báo cho một số người | Bàn tổng quan |
| | `SEND_NOTIFICATION_ALL` | Gửi thông báo cho tất cả | |

Quyền đặc biệt ghi dạng `{chức năng}:{mã}`, ví dụ `inv_receipt:VIEW_PRICE` là xem giá trên phiếu nhập kho.

**Quyền đặc biệt chỉ có hiệu lực khi có quyền Xem chức năng đó.** Không xem được phiếu nhập thì quyền "xem giá phiếu nhập" cũng không có tác dụng.

Chứng từ hiện khai báo:

| Mã chức năng | Loại phiếu | Tên |
| --- | --- | --- |
| `inv_receipt` | PNK | Phiếu nhập kho |
| `inv_issue_request` | YCX | Phiếu yêu cầu xuất kho (không ghi sổ: không có `ST_POSTED`, `ST_UNPOST`) |
| `pur_request` | YCM | Phiếu yêu cầu mua hàng (không ghi sổ) |
| `pur_order` | DMH | Đơn mua hàng (không ghi sổ) |
| `pur_invoice` | HDM | Hóa đơn mua hàng (không ghi sổ) |
| `inv_issue` | PXK | Phiếu xuất kho |
| `inv_transfer_order` | LDC | Lệnh điều chuyển kho |
| `inv_transfer_issue` | PXDC | Phiếu xuất điều chuyển |
| `inv_transfer_receipt` | PNDC | Phiếu nhập điều chuyển |
| `inv_audit_count` | PKK | Phiếu kiểm kê |
| `sales_orders` | SO | Đơn bán hàng (không ghi sổ) |
| `sales_delivery` | PGH | Phiếu giao hàng |
| `fin_receipt_voucher` | PT | Phiếu thu |
| `fin_payment_voucher` | PC | Phiếu chi |

## A6. Đơn vị cơ sở

Công ty có nhiều **đơn vị cơ sở** (chi nhánh, nhà máy, công ty con). Dữ liệu nghiệp vụ thuộc về từng đơn vị.

- Mỗi người dùng có **danh sách đơn vị được làm việc** và một **đơn vị mặc định**.
- Lúc đăng nhập chọn một đơn vị; trong phiên đổi đơn vị ở thanh đầu trang. Mọi thao tác chỉ làm trên đơn vị đang chọn.
- Đơn vị bị ngừng hoạt động thì không ai vào được, kể cả người có quyền.
- Quản trị viên vào được mọi đơn vị đang hoạt động.
- **Quyền chức năng (7 hành động) giống nhau ở mọi đơn vị.** Không có kiểu "ở Hà Nội được sửa, ở Hồ Chí Minh chỉ được xem".
- **Ngoại lệ: quyền theo trạng thái** (`ST_PENDING`, `ST_APPROVED`, `ST_POSTED`, `ST_UNPOST`, `ST_CANCELLED`, `ST_EDIT_POSTED`) **cấp riêng từng đơn vị**: có thể cho một người ghi sổ ở Hà Nội mà không ghi sổ ở Hồ Chí Minh (luồng C5). Quản trị viên có các quyền này ở mọi đơn vị đang hoạt động.

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
| Sửa | Sửa | Sửa + `ST_PENDING` | Sửa + `ST_APPROVED` | Không ai | Không ai |
| Gửi duyệt | Thêm hoặc Sửa + `ST_PENDING` | — | — | — | — |
| Duyệt / Từ chối | — | Người duyệt cấp hiện tại, **không phải người lập** | — | — | — |
| Ghi sổ | — | — | `ST_POSTED` | — | — |
| Bỏ ghi sổ | — | — | — | `ST_UNPOST` | — |
| Hủy | Người lập có Xóa; người khác cần `ST_CANCELLED` | `ST_CANCELLED` | `ST_CANCELLED` | Không (bỏ ghi sổ trước) | — |
| Khôi phục (về Lập) | — | — | — | — | `ST_CANCELLED` |

Phiếu đã ghi sổ **sửa / xóa được** nếu người làm có `ST_EDIT_POSTED` (phiếu nhập, xuất, xuất / nhập điều chuyển): hệ thống đảo ghi sổ cũ và ghi sổ lại trong một giao dịch, từ chối nếu làm âm kho. Cột "Sửa" ở bảng trên là quy tắc chung của trạng thái; ngoại lệ này do `ST_EDIT_POSTED` mở. Đơn vị có thể **tắt bước Chờ duyệt**, khi đó phiếu bỏ qua bước này (xem `trang-thai-chung-tu.md`).

Quyền trạng thái là quyền **đến** một trạng thái: người có `ST_POSTED` cũng gửi duyệt và lưu ở Đã duyệt được, và khi lập chứng từ chọn được đến trạng thái mà quyền của mình (tại đơn vị đang làm việc) với tới. Quyền được cấp riêng cho từng đơn vị (mã `inv_receipt:ST_POSTED@DVCS01`), danh mục trạng thái cũng theo đơn vị: xem `docs/he-thong/trang-thai-chung-tu.md`.

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
| Người duyệt | Một người, hoặc một vai trò (mọi người giữ vai trò đó). Chỉ tính người **có quyền Duyệt** chức năng (hoặc màn phê duyệt của nó) **và được làm việc ở đơn vị của phiếu** |

### Cách chạy

1. Khi phiếu được gửi duyệt, hệ thống lấy mọi quy tắc **khớp** (đúng chức năng, đơn vị, người lập, số tiền) và gom theo cấp.
2. Các cấp chạy **lần lượt** 1 → 2 → 3. Trong một cấp, **một người** trong danh sách duyệt là đủ để qua cấp.
3. Duyệt xong cấp cuối thì phiếu thành **Đã duyệt**. Bị từ chối ở bất kỳ cấp nào thì phiếu về **Lập**, người lập sửa rồi gửi lại (lượt mới).
4. Người lập (hoặc quản trị viên) rút lại được khi phiếu đang chờ.
5. Không có quy tắc nào khớp thì phiếu vẫn phải duyệt một cấp: mọi người có quyền **Duyệt** chức năng đó (hoặc màn phê duyệt của nó), được làm việc ở đơn vị của phiếu, trừ người lập. Một cấp có quy tắc mà không còn ai duyệt được (vai trò không có người, người duyệt bị khóa) thì không gửi duyệt được và báo lỗi.

Mỗi bước gửi thông báo, theo ngôn ngữ của từng người:
- người duyệt cấp kế tiếp nhận yêu cầu duyệt;
- người lập nhận kết quả (đã duyệt hết, hoặc bị từ chối kèm lý do).

**Ví dụ.** Phiếu xuất kho ở Hà Nội:
- Quy tắc 1: mọi người lập, mọi giá trị, cấp 1, vai trò Trưởng kho.
- Quy tắc 2: mọi người lập, từ 100.000.000, cấp 2, Giám đốc.

Phiếu 30 triệu: chỉ cần Trưởng kho duyệt. Phiếu 150 triệu: Trưởng kho duyệt, rồi đến Giám đốc.

### Màn Phê duyệt

Menu Phê duyệt có các màn gom phiếu cần duyệt: Phê duyệt nhập kho, xuất kho, yêu cầu xuất kho, điều chuyển, kiểm kê, yêu cầu mua, đơn mua, hóa đơn mua và đơn bán hàng.

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
| **Danh mục trạng thái chứng từ** theo đơn vị cơ sở và quyền theo trạng thái theo đơn vị | **Đã làm** (`docs/he-thong/trang-thai-chung-tu.md`) |
| Mở lại phiếu đã hủy | **Đã làm**: nút "Khôi phục", quyền `ST_CANCELLED` (mục C8) |
| Sửa / xóa phiếu đã ghi sổ | **Đã làm** cho phiếu nhập, xuất, điều chuyển: quyền `ST_EDIT_POSTED` |
| Phiếu, màn phê duyệt trên giao diện | Các phiếu kho, mua hàng, bán hàng đã chạy thật dùng API duyệt; phiếu giao hàng, thu, chi còn là dữ liệu mẫu |
| Chính sách mật khẩu (độ phức tạp, hết hạn), khóa tài khoản sau N lần sai theo tài khoản, tự đăng xuất khi không dùng, lịch sử đăng nhập | Chưa có |
| Quyền chức năng (7 hành động) khác nhau theo đơn vị cơ sở | Chưa có; chỉ quyền theo trạng thái là theo đơn vị |
| Phạm vi dữ liệu chi tiết hơn "của mình / tất cả" (theo kho, theo phòng ban) | Chưa có |
| Nhiều vai trò cho một người | Bảng dữ liệu cho phép, màn hình và API hiện chỉ gán một vai trò |
| Danh sách đầy đủ của các danh mục hệ thống cần quyền Xem | Đã làm; ô chọn ở màn khác đọc qua tra cứu, **tra cứu cũng được phân quyền theo danh mục** (mục C10). Còn **tỷ giá** (`GET /api/settings/exchange-rates`) đang mở cho mọi người đăng nhập vì phiếu cần tỷ giá của ngày chứng từ |

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
| `sys_voucher_status` | Tên trạng thái và việc bật / tắt "Chờ duyệt" của từng đơn vị (chỉ có dòng cho cái đã đổi) | (`unit_code`, `voucher_type`, `status_code`) |
| `sys_grid_layout` | Bố cục cột của từng người ở các lưới (không phải quyền; quản trị đặt mặc định cho công ty) | (người, chức năng, lưới) |

SQL: `sql/postgresql/01-users.sql`, `02-company-units.sql`, `05-approvals.sql`, `10-permission-exceptions.sql`, `12-audit-log.sql`, `43-voucher-status.sql` (quyền trạng thái theo đơn vị; đổi các quyền cũ POST / UNPOST / CANCEL / EDIT_* sang `ST_*`). Không có khóa ngoại; service kiểm tra liên kết.

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
| Trạng thái của từng chứng từ, có ghi sổ hay không | `Core.Application/Common/Documents/VoucherStatusCatalog.cs` | `services/voucherStatusService.ts` |
| Quyền theo đơn vị (`PerUnit`), danh mục có `VIEW_PRICE` / `VIEW_COST`, danh mục được đổi mã | `SpecialRightCatalog.cs` (`UnitKey`, `SplitUnit`, `PricedCatalogsAndReports`, `CodeChangeCatalogs`) | `hasStatusRight`, `reachesStatus` ở `utils/permissions.ts` |
| Quyền của 7 API chuẩn của danh mục | `Core/Common/Authorization/CatalogPermissions.cs`, `Core/Common/Controllers/CatalogControllerBase.cs` | `CatalogScreen` |
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

**Danh mục (khung `CatalogControllerBase`).** Controller chỉ khai `[CatalogFunction("mã")]`; mỗi API chuẩn mang `[CatalogRight(hành động)]` và `CatalogPermissionFilter` kiểm tra: danh sách = Xem; `/export` = Xem + Xuất; `POST` và `/import` = Thêm (nhập chế độ upsert kiểm thêm Sửa trong code); `PUT` = Sửa; `/delete-many` = Xóa; `code-change`, `rename`, `merge` = Sửa + quyền đặc biệt `CHANGE_CODE` (`EnsureChangeCodeRightAsync`). Tra cứu `/api/lookups/{tên}` mở cho người đã đăng nhập; tra cứu cần quyền riêng khai `AuthorizeAsync` và `CacheScopeAsync` trong `LookupProvider`.

**Báo cáo.** `GET` = `RequirePermission(mã báo cáo, View)`; `/export` = View và Export; tiền chỉ trả khi `HasRightAsync(user, mã báo cáo, VIEW_COST)`, nếu không để null. Mã báo cáo có tiền phải nằm trong `PricedCatalogsAndReports`.

**Phiếu: chặn dò id.** `ChangeStatusAsync` và `RejectAsync` của các service phiếu bắt đầu bằng `PermissionGate.EnsureTouchAsync` (403 trước khi tra phiếu); màn duyệt chỉ đọc phiếu trong đơn vị của phiên (`DocumentApprovalService.GetAsync`). Quyền trạng thái được lọc theo đơn vị của phiếu (`DocumentActor.For(..., unitCode)`).

**Menu.** `GET /api/menu` chỉ trả các chức năng người dùng có Xem (`MenuFilter`, cây lưu cache rồi cắt theo từng người). Sửa cấu trúc menu chỉ tài khoản siêu quản trị (`Security:SuperAdmin`, mặc định `admin`, policy `SuperAdmin`): xem `quan-ly-menu.md`.

**Quy ước theo phương thức HTTP:**

| HTTP | Quyền |
| --- | --- |
| `GET` danh sách / chi tiết của chức năng | Xem |
| `POST` tạo, sao chép, `.../import` | Thêm (`import` chế độ upsert cần thêm Sửa) |
| `PUT`, lưu cài đặt | Sửa |
| `DELETE`, `.../delete-many` | Xóa |
| Gửi duyệt | Thêm **hoặc** Sửa |
| Xuất file ở server | Xuất |

**Quy tắc đọc dữ liệu.** Danh sách đầy đủ của một chức năng cần quyền Xem. Màn khác chọn mã qua **tra cứu** `GET /api/lookups/{tên}`: chỉ trả mã, tên và vài cột, có phân trang, và **chỉ trả lời người có quyền** (quản trị viên; người có Xem danh mục đó; người có Xem một chức năng dùng nó; riêng ngoại tệ, phòng ban, đơn vị cơ sở là dữ liệu nền nên mở cho người đã đăng nhập). `LookupService.CheckAccessAsync` kiểm theo bảng quy tắc `LookupAccessCatalog` (`Core.Application/Common/Lookups/LookupAccess.cs`): mỗi tra cứu có `Owner` (chức năng của danh mục), `Consumers` (các chức năng được chọn từ nó), `SensitiveExtras` + `SensitiveFor` (cột như mã số thuế, điện thoại chỉ điền cho chủ danh mục và các chứng từ cần in), `UnitScoped` (đơn vị cơ sở chỉ trả đơn vị người đó được vào, trừ người có Xem danh mục đơn vị). Không đủ quyền: 403 `permission.denied`; tra cứu không có quy tắc: chỉ quản trị viên dùng được.

**Test tự kiểm tra:**

| Test | Báo đỏ khi |
| --- | --- |
| `ReadAccessContractTests` | `GET` của controller có `const string Function` mà thiếu `RequirePermission` (ngoại lệ ghi lý do trong danh sách `Exempt`) |
| `CatalogPermissionFilterTests`, `CatalogFrameworkTests` | API chuẩn của danh mục sai quyền |
| `MenuFilterTests`, `MenuSeedFileTests` | Menu trả chức năng không được Xem; file menu lệch `FunctionCatalog` |
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
| `GET /api/menu` | Đã đăng nhập; chỉ trả chức năng được Xem |
| `GET /api/voucher-statuses/current` | Đã đăng nhập (màn phiếu đọc tên trạng thái của đơn vị) |
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
- Hồ sơ quyền chỉ được nạp **lúc đăng nhập hoặc mở lại trang** (`authService.getMe`), nên đổi quyền cho người đang đăng nhập thì nút trên màn của họ đổi sau khi nạp lại; máy chủ kiểm tra theo quyền mới ngay.
- Quyền trạng thái theo đơn vị: `hasStatusRight` / `reachesStatus` đọc `user.ma_dvcs` (đơn vị đang làm việc); `documentPolicy.ts` là bản sao của `DocumentStatusPolicy`.

## B10. Thêm mới

**Một chức năng mới.** Khai báo mã ở `FunctionCatalog.cs` và `functions.ts`. Mã tự có trong ma trận với 7 hành động; chỉ cần gắn `RequirePermission` cho từng API (danh mục: theo skill `/them-danh-muc`, [them-danh-muc.md](../phat-trien/them-danh-muc.md)).

**Một chứng từ mới.** Thêm vào `VoucherCatalog.All`. Tự có: dãy số phiếu, đủ bộ quyền đặc biệt của chứng từ, chỗ trong quy tắc duyệt. Có màn phê duyệt riêng thì thêm vào `ApprovalScreens` (và `APPROVAL_SCREENS` ở frontend).

**Một quyền đặc biệt mới.** Thêm vào `SpecialRightCatalog.Build()` và khóa `right.<textKey>.name` / `.description` ở `Messages.vi.json` + `Messages.en.json`. Màn phân quyền tự hiện. Dùng ở API bằng `[RequireRight(fn, code)]` hoặc `HasRightAsync`, ở frontend bằng `hasRight`.

**Đổi quy tắc trạng thái phiếu.** Sửa cùng lúc `DocumentStatusPolicy.cs`, `documentPolicy.ts`, `DocumentPolicyCases.json`, rồi chạy `dotnet test` và `npm run check-policy`.


---

# Phần C. Các luồng làm từng bước

Phần này dành cho quản trị hệ thống và người phụ trách nghiệp vụ: **làm gì trước, bấm ở đâu, kiểm tra thế nào**. Mọi bước ở màn **Cài đặt › Người dùng & phân quyền** (chức năng `sys_users`); người làm cần có quyền Xem / Thêm / Sửa của chức năng này.

## C1. Đọc nhanh: quyền hoạt động thế nào

Ba câu cần nhớ:

1. **Vai trò cho quyền nền, người dùng chỉ có ngoại lệ.** Mỗi người giữ một vai trò; chỗ nào cần khác thì chỉnh riêng cho người đó (ô được tô màu).
2. **Có quyền Xem thì mới thấy chức năng.** Mọi quyền khác (Thêm, Sửa, quyền đặc biệt...) chỉ có tác dụng khi chức năng đó đã được Xem.
3. **Máy chủ kiểm tra thật, màn hình chỉ ẩn nút.** Ẩn nút không phải bảo mật; gọi thẳng API không đủ quyền vẫn bị từ chối (403).

Một thao tác trên phiếu phải qua lần lượt: đăng nhập → đơn vị cơ sở → quyền chức năng (7 hành động) → quyền đặc biệt → trạng thái phiếu → người duyệt (xem A1).

**Quyền nào ở đâu** (tóm tắt, chi tiết ở A3, A5, C9, C10):

| Việc muốn cho phép | Quyền cần cấp |
| --- | --- |
| Thấy một mục trên menu, mở màn | **Xem** của chức năng |
| Thêm / sao chép / nhập Excel danh mục hoặc phiếu | **Thêm** (nhập Excel "thêm mới và cập nhật" cần thêm **Sửa**) |
| Sửa bản ghi đã lưu | **Sửa** |
| Xóa, xóa nhiều | **Xóa** |
| Duyệt / từ chối phiếu | **Duyệt** (trên phiếu hoặc trên màn Phê duyệt của nó) + là người duyệt của cấp hiện tại |
| Nút In, in báo cáo | **In** |
| Xuất Excel, kể cả báo cáo | **Xuất** (và phải có Xem) |
| Thấy đơn giá, thành tiền, giá vốn | Quyền đặc biệt **Xem giá** (`VIEW_PRICE`), **Xem giá vốn** (`VIEW_COST`) của chức năng |
| Thấy phiếu của người khác | Quyền đặc biệt **Xem tất cả** (`VIEW_ALL`) |
| Gửi duyệt, ghi sổ, bỏ ghi sổ, hủy, sửa phiếu đã duyệt / đã ghi sổ | Quyền đặc biệt **theo trạng thái** (`ST_*`), **cấp riêng từng đơn vị cơ sở** |
| Đổi mã / gộp mã danh mục | Quyền đặc biệt **Đổi mã / gộp mã** (`CHANGE_CODE`) |

## C2. Luồng 1: đưa một nhân viên mới vào hệ thống

Dùng khi có người mới cần làm việc (ví dụ thủ kho kho Hà Nội).

1. **Chọn hoặc tạo vai trò** phù hợp (luồng C3). Nếu đã có vai trò "Thủ kho" thì bỏ qua.
2. Vào **Cài đặt › Người dùng & phân quyền**, tab **Người dùng**, bấm **Thêm người dùng**.
3. Điền **Tài khoản đăng nhập**: tên đăng nhập (chữ thường không dấu, số, `.` `_` `-`, 3–50 ký tự, ví dụ `hung.pham`); mật khẩu ban đầu từ 8 ký tự (nút **Tạo mật khẩu** sinh ngẫu nhiên, bấm biểu tượng con mắt để xem và gửi cho nhân viên).
4. Điền **Thông tin nhân viên**: họ tên (bắt buộc), mã nhân viên, email, số điện thoại, phòng ban. Phòng ban cũng dùng cho quy tắc duyệt theo phòng ban (C6).
5. Mục **Phân quyền & đơn vị làm việc**: chọn **Vai trò**; chọn **Đơn vị làm việc mặc định** (được chọn sẵn khi đăng nhập) và tick các đơn vị **Được phép đăng nhập vào**. Không tick thêm thì chỉ vào được đơn vị mặc định.
6. Bấm **Tạo người dùng**. Tài khoản đã dùng được ngay.
7. Cần khác vai trò ở vài chức năng thì chọn người đó ở danh sách và làm tiếp luồng C4 (ngoại lệ) và C5 (quyền trạng thái theo đơn vị).
8. **Kiểm tra:** đăng nhập thử bằng tài khoản mới (hoặc nhờ nhân viên đăng nhập), xem menu có đúng các chức năng, và thử một thao tác không được phép (phải bị từ chối).

Lưu ý:
- Tài khoản chưa có vai trò thì **không có quyền nào** (chỉ vào được Bàn tổng quan).
- Người đang làm không cấp được quyền hoặc đơn vị mà chính mình không có (xem A9).
- Nhân viên quên mật khẩu: mở người dùng, **Sửa tài khoản**, mục **Đặt lại mật khẩu**; mọi phiên đang đăng nhập của họ bị đăng xuất.

## C3. Luồng 2: tạo một vai trò mới

1. Tab **Vai trò**, bấm **Thêm vai trò**.
2. Nhập **Mã vai trò** (ví dụ `KT_KHO`), **Tên vai trò**, mô tả nhiệm vụ. Chọn **Sao chép quyền từ vai trò** nếu có vai trò gần giống (rồi chỉnh lại), hoặc để trống để bắt đầu không có quyền nào.
3. Bấm **Tạo vai trò**, vai trò hiện ở danh sách.
4. Ở bảng **ma trận quyền** (chia theo phân hệ Kho Hàng, Mua Hàng, Bán Hàng, Tài Chính, Nhân Sự, Hệ Thống; mỗi dòng chức năng có nhãn nhỏ cho biết là Danh mục, Chứng từ, Báo cáo hay Hệ thống):
   - Tick các ô Xem / Thêm / Sửa / Xóa / Phê duyệt / In / Xuất file cho từng chức năng. Cột **Đặc biệt** mở danh sách quyền đặc biệt của chức năng đó.
   - Dùng **Thiết lập nhanh** (Toàn quyền, Chỉ xem, Bỏ hết) cho cả nhóm, hoặc nút "Tất cả" trên đầu cột để chọn một hành động cho mọi chức năng đang hiển thị. Ô tìm kiếm lọc chức năng hoặc quyền; **Chỉ hiện chức năng đã cấp quyền** giúp rà soát.
   - Nhớ tick **Xem** cho mọi chức năng đã cấp hành động khác.
5. Bấm **Lưu vai trò**. Những người đang giữ vai trò nhận quyền mới ngay, **trừ** các ô đã chỉnh riêng cho từng người.
6. Muốn mọi người giữ vai trò về đúng quyền vai trò: bấm **Đưa N người về đúng vai trò** (xóa hết ngoại lệ). Hệ thống hỏi xác nhận vì có thể trả lại quyền đã cố ý bỏ.

Không xóa được vai trò còn người giữ: chuyển họ sang vai trò khác trước. Vai trò `ADMIN` có toàn quyền và không chỉnh được.

**Gợi ý bộ quyền theo vai trò điển hình** (chỉ để tham khảo, tùy tổ chức):

| Vai trò | Nên cấp |
| --- | --- |
| Thủ kho | Xem + Thêm + In phiếu nhập, phiếu xuất, yêu cầu xuất; Xem danh mục kho; Xem báo cáo tồn kho; `ST_PENDING` (gửi duyệt) cho đơn vị của mình. Không cấp xem giá vốn |
| Kế toán kho | Như thủ kho, thêm Xem giá (`VIEW_PRICE`) và Xem giá vốn (`VIEW_COST`) ở phiếu và báo cáo; Xuất file báo cáo; `ST_POSTED` để ghi sổ |
| Trưởng kho | Duyệt trên màn Phê duyệt nhập / xuất / điều chuyển; `VIEW_ALL` để thấy phiếu của cả kho; `ST_APPROVED` |
| Giám đốc | Duyệt ở màn Phê duyệt (không cần vào màn phiếu); xem các báo cáo; được chọn làm người duyệt cấp 2 trong quy tắc duyệt |
| Nhân viên mua hàng | Xem + Thêm + Sửa yêu cầu mua, đơn mua; Xem danh mục nhà cung cấp, dự án; `ST_PENDING` |
| Nhân viên bán hàng | Xem + Thêm + Sửa đơn bán hàng; Xem danh mục khách hàng, bảng giá; Xem giá |

## C4. Luồng 3: cấp quyền riêng cho một người (ngoại lệ)

Dùng khi một người cần nhiều hơn hoặc ít hơn vai trò ở vài chỗ.

1. Tab **Người dùng**, chọn người trong danh sách (tìm theo tên, tài khoản, email, mã NV; lọc theo vai trò, trạng thái).
2. Bảng quyền hiện **quyền thực tế** của người đó. Bật / tắt ô cần đổi: ô khác vai trò được **tô màu** và ghi "Khác <vai trò>" (đó là ngoại lệ).
3. Bấm **Lưu phân quyền**. Hệ thống chỉ lưu những ô khác vai trò.
4. Muốn bỏ ngoại lệ: bấm **Đưa về đúng quyền vai trò**, rồi **Lưu phân quyền**.

Quy tắc đáng nhớ:
- Đổi một ô của chức năng nào thì **cả dòng chức năng đó** của người này tách khỏi vai trò (sau này sửa vai trò, chức năng đó không đổi theo cho người này).
- Quản trị viên không bị giới hạn. Người khác **không cấp quá quyền mình có**, và **không sửa quyền của chính mình** (màn báo "Bạn không thể tự thay đổi quyền của chính mình").
- Người khác sửa quyền cùng người này trong lúc bạn mở màn thì lúc lưu sẽ báo xung đột (409) và tự tải lại; mở lại và làm lại.
- Đổi quyền có hiệu lực từ thao tác kế tiếp của người kia. Nếu nút trên màn hình họ chưa đổi, nhờ họ nạp lại trang hoặc đăng nhập lại; máy chủ vẫn kiểm tra theo quyền mới ngay.

## C5. Luồng 4: cấp quyền theo trạng thái cho từng đơn vị

Quyền trạng thái (`ST_PENDING`, `ST_APPROVED`, `ST_POSTED`, `ST_UNPOST`, `ST_CANCELLED`, `ST_EDIT_POSTED`) **cấp riêng từng đơn vị cơ sở**: người ghi sổ được ở Hà Nội chưa chắc ghi sổ được ở Hồ Chí Minh.

1. Mở vai trò (hoặc người dùng) cần cấp.
2. Ở đầu bảng quyền, ô **Đơn vị cho quyền trạng thái** chọn đơn vị (ví dụ DVCS01).
3. Mở cột **Đặc biệt** của chứng từ (ví dụ Phiếu nhập kho) và tick quyền trạng thái cần cấp cho **đơn vị đã chọn**.
4. Muốn cấp cho đơn vị khác: đổi ô đơn vị, tick lại. Màn báo "Đã có ở N đơn vị khác" để biết quyền đã cấp ở nơi khác.
5. **Lưu**.

Ý nghĩa nhanh:

| Quyền | Làm được |
| --- | --- |
| `ST_PENDING` | Gửi duyệt; lưu phiếu ở Chờ duyệt; sửa phiếu đang chờ duyệt |
| `ST_APPROVED` | Lưu thẳng ở Đã duyệt; sửa phiếu đã duyệt |
| `ST_POSTED` | Ghi sổ phiếu đã duyệt; lưu thẳng ở Đã ghi sổ |
| `ST_UNPOST` | Bỏ ghi sổ |
| `ST_CANCELLED` | Hủy phiếu (người lập hủy nháp của mình chỉ cần quyền Xóa); **khôi phục** phiếu đã hủy về Lập |
| `ST_EDIT_POSTED` | Sửa hoặc xóa phiếu **đã ghi sổ** (phiếu nhập / xuất, xuất / nhập điều chuyển) |

Quyền cho trạng thái sau **bao gồm** các bước trước (có `ST_POSTED` thì cũng gửi duyệt và lưu ở Đã duyệt được). Chi tiết và cách đổi tên / tắt bước Chờ duyệt: [trang-thai-chung-tu.md](trang-thai-chung-tu.md).

## C6. Luồng 5: thiết lập quy tắc duyệt

Mục đích: quyết định phiếu nào cần ai duyệt, mấy cấp.

1. Vào tab **Quy trình phê duyệt**.
2. Chọn **loại chứng từ** ở cột trái (kèm số quy tắc đã có). Chưa có quy tắc thì phiếu loại đó do **bất kỳ ai có quyền Duyệt** trong cùng đơn vị duyệt, một cấp (trừ người lập).
3. Bấm **Thêm quy tắc**. Điền:
   - **Cấp duyệt** (1 duyệt trước, rồi 2, 3...);
   - **Giá trị phiếu từ** (để trống = mọi giá trị);
   - **Đơn vị** (hoặc tất cả đơn vị);
   - **Áp dụng cho phiếu do**: mọi người / một người / người thuộc một vai trò / người thuộc một phòng ban;
   - **Người duyệt là**: mọi người thuộc một vai trò, hoặc một người cụ thể;
   - Ghi chú, **Đang sử dụng**.
4. Bấm **Lưu quy tắc**.
5. **Thử trước khi dùng:** bấm **Thử quy trình**, chọn người lập, nhập tổng giá trị, bấm **Xem ai duyệt**. Màn báo từng cấp và người duyệt; nếu "Không có người duyệt hợp lệ" thì phiếu sẽ không gửi duyệt được: sửa quy tắc hoặc cấp quyền Duyệt cho người duyệt.
6. Bảo đảm **người duyệt có quyền Duyệt** của chức năng (hoặc của màn Phê duyệt tương ứng) và **được làm việc ở đơn vị của phiếu**; nếu không họ bị loại khỏi danh sách.

Ví dụ: phiếu xuất kho dưới 100 triệu chỉ Trưởng kho duyệt (cấp 1); từ 100 triệu thêm Giám đốc duyệt (cấp 2) → tạo hai quy tắc: cấp 1 vai trò Trưởng kho (mọi giá trị), cấp 2 vai trò Giám đốc (giá trị từ 100.000.000).

## C7. Luồng 6: đường đi của một phiếu và ai cần quyền gì

Ví dụ phiếu xuất kho. Mỗi dòng là một bước; cột phải là thứ người làm bước đó cần.

| Bước | Ai làm | Cần |
| --- | --- | --- |
| 1. Lập phiếu (lưu nháp) | Nhân viên kho | Xem + Thêm của `inv_issue` |
| 2. Gửi duyệt | Người lập | Thêm hoặc Sửa, và `ST_PENDING` ở đơn vị của phiếu; đơn vị không tắt bước Chờ duyệt |
| 3. Duyệt cấp 1, cấp 2... | Người duyệt theo quy tắc (C6), **không phải người lập** | Quyền Duyệt (trên phiếu hoặc màn Phê duyệt); không cần Xem chức năng hay `VIEW_ALL` |
| 3'. Từ chối | Người duyệt cấp hiện tại | Như trên; phiếu về Lập kèm lý do, người lập sửa rồi gửi lại |
| 3''. Rút lại | Người lập (hoặc quản trị viên) | Phiếu đang chờ duyệt |
| 4. Ghi sổ | Thủ kho / kế toán kho | `ST_POSTED` ở đơn vị của phiếu; sổ kho kiểm tra đủ tồn |
| 5. Bỏ ghi sổ (khi cần) | Người có quyền | `ST_UNPOST`; không bỏ được nếu việc đó làm âm kho |

**Lưu thẳng đến một trạng thái.** Ô "Trạng thái" trên phiếu cho chọn Lập, Chờ duyệt, Đã duyệt, Đã ghi sổ tùy quyền của người lập. Phiếu được lưu rồi chạy các bước trong **một giao dịch**; thiếu quyền ở bước nào thì cả lần lưu bị hoàn tác:
- đến **Đã duyệt**: cần `ST_APPROVED`, quyền Duyệt và là người duyệt của mọi cấp (không cần người duyệt nếu đơn vị tắt "Chờ duyệt");
- đến **Đã ghi sổ**: cần thêm `ST_POSTED`.

**Luôn đúng:** không ai tự duyệt phiếu mình lập (kể cả quản trị viên); phiếu của người khác chỉ thấy khi có `VIEW_ALL`.

## C8. Luồng 7: sửa, xóa, hủy và khôi phục phiếu

| Tình huống | Làm thế nào | Quyền |
| --- | --- | --- |
| Sửa phiếu nháp | Mở phiếu, sửa, lưu | Sửa (người lập) |
| Sửa phiếu đang chờ duyệt / đã duyệt | Mở, sửa, lưu | Sửa + `ST_PENDING` / `ST_APPROVED` |
| Sửa hoặc xóa phiếu **đã ghi sổ** | Mở phiếu, sửa, lưu. Hệ thống đảo ghi sổ cũ, ghi sổ lại bản mới trong một giao dịch; xóa thì bỏ ghi sổ trước. Bị từ chối nếu làm âm kho | `ST_EDIT_POSTED` (chỉ phiếu nhập, xuất, xuất / nhập điều chuyển). Phiếu kiểm kê: bỏ ghi sổ rồi sửa |
| Hủy phiếu | Nút **Hủy** (có hỏi xác nhận) | Người lập hủy nháp: Xóa. Còn lại `ST_CANCELLED`. Phiếu đã ghi sổ phải bỏ ghi sổ trước |
| Khôi phục phiếu đã hủy | Nút **Khôi phục**: phiếu về Lập (tháng phải còn mở, các dòng nối phiếu khác phải còn khớp) | `ST_CANCELLED` |
| Bỏ ghi sổ | Nút **Bỏ ghi sổ** (có hỏi xác nhận): phiếu về Đã duyệt | `ST_UNPOST` |

Phiếu thuộc tháng đã khóa sổ không sửa, hủy hay ghi sổ được dù đủ quyền (khóa sổ ở Cài đặt, theo đơn vị).

## C9. Luồng 8: cho một người xem báo cáo

1. Cấp **Xem** của báo cáo (ví dụ Báo cáo tồn kho, Báo cáo nhập xuất tồn, Tính tồn kho tức thời, Tính giá trung bình tháng).
2. Cần **xuất Excel**: cấp thêm **Xuất file**. Cần **in**: cấp **In**.
3. Cần thấy **tiền** (giá trị, giá vốn): mở cột **Đặc biệt** của báo cáo và tick **Xem giá vốn** (`VIEW_COST`). Không có thì số lượng vẫn xem được, các cột tiền để trống và màn có dòng giải thích.
4. Tồn tức thời: nút **Kiểm tra sổ kho** chỉ cần Xem; nút **Dựng lại số dư** cần **Sửa**.
5. Báo cáo chỉ trả dữ liệu của **đơn vị đang làm việc** của người đó.

Bảng quyền các báo cáo kho:

| Báo cáo | Xem | Xuất Excel | Dựng lại số dư | Thấy tiền |
| --- | --- | --- | --- | --- |
| Tồn kho, nhập xuất tồn, hàng nhập, hàng xuất, tuổi hàng tồn | Xem | Xem + Xuất | — | `VIEW_COST` của chính báo cáo đó |
| Tính tồn kho tức thời | Xem | Xem + Xuất | Sửa | Không có tiền |
| Tính giá trung bình tháng | Xem | Xem + Xuất | — | `VIEW_COST` của `inv_calc_monthly_cost` |

Quyền Xem giá vốn của một báo cáo **không** mở giá vốn của báo cáo khác: cấp riêng cho từng báo cáo. Mỗi lần xuất Excel được ghi nhật ký.

## C10. Luồng 9: quyền làm việc với danh mục

| Thao tác trên danh mục | Quyền |
| --- | --- |
| Mở danh sách, tìm, lọc, chọn cột hiển thị | Xem |
| Thêm mới, **sao chép**, **nhập Excel** chế độ chỉ thêm | Thêm |
| Sửa; nhập Excel chế độ "thêm mới và cập nhật" | Sửa (và Thêm cho nhập Excel) |
| Xóa một hoặc nhiều dòng | Xóa |
| Xuất Excel | Xem + Xuất |
| Đổi mã, gộp mã (nhà cung cấp, nhóm nhà cung cấp, dự án, điều khoản thanh toán, loại kho, nhóm / loại vật tư, khách hàng, nhóm khách hàng) | **Sửa** + quyền đặc biệt **Đổi mã / gộp mã** (`CHANGE_CODE`) |
| Thấy giá, giá vốn của vật tư | `VIEW_PRICE`, `VIEW_COST` của danh mục vật tư |

Ô chọn mã ở các màn khác (chọn vật tư, kho, nhà cung cấp trên phiếu) đọc qua **tra cứu**: chỉ trả mã, tên và vài cột. **Tra cứu được phân quyền theo danh mục tương ứng**, nên nhân viên lập phiếu **không cần** quyền Xem danh mục vật tư để chọn vật tư trên phiếu (có quyền Xem phiếu là đủ), nhưng người không liên quan (ví dụ nhân sự) không đọc được danh sách vật tư, nhà cung cấp, khách hàng qua tra cứu.

**Ai dùng được tra cứu nào.** Một tra cứu trả lời khi người dùng có quyền **Xem** của một trong: chức năng danh mục của nó (cột "Chủ"), hoặc một chức năng được chọn từ nó (cột "Cũng dùng được bởi"). Quản trị viên luôn dùng được.

| Tra cứu | Chủ (danh mục) | Cũng dùng được bởi |
| --- | --- | --- |
| `uoms`, `materialUoms` | Đơn vị tính | Vật tư, quy đổi, bảng giá bán, mọi phiếu kho / mua / bán |
| `uomsFull` | Đơn vị tính | Vật tư (các cột ghi chú, thứ tự, thời gian tạo / sửa chỉ chủ danh mục thấy) |
| `uomConversions` | Quy đổi đơn vị tính | (chỉ chủ) |
| `materials` | Vật tư | Lô, định mức tồn kho, quy đổi, bảng giá bán, mọi phiếu kho / mua / bán |
| `materialGroups` | Nhóm vật tư | Vật tư, các báo cáo và màn tính toán Kho |
| `materialTypes` | Loại vật tư | Vật tư |
| `warehouses` | Danh mục kho | Vị trí, lô, định mức tồn kho, mọi phiếu, các báo cáo và màn tính toán Kho |
| `warehouseTypes` | Loại kho | Danh mục kho |
| `locations`, `lots` | Vị trí lưu kho, Lô | Các phiếu kho |
| `suppliers` | Nhà cung cấp | Lô, báo cáo công nợ phải trả, phiếu nhập kho, yêu cầu mua, đơn mua, hóa đơn mua. **Mã số thuế và điện thoại** chỉ điền cho chủ danh mục, phiếu nhập kho và ba phiếu mua hàng |
| `supplierGroups` | Nhóm nhà cung cấp | Nhà cung cấp |
| `customers` | Khách hàng | Phiếu xuất kho, đơn bán, phiếu giao hàng, báo cáo doanh số. **Mã số thuế** chỉ điền cho chủ danh mục, phiếu xuất kho, đơn bán, giao hàng |
| `customerGroups` | Nhóm khách hàng | Khách hàng, bảng giá bán |
| `priceLists` | Bảng giá bán | Đơn bán hàng |
| `projects` | Dự án | Các phiếu kho, mua hàng, đơn bán, báo cáo chi phí dự án |
| `paymentTerms` | Điều khoản thanh toán | Khách hàng, đơn bán, đơn mua, hóa đơn mua |
| `accounts` | Hệ thống tài khoản | Mã thuế, phiếu thu, phiếu chi |
| `taxRates` | Mã thuế | Vật tư, các phiếu mua hàng và bán hàng |
| `currencies`, `departments` | (dữ liệu nền) | **Mở cho mọi người đã đăng nhập** |
| `companyUnits` | Đơn vị cơ sở | **Mở**, nhưng chỉ trả các đơn vị người đó được làm việc (người có Xem danh mục đơn vị thấy tất cả) |

Làm thế nào khi thêm hoặc đổi: sửa bảng `LookupAccessCatalog` (một dòng cho mỗi tra cứu). `LookupAccessTests` báo đỏ nếu có tra cứu thiếu quy tắc, quy tắc trỏ tới chức năng không tồn tại, hoặc cột nhạy cảm không có chủ.

## C11. Luồng 10: thu hồi quyền, khóa nhân viên nghỉ việc

| Việc | Cách làm | Hiệu lực |
| --- | --- | --- |
| Rút một quyền | Sửa vai trò hoặc người dùng, bỏ tick, lưu | Từ thao tác kế tiếp của người đó |
| Chuyển người sang vai trò khác | Mở người dùng, **Sửa tài khoản**, đổi vai trò (ngoại lệ cũ vẫn còn: cân nhắc **Đưa về đúng quyền vai trò**) | Từ thao tác kế tiếp |
| Bỏ quyền vào một đơn vị | **Sửa tài khoản**, bỏ tick đơn vị ở "Được phép đăng nhập vào" | Từ thao tác kế tiếp |
| **Khóa** nhân viên nghỉ việc | **Sửa tài khoản**, bỏ tick **Tài khoản đang hoạt động**, lưu | **Ngay lập tức:** mọi phiên bị đăng xuất, không đăng nhập lại được |
| Xóa tài khoản | Nút **Xóa** ở người dùng; lịch sử phiếu của họ vẫn giữ | Ngay lập tức như khóa |
| Nghi lộ mật khẩu | **Đặt lại mật khẩu** | Mọi phiên cũ bị đăng xuất |

Không khóa hoặc xóa được tài khoản của chính mình hoặc quản trị viên cuối cùng. Mọi thay đổi này ghi ở **Cài đặt › Nhật ký thay đổi** (ghi theo quyền thực tế được thêm hoặc mất, ví dụ "Phiếu xuất kho: + Xóa").

## C12. Gỡ rối: "tôi không thấy / không bấm được..."

| Người dùng báo | Nguyên nhân thường gặp | Cách kiểm tra / sửa |
| --- | --- | --- |
| Ô chọn mã (vật tư, nhà cung cấp, kho...) trống hoặc báo 403 | Người dùng chưa có quyền Xem danh mục đó **và** chưa có quyền Xem màn nào dùng danh mục đó | Cấp quyền Xem màn dùng nó (ví dụ phiếu), hoặc thêm chức năng vào `Consumers` của tra cứu ở `LookupAccessCatalog` |
| Không thấy chức năng trên menu | Thiếu **Xem**; hoặc đang ở đơn vị không được vào | Mở người dùng, xem ô Xem của chức năng; xem "Được vào" các đơn vị |
| Thấy màn nhưng không có nút Thêm / Sửa / Xóa / Xuất / In | Thiếu hành động tương ứng | Bật ô đó trong ma trận |
| Bấm được nhưng báo 403 / "không có quyền" | Thiếu hành động hoặc quyền đặc biệt (màn có thể chưa ẩn nút) | Xem thông báo; bật quyền cần |
| Thấy phiếu nhưng cột đơn giá / thành tiền trống | Thiếu **Xem giá** (`VIEW_PRICE`) | Tick quyền đặc biệt của chứng từ |
| Cột giá vốn / giá trị ở báo cáo trống | Thiếu **Xem giá vốn** (`VIEW_COST`) của đúng báo cáo | Tick ở báo cáo đó |
| Chỉ thấy phiếu của mình | Thiếu **Xem tất cả** (`VIEW_ALL`) | Tick quyền đặc biệt |
| Không có nút Gửi duyệt | Thiếu `ST_PENDING` ở **đơn vị đang làm việc**; hoặc đơn vị đã tắt Chờ duyệt | Xem ô "Đơn vị cho quyền trạng thái"; xem Cài đặt › Trạng thái chứng từ |
| Gửi duyệt báo lỗi không có người duyệt | Quy tắc trỏ vai trò không còn người / người duyệt bị khóa / không có quyền Duyệt hoặc không vào đơn vị của phiếu | Dùng **Thử quy trình** (C6) |
| Không duyệt được phiếu | Không phải người duyệt của cấp hiện tại; là người lập; thiếu quyền Duyệt; không làm việc ở đơn vị của phiếu | Thử quy trình; kiểm tra quyền Duyệt (kể cả ở màn Phê duyệt) |
| Duyệt rồi nhưng không ghi sổ được | Thiếu `ST_POSTED` ở đơn vị; tồn kho không đủ; tháng đã khóa sổ | Đọc thông báo lỗi của phiếu |
| Không sửa được phiếu đã ghi sổ | Thiếu `ST_EDIT_POSTED`, hoặc làm âm kho, hoặc phiếu kiểm kê (phải bỏ ghi sổ trước) | Cấp quyền hoặc bỏ ghi sổ |
| Bật quyền đặc biệt mà không tác dụng | Chức năng đó chưa có **Xem** | Bật Xem |
| Sửa quyền xong nút chưa đổi | Màn hình giữ quyền từ lúc đăng nhập | Nạp lại trang hoặc đăng nhập lại |
| Cấp quyền bằng câu lệnh SQL nhưng không có hiệu lực | Quyền được giữ trong bộ nhớ của máy chủ | Cấp quyền bằng màn hình; hoặc khởi động lại backend |
| Lưu quyền báo xung đột (409) | Người khác vừa sửa cùng bản ghi | Màn tải lại, làm lại |
| Không đăng nhập được, báo thử quá nhiều | Giới hạn 10 lần mỗi phút mỗi địa chỉ IP | Chờ một phút |
| Không đăng nhập được | Tài khoản bị khóa; sai mật khẩu; đơn vị chọn không được vào | Xem trạng thái tài khoản, đặt lại mật khẩu |

## C13. Danh sách kiểm tra sau khi cấp quyền

Nên làm với mỗi vai trò mới hoặc thay đổi lớn, bằng một tài khoản thử có đúng vai trò đó:

- [ ] Menu chỉ hiện các chức năng được Xem (không dư, không thiếu).
- [ ] Mỗi chức năng: nút Thêm / Sửa / Xóa / Xuất / In xuất hiện đúng theo quyền.
- [ ] Thử một thao tác **không** được phép: màn mờ nút, và gọi thẳng API (Swagger) trả 403.
- [ ] Phiếu: cột giá, giá vốn hiện hoặc ẩn đúng; chỉ thấy phiếu của mình khi không có `VIEW_ALL`.
- [ ] Vòng đời phiếu: gửi duyệt, duyệt (bằng người khác), ghi sổ đúng người, đúng đơn vị; thử ghi sổ ở đơn vị chưa được cấp (phải bị từ chối).
- [ ] Quy tắc duyệt: dùng **Thử quy trình** với phiếu nhỏ và phiếu lớn.
- [ ] Báo cáo: xem, xuất Excel, và việc thấy tiền đúng với quyền.
- [ ] Nhật ký thay đổi ghi lại các lần cấp quyền.

**Đã kiểm chứng trên hệ thống thật** (tài khoản thủ kho, ba màn Kho: định mức tồn kho, tồn tức thời, giá trung bình tháng): không có quyền → mọi API trả 403, riêng tra cứu kho vẫn mở; chỉ Xem → xem được, nhưng thêm / xóa / xuất Excel / dựng lại số dư trả 403 và các cột tiền để trống; đủ Sửa + Xuất + `VIEW_COST` → tiền hiện, xuất Excel và dựng lại số dư chạy được.

## C14. Cho lập trình viên: thêm quyền khi làm chức năng mới

| Làm gì | Phải làm thêm về quyền |
| --- | --- |
| Danh mục mới | Khai mã chức năng (`FunctionCatalog.cs`, `functions.ts`); controller dùng `[CatalogFunction("mã")]` là đủ 7 API và quyền. Cho phép đổi mã thì thêm vào `CodeChangeCatalogs` |
| Chứng từ mới | Thêm vào `VoucherCatalog.All` (tự có số phiếu, quyền xem giá, xem tất cả, các quyền trạng thái); có màn Phê duyệt riêng thì thêm `ApprovalScreens` + `APPROVAL_SCREENS` ở frontend; có sổ kho thì dùng `PostedEdit` nếu cho sửa phiếu đã ghi sổ (và thêm vào danh sách `ST_EDIT_POSTED`) |
| Báo cáo mới có tiền | Thêm mã báo cáo vào `PricedCatalogsAndReports` để có `VIEW_COST`; controller: Xem cho đọc, Xem + Xuất cho `/export`; che tiền (trả null) khi thiếu `VIEW_COST` |
| API riêng | Luôn gắn `RequirePermission` / `RequireRight`; `ReadAccessContractTests` báo đỏ nếu `GET` thiếu |
| Quyền đặc biệt mới | `SpecialRightCatalog.Build()` + khóa `right.<textKey>.name/description` trong `Messages.vi.json` và `Messages.en.json` |
| Màn hình | Nút theo `getActionPermission` (Thêm → `create`, Sửa → `edit`, Xuất → `export`, In → `print`); ẩn nút không phải bảo mật |

Sau khi thêm, chạy `dotnet test` (có `PermissionMatrixTests`, `ReadAccessContractTests`, `CatalogPermissionFilterTests`) và `npm run check-policy`, rồi thử bằng một tài khoản không phải quản trị viên như danh sách C13.
