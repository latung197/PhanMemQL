# Điều chuyển kho

Điều chuyển kho chuyển hàng **giữa hai kho của cùng một đơn vị cơ sở**. Có ba chứng từ nối tiếp nhau, mỗi bước lấy dữ liệu từ bước trước:

```
Lệnh điều chuyển (LDC)  →  Phiếu xuất điều chuyển (PXDC)  →  Phiếu nhập điều chuyển (PNDC)
 đề nghị chuyển hàng        ghi sổ XUẤT ở kho đi              ghi sổ NHẬP ở kho đến
 (không ghi sổ)             (giá bình quân của kho đi)        (đúng giá trị của phiếu xuất)
```

Cấu trúc chứng từ giống phiếu nhập / xuất kho: trạng thái Lập chứng từ → Chờ duyệt → Đã phê duyệt → Chuyển sổ kho (và Hủy), quyền theo trạng thái theo đơn vị (`ST_*`), ô **Trạng thái** của form chọn mức lưu theo quyền, nút **Lưu Nháp**, số phiếu `{loại}-{ĐVCS}-{yyyymm}-{số}`, khóa kỳ, lưu nhật ký thay đổi, chống ghi đè (`version`), phân trang và xuất Excel ở máy chủ, in hai mẫu (có giá / không giá).

## 1. Ba chứng từ

| | Lệnh điều chuyển | Phiếu xuất điều chuyển | Phiếu nhập điều chuyển |
|---|---|---|---|
| Chức năng / mã số phiếu | `inv_transfer_order` / `LDC` | `inv_transfer_issue` / `PXDC` | `inv_transfer_receipt` / `PNDC` |
| Ghi sổ kho | Không (dừng ở Đã phê duyệt) | Có: **xuất** khỏi kho đi | Có: **nhập** vào kho đến |
| Lấy dữ liệu từ | — | Lệnh điều chuyển đã duyệt (tùy chọn) | Phiếu xuất điều chuyển **đã ghi sổ** (bắt buộc) |
| Số theo dõi trên dòng | **Đã xuất** (tổng các phiếu xuất) | **Đã nhận** (tổng các phiếu nhập) | — |
| Giá trị hàng | Không có | Do sổ kho tính khi ghi sổ | Bằng giá trị của dòng phiếu xuất tương ứng |
| Duyệt | `inv_approve_transfer` (một màn cho cả ba) | | |
| Bảng | `erp_transfer_order`, `..._line` | `erp_transfer_issue`, `..._line` | `erp_transfer_receipt`, `..._line` |

Đầu phiếu chung: **kho đi**, **kho đến** (khác nhau, đều là kho đơn vị được dùng), **lý do điều chuyển**, người liên quan (người đề nghị / người vận chuyển / người giao hàng), ghi chú; lệnh thêm **ngày cần chuyển**. Mỗi dòng: vật tư, đơn vị tính (đơn vị gốc hoặc đã quy đổi, xem `docs/kho/don-vi-tinh-vat-tu.md`), số lượng, ghi chú; phiếu xuất và phiếu nhập thêm **số lô** và **vị trí** (vị trí của kho đi trên phiếu xuất, của kho đến trên phiếu nhập).

## 2. Luồng và quy tắc

1. **Lệnh** được duyệt, rồi **phiếu xuất** bấm **Lấy từ lệnh điều chuyển** (cửa sổ hai phần: trên là các lệnh còn hàng chưa xuất, dưới là vật tư của lệnh đang bấm; tích vật tư, sửa số lượng, không vượt số còn lại). Một phiếu xuất lấy từ nhiều lệnh được nếu cùng kho đi và kho đến; lấy một phần được, phần còn lại vẫn mở. Phiếu xuất cũng lập tự do (không lấy từ lệnh) được.
2. **Phiếu xuất** ghi sổ: tồn kho đi giảm theo giá bình quân của kho; giá trị đó được **ghi ngược vào từng dòng** (đơn giá vốn, giá trị) và tổng phiếu. Thiếu tồn thì sổ kho từ chối như phiếu xuất kho. Đã ghi sổ thì hàng ở trạng thái "đang đi đường": chưa có ở kho đến.
3. **Phiếu nhập** bấm **Lấy từ phiếu xuất điều chuyển** (chỉ phiếu xuất đã ghi sổ còn hàng chưa nhận): ghi sổ nhập vào kho đến **đúng giá trị** của dòng phiếu xuất theo tỷ lệ số lượng nhận (nhận từng phần được); số lô đi theo hàng. Nhập xong tồn kho đến tăng cả số lượng lẫn giá trị, nên hàng giữ nguyên giá vốn qua kho.
4. Số **đã xuất / đã nhận** luôn do máy chủ **tính từ chứng từ sau chưa hủy** (không lưu cột riêng); sửa một phiếu thì số của chính nó không bị tính vào. Xóa hoặc hủy phiếu sau thì số tính lại.
5. Ràng buộc giữa các bước:
   - lệnh đã có phiếu xuất (chưa hủy) **không hủy được**;
   - phiếu xuất đã có phiếu nhập (chưa hủy) **không bỏ ghi sổ được**;
   - phiếu nhập phải cùng đơn vị, cùng kho đi và kho đến với phiếu xuất nó lấy, cùng vật tư và đơn vị tính, không nhận quá số còn lại.
