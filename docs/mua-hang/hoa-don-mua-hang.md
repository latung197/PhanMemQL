# Hóa đơn mua hàng và công nợ phải trả

Hóa đơn mua hàng là **hóa đơn của nhà cung cấp** ghi vào hệ thống, và là căn cứ của **công nợ phải trả**. Nó nối tiếp luồng mua hàng:

```
Yêu cầu mua hàng (YCM) → Đơn mua hàng (DMH) → Phiếu nhập kho (PNK) → Hóa đơn mua hàng (HDM) → Công nợ phải trả
```

Màn hình: Mua hàng › 1. Cập nhật số liệu › **Hóa đơn Mua hàng** (`pur_invoice`, số phiếu `HDM`), màn duyệt Mua hàng › 2. Phê duyệt › **Phê duyệt hóa đơn mua hàng** (`pur_approve_invoice`), báo cáo Mua hàng › 4. Báo cáo › **Báo cáo công nợ phải trả** (`pur_report_payable`).

Hóa đơn dùng đúng khung chứng từ của các phiếu khác (xem `docs/phat-trien/them-chung-tu.md`): trạng thái Lập chứng từ → Chờ duyệt → Đã phê duyệt (và Hủy, Khôi phục), duyệt nhiều cấp theo Quy tắc phê duyệt, quyền theo trạng thái theo từng đơn vị cơ sở (`ST_*`), lưu thẳng ở trạng thái theo quyền, chống ghi đè (`version`), nhật ký thay đổi, nhập số tự động, xuất Excel, in phiếu, phân trang. **Hóa đơn không ghi sổ kho và chưa ghi sổ cái**: trạng thái dừng ở Đã phê duyệt (không có `ST_POSTED`, `ST_UNPOST`, `ST_EDIT_POSTED`).

## 1. Đầu phiếu

| Trường | Ý nghĩa |
|---|---|
| Số chứng từ | `HDM-{đơn vị}-{năm tháng}-{số}`, cấp tự động |
| Ngày chứng từ | ngày ghi nhận hóa đơn vào hệ thống (khóa sổ kiểm theo ngày này) |
| Nhà cung cấp | bắt buộc, danh mục nhà cung cấp (đang sử dụng) |
| **Số hóa đơn**, **ký hiệu**, **ngày hóa đơn** | ghi theo hóa đơn giấy hoặc điện tử của nhà cung cấp. Số hóa đơn bắt buộc, được đổi sang chữ hoa; ngày hóa đơn không được sau ngày chứng từ |
| **Hạn thanh toán** | nhập tay, hoặc để trống để máy chủ tính = ngày hóa đơn + số ngày của **điều khoản thanh toán**; không được trước ngày hóa đơn |
| Điều khoản thanh toán, dự án | danh mục (tùy chọn) |
| Thuế suất | một mã thuế cho cả hóa đơn (tùy chọn); lấy phần trăm lúc lưu |
| Loại tiền, tỷ giá | tỷ giá lấy theo ngày chứng từ |
| Loại hóa đơn | hàng hóa, dịch vụ, hàng nhập khẩu, tài sản / công cụ |
| Theo phiếu nhập kho, theo đơn mua hàng | chỉ đọc, máy chủ suy ra từ các dòng |

Tiền: **tiền hàng** (tổng các dòng, làm tròn từng dòng), **tiền thuế** (trên tổng tiền hàng), **phải trả** = (tiền hàng + thuế) × tỷ giá, quy ra tiền hạch toán. Số này (`total_value`) dùng chọn cấp duyệt theo số tiền và để cộng công nợ.

**Trùng hóa đơn:** cùng nhà cung cấp + cùng số hóa đơn + cùng ký hiệu chỉ được nhập một lần, trừ hóa đơn đã hủy (hủy rồi thì dùng lại số được; khôi phục hóa đơn đã hủy bị từ chối nếu số của nó đã được dùng).

## 2. Dòng hàng và đối chiếu với phiếu nhập, đơn mua

Dòng gồm vật tư, đơn vị tính (đơn vị gốc hoặc đơn vị quy đổi của vật tư), số lượng, đơn giá, thành tiền, ghi chú. Vật tư dịch vụ (không phải hàng tồn kho) cũng lập hóa đơn được.

Có hai nút lấy dữ liệu, cùng cửa sổ chọn như các phiếu khác (chứng từ ở trên, vật tư ở dưới, đổi số lượng nếu hóa đơn chỉ ghi một phần):

| Nút | Lấy gì | Điều kiện |
|---|---|---|
| **Lấy từ phiếu nhập kho** | dòng phiếu nhập đã **duyệt hoặc ghi sổ** còn hàng chưa lập hóa đơn | cùng nhà cung cấp và loại tiền; phiếu phải có nhà cung cấp trong danh mục |
| **Lấy từ đơn mua hàng** | dòng đơn mua đã duyệt còn hàng chưa lập hóa đơn | dùng khi hóa đơn đến trước lúc hàng về, hoặc mua dịch vụ |

