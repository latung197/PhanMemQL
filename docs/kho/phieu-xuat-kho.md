# Phiếu xuất kho

Phiếu xuất kho (`inv_issue`) làm **giống hệt phiếu nhập kho** về cấu trúc mã nguồn, bố cục màn hình, trạng thái, phân quyền, phê duyệt và cách ghi sổ. Tài liệu này chỉ nói **phần khác**; mọi phần còn lại (trạng thái, luồng, sổ kho, ba bảng tồn, lỗi thường gặp) xem `docs/kho/so-kho-va-phieu-nhap-kho.md`.

Script: `ServerService/sql/postgresql/39-inventory-goods-issues.sql` (chạy sau 20 và 34).

## 1. Khác phiếu nhập ở đâu

| Việc | Phiếu nhập kho (`inv_receipt`) | Phiếu xuất kho (`inv_issue`) |
|---|---|---|
| Số chứng từ | `PNK-<đơn vị>-<yyyymm>-<số>` | `PXK-<đơn vị>-<yyyymm>-<số>` |
| Đối tác trên phiếu | Nhà cung cấp, người giao hàng (`supplier_name`, `deliverer_name`) | Khách hàng, người nhận hàng (`customer_name`, `receiver_name`) |
| Loại phiếu | Nhập mua mới, điều chuyển nội bộ, sản xuất thành phẩm, hàng trả lại, kiểm kê tăng | Xuất bán hàng, điều chuyển nội bộ, nguyên vật liệu sản xuất, hàng mẫu / khuyến mãi, kiểm kê giảm / hủy |
| Chiều ghi sổ | `StockDirection.In`: cộng tồn, giá trị lấy từ phiếu (thành tiền × tỷ giá) | `StockDirection.Out`: trừ tồn, **giá trị do sổ kho tính theo giá bình quân của kho**, đơn giá trên phiếu không được gửi sang sổ |
| Lô / vị trí | Nhập lô chưa có thì sổ kho tự mở lô | Vật tư theo dõi lô **bắt buộc** nhập số lô đã có, lô phải thả (không bị chặn) và chưa hết hạn; vật tư theo dõi vị trí bắt buộc vị trí thuộc kho xuất |
| Tồn | Không bao giờ bị từ chối vì tồn | **Bị từ chối khi ghi sổ nếu không đủ tồn** (trừ khi đơn vị bật tham số cho phép tồn âm): "Không đủ tồn kho: vật tư X tại kho Y chỉ còn n" |
| Tạo phiếu | Không kiểm tồn (phiếu chỉ là chứng từ) | Không kiểm tồn khi lập, sửa, gửi duyệt, duyệt; chỉ kiểm khi **Ghi sổ** |

Đơn giá và thành tiền trên phiếu xuất là **giá xuất để in và tham khảo** (mặc định lấy giá bán của vật tư). Giá vốn thật của dòng xuất nằm ở `value` của dòng sổ `erp_stock_movement` (số âm).

## 2. Cấu trúc mã nguồn (đồng bộ với phiếu nhập)

| Lớp | Phiếu nhập | Phiếu xuất |
|---|---|---|
| Entity | `Core.Domain/Modules/Inventory/Documents/GoodsReceipts/GoodsReceipt.cs` | `.../GoodsIssues/GoodsIssue.cs` (`GoodsIssue`, `GoodsIssueLine`) |
| Hợp đồng | `Core.Application/.../GoodsReceipts/GoodsReceiptContracts.cs` | `.../GoodsIssues/GoodsIssueContracts.cs` |
| Dịch vụ | `Core.Infrastructure/.../GoodsReceipts/GoodsReceiptService.cs` | `.../GoodsIssues/GoodsIssueService.cs` |
| Controller | `Core/Modules/Inventory/Documents/GoodsReceipts/GoodsReceiptsController.cs` | `.../GoodsIssues/GoodsIssuesController.cs` |
| API | `/api/inventory/goods-receipts` | `/api/inventory/goods-issues` |
| Frontend | `modules/inventory/documents/goods-receipts/` (`GoodsReceiptView.tsx`, `api.ts`) | `modules/inventory/documents/goods-issues/` (`GoodsIssueView.tsx`, `api.ts`) |
| Màn phê duyệt | `approval-receipt/ReceiptApprovalView.tsx` | `approval-issue/IssueApprovalView.tsx` |
| Bảng | `erp_goods_receipt`, `erp_goods_receipt_line` | `erp_goods_issue`, `erp_goods_issue_line` |

Điểm dùng chung (không viết lại): `IApprovableDocument` (`Core.Domain/Common`) là giao diện chung của phiếu đi qua quy trình duyệt; `DocumentApprovalService` đọc và đổi trạng thái phiếu qua nó, nên thêm một phiếu mới chỉ cần implement giao diện và thêm vào `FindVoucherAsync` / `IsVoucherFunction`.

Màn hình phiếu xuất dùng cùng bố cục với phiếu nhập: thanh công cụ và bộ lọc, lưới danh sách, cửa sổ toàn màn hình hai khối (I. nghiệp vụ và đối tác, II. chứng từ và tiền tệ), hai tab chi tiết (mặt hàng, nguyên vật liệu), các nút gửi duyệt, duyệt, rút phiếu, chuyển sổ kho, bỏ ghi sổ, in, xóa. Ở dữ liệu giao diện chung `GoodsVoucher`, khách hàng nằm trong `supplierName` và người nhận trong `delivererName` (`goods-issues/api.ts` đổi qua lại).

