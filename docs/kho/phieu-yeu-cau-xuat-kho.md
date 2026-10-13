# Phiếu yêu cầu xuất kho và việc lấy dữ liệu sang phiếu xuất kho

Phiếu yêu cầu xuất kho (`inv_issue_request`, số phiếu `YCX`) là chứng từ để **một bộ phận đề nghị kho xuất hàng**. Nó đi qua quy trình duyệt như phiếu nhập và phiếu xuất, nhưng **không ghi sổ kho**: tồn chỉ đổi khi **phiếu xuất kho** thực hiện yêu cầu. Phiếu xuất kho có chức năng **"Lấy từ phiếu yêu cầu"**: chọn **một hoặc nhiều** phiếu yêu cầu đã duyệt, hệ thống đưa các dòng còn chưa xuất vào phiếu xuất.

Làm theo đúng khung của `docs/phat-trien/them-chung-tu.md`; phần giống phiếu xuất kho xem `docs/kho/phieu-xuat-kho.md`. Script: `ServerService/sql/postgresql/42-inventory-issue-requests.sql` (chạy sau 39 và 40).

## 1. Luồng nghiệp vụ

1. Bộ phận lập **phiếu yêu cầu**: kho xuất, mục đích, bộ phận và người yêu cầu, khách hàng (nếu có), ngày cần hàng, danh sách vật tư, số lượng, đơn giá dự kiến.
2. Gửi duyệt, người có quyền duyệt duyệt (quy trình duyệt cấu hình ở Cài đặt › Quy tắc phê duyệt, chức năng "Phiếu yêu cầu xuất kho"). Phiếu **Đã phê duyệt** là phiếu kho có thể thực hiện.
3. Thủ kho lập **phiếu xuất kho**, bấm **"Lấy từ phiếu yêu cầu"**: cửa sổ chia hai, phần trên là danh sách phiếu yêu cầu còn hàng, bấm một phiếu thì phần dưới hiện các vật tư của nó để **tích chọn** (đổi được số lượng lấy sang). Vật tư đã xuất hết không hiện, vật tư còn hiện số lượng còn lại. Kho, mục đích, khách hàng, người nhận lấy từ phiếu đầu tiên; mỗi dòng phiếu xuất lưu **số phiếu yêu cầu** của nó. Lưu rồi duyệt và ghi sổ như thường; xóa phiếu xuất thì số lượng được tính lại.
4. Phiếu yêu cầu có thể được **nhiều phiếu xuất** thực hiện dần. Cột **Đã xuất** trên phiếu yêu cầu và dòng "Đã xuất x / y" ở danh sách cho biết tiến độ; khi xuất đủ thì phiếu không còn trong danh sách "Lấy từ phiếu yêu cầu".

Trạng thái của phiếu yêu cầu: **Lập chứng từ → Chờ duyệt → Đã phê duyệt** (hoặc **Hủy**). Không có "Chuyển sổ kho": nút ghi sổ và bỏ ghi sổ không có, lưu thẳng ở trạng thái ghi sổ bị từ chối.

## 2. Số đã xuất được tính thế nào

Không có cột lưu số đã xuất. **Số đã xuất của một dòng yêu cầu = tổng số lượng các dòng phiếu xuất trỏ tới nó** (`erp_goods_issue_line.issue_request_line_id`), trên các phiếu xuất **chưa hủy** (nháp, chờ duyệt, đã duyệt, đã ghi sổ đều tính, để hai người không cùng lấy một số hàng). Hủy hoặc xóa phiếu xuất thì số lượng được trả lại cho phiếu yêu cầu. Hàm tính nằm ở `IssueRequestProgress` (`Core.Infrastructure/.../IssueRequests/IssueRequestService.cs`), dùng chung cho phiếu yêu cầu (hiển thị) và phiếu xuất (kiểm tra).

## 3. Quy tắc khi lưu một phiếu xuất kho theo yêu cầu

