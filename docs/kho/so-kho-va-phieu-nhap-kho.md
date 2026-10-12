# Phiếu nhập kho, phiếu xuất kho, sổ kho và các bảng dùng chung

Tài liệu này giải thích **từng bảng và từng chức năng** liên quan đến hai chứng từ kho đang chạy thật là **phiếu nhập kho** và **phiếu xuất kho**: phiếu lưu những gì, ghi sổ làm gì, tồn kho nằm ở đâu, xóa phiếu thì dữ liệu đi đâu, và những bảng danh mục / hệ thống nào phiếu dựa vào. Hai phiếu có cùng kiến trúc; phần phiếu nhập được mô tả đầy đủ, phần phiếu xuất chỉ nói chỗ khác (mục 2.6, 3.3 đến 3.6). Riêng phiếu xuất còn có tài liệu ngắn `docs/kho/phieu-xuat-kho.md`. Viết cho người vận hành và người phát triển; mọi tên bảng, cột, mã chức năng và thông báo đều lấy đúng từ mã nguồn.

Nội dung:

1. [Bức tranh tổng thể](#1-bức-tranh-tổng-thể)
2. [Phiếu nhập kho và phiếu xuất kho: chức năng và luồng xử lý](#2-phiếu-nhập-kho-và-phiếu-xuất-kho-chức-năng-và-luồng-xử-lý)
3. [Các bảng của phiếu nhập kho và phiếu xuất kho](#3-các-bảng-của-phiếu-nhập-kho-và-phiếu-xuất-kho)
4. [Sổ kho và ba bảng tồn](#4-sổ-kho-và-ba-bảng-tồn)
5. [Danh mục dùng chung mà phiếu dựa vào](#5-danh-mục-dùng-chung-mà-phiếu-dựa-vào)
6. [Bảng hệ thống dùng chung](#6-bảng-hệ-thống-dùng-chung)
7. [Quan hệ giữa các bảng](#7-quan-hệ-giữa-các-bảng)
8. [Vận hành: cài đặt, kiểm tra, sửa chữa](#8-vận-hành-cài-đặt-kiểm-tra-sửa-chữa)
9. [Giới hạn hiện tại](#9-giới-hạn-hiện-tại)

---

## 1. Bức tranh tổng thể

```
 Danh mục (dùng chung)                Phiếu nhập / phiếu xuất kho            Sổ kho
 ─────────────────────                ───────────────────────                ───────
 erp_warehouse  ┐                     erp_goods_receipt / _line  (nhập, +)    erp_stock_movement  (sổ, chỉ ghi thêm)
 erp_material   │  chọn mã            erp_goods_issue   / _line  (xuất, −)         │
 erp_lot        ├──────────────►      Lập → Chờ duyệt → Đã duyệt ──► Ghi sổ ──────┤ cùng một giao dịch
 erp_location   │                              │                                   ▼
 sys_currency   │                              │                         erp_stock_balance           (tồn theo kho + giá trị)
 sys_exchange_rate ┘                           │                         erp_stock_lot_balance       (tồn theo lô)
                                               │                         erp_stock_location_balance  (tồn theo vị trí)
 Hệ thống dùng chung                           │
 ───────────────────                           ▼
 sys_voucher_numbering / sys_voucher_sequence   → cấp số phiếu
 sys_fiscal_period                               → kỳ đã khóa sổ thì không lập / sửa / ghi sổ
 sys_approval_rule / sys_document_approval       → quy tắc và tiến trình duyệt
 sys_audit_log                                   → nhật ký mọi thay đổi
 sys_role_* / sys_user_*                         → quyền xem, thêm, sửa, ghi sổ, xem giá...
```

Ba nguyên tắc xuyên suốt:

- **Không dùng khóa ngoại.** Các bảng liên kết nhau bằng **mã** (ví dụ `warehouse_code`) có index. Mã nào trỏ sang danh mục nào được khai trong code bằng `[References<...>]` và ghi vào bảng `sys_table_ref`; nhờ đó hệ thống kiểm tra mã có thật khi lưu và **không cho xóa** bản ghi đang được dùng.
- **Phiếu chỉ là chứng từ; sổ kho mới là sự thật về tồn.** Lập, sửa, duyệt phiếu chưa làm đổi tồn. Chỉ khi **Ghi sổ** thì phiếu mới đẩy vào sổ kho. Muốn sửa phiếu đã ghi sổ phải **Bỏ ghi sổ** trước.
- **Sổ kho không bao giờ bị sửa.** Bỏ ghi sổ không xóa dòng cũ mà ghi thêm dòng đảo (ngược dấu); nhờ vậy luôn truy vết được và tồn luôn bằng tổng của sổ. Dòng sổ của một phiếu chỉ bị xóa cùng với chính phiếu đó khi phiếu đã bỏ ghi sổ và sổ của nó cộng lại bằng 0 (mục 3.5).

---

## 2. Phiếu nhập kho và phiếu xuất kho: chức năng và luồng xử lý

Mã chức năng: **`inv_receipt`** (menu Kho hàng → Phiếu nhập kho). Dải số chứng từ: loại **`PNK`**. Màn Phê duyệt nhập kho: `inv_approve_receipt`.

### 2.1. Màn hình

**Danh sách phiếu** (một đơn vị cơ sở đang đăng nhập):

- Bộ lọc: mã phiếu, đơn vị cơ sở, loại nhập, trạng thái, kho, khoảng ngày; ô tìm kiếm nhanh theo mã, ghi chú, kho, nhà cung cấp, mặt hàng.
- Người không có quyền đặc biệt `VIEW_ALL` chỉ thấy phiếu **do mình lập**.
- Người không có quyền `VIEW_PRICE` thấy đơn giá, thành tiền, tổng giá trị bằng **0** (backend không gửi giá về).

**Form phiếu** gồm:

| Nhóm | Trường | Ghi chú |
|---|---|---|
| Đầu phiếu | Số phiếu | Tự cấp khi lưu lần đầu, dạng `PNK-DVCS01-202610-0001`; không sửa được |
| | Ngày chứng từ | Ngày hạch toán; phải thuộc kỳ chưa khóa sổ |
| | Ngày lập | Ngày tạo phiếu (hệ thống điền) |
| | Đơn vị cơ sở | Đơn vị đang đăng nhập |
| | Kho nhập | Chỉ kho còn hoạt động và dùng được cho đơn vị này |
| | Loại nhập | Nhập mua mới, nhập điều chuyển, nhập trả lại, nhập sản xuất (hiện là chữ chọn, chưa là danh mục) |
| | Loại tiền, tỷ giá | Tỷ giá tự lấy theo ngày chứng từ; đồng hạch toán luôn là 1 |
| | Nhà cung cấp, người giao hàng, ghi chú | Chữ tự do (nhà cung cấp chưa nối với danh mục) |
| Tab **Chi tiết nhập kho** | Dòng hàng (`ITEM`) | Mã vật tư, tên, ĐVT, số lượng, đơn giá, số lô, vị trí. **Chỉ các dòng này vào sổ kho** |
| Tab **Nguyên vật liệu** | Dòng định mức (`MATERIAL`) | Cấu trúc sản phẩm / nguyên vật liệu tham chiếu. **Không** vào sổ kho và không tính vào tổng giá trị |

Tổng giá trị phiếu = tổng (số lượng × đơn giá) của các dòng `ITEM`, nhân tỷ giá, làm tròn 2 số lẻ.

**Lưu thẳng ở một trạng thái.** Quy trình duyệt vẫn còn, nhưng người có quyền tới trạng thái nào thì lưu phiếu ở trạng thái đó được. Trường **"Trạng thái"** trong khối II (Chứng từ & tiền tệ) của form là ô chọn khi lập phiếu mới hoặc sửa phiếu nháp (chỉ chọn được khi người dùng có hơn một lựa chọn; còn không thì ô chỉ hiển thị trạng thái), và nút lưu đổi tên theo lựa chọn ("Lưu và chờ duyệt", "Lưu và đã phê duyệt", "Lưu và chuyển sổ kho"). Nút **Lưu Nháp** luôn có và luôn lưu ở **Lập chứng từ**, dù ô Trạng thái đang chọn gì:

| Lựa chọn | Người dùng cần | Hệ thống làm |
|---|---|---|
| Lập chứng từ | luôn có | chỉ lưu |
| Chờ duyệt | quyền Thêm hoặc Sửa | lưu rồi gửi duyệt như bấm Trình duyệt (dựng các cấp, thông báo người duyệt) |
| Đã phê duyệt | quyền **Duyệt** và là người duyệt của **mọi cấp** theo quy tắc phê duyệt (quản trị viên luôn đạt) | lưu rồi ghi một vòng duyệt, mỗi cấp một dòng đã duyệt bởi chính người lưu; nhật ký ghi gửi và duyệt, ghi chú "Lưu thẳng ở trạng thái đã duyệt…" |
| Chuyển sổ kho | như Đã phê duyệt **cộng** quyền đặc biệt `POST` | lưu, duyệt rồi ghi sổ |

Tất cả chạy trong **một transaction**: bước nào bị từ chối (thiếu quyền, không phải người duyệt cấp nào đó, không đủ tồn, kỳ đã khóa) thì **cả lần lưu bị hủy**, phiếu không bao giờ bị dở dang. Sửa một phiếu nháp rồi lưu ở trạng thái cao hơn cũng được. API: thêm `"targetStatus": "Pending" | "Approved" | "Posted"` vào nội dung lập / sửa phiếu. Nút Duyệt trên phiếu của người khác vẫn không cho tự duyệt phiếu mình lập; chỉ lưu thẳng ở Đã phê duyệt mới cho người lập tự duyệt, nên **ai không nên tự duyệt thì đừng cấp quyền Duyệt**.

**In phiếu nhập kho** (nút máy in ở từng dòng và nút "In phiếu" trong form, cần quyền In): có **hai mẫu** A4, in từ cửa sổ in của trình duyệt (lưu được thành PDF):

| Mẫu | Nội dung | Dùng cho |
|---|---|---|
| **In có giá và tiền** | Có cột đơn giá, thành tiền, dòng tổng cộng và **tổng số tiền viết bằng chữ**; phiếu ngoại tệ hiện thêm cộng theo loại tiền và tổng quy đổi VND theo tỷ giá | Kế toán |
| **In không có giá** | Chỉ số lượng, ghi rõ "Bản không giá"; không có đơn giá, thành tiền, tổng tiền, tỷ giá | Thủ kho, người giao hàng |

Cả hai mẫu có: tên, địa chỉ, mã số thuế, điện thoại công ty (lấy từ Hồ sơ doanh nghiệp), "Mẫu số 01 - VT", tiêu đề, ngày chứng từ dạng "Ngày 5 tháng 3 năm 2027", số phiếu, đơn vị, kho nhập, loại nhập, nhà cung cấp, người giao hàng, người duyệt, ghi chú; bảng hàng với số lô và vị trí (chỉ hiện cột nào có dữ liệu); bảng định mức nguyên vật liệu (nếu có, không tính tiền); bốn chỗ ký (người lập phiếu kèm tên người lập, người giao hàng, thủ kho, kế toán trưởng kèm tên từ hồ sơ doanh nghiệp); chân trang ngày in, người in. Người **không có quyền `VIEW_PRICE`** chỉ có mẫu không giá (nút In in luôn mẫu này); người có quyền bấm nút In thì chọn một trong hai mẫu. Mã nguồn: `modules/inventory/documents/voucherPrint.ts` (dựng trang, đọc số tiền thành chữ) và `PrintMenuButton.tsx`; phiếu xuất kho dùng lại được cùng mẫu (kind `issue`, "Mẫu số 02 - VT") nhưng chưa nối.

### 2.2. Trạng thái và thao tác

```
   ┌──────── Rút lại / Từ chối ────────┐
   ▼                                    │
 Lập chứng từ ──Trình duyệt──► Chờ duyệt ──Duyệt (đủ các cấp)──► Đã duyệt ──Ghi sổ──► Đã ghi sổ
 (Draft)                       (Pending)                         (Approved)           (Posted)
   │                                                                ▲                    │
   └──Hủy / Xóa──► Đã hủy (Cancelled)                               └────Bỏ ghi sổ───────┘
```

| Trạng thái | Sửa | Thao tác được phép | Quyền cần |
|---|---|---|---|
| **Lập chứng từ** (Draft) | Được | Sửa, Xóa (người lập), Trình duyệt, Hủy | Sửa: `edit`; Xóa: `delete`; Trình duyệt: `create` hoặc `edit` |
| **Chờ duyệt** (Pending) | Phải **rút lại** trước | Duyệt, Từ chối (người duyệt, không phải người lập), Rút lại (người lập) | Duyệt: `approve` hoặc quyền Duyệt trên màn phê duyệt |
| **Đã duyệt** (Approved) | Không (xem ghi chú dưới bảng) | Ghi sổ, Hủy | Ghi sổ: quyền đặc biệt `POST`; Hủy: `CANCEL` |
| **Đã ghi sổ** (Posted) | Không | Bỏ ghi sổ | Quyền đặc biệt `UNPOST` |
| **Đã hủy** (Cancelled) | Không | Không | — |

Ghi chú: bộ quy tắc chung cho phép sửa phiếu đã duyệt nếu có quyền đặc biệt `EDIT_APPROVED` (và phiếu chờ duyệt với `EDIT_PENDING`), nhưng **service phiếu nhập kho hiện chỉ cho sửa khi phiếu đang Lập chứng từ** ("Rút phiếu khỏi quy trình duyệt trước khi sửa phiếu nhập kho"). Sửa phiếu đã duyệt chưa được hỗ trợ ở phiếu nhập kho; cần thay đổi thì hủy phiếu và lập phiếu mới.

Quy tắc chung (bộ `DocumentStatusPolicy`, có bản sao ở frontend `utils/documentPolicy.ts`, hai bên được kiểm bằng cùng một bộ 34 ca thử):

- Mọi thao tác trừ Duyệt / Từ chối cần quyền **Xem** chức năng; người không có `VIEW_ALL` chỉ thao tác trên phiếu mình lập.
- **Không được tự duyệt phiếu do mình lập** ("Không được tự duyệt phiếu do mình lập").
- Phiếu đang chờ duyệt không sửa được: phải **Rút lại** (hoặc bị Từ chối) để về Lập chứng từ rồi mới sửa. Hủy phiếu đang chờ duyệt cũng phải rút lại trước.
- Phiếu đã ghi sổ phải **Bỏ ghi sổ** trước khi sửa hoặc hủy.

### 2.3. Luồng từng bước và những gì hệ thống kiểm tra

**Lập phiếu (Thêm mới)**

1. Quyền `create` trên `inv_receipt`.
2. **Khóa sổ:** ngày chứng từ không được nằm trong tháng đã khóa của đơn vị (`sys_fiscal_period`), cũng không được trước *ngày bắt đầu nhập liệu* của đơn vị.
3. **Kho:** phải tồn tại, còn hoạt động và dùng được cho đơn vị của phiếu (kho dùng chung, hoặc kho có đơn vị này trong danh sách đơn vị được dùng).
4. **Tiền tệ:** loại tiền phải còn hoạt động; tỷ giá lấy theo ngày chứng từ (`sys_exchange_rate`, ngày gần nhất không sau ngày chứng từ). Chưa khai tỷ giá thì báo "Chưa có tỷ giá …".
5. **Dòng hàng:** có ít nhất 1 dòng `ITEM`, tối đa 500 dòng cả hai tab; mỗi dòng có mã vật tư, tên, ĐVT, **số lượng > 0**, **đơn giá ≥ 0**.
6. **Cấp số phiếu** trong cùng giao dịch lưu (xem mục 6.1): lưu lỗi thì số được trả lại.
7. Lưu đầu phiếu, các dòng, ghi **nhật ký** (kèm bản tóm tắt dòng hàng).

**Sửa phiếu**: chỉ khi **Lập chứng từ**; kiểm lại khóa sổ, kho, tiền tệ như trên; kiểm **phiên bản** để không ghi đè người khác sửa cùng lúc (báo "bản ghi đã bị thay đổi", mã 409). Các dòng cũ bị thay bằng các dòng mới; nhật ký ghi "trước → sau" của danh sách dòng.

**Trình duyệt** (`submit`): người lập bấm. Hệ thống áp **quy tắc phê duyệt** (mục 6.3) để dựng các cấp duyệt: mỗi cấp một dòng `sys_document_approval`, cấp đầu `PENDING`, các cấp sau `WAITING`. Thiếu người duyệt ở một cấp thì báo lỗi và không gửi. Người duyệt nhận thông báo. Phiếu chuyển **Chờ duyệt**.

**Duyệt** (`approve`): người duyệt của cấp hiện tại (không phải người lập). Duyệt xong cấp nào thì mở cấp kế; **đủ mọi cấp** thì phiếu thành **Đã duyệt** và ghi người duyệt cuối. Người lập nhận thông báo.

**Từ chối** (`reject`): bắt buộc nhập lý do; các cấp còn chờ bị hủy, phiếu về **Lập chứng từ**, người lập nhận thông báo kèm lý do. Sau đó sửa rồi trình lại (lần trình mới tăng `round`).

**Rút lại** (`withdraw`): chỉ người lập (hoặc quản trị viên) khi phiếu đang chờ duyệt; các cấp đang mở bị hủy, phiếu về **Lập chứng từ**.

**Ghi sổ** (`post`) — bước làm đổi tồn:

1. Cần quyền đặc biệt `POST` và phiếu ở **Đã duyệt**; kiểm lại khóa sổ.
2. Dựng một lệnh ghi sổ **nhập** gồm các dòng `ITEM` (giá trị mỗi dòng = thành tiền × tỷ giá, quy ra đồng hạch toán).
3. Gọi **dịch vụ sổ kho** (`IStockLedger.PostAsync`): kiểm tra từng dòng, ghi sổ và cộng ba bảng tồn trong **một giao dịch**. Dòng nào sai thì **cả phiếu không ghi** và phiếu vẫn ở Đã duyệt. Chi tiết các kiểm tra ở mục 4.4.
4. Phiếu chuyển **Đã ghi sổ**.

> Số lô và vị trí gõ trên dòng phiếu hiện chỉ đi vào sổ với vật tư **có bật theo dõi lô / theo dõi vị trí**. Với vật tư không theo dõi, hai ô này chỉ là ghi chú và bị bỏ qua. Vật tư theo dõi lô mà để trống lô sẽ bị từ chối khi ghi sổ.

**Bỏ ghi sổ** (`unpost`): cần quyền `UNPOST` và phiếu **Đã ghi sổ**; kiểm khóa sổ. Dịch vụ sổ kho **ghi dòng đảo** cho mọi dòng sổ đang hiệu lực của phiếu và trừ lại ba bảng tồn đúng bằng những gì đã cộng (cả số lượng lẫn giá trị). Nếu hàng đã được xuất đi nên tồn không đủ để trừ lại thì **bị chặn** (trừ khi đơn vị cho phép tồn âm). Phiếu về **Đã duyệt**.

**Hủy** (`cancel`): chỉ khi chưa ghi sổ và không đang chờ duyệt. Phiếu Lập chứng từ do chính người lập có quyền `delete` thì dùng nút **Xóa** (xóa hẳn phiếu và dòng).

### 2.4. API

Tiền tố `/api/inventory/goods-receipts`:

| Phương thức, đường dẫn | Việc | Quyền |
|---|---|---|
| `GET /` | Danh sách phiếu của đơn vị | Xem |
| `GET /options` | Kho và loại tiền dùng được cho form | Xem |
| `GET /{id}` | Một phiếu | Xem |
| `POST /` | Lập phiếu | Thêm |
| `PUT /{id}` | Sửa phiếu (gửi kèm `version`) | Sửa |
| `POST /{id}/{operation}` | `submit`, `approve`, `post`, `unpost`, `cancel`, `withdraw` | Theo bảng 2.2 |
| `POST /{id}/reject` | Từ chối, body `{ "note": "lý do" }` | Duyệt |
| `DELETE /{id}` | Xóa phiếu Lập chứng từ | Xóa |

> Lưu ý kỹ thuật: tham số đường dẫn tên là `operation`, **không** đặt `action` (từ khóa dành riêng của ASP.NET, route sẽ không bao giờ khớp).

API duyệt dùng chung: `/api/approvals/{function}/{documentId}/...` (màn Phê duyệt nhập kho gọi các API này).

### 2.5. Thông báo lỗi thường gặp

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| Kỳ tháng MM/YYYY của đơn vị … đã khóa sổ | Ngày chứng từ nằm trong tháng đã khóa | Đổi ngày hoặc mở khóa ở Cài đặt › Năm tài chính & khóa sổ |
| Kho … không dành cho đơn vị cơ sở … | Kho không thuộc / không dùng chung cho đơn vị | Chọn kho khác, hoặc thêm đơn vị vào danh sách "Đơn vị cơ sở sử dụng" của kho |
| Chưa có tỷ giá … | Phiếu ngoại tệ nhưng chưa khai tỷ giá | Khai ở Cài đặt › Tỷ giá |
| Không được tự duyệt phiếu do mình lập | Người lập bấm Duyệt | Nhờ người khác duyệt |
| Vật tư X không có trong danh mục vật tư | Mã vật tư chưa khai | Thêm ở Danh mục vật tư |
| Vật tư X theo dõi theo lô nên phải nhập số lô | Thiếu số lô | Nhập số lô |
| Vật tư X theo dõi theo vị trí… | Thiếu vị trí | Nhập mã vị trí đúng kho của phiếu |
| Vị trí … không tồn tại, đã ngừng hoặc không thuộc kho … | Sai mã vị trí / sai kho | Chọn vị trí của đúng kho nhập |
| Vật tư X có hạn sử dụng nên lô mới … phải có ngày hết hạn | Nhập vào lô chưa có của vật tư có hạn dùng | Khai lô (kèm hạn dùng) ở Danh mục lô trước |
| Lô … đang bị khóa | Lô để trạng thái Khóa | Dùng lô khác hoặc mở khóa lô |
| Không đủ tồn kho … | Bỏ ghi sổ khi hàng đã xuất | Hủy các phiếu đã xuất trước, hoặc cho phép tồn âm (không khuyến nghị) |
| Chứng từ đã được ghi sổ kho | Ghi sổ lần hai | Không cần làm gì |

### 2.6. Phiếu xuất kho: khác gì phiếu nhập

Mã chức năng **`inv_issue`** (menu Kho hàng → Phiếu xuất kho), dải số chứng từ **`PXK`** (ví dụ `PXK-DVCS01-202703-0001`), màn Phê duyệt xuất kho `inv_approve_issue`, API tiền tố `/api/inventory/goods-issues`. Phiếu xuất **giống phiếu nhập** ở màn hình (hai khối, hai tab mặt hàng và nguyên vật liệu), trạng thái (Lập → Chờ duyệt → Đã duyệt → Đã ghi sổ / Hủy), quyền, quy tắc duyệt, khóa sổ, đánh số, nhật ký, chống ghi đè và các API (mục 2.4, thay `goods-receipts` bằng `goods-issues`). Mã nguồn đối xứng: `GoodsIssue.cs`, `GoodsIssueContracts.cs`, `GoodsIssueService.cs`, `GoodsIssuesController.cs`; phần duyệt dùng chung `DocumentApprovalService` qua giao diện `IApprovableDocument`.

Khác nhau:

| Việc | Phiếu nhập | Phiếu xuất |
|---|---|---|
| Đối tác | Nhà cung cấp (`supplier_code` + `supplier_name`), người giao | Khách hàng (`customer_name`, chữ tự do vì danh mục khách hàng chưa có backend), người nhận hàng (`receiver_name`) |
| Chiều ghi sổ | `StockDirection.In`: **cộng** tồn, giá trị = thành tiền × tỷ giá của phiếu | `StockDirection.Out`: **trừ** tồn, giá trị do **sổ kho tính theo giá bình quân của kho**; đơn giá trên phiếu **không** được gửi sang sổ |
| Đơn giá và thành tiền trên phiếu | Là giá trị nhập thật | Chỉ là giá xuất để in và tham khảo; giá vốn thật nằm ở cột `value` (số âm) của dòng sổ |
| Lô | Nhập vào lô chưa có thì sổ kho tự mở lô | Vật tư theo dõi lô **bắt buộc** có số lô đang có tồn, lô không bị khóa và chưa hết hạn |
| Kiểm tra tồn | Không bao giờ bị từ chối vì tồn | **Chỉ khi Ghi sổ**: thiếu hàng thì từ chối "Không đủ tồn kho: vật tư X tại kho Y chỉ còn n", cả phiếu không ghi (trừ khi đơn vị bật tham số `allowNegativeStock`) |
| Lập, sửa, gửi duyệt, duyệt | Không kiểm tồn | Không kiểm tồn (phiếu xuất chỉ là chứng từ cho tới khi ghi sổ) |

Luồng **Ghi sổ** của phiếu xuất: (1) cần quyền `POST` và phiếu **Đã duyệt**, kiểm khóa sổ; (2) dựng lệnh ghi sổ **xuất** gồm các dòng `ITEM` (mỗi dòng gửi mã vật tư, số lượng, mã đơn vị tính, số lô và vị trí nếu vật tư theo dõi; **không** gửi giá trị); (3) `IStockLedger.PostAsync` khóa dòng tồn (`FOR UPDATE`), kiểm tồn, tính giá bình quân, ghi sổ với số lượng và giá trị **âm**, trừ ba bảng tồn trong một giao dịch; (4) phiếu thành **Đã ghi sổ**. **Bỏ ghi sổ** ghi dòng đảo (dương) và cộng lại tồn đúng bằng đã trừ; phiếu về Đã duyệt.

Ví dụ đã chạy thật: nhập 10 cái giá 100.000 (tồn 10, giá trị 1.000.000); lập phiếu xuất 5 cái đơn giá bán 150.000 → ghi sổ ra dòng sổ **−5, giá trị −500.000** (bình quân 100.000, không phải 150.000), tồn còn 5 và 500.000; phiếu xuất khác 20 cái bị từ chối vì chỉ còn 5; bỏ ghi sổ phiếu đầu thì tồn về 10 và 1.000.000, `GET /api/inventory/stock/verify` không báo lệch.

Thông báo lỗi riêng của phiếu xuất: "Phiếu xuất kho cần ít nhất một dòng hàng", "Kho xuất không tồn tại hoặc đã ngừng sử dụng", "Chỉ được xóa phiếu xuất kho đang ở trạng thái lập chứng từ", "Không đủ tồn kho …", "Vật tư X theo dõi theo lô nên phải nhập số lô"; các lỗi về khóa sổ, kho không dành cho đơn vị, vật tư, đơn vị tính và vị trí giống bảng 2.5.

---

## 3. Các bảng của phiếu nhập kho và phiếu xuất kho

Script tạo bảng phiếu nhập: `ServerService/sql/postgresql/20-inventory-goods-receipts.sql`; phiếu xuất: `39-inventory-goods-issues.sql`; script `40-inventory-voucher-line-references.sql` đổi dòng của cả hai phiếu sang mã vật tư / đơn vị tính (`product_code` → `material_code`, `product_name` → `material_name`, `unit` → `uom_code`) và thêm `supplier_code` cho phiếu nhập. Mọi bảng dưới đây đều có bốn cột dấu vết `created_at`, `created_by`, `updated_at`, `updated_by` (hệ thống tự điền) và cột phiên bản `xmin` của PostgreSQL (chống ghi đè).

### 3.1. `erp_goods_receipt` — đầu phiếu

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigint, khóa chính | Mã nội bộ của phiếu |
| `code` | varchar(64), **duy nhất** | Số phiếu, ví dụ `PNK-DVCS01-202610-0001`. Duy nhất toàn hệ thống nên mẫu số bắt buộc có `{DVCS}` |
| `unit_code` | varchar(20) | Đơn vị cơ sở lập phiếu → `sys_company_unit.code` |
| `document_date` | date | Ngày chứng từ (ngày hạch toán, kiểm khóa sổ theo ngày này) |
| `created_date` | date | Ngày lập phiếu |
| `warehouse_code` | varchar(20) | Kho nhập → `erp_warehouse.code` |
| `voucher_type` | varchar(100) | Loại nhập (chữ) |
| `currency_code` | varchar(10) | Loại tiền → `sys_currency.code` |
| `exchange_rate` | numeric(18,6) | Tỷ giá đã chốt lúc lưu (1 với đồng hạch toán) |
| `supplier_code` | varchar(20), có thể trống | Nhà cung cấp trong danh mục → `erp_supplier.code`; chọn từ danh mục (ô tra cứu) thì có mã |
| `supplier_name` | varchar(200) | Tên nhà cung cấp: lấy từ danh mục khi có `supplier_code`, còn không là chữ tự do |
| `deliverer_name` | varchar(200) | Người giao hàng |
| `note` | varchar(1000) | Ghi chú |
| `status` | varchar(20) | `Draft`, `Pending`, `Approved`, `Posted`, `Cancelled` (ràng buộc CHECK) |
| `total_value` | numeric(18,2) | Tổng giá trị theo **đồng hạch toán** (đã nhân tỷ giá) |
| `approved_by_user_id` | integer | Người duyệt cuối |

Chỉ mục: `(unit_code, document_date desc)`, `warehouse_code`, `currency_code`.

### 3.2. `erp_goods_receipt_line` — dòng phiếu

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigint, khóa chính | Mã dòng; **chính là `source_line_id` của sổ kho** |
| `receipt_id` | bigint | Phiếu chứa dòng này → `erp_goods_receipt.id` |
| `kind` | `ITEM` / `MATERIAL` | `ITEM` = hàng nhập (vào sổ); `MATERIAL` = định mức nguyên vật liệu (không vào sổ) |
| `line_no` | integer | Số thứ tự trong từng `kind` |
| `material_code` | varchar(64) | Mã vật tư → `erp_material.code` (viết hoa khi lưu). Phải là vật tư đang dùng; dòng hàng (`ITEM`) phải là vật tư tồn kho |
| `material_name` | varchar(200) | Tên vật tư lúc lưu phiếu, **lấy từ danh mục** (phiếu cũ không đổi khi đổi tên vật tư) |
| `uom_code` | varchar(30) | Đơn vị tính của dòng → `erp_uom.code`: đơn vị gốc của vật tư hoặc đơn vị có quy đổi sang đơn vị gốc (`erp_uom_conversion`); sổ kho quy đổi khi ghi sổ |
| `quantity` | numeric(18,4) | Số lượng, > 0 |
| `unit_price` | numeric(18,4) | Đơn giá theo loại tiền của phiếu, ≥ 0 |
| `amount` | numeric(18,2) | Thành tiền = số lượng × đơn giá |
| `lot_number` | varchar(64) | Số lô (chỉ có nghĩa với vật tư theo dõi lô) |
| `position` | varchar(100) | Vị trí lưu (chỉ có nghĩa với vật tư theo dõi vị trí; nhập **mã vị trí**) |

Ràng buộc: mỗi `(receipt_id, kind, line_no)` duy nhất; chỉ mục theo `receipt_id`, `material_code`, `uom_code`. Sửa phiếu thì xóa hết dòng cũ rồi thêm lại, nên `id` dòng đổi — vì vậy chỉ dòng của phiếu **đã ghi sổ** mới được coi là gắn với sổ, và phiếu đã ghi sổ không sửa được.

### 3.3. `erp_goods_issue` — đầu phiếu xuất

Cấu trúc **giống `erp_goods_receipt`** (cùng các cột `id`, `code`, `unit_code`, `document_date`, `created_date`, `warehouse_code`, `voucher_type`, `currency_code`, `exchange_rate`, `note`, `status`, `total_value`, `approved_by_user_id`, bốn cột dấu vết và `xmin`), chỉ khác phần đối tác:

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `code` | varchar(64), **duy nhất** | Số phiếu `PXK-<đơn vị>-<yyyymm>-<số>` |
| `warehouse_code` | varchar(20) | **Kho xuất** → `erp_warehouse.code` |
| `voucher_type` | varchar(100) | Loại xuất (chữ): xuất bán hàng, điều chuyển nội bộ, nguyên vật liệu sản xuất, hàng mẫu / khuyến mãi, kiểm kê giảm / hủy |
| `customer_name` | varchar(200) | Khách hàng (chữ tự do) |
| `receiver_name` | varchar(200) | Người nhận hàng |
| `total_value` | numeric(18,2) | Tổng giá xuất của các dòng `ITEM` theo đồng hạch toán, **để tham khảo**; giá vốn thật nằm trong sổ kho |

Không có `supplier_code`. Chỉ mục: `(unit_code, document_date desc)`, `warehouse_code`, `currency_code`. Trạng thái và ràng buộc `CHECK` như phiếu nhập.

### 3.4. `erp_goods_issue_line` — dòng phiếu xuất

Cấu trúc **giống `erp_goods_receipt_line`**, chỉ khác cột trỏ về đầu phiếu là **`issue_id`** → `erp_goods_issue.id`: `kind` (`ITEM` = hàng xuất, vào sổ; `MATERIAL` = định mức nguyên vật liệu, không vào sổ), `line_no`, `material_code` → `erp_material`, `material_name`, `uom_code` → `erp_uom`, `quantity`, `unit_price`, `amount`, `lot_number`, `position`. `id` của dòng là `source_line_id` của sổ kho khi ghi sổ. Ràng buộc `(issue_id, kind, line_no)` duy nhất; chỉ mục theo `issue_id`, `material_code`, `uom_code`.

### 3.5. Xóa phiếu: dòng chi tiết, sổ kho và các bảng tồn

Script `41-voucher-delete-trigger.sql` tạo trigger `BEFORE DELETE` cho `erp_goods_receipt` và `erp_goods_issue` (hàm `erp_voucher_delete_cleanup`). Vì dự án không dùng khóa ngoại nên đây là lớp bảo vệ ở mức database, bổ sung cho việc dịch vụ tự xóa dòng phiếu:

| Tình trạng phiếu khi xóa | Điều gì xảy ra |
|---|---|
| **Còn ghi sổ** (sổ của phiếu, cộng theo kho / vật tư / lô / vị trí, chưa về 0) | **Từ chối** với thông báo "Phiếu … đang ghi sổ kho: phải bỏ ghi sổ trước khi xóa". Nếu cho xóa dòng sổ lúc này, ba bảng tồn sẽ lệch so với sổ |
| **Chưa từng ghi sổ** (Lập chứng từ) | Xóa **mọi dòng chi tiết** của phiếu (`*_line`); không có dòng sổ nào để xóa |
| **Đã bỏ ghi sổ** (sổ chỉ còn các cặp dòng ghi và dòng đảo, cộng lại bằng 0) | Xóa dòng chi tiết **và toàn bộ dòng sổ** (`erp_stock_movement`) của phiếu. Ba bảng tồn **không đổi** vì tổng của phiếu bằng 0, nên không cần tính lại |

Giữ lại: lịch sử duyệt (`sys_document_approval`) và nhật ký thay đổi (`sys_audit_log`), để còn bằng chứng ai đã làm gì.

Cách dùng bình thường vẫn qua màn hình: nút **Xóa** chỉ có với phiếu **Lập chứng từ** (dịch vụ từ chối phiếu đã gửi duyệt, đã duyệt hoặc đã ghi sổ trước khi chạm database). Trigger chỉ là chốt chặn cuối cho trường hợp ai đó xóa trực tiếp bằng SQL: xóa phiếu đã bỏ ghi sổ thì dọn sạch, xóa phiếu còn ghi sổ thì bị chặn. Đã thử trên dữ liệu thật: phiếu nhập còn ghi sổ bị chặn (dòng và sổ còn nguyên); phiếu nhập và phiếu xuất đã bỏ ghi sổ bị xóa cùng dòng chi tiết và dòng sổ, tồn của phiếu còn lại vẫn 10, `verify` không báo lệch; phiếu nháp xóa qua API vẫn chạy bình thường.

### 3.6. Số phiếu và quan hệ giữa hai phiếu

Hai phiếu dùng **chung** bảng số chứng từ (`sys_voucher_numbering`: `PNK`, `PXK`), khóa sổ (`sys_fiscal_period`), phê duyệt (`sys_approval_rule`, `sys_document_approval`, khóa theo `menuid0` + số phiếu) và **một** sổ kho: dòng sổ biết nó đến từ phiếu nào qua `source_function` (`inv_receipt` hay `inv_issue`) và `source_id`.

---

## 4. Sổ kho và ba bảng tồn

Script: `34-inventory-stock-ledger.sql`. Mã: `ServerService/Core.Infrastructure/Modules/Inventory/Stock/`.

### 4.1. Vì sao có bốn bảng

| Bảng | Vai trò | Ví dụ câu hỏi nó trả lời |
|---|---|---|
| `erp_stock_movement` | **Sổ kho**: nhật ký mọi lần nhập / xuất, chỉ ghi thêm | "Phiếu nào làm tồn laptop thay đổi?" |
| `erp_stock_balance` | **Tồn theo kho** + giá trị | "Kho HCM còn bao nhiêu laptop, trị giá bao nhiêu?" |
| `erp_stock_lot_balance` | **Tồn theo lô** | "Lô LOT-2605A còn bao nhiêu?" |
| `erp_stock_location_balance` | **Tồn theo vị trí** | "Kệ A1 tầng 1 đang chứa gì?" |

Sổ để **truy vết và dựng lại**; ba bảng tồn là **số dư hiện tại** để tra nhanh và chặn xuất vượt tồn. Ba bảng tồn luôn bằng tổng số lượng của sổ cho đúng khóa đó (kiểm bằng `verify`, sửa bằng `rebuild`, xem mục 8).

### 4.2. `erp_stock_movement` — sổ kho

| Cột | Ý nghĩa |
|---|---|
| `id` | Số thứ tự dòng sổ |
| `source_function`, `source_id`, `source_line_id` | Phiếu nguồn: mã chức năng (`inv_receipt`), id phiếu, id dòng phiếu |
| `unit_code`, `warehouse_code` | Đơn vị cơ sở và kho phát sinh |
| `material_code` | Vật tư |
| `lot_code` | Lô (dạng `VT001@LOT-2610`); **null** nếu vật tư không theo dõi lô |
| `location_code` | Vị trí; **null** nếu không theo dõi vị trí |
| `document_date` | Ngày chứng từ của phiếu |
| `quantity` | Số lượng **có dấu** (+ nhập, − xuất) theo **đơn vị tính gốc** của vật tư |
| `value` | Giá trị **có dấu**, đồng hạch toán |
| `uom_code` | Đơn vị tính gốc của vật tư lúc ghi |
| `line_uom_code`, `line_quantity` | Đơn vị và số lượng ghi trên dòng phiếu (có dấu), khi khác đơn vị gốc |
| `posting_seq` | Lần ghi sổ thứ mấy của phiếu này (1, 2, …) |
| `reversal_of_id` | Nếu là **dòng đảo**: id dòng sổ bị đảo; ngược lại null |
| `created_at`, `created_by` | Thời điểm và người ghi sổ |

Ràng buộc quan trọng:

- Duy nhất `(source_function, source_line_id, posting_seq)` cho dòng không phải đảo: một dòng phiếu không ghi hai lần trong cùng một lần ghi sổ.
- Duy nhất `reversal_of_id`: một dòng sổ chỉ bị đảo **một lần**.
- Một dòng sổ **đang hiệu lực** khi nó không phải dòng đảo và chưa có dòng đảo nào trỏ tới nó.

### 4.3. Ba bảng tồn

**`erp_stock_balance`** — khóa `(unit_code, warehouse_code, material_code)`: `quantity` (số lượng), `value` (giá trị). Có mặt với **mọi** vật tư tồn kho.

**`erp_stock_lot_balance`** — khóa `(unit_code, warehouse_code, material_code, lot_code)`: `quantity`. Chỉ có với vật tư **theo dõi lô**.

**`erp_stock_location_balance`** — khóa `(unit_code, warehouse_code, material_code, lot_code, location_code)`: `quantity`. Chỉ có với vật tư **theo dõi vị trí**. Vật tư không theo lô thì `lot_code` là chuỗi rỗng (khóa chính không được null; trong sổ thì là null).

Mối quan hệ giữa ba bảng (với vật tư theo dõi đủ): tổng số lượng các vị trí của một lô = số lượng lô; tổng các lô = số lượng kho. Có vật tư chỉ theo lô, chỉ theo vị trí hoặc không theo dõi gì — bảng nào không áp dụng thì không có dòng.

Cả bốn bảng không có khóa ngoại nhưng khai `[References]` tới vật tư, lô, vị trí, kho, đơn vị cơ sở: **vật tư / lô / vị trí / kho đã có lịch sử tồn thì không xóa được** (hãy chuyển sang Tạm dừng).

### 4.4. Dịch vụ ghi sổ `IStockLedger`

Mọi phiếu làm đổi tồn đều gọi **một nơi duy nhất**, không tự viết SQL ghi sổ.

**Ghi sổ (`PostAsync`)** — các bước, tất cả trong một giao dịch (lỗi ở đâu cũng hoàn tác hết):

1. Phiếu phải có dòng. Lấy tham số `allowNegativeStock` của đơn vị.
2. **Kho** phải còn hoạt động và dùng được cho đơn vị.
3. Phiếu **chưa ghi sổ** (không có dòng sổ hiệu lực); tính `posting_seq` kế tiếp.
4. Với từng dòng:
   - Vật tư phải có trong danh mục và là **vật tư tồn kho**; số lượng > 0; giá trị ≥ 0.
   - **Đơn vị tính:** để trống hoặc trùng đơn vị gốc thì hệ số 1; khác thì tìm trong danh mục quy đổi (ưu tiên quy đổi riêng của vật tư, rồi quy đổi chung; chiều ngược thì chia). Không có quy đổi → từ chối. Số lượng gốc = số lượng × hệ số, làm tròn 4 số lẻ.
   - **Lô:** vật tư theo dõi lô thì **bắt buộc** có số lô; không theo dõi thì **không được** có. Nhập vào lô chưa có thì **tự tạo lô** (vật tư có hạn dùng bắt buộc kèm ngày hết hạn; ngày hết hạn không trước ngày sản xuất). Lô **bị khóa** thì không nhập không xuất; lô **hết hạn** (so với ngày chứng từ) thì không xuất.
   - **Vị trí:** vật tư theo dõi vị trí thì bắt buộc, không theo dõi thì không được có; vị trí phải tồn tại, còn hoạt động và **thuộc đúng kho** của phiếu.
5. Áp các dòng theo thứ tự cố định (vật tư, lô, vị trí) để các phiếu chạy đồng thời khóa dòng theo cùng thứ tự, tránh khóa chéo.
6. Với từng dòng: **khóa dòng tồn** (`SELECT … FOR UPDATE`), kiểm tồn không âm (trừ khi cho phép), cộng/trừ ba bảng tồn, ghi một dòng sổ.

**Cách tính giá trị:**

- **Nhập:** giá trị dòng = thành tiền × tỷ giá.
- **Xuất:** theo **bình quân di động** của kho: `giá trị xuất = giá trị tồn × số lượng xuất / số lượng tồn`, làm tròn 2 số lẻ; xuất **hết** thì lấy trọn giá trị còn lại (không để dư số lẻ). Tồn rỗng hoặc âm thì xuất ra giá trị 0.
- **Bỏ ghi sổ:** lấy lại đúng số lượng và giá trị của dòng sổ gốc, không tính lại bình quân.

**Tranh chấp đồng thời:** hai phiếu xuất cùng lúc từ một dòng tồn sẽ xếp hàng nhờ khóa dòng. Đã thử: 10 phiếu xuất 2 đơn vị từ tồn 6 thì đúng 3 phiếu thành công, tồn không âm.

**Bỏ ghi sổ (`UnpostAsync`)**: lấy các dòng sổ đang hiệu lực của phiếu, với mỗi dòng ghi một dòng đảo (số lượng và giá trị ngược dấu, `reversal_of_id` trỏ về dòng gốc, cùng `posting_seq`) rồi trừ lại ba bảng tồn. Phiếu chưa ghi sổ thì báo "Chứng từ chưa được ghi sổ kho".

### 4.5. Ví dụ chạy số

Đơn vị DVCS01, kho `KHO-HCM`, vật tư `LAP-DELL-XPS15` (theo dõi lô và vị trí), tồn đầu 0.

1. **Phiếu nhập 1:** 10 cái × 28.000.000, lô `LOT-2605A`, vị trí `HCM-A1-T1`, ghi sổ.
   - Sổ: +10, giá trị +280.000.000.
   - Tồn kho: 10 / 280.000.000. Tồn lô `LAP-DELL-XPS15@LOT-2605A`: 10. Tồn vị trí `HCM-A1-T1`: 10.
2. **Phiếu nhập 2:** 5 cái × 30.000.000, lô **mới** `LOT-NEW1`, vị trí `HCM-A1-T2`, ghi sổ.
   - Hệ thống **tự tạo lô** `LAP-DELL-XPS15@LOT-NEW1` trong danh mục lô.
   - Tồn kho: 15 / 430.000.000 (bình quân 28.666.666,67 mỗi cái).
3. **Một phiếu xuất 4 cái** lô `LOT-2605A`:
   - Sổ: −4, giá trị −114.666.666,67. Tồn kho: 11 cái. Tồn lô `LOT-2605A`: 6. Tồn vị trí `HCM-A1-T1`: 6.
4. **Bỏ ghi sổ phiếu nhập 1** khi đang còn phiếu xuất 4 cái: lô `LOT-2605A` chỉ còn 6 < 10 nên **bị chặn** ("Không đủ tồn kho …"). Hủy ghi sổ phiếu xuất trước thì bỏ ghi sổ phiếu nhập 1 được: sổ có thêm 2 dòng đảo (−10 và giá trị −280.000.000), `posting_seq` của lần ghi lại sẽ là 2.

---

## 5. Danh mục dùng chung mà phiếu dựa vào

Tất cả đều là danh mục theo **khung danh mục chung** (`CatalogService`): có tìm kiếm, phân trang, nhập / xuất Excel, xóa nhiều, nhật ký, chống ghi đè, ô chọn mã (F2) và không cho xóa khi đang được dùng. Cột nào cũng có người tạo / người sửa và thời điểm.

### 5.1. `erp_warehouse` (Danh mục kho) — `inv_warehouse_cat`

| Cột | Ý nghĩa |
|---|---|
| `code`, `name` | Mã (≤ 20) và tên kho; tên không trùng |
| `unit_code` | **Đơn vị cơ sở của kho** (bắt buộc; mặc định đơn vị đang đăng nhập khi tạo) |
| `warehouse_type_code` | Loại kho → `erp_warehouse_type` |
| `address`, `manager`, `capacity` | Địa chỉ, thủ kho, sức chứa (chữ) |
| `is_active`, `sort_order` | Trạng thái và thứ tự |

Bảng phụ **`erp_warehouse_unit`** `(warehouse_code, unit_code)`: danh sách đơn vị cơ sở **được dùng** kho. **Không có dòng nào = kho dùng chung** (mọi đơn vị dùng được). Nếu có danh sách thì đơn vị của kho luôn nằm trong đó. Phiếu chỉ chọn được kho mà đơn vị của phiếu được dùng.

### 5.2. `erp_material` (Danh mục vật tư) — `inv_material_cat`

| Nhóm | Cột | Ý nghĩa |
|---|---|---|
| Định danh | `code` (≤ 50), `name`, `customer_material_code`, `part_no` | Mã, tên, mã của khách, part number |
| Phân loại | `material_type_code`, `material_group_code` | Loại vật tư, nhóm vật tư |
| Đơn vị | `uom_code` | **Đơn vị tính gốc**: sổ kho tính theo đơn vị này |
| Thuế | `vat_tax_rate_code`, `import_tax_rate_code` | Mã thuế GTGT, thuế nhập khẩu → `sys_tax_rate` |
| **Cờ cho sổ kho** | `is_stock_item` | Vật tư tồn kho; tắt cho dịch vụ / chi phí (không vào sổ) |
| | `track_lot` | Theo dõi theo lô → có tồn theo lô, phiếu bắt buộc số lô |
| | `has_expiry`, `shelf_life_days` | Có hạn sử dụng (kèm số ngày hạn dùng); hạn ghi trên lô nên cần `track_lot` |
| | `track_location` | Theo dõi theo vị trí → có tồn theo vị trí, phiếu bắt buộc vị trí |
| | `is_cycle_counted` | Kiểm kê định kỳ |
| | `costing_method` | `AVERAGE` (bình quân) hoặc `FIFO` |
| Định mức | `min_stock`, `max_stock` | Tồn tối thiểu / tối đa |
| Kích thước | `length`, `width`, `height`, `weight`, `volume` | |

Quy tắc kiểm tra khi lưu: vật tư không tồn kho thì không được bật theo lô / vị trí / hạn dùng / kiểm kê; có hạn dùng thì phải theo dõi lô; số ngày hạn dùng chỉ khi có hạn dùng; tồn tối đa ≥ tồn tối thiểu; các số đo không âm.

### 5.3. `erp_lot` (Lô và hạn sử dụng) — `inv_lot_cat`

Khóa là **vật tư + số lô**, viết thành mã `VT001@LOT-2610` (cột `code` là khóa chính; các bảng sổ và tồn trỏ tới lô bằng mã này). Cột: `material_code`, `lot_no`, `mfg_date`, `exp_date`, `supplier_code`, `quality_status` (`PASSED` đạt chuẩn / `INSPECT` cần kiểm định / `BLOCKED` khóa), `note`, `is_active`. Vật tư và số lô **không đổi** sau khi lưu. Lô chỉ tạo cho vật tư bật `track_lot`; vật tư có hạn dùng thì lô phải có ngày hết hạn. Tình trạng hạn (còn hạn / sắp hết trong 30 ngày / hết hạn) **tính khi đọc**, không lưu. Số lượng còn lại của lô nằm ở `erp_stock_lot_balance`, không ở đây.

### 5.4. `erp_location` (Vị trí lưu kho) — `inv_location_cat`

`code` (≤ 30, **duy nhất toàn hệ thống**, ví dụ `KHO1-A-01`), `name` (không trùng trong cùng kho), `warehouse_code`, `zone`, `rack`, `shelf`, `capacity`, `note`, `is_active`. Kho của vị trí **không đổi** sau khi lưu. Số lượng đang chứa lấy từ `erp_stock_location_balance`.

### 5.5. Các danh mục còn lại

| Bảng | Dùng để | Ghi chú |
|---|---|---|
| `erp_material_type`, `erp_material_group` | Phân loại vật tư | Vật tư trỏ bằng `material_type_code`, `material_group_code` |
| `erp_uom` (+ `erp_uom_translation`) | Đơn vị tính, có tên theo ngôn ngữ | Đơn vị gốc của vật tư |
| `erp_uom_conversion` | Quy đổi giữa hai đơn vị: 1 `from` = `factor` `to`, có thể riêng cho một vật tư | Sổ kho dùng khi dòng phiếu có đơn vị khác đơn vị gốc |
| `erp_supplier` | Nhà cung cấp | Phiếu nhập hiện lưu **tên chữ**, chưa trỏ mã |
| `erp_warehouse_type` | Loại kho | |
| `sys_company_unit` | Đơn vị cơ sở | Mỗi phiếu, kho, dòng sổ đều thuộc một đơn vị |
| `sys_currency` | Loại tiền; một đồng là **tiền hạch toán** (`is_base`) | Phiếu chọn loại tiền còn hoạt động |
| `sys_exchange_rate` | Tỷ giá theo ngày (mua, bán, hạch toán) | Phiếu lấy tỷ giá **hạch toán** của ngày gần nhất không sau ngày chứng từ; tiền hạch toán luôn là 1 |
| `sys_tax_rate` | Mã thuế | Vật tư trỏ; phiếu nhập chưa dùng |

---

## 6. Bảng hệ thống dùng chung

### 6.1. Đánh số chứng từ — `sys_voucher_numbering`, `sys_voucher_sequence`

- **`sys_voucher_numbering`** (khóa `voucher_type`, ví dụ `PNK`): `menuid0` (mã chức năng), `name`, `prefix`, `pattern`, `digits`. Mẫu số dùng các ký hiệu `{PREFIX}`, `{DVCS}`, `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{SEQ}`. Mặc định `{PREFIX}-{DVCS}-{YYYY}{MM}-{SEQ}`, 4 chữ số → `PNK-DVCS01-202610-0001`. Sửa ở Cài đặt › Tham số mặc định & đánh số chứng từ. Mỗi loại chứng từ khai trong `VoucherCatalog.cs` được tự tạo một dòng khi khởi động.
- **Bắt buộc có `{SEQ}` và `{DVCS}`.** `{DVCS}` bắt buộc vì dải số chạy riêng từng đơn vị mà số phiếu phải duy nhất toàn hệ thống; thiếu thì hai đơn vị lập phiếu đầu tháng sẽ trùng số.
- **`sys_voucher_sequence`** `(voucher_type, unit_code, period_key)` → `last_number`: số đã cấp cuối cùng. `period_key` suy từ mẫu: có `{DD}` thì theo ngày (`yyyyMMdd`), có `{MM}` theo tháng (`yyyyMM`), chỉ có năm thì `yyyy`, không có ngày tháng thì `ALL` (không bao giờ về 1).
- Số được cấp bằng một câu `INSERT … ON CONFLICT DO UPDATE … RETURNING` nên hai người lưu cùng lúc **không bao giờ trùng số**; số cấp trong giao dịch lưu phiếu nên lưu lỗi thì số được trả lại.

### 6.2. Khóa sổ — `sys_fiscal_period`

`(unit_code, year, month)` + `is_locked`, người và giờ khóa. **Không có dòng = tháng mở.** Phiếu có ngày chứng từ trong tháng đã khóa của đơn vị thì không lập / sửa / ghi sổ / bỏ ghi sổ / xóa được. Ngoài ra *ngày bắt đầu nhập liệu* (tham số năm tài chính của đơn vị) chặn mọi phiếu có ngày trước nó.

### 6.3. Phê duyệt — `sys_approval_rule`, `sys_document_approval`

- **`sys_approval_rule`**: "phiếu của `menuid0`, do ai lập (`requester_type`: `ANY` / `USER` / `ROLE` / `DEPARTMENT` + `requester_value`), ở đơn vị `unit_code` (null = mọi đơn vị), từ số tiền `min_amount`, thì ở cấp `level` do `approver_type` (`USER` / `ROLE`) `approver_value` duyệt". Nhiều quy tắc cùng cấp được gộp (ai trong đó cũng duyệt được); các cấp chạy theo thứ tự. Cấu hình ở Cài đặt › Phân quyền › Quy trình phê duyệt.
- **`sys_document_approval`**: mỗi lần trình tạo **một dòng cho mỗi cấp**: `menuid0`, `document_id` (số phiếu), `unit_code`, `amount`, `round` (lần trình), `level`, `approver_user_ids` (người được duyệt cấp đó), `status` (`WAITING` / `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED`), người trình, người xử lý, giờ, ghi chú.
- Khóa nối với phiếu là **số phiếu** (`document_id` = `erp_goods_receipt.code`), vì vậy số phiếu phải duy nhất toàn hệ thống.

### 6.4. Nhật ký thay đổi — `sys_audit_log`

Mọi thêm / sửa / xóa của bản ghi có khai `[Audited]` tự ghi một dòng (cột `function_code`, `object_type`, `object_id`, `object_label`, `action`, `changes` dạng JSON "trước → sau", `actor_*`, `unit_code`, `ip_address`, `log_time`), cùng giao dịch với thay đổi. Phiếu nhập kho ghi cả danh sách dòng hàng. Trình, duyệt, từ chối, rút lại cũng được ghi. Xem ở Cài đặt › Nhật ký thay đổi (có tự dọn theo số ngày lưu). Các bảng tồn và sổ kho **không** ghi nhật ký riêng vì sổ chính là dấu vết.

### 6.5. Quyền — `sys_command`, `sys_role_command`, `sys_user_command`, `sys_role_right`, `sys_user_right`

- Mỗi chức năng (`inv_receipt`...) có 7 thao tác: xem, thêm, sửa, xóa, duyệt, in, xuất. Quyền hiệu lực = **quyền của vai trò + ngoại lệ của người dùng**; quản trị viên có tất cả.
- **Quyền đặc biệt** của phiếu (`{chức năng}:{mã}`): `VIEW_PRICE` (xem giá), `VIEW_ALL` (xem phiếu người khác), `EDIT_PENDING` (sửa phiếu chờ duyệt), `EDIT_APPROVED` (sửa phiếu đã duyệt), `POST` (ghi sổ), `UNPOST` (bỏ ghi sổ), `CANCEL` (hủy). Đọc sổ kho / tồn dùng chức năng `inv_report_stock` (giá trị cần `VIEW_COST`).

### 6.6. Tham số hệ thống — `sys_setting`

Giá trị ít được bảng khác tham chiếu nằm dạng JSON. Liên quan đến kho: `allowNegativeStock` (cho phép tồn âm, theo từng đơn vị; **mặc định tắt**), `costingMethod`, `requireApprovalBeforePosting`, `defaultWarehouse`, và năm tài chính (ngày bắt đầu nhập liệu). Sửa ở Cài đặt › Tham số mặc định & đánh số chứng từ.

### 6.7. Các bảng phụ trợ

| Bảng | Vai trò |
|---|---|
| `sys_table_ref`, view `sys_v_columns` | Bản đồ "cột `*_code` trỏ sang bảng nào"; nguồn của kiểm tra mã khi lưu và chặn xóa |
| `sys_notification`, `sys_notification_read` | Thông báo duyệt / từ chối cho người liên quan |
| `sys_grid_layout` | Cột hiển thị, độ rộng, thứ tự của từng người trên các lưới danh mục |
| `sys_users`, `sys_role`, `sys_user_role`, `sys_user_company_unit` | Người dùng, vai trò, đơn vị cơ sở người dùng được vào |

---

## 7. Quan hệ giữa các bảng

Không có khóa ngoại trong database; "→" là cột mã được code kiểm tra và dùng để chặn xóa.

| Từ (bảng.cột) | Tới | Chặn xóa? |
|---|---|---|
| `erp_goods_receipt.unit_code` | `sys_company_unit` | Có |
| `erp_goods_receipt.warehouse_code` | `erp_warehouse` | Có |
| `erp_goods_receipt.currency_code` | `sys_currency` | Có |
| `erp_goods_receipt_line.receipt_id` | `erp_goods_receipt.id` | Xóa phiếu thì xóa dòng |
| `erp_goods_receipt_line.material_code` | `erp_material` | Có (vật tư đã có dòng phiếu thì không xóa được) |
| `erp_goods_receipt_line.uom_code` | `erp_uom` | Có |
| `erp_goods_receipt.supplier_code` | `erp_supplier` | Có (không bắt buộc) |
| `erp_goods_issue.unit_code`, `.warehouse_code`, `.currency_code` | `sys_company_unit`, `erp_warehouse`, `sys_currency` | Có |
| `erp_goods_issue_line.issue_id` | `erp_goods_issue.id` | Xóa phiếu thì xóa dòng (trigger mục 3.5) |
| `erp_goods_issue_line.material_code`, `.uom_code` | `erp_material`, `erp_uom` | Có |
| `erp_stock_movement.{unit,warehouse,material,lot,location,uom,line_uom}_code` | đơn vị, kho, vật tư, lô, vị trí, đơn vị tính | **Có** (lịch sử tồn) |
| `erp_stock_balance` / `_lot_balance` / `_location_balance` `.{…}_code` | như trên | **Có** |
| `erp_lot.material_code`, `erp_lot.supplier_code` | `erp_material`, `erp_supplier` | Có (vật tư còn lô thì không xóa) |
| `erp_location.warehouse_code` | `erp_warehouse` | Có |
| `erp_material.{uom,material_type,material_group,vat_tax_rate,import_tax_rate}_code` | các danh mục tương ứng | Có |
| `erp_warehouse.unit_code`, `erp_warehouse_unit.unit_code` | `sys_company_unit` | Có |
| `sys_document_approval.document_id` | `erp_goods_receipt.code` hoặc `erp_goods_issue.code` (theo `menuid0`) | Không (liên kết mềm, giữ lại khi xóa phiếu) |
| `erp_stock_movement.source_id` | `erp_goods_receipt.id` hoặc `erp_goods_issue.id` (theo `source_function`) | Không (liên kết mềm); trigger mục 3.5 dọn dòng sổ đã triệt tiêu khi xóa phiếu |

Xem toàn bộ bản đồ bằng câu lệnh `select * from sys_v_columns where ref_table = 'erp_material'`.

---

## 8. Vận hành: cài đặt, kiểm tra, sửa chữa

### 8.1. Thứ tự cài đặt (đã có database)

1. Chạy các script `ServerService/sql/postgresql/` **theo thứ tự tên file** (script chạy lại được). Liên quan trực tiếp: `20` (phiếu nhập), `30` (đơn vị cơ sở của kho), `31` (vật tư), `32` (vị trí), `33` (lô), `34` (sổ kho và tồn), `35` (mẫu số chứng từ có `{DVCS}`), `39` (phiếu xuất), `40` (dòng phiếu trỏ tới vật tư / đơn vị tính / nhà cung cấp), `41` (trigger xóa phiếu).
2. Khởi động backend; chạy lại `00-helpers.sql` nếu thiếu hàm tìm kiếm.
3. Khai: đơn vị cơ sở → tiền tệ và tỷ giá → loại kho, **kho** (kèm đơn vị) → đơn vị tính → loại / nhóm vật tư → **vật tư** (đặt cờ lô / vị trí / hạn dùng) → **vị trí lưu kho** → **lô** (hoặc để phiếu tự tạo).
4. Cài đặt: mẫu số chứng từ (Tham số mặc định & đánh số chứng từ), khóa sổ (Năm tài chính & khóa sổ), quy tắc phê duyệt cho `inv_receipt` và `inv_issue`, tham số tồn âm.
5. Cấp quyền cho vai trò, gồm các quyền đặc biệt `POST`, `UNPOST`, `VIEW_PRICE`, `VIEW_ALL` cho đúng người.

### 8.2. Xem tồn và sổ (API)

| Câu hỏi | API |
|---|---|
| Tồn theo kho | `GET /api/inventory/stock/balances?level=warehouse&warehouseCode=&materialCode=&search=` |
| Tồn theo lô | `GET /api/inventory/stock/balances?level=lot&materialCode=` |
| Tồn theo vị trí | `GET /api/inventory/stock/balances?level=location&warehouseCode=` |
| Sổ kho của một phiếu | `GET /api/inventory/stock/movements?sourceFunction=inv_receipt&sourceId=<id phiếu>` (phiếu xuất: `inv_issue`) |

Phân trang `page`, `pageSize` (tối đa 200); `includeZero=true` để thấy cả dòng tồn 0; cột giá trị chỉ hiện khi có quyền xem giá vốn (`inv_report_stock:VIEW_COST`).

### 8.3. Kiểm tra và dựng lại tồn

- `GET /api/inventory/stock/verify` → danh sách chỗ **lệch** giữa sổ và bảng tồn (trống = ổn). Mỗi dòng cho biết mức (kho / lô / vị trí), khóa, số lượng theo sổ và theo bảng tồn.
- `POST /api/inventory/stock/rebuild` → xóa và **dựng lại** ba bảng tồn của đơn vị từ sổ. Chỉ dùng sau khi sửa dữ liệu bằng tay hoặc khi `verify` báo lệch.
- Cả hai thuộc chức năng **Tính tồn kho tức thời** (`inv_calc_instant_stock`): xem cần quyền Xem, dựng lại cần quyền Sửa.

Câu SQL tương đương để tự kiểm: tổng `quantity` của `erp_stock_movement` theo `(unit_code, warehouse_code, material_code)` phải bằng `erp_stock_balance.quantity`; giá trị tương tự với `value`.

### 8.4. Lưu ý khi thử trên dữ liệu mẫu

Dữ liệu dev có **toàn bộ các tháng 2026 của DVCS01 đã khóa sổ**; phiếu thử cần ngày năm 2027 hoặc mở khóa tháng cần dùng.

---

## 9. Giới hạn hiện tại

- Ô chọn vật tư, đơn vị tính và nhà cung cấp trên phiếu **đọc danh mục thật** (tra cứu `materials`, `uoms`, `suppliers`). Danh mục vật tư chưa có giá nên đơn giá dòng bắt đầu bằng 0, nhập tay. Lô và vị trí vẫn nhập tay (chữ): vật tư theo dõi vị trí phải nhập vị trí thuộc kho của phiếu (kiểm tra khi lưu), vật tư theo dõi lô phải có số lô khi ghi sổ. Khi lưu, backend kiểm tra mã vật tư, đơn vị tính, nhà cung cấp, vị trí (thông báo `voucherLine.*`, `receipt.supplierInvalid`) và lấy tên vật tư từ danh mục.
- Đơn vị tính trên dòng **đi vào sổ**: phiếu gửi `uom_code` của dòng, sổ kho quy đổi về đơn vị gốc của vật tư qua `erp_uom_conversion` (dòng sổ lưu cả số lượng và đơn vị gốc lẫn của dòng phiếu).
- Phiếu nhập và phiếu xuất chưa có phân trang phía máy chủ và xuất Excel từ trình duyệt (khác các danh mục); danh sách tải hết phiếu của đơn vị một lần.
- Người **không có quyền xem giá** (`VIEW_PRICE`) thấy đơn giá 0 trên phiếu; nếu họ sửa và lưu phiếu nháp thì tổng tiền bị tính lại từ số 0 đó. Cần giữ nguyên đơn giá cũ khi người sửa không có quyền xem giá (chưa làm, áp dụng cho cả hai phiếu).
- Mới có phiếu nhập và phiếu xuất ghi vào sổ; **điều chuyển và kiểm kê** chưa ghi sổ. Chưa có màn hình xem tồn kho và báo cáo nhập xuất tồn (mới có API). Khách hàng trên phiếu xuất là chữ tự do cho tới khi có danh mục khách hàng.
- Giá xuất tính **bình quân di động** theo kho tại thời điểm ghi sổ; tính lại bình quân cuối tháng và FIFO theo lô chưa làm.
- Loại nhập và loại xuất (nhập mua, xuất bán, điều chuyển…) còn là chữ chọn, sẽ thành danh mục "Loại nhập xuất".