## 3. Trạng thái, quyền và phê duyệt

- Trạng thái và thao tác giống phiếu nhập: Lập chứng từ → Chờ duyệt → Đã phê duyệt → Chuyển sổ kho (hoặc Hủy); `DocumentStatusPolicy` quyết định ai làm được gì.
- Quyền chức năng `inv_issue` (Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất Excel) và màn phê duyệt `inv_approve_issue`. Quyền đặc biệt: `VIEW_PRICE` (xem đơn giá và thành tiền), `VIEW_COST` (xem giá vốn), `VIEW_ALL`, `EDIT_PENDING`, `EDIT_APPROVED`, `POST`, `UNPOST`, `CANCEL`.
- Không được tự duyệt phiếu do mình lập. Quy tắc duyệt cấu hình ở Cài đặt › Người dùng và phân quyền › Quy tắc phê duyệt (chức năng Phiếu xuất kho).
- Số phiếu và khóa sổ như phiếu nhập: loạt `PXK` trong Cài đặt › Đánh số chứng từ; ngày phiếu nằm trong tháng đã khóa thì không lưu, không ghi sổ được.

## 4. API

| Việc | Lệnh | Quyền |
|---|---|---|
| Danh sách phiếu của đơn vị | `GET /api/inventory/goods-issues` | Xem (chỉ phiếu mình lập nếu không có `VIEW_ALL`) |
| Kho và loại tiền dùng được | `GET /api/inventory/goods-issues/options` | Xem |
| Một phiếu | `GET /api/inventory/goods-issues/{id}` | Xem |
| Tạo / sửa (chỉ phiếu Lập chứng từ) | `POST` / `PUT /{id}` | Thêm / Sửa |
| Chuyển trạng thái | `POST /{id}/submit`, `approve`, `post`, `unpost`, `cancel`, `withdraw` | theo `DocumentStatusPolicy` |
| Từ chối | `POST /{id}/reject` | Duyệt |
| Xóa (chỉ phiếu Lập chứng từ) | `DELETE /{id}` | Xóa |

Đường dẫn dùng tên `operation`, không dùng `action` (tên dành riêng của ASP.NET Core).

## 5. Thông báo lỗi thường gặp

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| Không đủ tồn kho: vật tư X tại Y chỉ còn n | Tồn kho hiện tại ít hơn số xuất | Giảm số lượng, nhập kho trước, hoặc chọn kho khác |
| Vật tư X theo dõi theo lô nên phải nhập số lô | Dòng phiếu thiếu số lô | Nhập số lô đang còn tồn |
| Phiếu xuất kho cần ít nhất một dòng hàng | Tab mặt hàng trống | Thêm dòng hàng |
| Kho X không dành cho đơn vị cơ sở Y | Kho chỉ dành cho một số đơn vị | Chọn kho khác hoặc thêm đơn vị vào danh mục kho |
| Chỉ được xóa phiếu xuất kho đang ở trạng thái lập chứng từ | Phiếu đã gửi duyệt hoặc đã ghi sổ | Rút phiếu, bỏ ghi sổ hoặc hủy phiếu |
| Không được tự duyệt phiếu do mình lập | Người lập cũng là người duyệt | Nhờ người khác duyệt |

## 6. Cách đã kiểm tra

Chạy trên backend thật, dữ liệu thử đã xóa sau khi xong: lập phiếu, sửa, trùng phiên bản (409), gửi duyệt, tự duyệt bị chặn, người khác duyệt, ghi sổ trừ tồn và giá trị theo giá bình quân, xuất quá tồn bị từ chối mà tồn không đổi, vật tư theo lô thiếu lô bị từ chối rồi xuất đúng lô thì tồn lô giảm, bỏ ghi sổ tồn trả lại, từ chối và rút phiếu, xóa phiếu nháp, phiếu đã ghi sổ không xóa được, người không có quyền bị chặn (403); `GET .../stock/verify` không còn chênh lệch sau mỗi bước.

## 7. Giới hạn hiện tại

- Ô chọn **vật tư và đơn vị tính đọc danh mục thật**, dòng phiếu khai `[References<Material>]` và `[References<Uom>]` (cột `material_code`, `uom_code`; vật tư đã có dòng phiếu xuất thì không xóa được); tên vật tư lấy từ danh mục khi lưu. Danh mục vật tư chưa có giá nên đơn giá bắt đầu bằng 0.
- **Khách hàng** vẫn là chữ tự do và danh sách mẫu trong trình duyệt, vì danh mục khách hàng chưa có backend. Lô và vị trí vẫn nhập tay.
- Phiếu xuất điều chuyển kho (`inv_transfer_issue`) và xuất từ đơn bán hàng vẫn là dữ liệu mẫu.
- Chưa có màn xem giá vốn thật của từng dòng xuất ngay trên phiếu (có sẵn trong sổ kho qua `GET /api/inventory/stock/movements`).