6. Phiếu xuất và phiếu nhập đã ghi sổ sửa và xóa được với quyền `ST_EDIT_POSTED`, chỉ khi không làm âm kho (xem `docs/kho/sua-xoa-phieu-da-ghi-so.md`); phiếu xuất đã có phiếu nhập thì không sửa, không xóa. Phiếu chưa ghi sổ chỉ xóa được ở trạng thái Lập chứng từ. Xóa phiếu xuất / nhập thì trigger `erp_voucher_delete_cleanup` (script 41, gắn lại trong script 48) dọn dòng chi tiết và dấu vết sổ kho như phiếu nhập / xuất kho.

Điều chuyển **giữa hai đơn vị cơ sở** chưa làm: cả hai kho phải là kho của đơn vị đang làm việc (hoặc kho dùng chung).

## 3. Màn hình

Kho › 1. Cập nhật số liệu: **Lệnh điều chuyển kho**, **Phiếu xuất điều chuyển kho**, **Phiếu nhập điều chuyển kho**; Kho › 2. Phê duyệt: **Phê duyệt điều chuyển** (liệt kê cả ba loại chờ duyệt, duyệt hoặc từ chối kèm lý do). Cả ba là một màn dùng chung (`TransferVoucherView`, tham số `kind`).

- Danh sách: lọc theo mã, lý do, trạng thái, kho (đi hoặc đến), khoảng ngày; tìm không dấu; cột **Đã xuất / Đã nhận**; thao tác gửi duyệt, duyệt, rút, ghi sổ (biểu tượng sổ), bỏ ghi sổ, hủy, in, xóa theo quyền.
- Form: các ô kho đi / kho đến bị khóa khi phiếu đã theo lệnh hoặc phiếu xuất (lấy theo nguồn). Phiếu nhập không gõ vật tư tự do: dòng chỉ đến từ cửa sổ lấy phiếu xuất.
- Giá trị hàng (đơn giá vốn, giá trị, tổng) chỉ hiện cho người có quyền đặc biệt **Xem giá vốn** (`VIEW_COST`) của chức năng đó; không có quyền thì cũng không sắp xếp được theo cột giá trị.

## 4. Quyền

Mỗi chức năng có bảy quyền thường (xem, thêm, sửa, xóa, duyệt, in, xuất), quyền đặc biệt `VIEW_ALL` (xem phiếu của người khác; mặc định chỉ xem phiếu mình lập), `VIEW_COST` (phiếu xuất và phiếu nhập) và quyền trạng thái theo đơn vị: `ST_PENDING`, `ST_APPROVED`, `ST_CANCELLED` cho cả ba; `ST_POSTED`, `ST_UNPOST` cho phiếu xuất và phiếu nhập (lệnh không ghi sổ nên không có). Màn **Phê duyệt điều chuyển** cho quyền Duyệt của cả ba chứng từ.

## 5. API

| Việc | Đường dẫn |
|---|---|
| Danh sách, xuất Excel, tùy chọn, chi tiết, thêm, sửa, xóa | `GET/POST/PUT/DELETE api/inventory/transfer-orders`, `transfer-issues`, `transfer-receipts` (`/export`, `/options`, `/{id}`) |
| Đổi trạng thái | `POST .../{id}/submit | withdraw | approve | cancel`, và `post | unpost` cho phiếu xuất, phiếu nhập; `POST .../{id}/reject` kèm lý do |
| Lệnh còn hàng chưa xuất | `GET api/inventory/transfer-issues/open-orders?issueId=` |
| Phiếu xuất còn hàng chưa nhận | `GET api/inventory/transfer-receipts/open-issues?receiptId=` |

Lưu phiếu nhận `targetStatus` (Draft, Pending, Approved, Posted; lệnh không có Posted): máy chủ lưu nháp rồi chạy các bước trong cùng giao dịch tới mức quyền của người dùng cho phép, lỗi ở bước nào thì hủy cả lần lưu.

## 6. Mã nguồn

| Phần | Nơi |
|---|---|
| Bảng và trigger | `ServerService/sql/postgresql/48-transfers.sql` |
| Thực thể | `Core.Domain/Modules/Inventory/Documents/Transfers/Transfers.cs` |
| Hợp đồng (DTO dùng chung cho cả ba) | `Core.Application/Modules/Inventory/Documents/Transfers/TransferContracts.cs` |
| Dịch vụ | `Core.Infrastructure/Modules/Inventory/Documents/Transfers/` (`TransferOrderService`, `TransferIssueService`, `TransferReceiptService` cùng cấu trúc, `TransferProgress` tính số đã xuất / đã nhận) |
| Điều khiển | `Core/Modules/Inventory/Documents/Transfers/` |
| Màn hình | `Frontend/src/modules/inventory/documents/transfers/` (`TransferVoucherView.tsx`, `api.ts`), màn duyệt `approval-transfer/` |

Lỗi thường gặp: `transferIssue.exceedsSource`, `transferReceipt.exceedsSource`, `transferReceipt.sourceRequired`, `transferReceipt.issueNotPosted`, `transferOrder.cancelHasIssues`, `transferIssue.unpostHasReceipts`, `*.sameWarehouse`, `stock.uomNotConvertible`.