- Mỗi dòng hóa đơn có `goods_receipt_line_id` và / hoặc `purchase_order_line_id`. Dòng lấy từ phiếu nhập **tự theo luôn dòng đơn mua mà phiếu nhập đó theo** (máy chủ gán, không tin dữ liệu gửi lên); dòng không lấy từ đâu là dòng tự do.
- **Số lượng đã lập hóa đơn do máy chủ tính** từ các hóa đơn chưa hủy (không lưu ở phiếu nhập hay đơn mua): hủy hoặc xóa hóa đơn thì số lượng trả lại. Lập hóa đơn quá số đã nhập (theo dòng phiếu nhập) hoặc quá số đã đặt (theo dòng đơn mua) bị từ chối.
- **Đơn giá là giá trên hóa đơn của nhà cung cấp**, có thể khác giá đơn mua (hệ thống không chặn, người lập sửa theo hóa đơn thật). Khi lấy từ chứng từ nguồn, đơn giá điền sẵn theo nguồn.
- Đầu phiếu của hóa đơn lấy từ chứng từ nguồn đầu tiên: nhà cung cấp, loại tiền, thuế, điều khoản thanh toán, dự án. Đã lấy từ nguồn thì nhà cung cấp và loại tiền bị khóa; nút ✕ cạnh "Theo đơn mua hàng" bỏ liên kết (các dòng thành dòng tự do).

## 3. Chứng từ nguồn được bảo vệ

Khi còn hóa đơn **chưa hủy** lập theo nó:

| Chứng từ | Không làm được |
|---|---|
| Phiếu nhập kho | hủy, bỏ ghi sổ, sửa hoặc xóa phiếu đã ghi sổ (`receipt.hasInvoices`) |
| Đơn mua hàng | hủy (`purchaseOrder.cancelHasInvoices`) |

Hủy hoặc xóa các hóa đơn đó trước. Hóa đơn chỉ **sửa** khi ở Lập chứng từ, chỉ **xóa** khi là phiếu nháp; hóa đơn đã duyệt thì hủy (có hỏi xác nhận), hủy nhầm thì bấm **Khôi phục** (về Lập chứng từ, kiểm lại dòng nguồn còn đủ chỗ và số hóa đơn chưa bị dùng).

## 4. Báo cáo công nợ phải trả

Báo cáo theo **nhà cung cấp**, của đơn vị cơ sở đang làm việc. Chỉ tính hóa đơn **đã phê duyệt** (nháp, chờ duyệt, đã hủy không tính). Giá trị theo tiền hạch toán.

| Cột | Ý nghĩa |
|---|---|
| Tổng phải trả | tổng `total_value` các hóa đơn ghi nhận đến ngày chọn |
| Chưa đến hạn / Đã quá hạn | hạn thanh toán từ ngày chọn trở đi / trước ngày chọn (đúng ngày hạn thì chưa quá hạn) |
| 1-30, 31-60, 61-90, trên 90 ngày | phần quá hạn theo số ngày đã quá hạn |
| Hạn sớm nhất | hạn thanh toán sớm nhất của nhà cung cấp |

Bộ lọc: tìm nhà cung cấp, **tính đến ngày** (mặc định hôm nay; chỉ hóa đơn có ngày chứng từ đến ngày đó), hóa đơn từ ngày. Bấm một dòng để xem các hóa đơn của nhà cung cấp (số ngày quá hạn từng hóa đơn). Các cột giá trị cần quyền đặc biệt **Xem giá vốn** (`VIEW_COST`) của chức năng báo cáo; không có thì chỉ thấy số hóa đơn.

**Chưa có thanh toán:** phiếu chi tiền chưa nối với hóa đơn nên công nợ = toàn bộ hóa đơn đã duyệt. Khi phiếu chi tiền làm thật, số đã thanh toán sẽ trừ vào đây.

## 5. Cơ sở dữ liệu và API

Script `ServerService/sql/postgresql/51-purchase-invoices.sql` (chạy lại được, không khóa ngoại): `erp_purchase_invoice` (đầu phiếu) và `erp_purchase_invoice_line`.

| Cột đáng chú ý | Ghi chú |
|---|---|
| `invoice_no`, `invoice_series`, `invoice_date`, `due_date` | số, ký hiệu, ngày hóa đơn của nhà cung cấp, hạn thanh toán; chỉ mục `(supplier_code, invoice_no)` để kiểm trùng, `(unit_code, due_date)` cho báo cáo |
| `purchase_order_code`, `goods_receipt_code` | danh sách số đơn mua / phiếu nhập mà hóa đơn theo, suy từ các dòng (`[NotReference]`) |
| dòng: `purchase_order_line_id`, `goods_receipt_line_id` | dòng nguồn (sự thật); số đã lập hóa đơn tính từ đây |
| mọi cột `*_code` | `[References]` tới danh mục: đơn vị, nhà cung cấp, loại tiền, mã thuế, điều khoản thanh toán, dự án, vật tư, đơn vị tính |