Phiếu xuất **không còn gửi mã phiếu yêu cầu**: mỗi dòng hàng mang `IssueRequestLineId` (dòng yêu cầu mà nó thực hiện) và backend tự suy ra các phiếu yêu cầu từ các dòng; `issue_request_code` ở đầu phiếu là **danh sách mã cách nhau bằng dấu phẩy** (để hiển thị). Một phiếu xuất lấy được từ nhiều phiếu yêu cầu **cùng kho và cùng loại tiền**. Backend kiểm:

| Quy tắc | Thông báo (khóa) |
|---|---|
| Mọi phiếu yêu cầu có dòng được lấy phải **Đã phê duyệt** | `issue.requestNotApproved` |
| Phiếu xuất phải xuất **từ kho của phiếu yêu cầu** | `issue.requestWarehouse` |
| Khi đã lấy từ yêu cầu, mọi dòng hàng phải trỏ tới một dòng yêu cầu (của một trong các phiếu, cùng đơn vị cơ sở) | `issue.lineNotInRequest` |
| Dòng phải cùng vật tư và cùng đơn vị tính với dòng yêu cầu | `issue.requestLineMismatch` |
| Tổng số lượng lấy từ một dòng yêu cầu (phiếu này và các phiếu xuất khác chưa hủy) không vượt số yêu cầu | `issue.exceedsRequest` |

Dòng thuộc tab nguyên vật liệu (BOM) không thuộc yêu cầu. Khi **sửa** một phiếu xuất, số lượng của chính nó không bị tính hai lần.

Phiếu yêu cầu đã có dòng nằm trong phiếu xuất (chưa hủy) **không hủy được** (`issueRequest.cancelHasIssues`). Phiếu yêu cầu chỉ xóa được khi còn nháp; một phiếu xuất không thể trỏ tới phiếu nháp, nên không có phiếu xuất mồ côi.

## 4. Bảng dữ liệu

**`erp_issue_request`**: `id`, `code` (duy nhất, `YCX-<DVCS>-<yyyymm>-<số>`), `unit_code`, `document_date`, `created_date`, `required_date` (ngày cần hàng, không trước ngày chứng từ), `warehouse_code`, `voucher_type` (mục đích: cùng danh sách loại xuất của phiếu xuất), `department_code` (không bắt buộc), `requester_name`, `customer_name`, `currency_code`, `exchange_rate`, `note`, `status`, `total_value`, `approved_by_user_id`, bốn cột dấu vết.

**`erp_issue_request_line`**: `id`, `request_id`, `line_no`, `material_code`, `material_name` (tên lúc lưu, lấy từ danh mục), `uom_code`, `quantity` (> 0), `unit_price`, `amount`, `note`, bốn cột dấu vết.

**Thêm vào phiếu xuất kho**: `erp_goods_issue.issue_request_code` (các phiếu yêu cầu đang thực hiện, varchar 500) và `erp_goods_issue_line.issue_request_line_id` (dòng yêu cầu), kèm chỉ mục.

Các cột `*_code` trỏ danh mục khai `[References]`: đơn vị cơ sở, kho, ngoại tệ, bộ phận (không bắt buộc), vật tư, đơn vị tính; vật tư, kho, bộ phận đã có phiếu yêu cầu dùng thì không xóa được. `issue_request_code` của phiếu xuất khai `[NotReference]` kèm lý do (khóa của phiếu yêu cầu là `id`; việc chặn xóa / hủy do dịch vụ làm).

## 5. Quyền và phê duyệt

