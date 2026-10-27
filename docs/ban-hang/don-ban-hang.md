# Đơn bán hàng và phiếu xuất kho lấy từ đơn

Giai đoạn 2 của phân hệ Bán hàng: **đơn bán hàng** (`sales_orders`, số phiếu `SO`) chạy thật trên backend, và **phiếu xuất kho** (`inv_issue`) lấy hàng từ đơn đã duyệt. Luồng:

```
Đơn bán hàng (SO) → Phiếu xuất kho (PXK, ghi sổ kho) → Hóa đơn bán hàng → Công nợ phải thu
   không ghi sổ        giá vốn do sổ kho tính           (giai đoạn sau)
```

Màn hình: Bán hàng › Chứng từ › **Đơn bán hàng**, duyệt ở Bán hàng › **Phê duyệt đơn bán hàng** (`sales_approve_order`). Đơn dùng đúng khung chứng từ của các phiếu khác (xem `docs/phat-trien/them-chung-tu.md`): trạng thái Lập chứng từ → Chờ duyệt → Đã phê duyệt (và Hủy, Khôi phục), duyệt nhiều cấp, quyền theo trạng thái theo từng đơn vị cơ sở (`ST_*`), lưu thẳng ở trạng thái theo quyền, chống ghi đè (`version`), nhật ký, xuất Excel, in, phân trang. **Đơn không ghi sổ kho**: trạng thái dừng ở Đã duyệt.

## 1. Đơn bán hàng

| Trường | Ghi chú |
|---|---|
| Khách hàng | bắt buộc, danh mục khách hàng (đang sử dụng); tên được chép vào đơn lúc lưu. Chọn khách thì điều khoản thanh toán mặc định của khách điền vào đơn |
| Loại bán hàng | trong nước, xuất khẩu, đại lý, bán lẻ |
| Kho xuất hàng | bắt buộc, kho của đơn vị cơ sở; phiếu xuất giao đơn phải cùng kho |
| Địa chỉ giao hàng, ngày giao hàng | ngày giao không được trước ngày chứng từ |
| Điều khoản thanh toán, dự án | danh mục (tùy chọn) |
| Thuế suất | một mã thuế cho cả đơn (tùy chọn); phần trăm được chép vào đơn |
| Loại tiền, tỷ giá | tỷ giá theo ngày chứng từ |

Tiền: tiền hàng (làm tròn từng dòng), tiền thuế (trên tổng tiền hàng), tổng cộng × tỷ giá quy ra tiền hạch toán (dùng chọn cấp duyệt theo số tiền).

**Dòng hàng:** vật tư (bất kỳ vật tư đang sử dụng, kể cả dịch vụ), đơn vị tính (gốc hoặc đã quy đổi), số lượng, đơn giá, thành tiền, ghi chú, và cột **Đã xuất** (số các phiếu xuất chưa hủy đã giao theo dòng, máy chủ tính, chỉ đọc).

**Lấy giá theo bảng giá:** chọn vật tư trên một dòng thì đơn giá tự điền từ bảng giá bán hợp với khách hàng, loại tiền và ngày chứng từ (bảng giá của nhóm khách trước, rồi bảng giá chung; xem `docs/ban-hang/danh-muc-ban-hang.md`). Nút **Cập nhật giá theo bảng giá** lấy lại giá cho mọi dòng (dùng khi đổi khách, ngày hoặc loại tiền). Không có bảng giá cho mặt hàng đó, hoặc người dùng không có quyền Xem bảng giá, thì giá để người lập tự nhập. Đơn giá luôn sửa được.

**Hủy đơn:** đơn còn phiếu xuất kho chưa hủy lấy từ nó thì không hủy được (`salesOrder.cancelHasIssues`). Hủy hoặc xóa các phiếu xuất đó trước. Đơn đã duyệt không sửa được, muốn sửa thì rút về nháp theo quy trình.

## 2. Phiếu xuất kho lấy từ đơn bán hàng

Trên màn Phiếu xuất kho có nút **Lấy từ đơn bán hàng** (cạnh "Lấy từ phiếu yêu cầu"): cửa sổ liệt kê các đơn đã duyệt còn hàng chưa xuất; chọn đơn ở phần trên, tích các vật tư cần xuất ở phần dưới (đổi số lượng nếu chỉ giao một phần).

- Có thể lấy từ nhiều đơn, miễn là **cùng khách hàng, kho xuất và loại tiền**. Phiếu lấy theo đơn thì khách hàng và kho bị khóa theo đơn; mã khách hàng của danh mục được lưu vào phiếu (`customer_code`), tên khách hàng điền sẵn.
- Phiếu xuất vẫn dùng được **không theo đơn**: gõ tên khách tự do như trước, hoặc chọn khách hàng từ danh mục (cửa sổ tra cứu nay đọc danh mục khách hàng thật, thay cho danh sách mẫu cũ).
- Mỗi dòng của phiếu lấy theo đơn gắn với một dòng đơn (`erp_goods_issue_line.sales_order_line_id`, là sự thật; `erp_goods_issue.sales_order_code` là danh sách số đơn suy từ các dòng). Đã lấy theo đơn thì **mọi** dòng hàng phải theo một dòng đơn.
- Máy chủ kiểm: đơn đã duyệt, cùng đơn vị, kho, loại tiền, một khách hàng; dòng cùng vật tư và đơn vị tính với dòng đơn; **số lượng đã xuất theo một dòng đơn** (các phiếu xuất chưa hủy, kể cả phiếu nháp) **không vượt số bán**. Hủy hoặc xóa phiếu xuất thì số lượng trả lại cho đơn. Khôi phục phiếu xuất đã hủy bị từ chối nếu đơn không còn đủ chỗ.
- Giá vốn do sổ kho tính khi ghi sổ (không lấy giá bán của đơn); ô đơn giá trên phiếu xuất điền sẵn theo giá bán để người in phiếu thấy, người không có quyền xem giá thì thấy 0.