| Việc | Đường dẫn |
|---|---|
| Danh sách (phân trang, lọc, sắp xếp), xuất Excel | `GET api/purchasing/purchase-invoices`, `.../export` |
| Lựa chọn của form | `GET .../options` |
| Phiếu nhập / đơn mua còn hàng chưa lập hóa đơn | `GET .../open-receipts?supplier=&invoiceId=`, `GET .../open-orders?supplier=&invoiceId=` |
| Một phiếu, thêm, sửa, xóa | `GET .../{id}`, `POST`, `PUT .../{id}`, `DELETE .../{id}` |
| Gửi duyệt, duyệt, hủy, khôi phục, rút lại, từ chối | `POST .../{id}/submit\|approve\|cancel\|reopen\|withdraw`, `POST .../{id}/reject` |
| Báo cáo công nợ | `GET api/purchasing/payables?asOf=&from=&search=&supplier=`, `GET .../{supplierCode}/invoices` |

`POST/PUT` nhận `SavePurchaseInvoiceRequest`: `date`, `voucherType`, `supplierCode`, `invoiceNo`, `invoiceSeries`, `invoiceDate`, `dueDate` (hoặc `paymentTermCode`), `currencyCode`, `taxRateCode`, `projectCode`, `items[]` (`materialCode`, `uomCode`, `quantity`, `unitPrice`, `goodsReceiptLineId`, `purchaseOrderLineId`), `version`, `targetStatus` (Draft, Pending, Approved; không có Posted).

Lỗi thường gặp: `purchaseInvoice.duplicate` (trùng số hóa đơn), `purchaseInvoice.exceedsReceipt` / `exceedsOrder` (lập quá số còn lại), `purchaseInvoice.receiptNotReady` (phiếu nhập chưa duyệt hoặc đã hủy), `purchaseInvoice.receiptSupplier` / `receiptCurrency` / `orderSupplier` / `orderCurrency` (khác nhà cung cấp hoặc loại tiền), `purchaseInvoice.lineMismatch` (khác vật tư hoặc đơn vị tính của dòng nguồn), `purchaseInvoice.invoiceDateInvalid`, `purchaseInvoice.dueDateInvalid`.

## 6. Quyền

Chức năng `pur_invoice`: Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất; quyền đặc biệt `VIEW_PRICE` (xem đơn giá, thành tiền), `VIEW_ALL` (xem phiếu của người khác), và các quyền trạng thái theo đơn vị `ST_PENDING`, `ST_APPROVED`, `ST_CANCELLED`. Quyền Duyệt trên màn `pur_approve_invoice` có tác dụng như quyền Duyệt trên chính phiếu. Báo cáo: chức năng `pur_report_payable` (Xem) và `VIEW_COST`. Cấp quyền ở Cài đặt › Người dùng & phân quyền.

## 7. Cài đặt và kiểm tra

1. Chạy script `51-purchase-invoices.sql` (sau `44` đến `50`).
2. Khởi động lại backend: tự thêm mã chức năng, dải số `HDM`, mục menu và lưới chi tiết `HDM_ITEMS` (Cài đặt › Cấu hình lưới chứng từ).
3. Kiểm tra: `dotnet test` (460 test), `npm run lint`, `npm run check-menu`, `npm run check-policy`.

## 8. Giới hạn hiện tại

- Chưa **thanh toán nhà cung cấp** (phiếu chi chưa nối với hóa đơn) nên công nợ chưa giảm khi trả tiền.
- Chưa **hạch toán** (định khoản Nợ 156 / 1331, Có 331...) và chưa có sổ cái; mã thuế đã có tài khoản thuế nhưng hóa đơn chưa dùng.
- Chưa **phiếu trả hàng nhà cung cấp** và hóa đơn điều chỉnh (giảm giá, trả hàng).
- Chưa đối chiếu giá hóa đơn với giá đơn mua (chỉ đối chiếu số lượng).
- Một mã thuế cho cả hóa đơn (chưa thuế riêng từng dòng).

## 9. Tệp mã nguồn

| Phần | Nơi |
|---|---|
| Bảng | `ServerService/sql/postgresql/51-purchase-invoices.sql` |
| Thực thể | `Core.Domain/Modules/Purchasing/Documents/PurchaseInvoices/PurchaseInvoice.cs` |
| Hợp đồng | `Core.Application/Modules/Purchasing/Documents/PurchaseInvoices/PurchaseInvoiceContracts.cs` |
| Dịch vụ, tiến độ đã lập hóa đơn | `Core.Infrastructure/Modules/Purchasing/Documents/PurchaseInvoices/PurchaseInvoiceService.cs` (`PurchaseInvoiceProgress`) |
| API | `Core/Modules/Purchasing/Documents/PurchaseInvoices/PurchaseInvoicesController.cs` |
| Báo cáo công nợ | `Core.Application/Modules/Purchasing/Reports/PayableContracts.cs`, `Core.Infrastructure/Modules/Purchasing/Reports/PayableService.cs` + `Sql/Payables.sql`, `Sql/PayableInvoices.sql`, `Core/Modules/Purchasing/Reports/PayablesController.cs` |
| Màn hình | `Frontend/src/modules/purchasing/documents/purchase-invoices/`, duyệt `approval-purchase-invoice/`, báo cáo `reports/PayableReportView.tsx` |