- Chức năng `inv_issue_request` (Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất Excel) và màn phê duyệt `inv_approve_issue_request` (Kho › Phê duyệt yêu cầu xuất kho).
- Quyền đặc biệt (do `VoucherCatalog` tự sinh): `VIEW_PRICE` (xem đơn giá dự kiến và thành tiền), `VIEW_ALL` (xem phiếu của người khác), và các quyền trạng thái theo đơn vị cơ sở `ST_PENDING`, `ST_APPROVED`, `ST_CANCELLED` (hủy phiếu đã duyệt chưa có phiếu xuất). Phiếu yêu cầu không ghi sổ nên **không có** `ST_POSTED`, `ST_UNPOST` và trạng thái Đã ghi sổ (`docs/he-thong/trang-thai-chung-tu.md`).
- Danh sách "Lấy từ phiếu yêu cầu" (`GET /api/inventory/goods-issues/open-requests`) cần quyền **Xem phiếu xuất kho**, không cần quyền xem phiếu yêu cầu. Giá chỉ trả khi người dùng có `VIEW_PRICE` của phiếu xuất.
- Chức năng mới nên **cấp quyền cho vai trò** ở Cài đặt › Người dùng và phân quyền; mặc định chỉ quản trị viên dùng được. Nếu chưa cấu hình quy tắc duyệt riêng, cấp 1 là "người có quyền Duyệt chức năng này" (không phải người lập).

## 6. API

| Việc | Lệnh |
|---|---|
| Một trang danh sách (phân trang, lọc, tìm, sắp xếp ở máy chủ; thêm bộ lọc `department` = mã bộ phận), tệp Excel, kho / ngoại tệ / bộ phận dùng được, một phiếu | `GET /api/inventory/issue-requests?page=&pageSize=&sort=&dir=&search=&status=&warehouse=&voucherType=&code=&from=&to=&department=`, `.../export?...`, `.../options`, `.../{id}` (cùng quy tắc với phiếu nhập: `so-kho-va-phieu-nhap-kho.md`, mục 2.4.1) |
| Tạo, sửa (chỉ phiếu Lập chứng từ) | `POST`, `PUT /{id}` (kèm `version`, `targetStatus` = Draft / Pending / Approved) |
| Chuyển trạng thái | `POST /{id}/submit`, `approve`, `cancel`, `withdraw`; từ chối `POST /{id}/reject` |
| Xóa phiếu nháp | `DELETE /{id}` |
| Phiếu yêu cầu còn hàng cho phiếu xuất | `GET /api/inventory/goods-issues/open-requests?issueId=` (bỏ trống khi lập phiếu mới) |

Mỗi dòng phiếu yêu cầu trả `issuedQuantity`. Thao tác `post` / `unpost` trả 400 (`issueRequest.invalidAction`); lưu với `targetStatus` = Posted trả 400 (`issueRequest.noPosting`).

## 7. Màn hình

- **Kho › Phiếu yêu cầu xuất kho**: cùng bố cục với phiếu nhập và xuất (hai khối thông tin, lưới chi tiết giãn hết chỗ, thanh tóm tắt). Khối trái: mục đích, kho, bộ phận, người yêu cầu, khách hàng, ngày cần hàng, ghi chú; khối phải: chứng từ và tiền tệ. Lưới có cột **Đã xuất** (chỉ đọc). Có nút gửi duyệt, duyệt, rút phiếu, hủy phiếu đã duyệt, in (có giá / không giá), xóa.
- **Kho › Phiếu xuất kho**: thêm nút **"Lấy từ phiếu yêu cầu"** trên thanh của lưới (hiện khi đang lập hoặc sửa phiếu nháp): cửa sổ hai phần (phiếu yêu cầu ở trên, vật tư để tích chọn ở dưới), mô tả đầy đủ ở `phieu-xuat-kho.md`. Phiếu xuất theo yêu cầu hiện một dòng nhắc số phiếu yêu cầu kèm nút **Bỏ liên kết** và cột "Phiếu yêu cầu" ở lưới; ô kho bị khóa vì phải cùng kho với yêu cầu.
- **Kho › Phê duyệt yêu cầu xuất kho**: danh sách phiếu chờ duyệt như các màn phê duyệt khác.
- Dữ liệu giao diện chung `GoodsVoucher`: khách hàng nằm ở `supplierName`, người yêu cầu ở `delivererName` (để in phiếu), `departmentCode` / `departmentName`, `requiredDate` và `issueRequestCode`; dòng có `note`, `issuedQuantity`, `issueRequestLineId`.