## 3. Cơ sở dữ liệu và API

Script `ServerService/sql/postgresql/53-sales-orders.sql` (chạy lại được, không khóa ngoại): `erp_sales_order`, `erp_sales_order_line`; thêm `erp_goods_issue.customer_code`, `erp_goods_issue.sales_order_code`, `erp_goods_issue_line.sales_order_line_id`.

| Việc | Đường dẫn |
|---|---|
| Danh sách (phân trang, lọc theo trạng thái, kho, khách hàng, dự án, ngày), xuất Excel | `GET api/sales/sales-orders`, `.../export` |
| Lựa chọn của form | `GET .../options` |
| Một đơn, thêm, sửa, xóa | `GET .../{id}`, `POST`, `PUT .../{id}`, `DELETE .../{id}` |
| Gửi duyệt, duyệt, hủy, khôi phục, rút lại, từ chối | `POST .../{id}/submit\|approve\|cancel\|reopen\|withdraw`, `POST .../{id}/reject` |
| Đơn còn hàng chưa xuất (cho phiếu xuất) | `GET api/inventory/goods-issues/open-sales-orders?issueId=` (quyền Xem phiếu xuất) |

`POST/PUT` đơn nhận `SaveSalesOrderRequest` (`date`, `deliveryDate`, `warehouseCode`, `voucherType`, `customerCode`, `deliveryAddress`, `currencyCode`, `taxRateCode`, `paymentTermCode`, `projectCode`, `items[]` (`materialCode`, `uomCode`, `quantity`, `unitPrice`), `version`, `targetStatus` (Draft, Pending, Approved; không có Posted)). Phiếu xuất nhận thêm `customerCode` và `items[].salesOrderLineId`.

Lỗi thường gặp: `salesOrder.customerInvalid`, `salesOrder.cancelHasIssues`, `issue.exceedsSalesOrder` (xuất quá số còn lại), `issue.salesOrderCustomers` (các đơn khác khách hàng), `issue.salesOrderWarehouse` / `issue.salesOrderCurrency` (khác kho hoặc loại tiền), `issue.salesOrderLineMismatch`, `issue.lineNotInSalesOrder`.

## 4. Quyền

Chức năng `sales_orders`: Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất; quyền đặc biệt `VIEW_PRICE` (xem đơn giá và thành tiền), `VIEW_ALL` (xem đơn của người khác), `ST_PENDING`, `ST_APPROVED`, `ST_CANCELLED` theo từng đơn vị. Quyền Duyệt trên màn `sales_approve_order` có tác dụng như quyền Duyệt trên chính đơn. Để lấy giá theo bảng giá, người lập đơn cần quyền Xem của `sales_price_list_cat`.

## 5. Cài đặt và kiểm tra

1. Chạy script `53-sales-orders.sql` (sau `52`).
2. Khởi động lại backend: tự thêm mã chức năng `sales_approve_order`, dải số `SO` (có sẵn), menu mới và lưới chi tiết `SO_ITEMS` (Cài đặt › Cấu hình lưới chứng từ).
3. `dotnet test` (472 test), `npm run lint`, `npm run check-menu`, `npm run check-policy`.

## 6. Chưa làm

- Cảnh báo **vượt hạn mức công nợ** của khách khi lập đơn: cần công nợ phải thu, làm cùng hóa đơn bán hàng.
- **Hóa đơn bán hàng** và báo cáo **công nợ phải thu**, báo giá, phiếu trả hàng bán, báo cáo doanh số và lãi gộp.
- Chiết khấu theo dòng, một mã thuế cho cả đơn.
- Các màn Phiếu giao hàng và Báo cáo doanh số vẫn là dữ liệu giả trong trình duyệt.

## 7. Tệp mã nguồn

| Phần | Nơi |
|---|---|
| Bảng | `ServerService/sql/postgresql/53-sales-orders.sql` |
| Thực thể | `Core.Domain/Modules/Sales/Documents/SalesOrders/SalesOrder.cs` |
| Hợp đồng | `Core.Application/Modules/Sales/Documents/SalesOrders/SalesOrderContracts.cs` |
| Dịch vụ, số đã xuất | `Core.Infrastructure/Modules/Sales/Documents/SalesOrders/SalesOrderService.cs` (`SalesOrderProgress`) |
| API | `Core/Modules/Sales/Documents/SalesOrders/SalesOrdersController.cs`; `GoodsIssuesController` (`open-sales-orders`) |
| Phiếu xuất | `GoodsIssueService.ValidateSalesLinkAsync` |
| Màn hình | `Frontend/src/modules/sales/documents/sales-orders/`, duyệt `approval-sales-order/`; phiếu xuất `modules/inventory/documents/goods-issues/GoodsIssueView.tsx` |
