# Phiếu xuất kho

Tài liệu đầy đủ về **phiếu xuất kho** (`inv_issue`): cách dùng, trạng thái và phê duyệt, cách ghi sổ kho khi xuất, từng bảng và từng cột, xóa phiếu, API, thông báo lỗi, cách cài đặt và kiểm tra. Đọc được độc lập; các phần chung với phiếu nhập kho chỉ nhắc ngắn kèm chỉ dẫn sang `docs/kho/so-kho-va-phieu-nhap-kho.md` (mô tả sâu sổ kho và ba bảng tồn).

Nội dung:

1. [Tổng quan](#1-tổng-quan)
2. [Màn hình](#2-màn-hình)
3. [Trạng thái và thao tác](#3-trạng-thái-và-thao-tác)
4. [Luồng từng bước và những gì hệ thống kiểm tra](#4-luồng-từng-bước-và-những-gì-hệ-thống-kiểm-tra)
5. [Ghi sổ xuất kho: trừ tồn và tính giá vốn](#5-ghi-sổ-xuất-kho-trừ-tồn-và-tính-giá-vốn)
6. [Các bảng dữ liệu](#6-các-bảng-dữ-liệu)
7. [Xóa phiếu và dữ liệu đi kèm](#7-xóa-phiếu-và-dữ-liệu-đi-kèm)
8. [Quyền, phê duyệt, số phiếu, khóa sổ](#8-quyền-phê-duyệt-số-phiếu-khóa-sổ)
9. [API](#9-api)
10. [Thông báo lỗi thường gặp](#10-thông-báo-lỗi-thường-gặp)
11. [Cài đặt, vận hành và cách kiểm tra](#11-cài-đặt-vận-hành-và-cách-kiểm-tra)
12. [Giới hạn hiện tại](#12-giới-hạn-hiện-tại)
13. [Các tệp mã nguồn](#13-các-tệp-mã-nguồn)

---

## 1. Tổng quan

Phiếu xuất kho là chứng từ **lấy hàng ra khỏi kho**: bán hàng, xuất nguyên vật liệu cho sản xuất, xuất hàng mẫu hoặc khuyến mãi, hủy hàng. Nó làm **cùng kiến trúc** với phiếu nhập kho (cùng màn hình, trạng thái, quyền, phê duyệt, đánh số, khóa sổ, nhật ký, chống ghi đè) và chỉ khác phần đối tác và chiều ghi sổ.

| | |
|---|---|
| Mã chức năng | `inv_issue` (menu Kho hàng → Phiếu xuất kho) |
| Màn phê duyệt | `inv_approve_issue` |
| Số chứng từ | Loại `PXK`: `PXK-<đơn vị>-<yyyymm>-<số>`, ví dụ `PXK-DVCS01-202703-0001` |
| Bảng | `erp_goods_issue` (đầu phiếu), `erp_goods_issue_line` (dòng) |
| Chiều ghi sổ | Xuất: **trừ** tồn qua dịch vụ sổ kho `IStockLedger` |
| API | `/api/inventory/goods-issues` |

Ba điều cần nhớ:

- **Phiếu chỉ là chứng từ; sổ kho mới là sự thật về tồn.** Lập, sửa, gửi duyệt, duyệt phiếu xuất **không** làm đổi tồn và **không** kiểm tồn. Chỉ khi **Ghi sổ** thì phiếu mới trừ tồn, và lúc đó mới bị từ chối nếu không đủ hàng.
- **Giá vốn do sổ kho tính, không lấy từ phiếu.** Đơn giá và thành tiền trên phiếu xuất chỉ là giá xuất để in và tham khảo. Giá vốn thật của từng dòng là cột `value` (số âm) của dòng sổ kho.
- **Không dùng khóa ngoại.** Phiếu liên kết với danh mục bằng **mã** có chỉ mục; hệ thống kiểm tra mã có thật khi lưu và không cho xóa vật tư, đơn vị tính, kho đang được phiếu dùng.

Đã có đủ: lập, sửa, gửi duyệt, duyệt nhiều cấp, từ chối, rút lại, ghi sổ trừ tồn, bỏ ghi sổ, hủy, xóa, in phiếu, xuất Excel, nhật ký, chống ghi đè. Chưa có: danh mục khách hàng (khách hàng là chữ tự do), số lô và vị trí chọn từ danh mục, phân trang phía máy chủ (mục 12).

---

## 2. Màn hình

### 2.1. Danh sách phiếu

Hiện các phiếu của **đơn vị cơ sở đang đăng nhập**.

- **Bộ lọc:** mã phiếu, đơn vị cơ sở, loại xuất, trạng thái, kho, khoảng ngày; ô tìm nhanh theo mã, ghi chú, kho, khách hàng và mặt hàng.
- **Phạm vi xem:** người không có quyền đặc biệt `VIEW_ALL` chỉ thấy phiếu **do mình lập**.
- **Giá:** người không có quyền `VIEW_PRICE` thấy đơn giá, thành tiền và tổng giá trị bằng **0** (backend không gửi giá về, cột giá bị ẩn).
- **Nút trên từng dòng và trên form:** xem, sửa, các nút chuyển trạng thái, in phiếu, xóa; xuất Excel danh sách cần quyền Xuất.

### 2.2. Form phiếu

| Nhóm | Trường | Ghi chú |
|---|---|---|
| Đầu phiếu | Số phiếu | Tự cấp khi lưu lần đầu (`PXK-DVCS01-202703-0001`); không sửa được |
| | Ngày chứng từ | Ngày hạch toán; phải thuộc kỳ **chưa khóa sổ** |
| | Ngày lập | Ngày tạo phiếu, hệ thống điền |
| | Đơn vị cơ sở | Đơn vị đang đăng nhập |
| | Kho xuất | Chỉ kho còn hoạt động và dùng được cho đơn vị này (kho dùng chung hoặc có đơn vị này trong danh sách đơn vị sử dụng) |
| | Loại xuất | Xuất bán hàng (mặc định), xuất điều chuyển nội bộ, xuất nguyên vật liệu sản xuất, xuất hàng mẫu / khuyến mãi, xuất kiểm kê giảm / hủy. Hiện là chữ chọn, chưa là danh mục |
| | Loại tiền, tỷ giá | Tỷ giá tự lấy theo ngày chứng từ; đồng hạch toán luôn là 1 |
| | Khách hàng, người nhận hàng, ghi chú | Chữ tự do (khách hàng chưa nối danh mục) |
| Tab **Chi tiết xuất kho** | Dòng hàng (`ITEM`) | Mã vật tư, tên, đơn vị tính, số lượng, đơn giá, số lô, vị trí. **Chỉ các dòng này vào sổ kho** |
| Tab **Nguyên vật liệu** | Dòng định mức (`MATERIAL`) | Danh mục nguyên vật liệu tham chiếu. **Không** vào sổ kho và không tính vào tổng giá trị |

Cách điền dòng:

- **Vật tư và đơn vị tính chọn từ danh mục thật** (ô nhập mã + cửa sổ tra cứu F2). Tên vật tư lấy từ danh mục khi lưu. Dòng hàng phải là vật tư **tồn kho** (`is_stock_item`) và đang dùng.
- **Đơn giá** bắt đầu bằng 0 và nhập tay (danh mục vật tư chưa có giá).
- **Số lô** bắt buộc khi ghi sổ với vật tư bật theo dõi lô; **vị trí** bắt buộc với vật tư theo dõi vị trí và phải là mã vị trí **của kho xuất**. Vật tư không theo dõi thì hai ô này chỉ là ghi chú và bị bỏ qua khi ghi sổ.

**Tổng giá trị phiếu** = tổng (số lượng × đơn giá) của các dòng `ITEM` × tỷ giá, làm tròn 2 số lẻ. Dòng `MATERIAL` không được cộng vào.

### 2.3. In và xuất Excel

- **In phiếu:** mở cửa sổ in của trình duyệt, có thể lưu thành PDF. Người không có `VIEW_PRICE` thì bản in không có cột đơn giá và thành tiền.
- **Xuất Excel:** danh sách phiếu đang lọc, tạo ngay trong trình duyệt; chỉ hiện khi có quyền Xuất.

---

## 3. Trạng thái và thao tác

```
   ┌──────── Rút lại / Từ chối ────────┐
   ▼                                    │
 Lập chứng từ ──Trình duyệt──► Chờ duyệt ──Duyệt (đủ các cấp)──► Đã duyệt ──Ghi sổ──► Đã ghi sổ
 (Draft)                       (Pending)                         (Approved)           (Posted)
   │                                                                ▲                    │
   └──Xóa (phiếu bị xóa hẳn)                                        └────Bỏ ghi sổ───────┘
   Lập chứng từ / Đã duyệt ──Hủy──► Đã hủy (Cancelled)
```

| Trạng thái | Sửa | Thao tác được phép | Quyền cần |
|---|---|---|---|
| **Lập chứng từ** (Draft) | Được | Sửa, Xóa, Trình duyệt, Hủy | Sửa: `edit`; Xóa: `delete`; Trình duyệt: `create` hoặc `edit`; Hủy: `CANCEL` |
| **Chờ duyệt** (Pending) | Phải **rút lại** trước | Duyệt, Từ chối (người duyệt, không phải người lập); Rút lại (người lập hoặc quản trị viên) | Duyệt: `approve`; trên màn phê duyệt là quyền Duyệt |
| **Đã duyệt** (Approved) | Không | Ghi sổ, Hủy | Ghi sổ: quyền đặc biệt `POST`; Hủy: `CANCEL` |
| **Đã ghi sổ** (Posted) | Không | Bỏ ghi sổ | Quyền đặc biệt `UNPOST` |
| **Đã hủy** (Cancelled) | Không | Không | — |

Quy tắc chung (bộ `DocumentStatusPolicy`; bản sao ở frontend `utils/documentPolicy.ts`, hai bên được kiểm bằng cùng một bộ ca thử):

- Mọi thao tác trừ Duyệt và Từ chối cần quyền **Xem**; người không có `VIEW_ALL` chỉ thao tác trên phiếu mình lập.
- **Không được tự duyệt phiếu do mình lập.**
- Phiếu đang chờ duyệt không sửa, không hủy được: phải **Rút lại** (hoặc bị Từ chối) để về Lập chứng từ.
- Phiếu đã ghi sổ phải **Bỏ ghi sổ** trước khi sửa hoặc hủy.
- Bộ quy tắc chung có cho sửa phiếu đã duyệt nếu có quyền `EDIT_APPROVED` (chờ duyệt: `EDIT_PENDING`), nhưng **dịch vụ phiếu xuất hiện chỉ cho sửa khi phiếu đang Lập chứng từ**. Cần đổi phiếu đã duyệt thì hủy và lập phiếu mới.

---

## 4. Luồng từng bước và những gì hệ thống kiểm tra

**Lưu thẳng ở một trạng thái.** Quy trình duyệt vẫn còn, nhưng người có quyền tới trạng thái nào thì lưu phiếu ở trạng thái đó được. Giống phiếu nhập: trường **"Trạng thái"** trong khối II (Chứng từ & tiền tệ) của form là ô chọn khi lập phiếu mới hoặc sửa phiếu nháp (chỉ chọn được khi người dùng có hơn một lựa chọn; còn không thì ô chỉ hiển thị trạng thái), và nút lưu đổi tên theo lựa chọn ("Lưu và chờ duyệt", "Lưu và đã phê duyệt", "Lưu và chuyển sổ kho"). Nút **Lưu Nháp** luôn có và luôn lưu ở **Lập chứng từ**, dù ô Trạng thái đang chọn gì:

| Lựa chọn | Người dùng cần | Hệ thống làm |
|---|---|---|
| Lập chứng từ | luôn có | chỉ lưu |
| Chờ duyệt | quyền Thêm hoặc Sửa | lưu rồi gửi duyệt như bấm Trình duyệt (dựng các cấp, thông báo người duyệt) |
| Đã phê duyệt | quyền **Duyệt** và là người duyệt của **mọi cấp** theo quy tắc phê duyệt (quản trị viên luôn đạt) | lưu rồi ghi một vòng duyệt, mỗi cấp một dòng đã duyệt bởi chính người lưu; nhật ký ghi gửi và duyệt, ghi chú "Lưu thẳng ở trạng thái đã duyệt…" |
| Chuyển sổ kho | như Đã phê duyệt **cộng** quyền đặc biệt `POST` | lưu, duyệt rồi ghi sổ |

Tất cả chạy trong **một transaction**: bước nào bị từ chối (thiếu quyền, không phải người duyệt cấp nào đó, không đủ tồn, kỳ đã khóa) thì **cả lần lưu bị hủy**, phiếu không bao giờ bị dở dang. Sửa một phiếu nháp rồi lưu ở trạng thái cao hơn cũng được. API: thêm `"targetStatus": "Pending" | "Approved" | "Posted"` vào nội dung lập / sửa phiếu. Nút Duyệt trên phiếu của người khác vẫn không cho tự duyệt phiếu mình lập; chỉ lưu thẳng ở Đã phê duyệt mới cho người lập tự duyệt, nên **ai không nên tự duyệt thì đừng cấp quyền Duyệt**.

### 4.1. Lập phiếu

1. Quyền `create` trên `inv_issue`.
2. **Khóa sổ:** ngày chứng từ không nằm trong tháng đã khóa của đơn vị (`sys_fiscal_period`) và không trước ngày bắt đầu nhập liệu của đơn vị.
3. **Kho:** tồn tại, còn hoạt động và dùng được cho đơn vị của phiếu.
4. **Tiền tệ:** còn hoạt động; tỷ giá lấy theo ngày chứng từ (ngày gần nhất không sau ngày chứng từ), chưa khai thì báo "Chưa có tỷ giá …".
5. **Dòng hàng:** có ít nhất 1 dòng `ITEM`; tối đa 500 dòng cả hai tab; mỗi dòng **số lượng > 0**, **đơn giá ≥ 0**; mã vật tư và đơn vị tính phải có trong danh mục và còn dùng; dòng `ITEM` phải là vật tư tồn kho; vật tư theo dõi vị trí mà có nhập vị trí thì vị trí phải thuộc kho xuất.
6. **Cấp số phiếu** trong cùng giao dịch lưu: lưu lỗi thì số được trả lại, không bao giờ trùng.
7. Lưu đầu phiếu và dòng, ghi **nhật ký** (kèm tóm tắt dòng hàng). Tên vật tư lấy từ danh mục tại lúc lưu.

### 4.2. Sửa phiếu

Chỉ khi **Lập chứng từ**. Kiểm lại khóa sổ (cả ngày cũ và ngày mới), kho, tiền tệ, dòng như trên; kiểm **phiên bản** để không ghi đè người khác sửa cùng lúc (báo "bản ghi đã bị thay đổi", mã 409). Các dòng cũ được thay bằng dòng mới; nhật ký ghi "trước → sau" của danh sách dòng.

### 4.3. Trình duyệt, duyệt, từ chối, rút lại

- **Trình duyệt** (`submit`): chỉ người lập, phiếu đang Lập chứng từ. Hệ thống áp **quy tắc phê duyệt** của `inv_issue` theo đơn vị và **tổng giá trị phiếu** để dựng các cấp: mỗi cấp một dòng `sys_document_approval`, cấp đầu `PENDING`, các cấp sau `WAITING`. Thiếu người duyệt ở một cấp thì báo lỗi và không gửi. Người duyệt nhận thông báo. Phiếu thành **Chờ duyệt**.
- **Duyệt** (`approve`): người duyệt của cấp hiện tại, không phải người lập. Xong cấp nào thì mở cấp kế; **đủ mọi cấp** thì phiếu thành **Đã duyệt**, ghi người duyệt cuối và người lập nhận thông báo.
- **Từ chối** (`reject`): bắt buộc nhập lý do; các cấp còn chờ bị hủy, phiếu về Lập chứng từ, người lập nhận thông báo kèm lý do. Sau đó sửa và trình lại (lần trình mới tăng `round`).
- **Rút lại** (`withdraw`): người lập (hoặc quản trị viên) khi phiếu đang chờ duyệt; các cấp đang mở bị hủy, phiếu về Lập chứng từ.

Phần duyệt dùng chung với phiếu nhập qua `DocumentApprovalService` và giao diện `IApprovableDocument` (đọc người lập, đơn vị, tổng giá trị và đổi trạng thái phiếu). Số tiền hiện trên màn phê duyệt chỉ hiển thị cho người có quyền `VIEW_PRICE` của `inv_issue`.

### 4.4. Ghi sổ

1. Cần quyền đặc biệt `POST` và phiếu ở **Đã duyệt**; kiểm lại khóa sổ.
2. Dựng lệnh ghi sổ **xuất** từ các dòng `ITEM` theo thứ tự dòng. Mỗi dòng gửi: mã vật tư, số lượng, **mã đơn vị tính**, số lô và vị trí (**chỉ** với vật tư bật theo dõi lô / vị trí). **Không gửi giá trị.**
3. Gọi `IStockLedger.PostAsync`: kiểm tra từng dòng, ghi sổ và trừ ba bảng tồn trong **một giao dịch** (mục 5). Dòng nào sai thì **cả phiếu không ghi** và phiếu vẫn ở Đã duyệt.
4. Phiếu chuyển **Đã ghi sổ**.

### 4.5. Bỏ ghi sổ

Cần quyền `UNPOST`, phiếu **Đã ghi sổ**, kiểm khóa sổ. Dịch vụ sổ kho **ghi dòng đảo** (dương) cho mọi dòng sổ đang hiệu lực của phiếu và cộng lại ba bảng tồn đúng bằng những gì đã trừ, cả số lượng lẫn giá trị. Phiếu về **Đã duyệt**. Bỏ ghi sổ phiếu xuất luôn làm được (chỉ làm tồn tăng lại). Ghi sổ lại lần sau tăng `posting_seq` của dòng sổ.

### 4.6. Hủy và xóa

- **Hủy** (`cancel`): cần quyền `CANCEL`; chỉ khi chưa ghi sổ và không đang chờ duyệt (phiếu chờ duyệt phải rút lại trước). Phiếu thành **Đã hủy**, vẫn còn trong danh sách.
- **Xóa:** chỉ phiếu **Lập chứng từ**, cần quyền `delete` và kiểm khóa sổ. Xóa hẳn đầu phiếu và dòng (xem mục 7).

---

## 5. Ghi sổ xuất kho: trừ tồn và tính giá vốn

Phiếu xuất dùng nhánh **xuất** (`StockDirection.Out`) của dịch vụ sổ kho. Nguyên tắc đầy đủ của sổ ở `so-kho-va-phieu-nhap-kho.md` mục 4; riêng với phiếu xuất:

**Thứ tự và khóa.** Các dòng được áp theo thứ tự vật tư, lô, vị trí để tránh khóa chéo. Mỗi dòng tồn được khóa `SELECT … FOR UPDATE` **trước khi đọc**: hai phiếu cùng xuất từ một dòng tồn sẽ xếp hàng chứ không cùng lấy hàng. (Đã thử: 10 phiếu xuất 2 đơn vị cùng lúc từ tồn 6 thì đúng 3 phiếu thành công, tồn không âm.)

**Kiểm tồn.** Số lượng xuất so với tồn **tại thời điểm ghi sổ**. Thiếu hàng thì từ chối "Không đủ tồn kho: vật tư X tại kho Y chỉ còn n" và **không dòng nào được ghi**. Đơn vị bật tham số `allowNegativeStock` thì được phép tồn âm (không khuyến nghị).

**Giá vốn: bình quân di động theo kho.** Giá trị xuất của một dòng = `giá trị tồn × số lượng xuất ÷ số lượng tồn`, làm tròn 2 số lẻ; xuất **hết** số tồn thì lấy trọn giá trị còn lại (không để dư số lẻ). Tồn rỗng hoặc âm thì giá trị xuất là 0. Dòng sổ có `quantity` âm và `value` âm; cả hai bảng tồn theo kho giảm đúng bằng đó.

**Lô.** Vật tư theo dõi lô **bắt buộc** có số lô đang có; lô **bị khóa** thì không xuất được; lô **hết hạn** (so với ngày chứng từ) không xuất được. Tồn của lô phải đủ, không đủ thì cũng báo "Không đủ tồn kho". Vật tư không theo dõi lô thì số lô trên dòng bị bỏ qua.

**Vị trí.** Vật tư theo dõi vị trí bắt buộc vị trí thuộc kho xuất; bảng tồn theo vị trí bị trừ tương ứng.

**Đơn vị tính.** Dòng dùng đơn vị khác đơn vị gốc của vật tư thì được quy đổi qua `erp_uom_conversion`; sổ lưu số lượng đã quy về đơn vị gốc, kèm đơn vị và số lượng của dòng phiếu (`line_uom_code`, `line_quantity`). Không có quy đổi thì từ chối.

**Dòng sổ ghi ra** (`erp_stock_movement`) cho mỗi dòng `ITEM`: `source_function = 'inv_issue'`, `source_id` = id phiếu, `source_line_id` = id dòng, `quantity` âm, `value` âm, đơn vị / kho / vật tư / lô / vị trí, `posting_seq` = 1 (tăng khi ghi sổ lại sau bỏ ghi sổ).

### 5.1. Ví dụ chạy số

Đã chạy thật trên dữ liệu dev (ngày chứng từ năm 2027):

1. Phiếu nhập 10 cái vật tư `AUD-SNY-XM5` đơn giá 100.000 → ghi sổ: tồn **10**, giá trị **1.000.000**.
2. Lập phiếu xuất 4 cái, đơn giá xuất 150.000, rồi **sửa** thành 5 cái (tổng giá trị trên phiếu 750.000). Phiếu chưa đụng tới tồn.
3. Ghi sổ phiếu xuất khi chưa duyệt → bị chặn ("Chỉ ghi sổ phiếu đã duyệt; cần quyền Ghi sổ"). Sau khi duyệt, ghi sổ → dòng sổ **−5, giá trị −500.000** (bình quân 1.000.000 ÷ 10 = 100.000 mỗi cái, **không** phải 150.000 trên phiếu); tồn còn **5**, giá trị **500.000**.
4. Phiếu xuất khác 20 cái → ghi sổ bị từ chối "Không đủ tồn kho: vật tư … chỉ còn 5 CAI"; tồn vẫn 5.
5. Sửa hoặc xóa phiếu đã ghi sổ → bị chặn ("phải bỏ ghi sổ trước khi sửa / hủy").
6. Bỏ ghi sổ phiếu xuất → phiếu về Đã duyệt, tồn trở lại **10** và **1.000.000**; `GET /api/inventory/stock/verify` trả danh sách rỗng (không lệch).

---

## 6. Các bảng dữ liệu

Script: `ServerService/sql/postgresql/39-inventory-goods-issues.sql` (chạy sau 20 và 34), `40-inventory-voucher-line-references.sql` (dòng trỏ tới danh mục), `41-voucher-delete-trigger.sql` (xóa phiếu). Mọi bảng có bốn cột dấu vết `created_at`, `created_by`, `updated_at`, `updated_by` (hệ thống tự điền) và phiên bản `xmin` của PostgreSQL (chống ghi đè).

### 6.1. `erp_goods_issue` — đầu phiếu

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigint, khóa chính | Mã nội bộ của phiếu |
| `code` | varchar(64), **duy nhất** | Số phiếu `PXK-<đơn vị>-<yyyymm>-<số>`. Duy nhất toàn hệ thống nên mẫu số bắt buộc có `{DVCS}` |
| `unit_code` | varchar(20) | Đơn vị cơ sở lập phiếu → `sys_company_unit.code` |
| `document_date` | date | Ngày chứng từ (ngày hạch toán, kiểm khóa sổ theo ngày này) |
| `created_date` | date | Ngày lập phiếu |
| `warehouse_code` | varchar(20) | Kho xuất → `erp_warehouse.code` |
| `voucher_type` | varchar(100) | Loại xuất (chữ) |
| `currency_code` | varchar(10) | Loại tiền → `sys_currency.code`, mặc định `VND` |
| `exchange_rate` | numeric(18,6) | Tỷ giá đã chốt lúc lưu (1 với đồng hạch toán); ràng buộc > 0 |
| `customer_name` | varchar(200) | Khách hàng (chữ tự do) |
| `receiver_name` | varchar(200) | Người nhận hàng |
| `note` | varchar(1000) | Ghi chú |
| `status` | varchar(20) | `Draft`, `Pending`, `Approved`, `Posted`, `Cancelled` (ràng buộc CHECK) |
| `total_value` | numeric(18,2) | Tổng giá xuất của các dòng `ITEM` theo **đồng hạch toán** (đã nhân tỷ giá), để tham khảo |
| `approved_by_user_id` | integer | Người duyệt cuối |

Chỉ mục: `(unit_code, document_date desc)`, `warehouse_code`, `currency_code`. Mã nguồn khai `unit_code`, `warehouse_code`, `currency_code` bằng `[References<…>]`: không xóa được đơn vị, kho, loại tiền đang có phiếu xuất.

### 6.2. `erp_goods_issue_line` — dòng phiếu

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigint, khóa chính | Mã dòng; **chính là `source_line_id` của sổ kho** khi ghi sổ |
| `issue_id` | bigint | Phiếu chứa dòng → `erp_goods_issue.id` |
| `kind` | `ITEM` / `MATERIAL` | `ITEM` = hàng xuất (vào sổ); `MATERIAL` = định mức nguyên vật liệu (không vào sổ) |
| `line_no` | integer | Số thứ tự trong từng `kind` |
| `material_code` | varchar(64) | Mã vật tư → `erp_material.code` (viết hoa khi lưu). Phải là vật tư đang dùng; dòng `ITEM` phải là vật tư tồn kho |
| `material_name` | varchar(200) | Tên vật tư lúc lưu phiếu, **lấy từ danh mục** (phiếu cũ không đổi khi đổi tên vật tư) |
| `uom_code` | varchar(30) | Đơn vị tính của dòng → `erp_uom.code`: đơn vị gốc của vật tư hoặc đơn vị có quy đổi |
| `quantity` | numeric(18,4) | Số lượng, > 0 |
| `unit_price` | numeric(18,4) | Giá xuất theo loại tiền của phiếu, ≥ 0 (không vào sổ) |
| `amount` | numeric(18,2) | Thành tiền = số lượng × đơn giá |
| `lot_number` | varchar(64) | Số lô (chỉ có nghĩa với vật tư theo dõi lô) |
| `position` | varchar(100) | Vị trí lưu (chỉ có nghĩa với vật tư theo dõi vị trí; nhập **mã vị trí**) |

Ràng buộc: `(issue_id, kind, line_no)` duy nhất; `kind` thuộc `ITEM`, `MATERIAL`; `quantity > 0`; `unit_price ≥ 0`. Chỉ mục theo `issue_id`, `material_code`, `uom_code` (xóa vật tư hoặc đơn vị tính tra các cột này nên vật tư đã có dòng phiếu xuất không xóa được). Sửa phiếu thì xóa hết dòng cũ và thêm lại nên `id` dòng đổi, vì vậy chỉ dòng của phiếu **đã ghi sổ** mới gắn với sổ, và phiếu đã ghi sổ không sửa được.

### 6.3. Sổ kho và bảng tồn mà phiếu xuất làm thay đổi

| Bảng | Phiếu xuất làm gì |
|---|---|
| `erp_stock_movement` | Thêm một dòng **âm** cho mỗi dòng `ITEM` (và dòng dương khi bỏ ghi sổ) |
| `erp_stock_balance` | Trừ số lượng và giá trị theo (đơn vị, kho, vật tư) |
| `erp_stock_lot_balance` | Trừ số lượng theo lô (vật tư bật `track_lot`) |
| `erp_stock_location_balance` | Trừ số lượng theo vị trí (vật tư bật `track_location`) |

Ba bảng tồn luôn bằng tổng của sổ; `GET /api/inventory/stock/verify` kiểm, `POST .../rebuild` dựng lại (xem `so-kho-va-phieu-nhap-kho.md` mục 8.3).

### 6.4. Bảng hệ thống mà phiếu dùng chung

| Bảng | Vai trò với phiếu xuất |
|---|---|
| `sys_voucher_numbering`, `sys_voucher_sequence` | Cấp số `PXK` theo đơn vị và tháng, không trùng |
| `sys_fiscal_period` | Tháng đã khóa thì không lập, sửa, xóa, ghi sổ, bỏ ghi sổ |
| `sys_approval_rule`, `sys_document_approval` | Quy tắc duyệt của `inv_issue` và tiến trình từng cấp (khóa theo `menuid0` + số phiếu) |
| `sys_audit_log` | Nhật ký tạo, sửa, xóa phiếu (chức năng `inv_issue`, đối tượng `goodsIssue`), kèm thay đổi dòng hàng |
| `sys_command`, `sys_role_command`, `sys_user_command`, `sys_role_right`, `sys_user_right` | Quyền chức năng và quyền đặc biệt |
| `sys_exchange_rate`, `sys_currency` | Tỷ giá theo ngày chứng từ |

---

## 7. Xóa phiếu và dữ liệu đi kèm

Nút **Xóa** chỉ có với phiếu **Lập chứng từ**; phiếu đã gửi duyệt, đã duyệt hoặc đã ghi sổ thì dịch vụ từ chối trước khi chạm database ("Chỉ được xóa phiếu xuất kho đang ở trạng thái lập chứng từ").

Ở database, trigger `trg_erp_goods_issue_delete` (script 41, hàm `erp_voucher_delete_cleanup`) là chốt chặn cuối, kể cả khi ai đó xóa trực tiếp bằng SQL:

| Tình trạng phiếu khi xóa | Kết quả |
|---|---|
| **Còn ghi sổ** (sổ của phiếu, cộng theo kho / vật tư / lô / vị trí, chưa về 0) | **Từ chối**: "Phiếu … đang ghi sổ kho: phải bỏ ghi sổ trước khi xóa". Nếu cho xóa dòng sổ lúc này thì ba bảng tồn lệch so với sổ |
| **Chưa từng ghi sổ** | Xóa mọi dòng chi tiết `erp_goods_issue_line`; không có dòng sổ nào |
| **Đã bỏ ghi sổ** (sổ chỉ còn các cặp dòng ghi và dòng đảo, cộng lại bằng 0) | Xóa dòng chi tiết **và toàn bộ dòng sổ** của phiếu. Ba bảng tồn **không đổi** vì tổng của phiếu bằng 0, không cần tính lại |

Được giữ lại: lịch sử duyệt (`sys_document_approval`) và nhật ký thay đổi (`sys_audit_log`), làm bằng chứng. Cùng cơ chế áp dụng cho `erp_goods_receipt`. Chi tiết và kết quả thử ở `so-kho-va-phieu-nhap-kho.md` mục 3.5.

---

## 8. Quyền, phê duyệt, số phiếu, khóa sổ

**Quyền chức năng `inv_issue`** (7 thao tác): Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất Excel. API: `POST` cần Thêm, `PUT` cần Sửa, `DELETE` cần Xóa, `GET` cần Xem. Màn phê duyệt có chức năng riêng `inv_approve_issue`.

**Quyền đặc biệt** (cấp ở Cài đặt › Người dùng và phân quyền):

| Quyền | Cho phép |
|---|---|
| `VIEW_PRICE` | Xem đơn giá, thành tiền, tổng giá trị trên phiếu và trên màn phê duyệt |
| `VIEW_COST` | Xem giá vốn (cột giá trị của sổ kho ở báo cáo `inv_report_stock`) |
| `VIEW_ALL` | Xem và thao tác phiếu của người khác lập |
| `EDIT_PENDING`, `EDIT_APPROVED` | Có trong bộ quy tắc chung nhưng dịch vụ phiếu xuất chưa dùng (chỉ sửa phiếu Lập chứng từ) |
| `POST` | Ghi sổ |
| `UNPOST` | Bỏ ghi sổ |
| `CANCEL` | Hủy phiếu |

Quyền hiệu lực = quyền của vai trò cộng ngoại lệ của người dùng; quản trị viên có tất cả. `GrantGuard` không cho người không phải quản trị cấp quyền mà chính họ không có.

**Quy tắc phê duyệt:** Cài đặt › Người dùng và phân quyền › Quy tắc phê duyệt, chọn chức năng **Phiếu xuất kho**. Mỗi quy tắc nói: phiếu do ai lập (mọi người, một người, một vai trò hoặc một phòng ban), ở đơn vị nào (trống = mọi đơn vị), **từ số tiền tối thiểu** bao nhiêu thì ở cấp nào do ai duyệt; các cấp chạy theo thứ tự. Số tiền dùng để chọn cấp là `total_value` của phiếu, vì vậy phiếu có đơn giá 0 sẽ rơi vào nhóm giá trị thấp nhất. Người lập không được duyệt phiếu của mình.

**Số phiếu:** loạt `PXK` ở Cài đặt › Tham số mặc định & đánh số chứng từ; mẫu mặc định `{PREFIX}-{DVCS}-{YYYY}{MM}-{SEQ}` (bắt buộc có `{DVCS}` để số không trùng giữa các đơn vị).

**Khóa sổ:** Cài đặt › Năm tài chính & khóa sổ. Tháng đã khóa thì không lập, sửa, xóa, ghi sổ, bỏ ghi sổ phiếu có ngày chứng từ trong tháng đó. Dữ liệu dev có toàn bộ các tháng 2026 của DVCS01 đã khóa nên phiếu thử dùng ngày năm 2027.

---

## 9. API

Tiền tố `/api/inventory/goods-issues`. Mọi API cần đăng nhập và đúng đơn vị của token.

| Phương thức, đường dẫn | Việc | Quyền |
|---|---|---|
| `GET /` | Danh sách phiếu của đơn vị (không có `VIEW_ALL` thì chỉ phiếu mình lập) | Xem |
| `GET /options` | Kho dùng được cho đơn vị và các loại tiền đang dùng | Xem |
| `GET /{id}` | Một phiếu | Xem |
| `POST /` | Lập phiếu | Thêm |
| `PUT /{id}` | Sửa phiếu Lập chứng từ (kèm `version`) | Sửa |
| `POST /{id}/submit` | Trình duyệt | Thêm hoặc Sửa |
| `POST /{id}/approve` | Duyệt cấp hiện tại | Duyệt |
| `POST /{id}/post` | Ghi sổ | `POST` |
| `POST /{id}/unpost` | Bỏ ghi sổ | `UNPOST` |
| `POST /{id}/cancel` | Hủy | `CANCEL` |
| `POST /{id}/withdraw` | Rút lại khỏi duyệt | Người lập |
| `POST /{id}/reject` | Từ chối, body `{ "note": "lý do" }` | Duyệt |
| `DELETE /{id}` | Xóa phiếu Lập chứng từ | Xóa |

Quyền của các thao tác chuyển trạng thái do `DocumentStatusPolicy` quyết định theo trạng thái và người thao tác. Đường dẫn dùng tên `operation`, **không** dùng `action` (tên dành riêng của ASP.NET Core, route sẽ không bao giờ khớp). API duyệt dùng chung: `/api/approvals/inv_issue/{số phiếu}/...` (màn Phê duyệt xuất kho gọi các API này).

**Nội dung lập / sửa phiếu** (`POST`, `PUT`):

```json
{
  "date": "2027-03-06",
  "warehouseCode": "KHO-HCM",
  "voucherType": "Xuất bán hàng",
  "currencyCode": "VND",
  "exchangeRate": 1,
  "customerName": "Công ty ABC",
  "receiverName": "Nguyễn Văn A",
  "note": "Giao đợt 1",
  "items": [
    { "kind": "ITEM", "materialCode": "AUD-SNY-XM5", "uomCode": "CAI",
      "quantity": 5, "unitPrice": 150000, "lotNumber": null, "position": null }
  ],
  "materialItems": [],
  "version": 12345
}
```

`targetStatus` (không bắt buộc): `Pending`, `Approved` hoặc `Posted` để lưu thẳng ở trạng thái đó nếu đủ quyền (mục 4). `version` chỉ gửi khi sửa (lấy từ phiếu đã tải; sai phiên bản thì 409). `exchangeRate` do server tính lại theo ngày chứng từ. Phản hồi là phiếu đầy đủ: các trường trên cộng `id`, `code`, `unitName`, `warehouseName`, `status`, `totalValue`, `createdBy`, `approvedBy`, `items`, `materialItems` (mỗi dòng có `id`, `materialName`, `amount`) và `version`. Người không có `VIEW_PRICE` nhận `unitPrice`, `amount`, `totalValue` bằng 0.

Xem sổ của một phiếu: `GET /api/inventory/stock/movements?sourceFunction=inv_issue&sourceId=<id phiếu>` (giá trị cần quyền `VIEW_COST`).

---

## 10. Thông báo lỗi thường gặp

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| Kỳ tháng MM/YYYY của đơn vị … đã khóa sổ | Ngày chứng từ nằm trong tháng đã khóa | Đổi ngày hoặc mở khóa ở Cài đặt › Năm tài chính & khóa sổ |
| Kho xuất không tồn tại hoặc đã ngừng sử dụng | Mã kho sai hoặc kho đã ngừng | Chọn kho khác |
| Kho X không dành cho đơn vị cơ sở Y | Kho chỉ dành cho một số đơn vị | Chọn kho khác hoặc thêm đơn vị vào danh mục kho |
| Loại tiền không tồn tại hoặc đã ngừng sử dụng | Mã tiền sai hoặc đã ngừng | Chọn loại tiền khác |
| Chưa có tỷ giá … | Phiếu ngoại tệ nhưng chưa khai tỷ giá | Khai ở Cài đặt › Tỷ giá |
| Phiếu xuất kho cần ít nhất một dòng hàng | Tab hàng trống | Thêm dòng hàng |
| Một phiếu xuất kho chỉ được tối đa 500 dòng | Quá nhiều dòng | Tách thành nhiều phiếu |
| Số lượng phải lớn hơn 0 và đơn giá không được âm | Dòng nhập sai số | Sửa số lượng, đơn giá |
| Vật tư X không tồn tại hoặc đã ngừng sử dụng | Mã vật tư sai | Chọn từ danh mục vật tư |
| Vật tư X không phải vật tư tồn kho nên không nhập / xuất kho được | Dòng hàng là vật tư không tồn kho | Dùng vật tư tồn kho hoặc đổi cờ ở danh mục vật tư |
| Đơn vị tính X của vật tư Y không tồn tại hoặc đã ngừng sử dụng | Đơn vị tính sai | Chọn đơn vị tính còn dùng |
| Vị trí X không thuộc kho Y | Vật tư theo dõi vị trí nhập vị trí sai kho | Chọn vị trí của kho xuất |
| Vật tư X theo dõi theo lô nên phải nhập số lô | Thiếu số lô khi ghi sổ | Nhập số lô đang còn tồn |
| Lô … đang bị khóa / đã hết hạn | Lô không xuất được | Dùng lô khác |
| **Không đủ tồn kho: vật tư X tại kho Y chỉ còn n** | Tồn hiện tại ít hơn số xuất khi ghi sổ | Giảm số lượng, nhập kho trước, chọn kho khác (hoặc bật tồn âm, không khuyến nghị) |
| Rút phiếu khỏi quy trình duyệt trước khi sửa phiếu xuất kho | Sửa phiếu không ở Lập chứng từ | Rút lại hoặc từ chối rồi sửa |
| Cần rút phiếu khỏi quy trình duyệt trước khi hủy | Hủy phiếu đang chờ duyệt | Rút lại trước |
| Chỉ được xóa phiếu xuất kho đang ở trạng thái lập chứng từ | Xóa phiếu đã gửi duyệt hoặc đã ghi sổ | Rút lại, bỏ ghi sổ hoặc hủy |
| Phiếu đã ghi sổ; phải bỏ ghi sổ trước khi sửa / hủy | Sửa hoặc hủy phiếu đã ghi sổ | Bỏ ghi sổ trước |
| Chỉ ghi sổ phiếu đã duyệt; cần quyền "Ghi sổ" | Ghi sổ phiếu chưa duyệt hoặc thiếu quyền | Duyệt phiếu, cấp quyền `POST` |
| Không được tự duyệt phiếu do mình lập | Người lập bấm Duyệt | Nhờ người khác duyệt |
| Chỉ được thao tác trên phiếu do mình lập | Không có `VIEW_ALL` | Cấp quyền hoặc dùng tài khoản người lập |
| Bản ghi đã bị thay đổi (409) | Người khác vừa sửa phiếu | Tải lại phiếu rồi sửa |
| Chứng từ đã được ghi sổ kho | Ghi sổ lần hai | Không cần làm gì |
| Không tìm thấy phiếu xuất kho | Sai số phiếu hoặc phiếu thuộc đơn vị khác | Kiểm tra lại đơn vị đang đăng nhập |

---

## 11. Cài đặt, vận hành và cách kiểm tra

### 11.1. Cài đặt

1. Chạy các script `ServerService/sql/postgresql/` theo thứ tự tên file (chạy lại được): `20`, `34` (sổ kho), `39` (phiếu xuất), `40` (dòng trỏ tới danh mục), `41` (trigger xóa phiếu).
2. Khởi động backend; chức năng `inv_issue`, `inv_approve_issue` và loạt số `PXK` tự được thêm khi khởi động.
3. Khai các danh mục phiếu dùng: đơn vị cơ sở, tiền tệ và tỷ giá, **kho** (kèm đơn vị sử dụng), đơn vị tính, **vật tư** (đặt cờ tồn kho, theo dõi lô / vị trí), vị trí lưu kho, lô.
4. Cài đặt: mẫu số chứng từ, khóa sổ, **quy tắc phê duyệt cho `inv_issue`**, tham số tồn âm của đơn vị.
5. Cấp quyền cho vai trò: quyền chức năng `inv_issue` và `inv_approve_issue`; quyền đặc biệt `POST`, `UNPOST`, `VIEW_PRICE`, `VIEW_ALL`, `CANCEL` cho đúng người.

### 11.2. Kiểm tra bằng tay (kịch bản gợi ý)

Dùng ngày chứng từ năm 2027 (dữ liệu dev đã khóa 2026).

1. Lập và ghi sổ một phiếu nhập 10 cái, đơn giá 100.000 (cần duyệt bởi người khác).
2. Lập phiếu xuất 4 cái: có số `PXK-...-0001`, trạng thái Lập chứng từ, tồn chưa đổi.
3. Sửa lên 5 cái; thử sửa với phiên bản cũ (kỳ vọng 409).
4. Trình duyệt, người khác duyệt (người lập tự duyệt phải bị chặn), ghi sổ: tồn còn 5, dòng sổ −5 / −500.000.
5. Lập phiếu xuất 20 cái, duyệt, ghi sổ: bị từ chối "Không đủ tồn kho", tồn không đổi.
6. Thử sửa, xóa phiếu đã ghi sổ: bị chặn. Bỏ ghi sổ: tồn về 10.
7. Thử một ngày thuộc tháng đã khóa: bị chặn ở lập, ghi sổ.
8. Vật tư theo dõi lô: để trống lô khi ghi sổ bị từ chối; nhập đúng lô thì tồn của lô giảm.
9. Tài khoản không có quyền Xem: gọi danh sách phải trả 403; tài khoản không có `VIEW_PRICE` thấy giá bằng 0.
10. Sau mỗi bước, `GET /api/inventory/stock/verify` phải trống.
11. Xóa dữ liệu thử; nếu xóa trực tiếp bằng SQL thì chạy `POST /api/inventory/stock/rebuild` rồi `verify` để chắc các bảng tồn khớp sổ.

Trong dev, admin không tự duyệt được phiếu của mình; khi thử bằng API có thể đặt `status = 'Approved'` bằng SQL.

---

## 12. Giới hạn hiện tại

- **Khách hàng** là chữ tự do (chưa có danh mục khách hàng); **số lô và vị trí** nhập tay, chưa chọn từ danh mục, nhưng được kiểm khi ghi sổ.
- **Loại xuất** là chữ chọn, sẽ thành danh mục "Loại nhập xuất".
- **Đơn giá bắt đầu bằng 0** vì danh mục vật tư chưa có giá bán.
- Danh sách tải **hết phiếu của đơn vị** một lần (chưa phân trang phía máy chủ); xuất Excel làm trong trình duyệt.
- Người **không có `VIEW_PRICE`** thấy giá 0; nếu họ sửa và lưu phiếu nháp thì đơn giá và tổng tiền bị tính lại từ số 0 (kéo theo cấp duyệt theo số tiền có thể sai). Cần giữ đơn giá cũ khi người sửa không có quyền xem giá; chưa làm, áp dụng cả phiếu nhập.
- Chỉ sửa được phiếu **Lập chứng từ**; quyền `EDIT_PENDING`, `EDIT_APPROVED` chưa dùng.
- Duyệt, ghi sổ, bỏ ghi sổ chưa kiểm phiên bản: hai người cùng ghi sổ một phiếu thì người sau bị chặn bởi chỉ mục duy nhất của sổ kho (lỗi 409 chung).
- Giá vốn là **bình quân di động theo kho** tại lúc ghi sổ; tính lại bình quân cuối tháng và FIFO theo lô chưa làm. Chưa có màn xem giá vốn từng dòng ngay trên phiếu (có sẵn trong sổ kho qua API).
- Phiếu xuất **điều chuyển kho** (`inv_transfer_issue`) và xuất từ đơn bán hàng vẫn là dữ liệu mẫu trong trình duyệt.

---

## 13. Các tệp mã nguồn

| Lớp | Tệp |
|---|---|
| Cơ sở dữ liệu | `ServerService/sql/postgresql/39-inventory-goods-issues.sql`, `40-inventory-voucher-line-references.sql`, `41-voucher-delete-trigger.sql` |
| Thực thể | `Core.Domain/Modules/Inventory/Documents/GoodsIssues/GoodsIssue.cs` (`GoodsIssue`, `GoodsIssueLine`); giao diện duyệt chung `Core.Domain/Common/IApprovableDocument.cs` |
| Hợp đồng | `Core.Application/Modules/Inventory/Documents/GoodsIssues/GoodsIssueContracts.cs` |
| Dịch vụ | `Core.Infrastructure/Modules/Inventory/Documents/GoodsIssues/GoodsIssueService.cs`; duyệt dùng chung `Core.Infrastructure/Modules/Approvals/DocumentApprovalService.cs`; ghi sổ `Core.Infrastructure/Modules/Inventory/Stock/StockLedgerService.cs` |
| Controller | `Core/Modules/Inventory/Documents/GoodsIssues/GoodsIssuesController.cs` |
| Số phiếu | `Core.Application/Common/Documents/VoucherCatalog.cs` (`inv_issue` → `PXK`) |
| Frontend | `Frontend/src/modules/inventory/documents/goods-issues/` (`GoodsIssueView.tsx`, `api.ts`), màn phê duyệt `approval-issue/IssueApprovalView.tsx`, tra cứu `services/lookupOptions.ts` |
| Thông báo lỗi | `ServerService/Core.Application/Common/Localization/Messages.{vi,en}.json` (khóa `issue.*`, `voucherLine.*`) |

Sổ kho, ba bảng tồn, danh mục và bảng hệ thống dùng chung: `docs/kho/so-kho-va-phieu-nhap-kho.md`. Quy trình thêm chứng từ mới theo cùng kiến trúc: sao phiếu nhập hoặc phiếu xuất, implement `IApprovableDocument`, thêm vào `FindVoucherAsync` / `IsVoucherFunction` của `DocumentApprovalService` và vào `VoucherCatalog`.