## 8. Mã nguồn

| Lớp | Tệp |
|---|---|
| SQL | `42-inventory-issue-requests.sql` |
| Thực thể | `Core.Domain/Modules/Inventory/Documents/IssueRequests/IssueRequest.cs` |
| Hợp đồng | `Core.Application/Modules/Inventory/Documents/IssueRequests/IssueRequestContracts.cs` |
| Dịch vụ | `Core.Infrastructure/Modules/Inventory/Documents/IssueRequests/IssueRequestService.cs` (có `IssueRequestProgress`) |
| Controller | `Core/Modules/Inventory/Documents/IssueRequests/IssueRequestsController.cs`; danh sách còn hàng ở `GoodsIssuesController` |
| Phiếu xuất | `GoodsIssueService.ValidateRequestLinkAsync` |
| Duyệt | `DocumentApprovalService` (`IsVoucherFunction`, `FindVoucherAsync`, `NotFoundKey`) |
| Danh mục chức năng, số phiếu | `FunctionCatalog`, `VoucherCatalog` (`YCX`, màn `inv_approve_issue_request`), `menu.json` |
| Frontend | `modules/inventory/documents/issue-requests/` (`IssueRequestView.tsx`, `api.ts`), `approval-issue-request/`, `goods-issues/GoodsIssueView.tsx` (phần lấy yêu cầu) |
| Lưới | `mock/voucherGridConfigs.ts` (`YCX_ITEMS`); in phiếu: `voucherPrint.ts` (kiểu `request`) |

## 9. Đã kiểm tra

Chạy trên backend thật, dữ liệu thử đã xóa sau khi xong: lập phiếu yêu cầu (lỗi vật tư, đơn vị tính, bộ phận, kho, số lượng, ngày cần hàng), sửa, sửa với phiên bản cũ (409), post / unpost bị từ chối, lưu thẳng ở Đã duyệt, gửi duyệt, tự duyệt bị chặn, người khác duyệt, phiếu đã duyệt không sửa được; phiếu nháp không có trong danh sách còn hàng; phiếu xuất: dòng sai yêu cầu, sai vật tư, sai đơn vị, quá số lượng, khác kho, thiếu phiếu yêu cầu đều bị từ chối; xuất từng phần qua nhiều phiếu, số còn lại giảm đúng và phiếu hết hàng thì biến mất khỏi danh sách; sửa phiếu xuất không tính hai lần; ghi sổ phiếu xuất theo yêu cầu (tồn giảm đúng); hủy phiếu xuất trả số lượng về cho phiếu yêu cầu; phiếu yêu cầu đã có phiếu xuất không hủy được; không có quyền thì 403. Trên trình duyệt: danh sách, cửa sổ chi tiết, chọn phiếu yêu cầu trong phiếu xuất, lưu phiếu xuất và kiểm tra số đã xuất.

## 10. Giới hạn hiện tại

- Các phiếu yêu cầu gộp vào một phiếu xuất phải cùng kho và cùng loại tiền; kho, mục đích, khách hàng, người nhận lấy từ phiếu đầu tiên.
- Phiếu xuất theo yêu cầu chỉ được xuất các dòng của yêu cầu (dòng khác phải lập phiếu xuất khác).
- Phiếu yêu cầu đã duyệt không sửa được; muốn đổi phải hủy (khi chưa có phiếu xuất) rồi lập lại.
- Khách hàng vẫn là chữ tự do (chưa có danh mục khách hàng); lô và vị trí của phiếu xuất vẫn nhập tay.
- Chưa có thông báo riêng cho thủ kho khi một phiếu yêu cầu được duyệt (ngoài thông báo duyệt chung của quy trình).
