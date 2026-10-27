# Phiếu kiểm kê

Phiếu kiểm kê (`inv_audit_count`, số phiếu `PKK`) đối chiếu **tồn sổ sách** của một kho tại một ngày với **tồn thực tế** đếm được. Chênh lệch được ghi vào sổ kho khi phiếu được ghi sổ: phần **thừa** nhập thêm vào kho, phần **thiếu** xuất khỏi kho, cả hai theo giá bình quân của kho.

Màn hình: Kho › Cập nhật số liệu › **Phiếu kiểm kê hàng hóa**; duyệt ở Kho › Phê duyệt › **Phê duyệt kiểm kê** (`inv_approve_audit`). Phiếu dùng đúng khung chứng từ của các phiếu kho khác (xem `docs/phat-trien/them-chung-tu.md`): trạng thái Lập chứng từ → Chờ duyệt → Đã phê duyệt → Đã ghi sổ (và Hủy, Khôi phục), duyệt nhiều cấp, quyền theo trạng thái theo từng đơn vị cơ sở (`ST_*`), lưu thẳng ở trạng thái theo quyền, chống ghi đè (`version`), nhật ký thay đổi, xuất Excel, in, phân trang.

## 1. Nguyên tắc

- **Người dùng chỉ nhập số lượng thực tế.** Tồn sổ sách, chênh lệch, giá vốn và giá trị chênh lệch do máy chủ tính từ sổ kho; giao diện hiển thị để người kiểm kê theo dõi nhưng máy chủ không nhận các số đó từ giao diện, nên không thể gõ sai hay làm giả.
- **Tồn sổ sách là tồn của sổ kho đến hết ngày kiểm kê** (tổng các dòng sổ có ngày chứng từ không sau ngày đó, kể cả dòng đảo của phiếu đã bỏ ghi sổ). Nó được tính lại ở **mỗi lần lưu** và **ngay lúc ghi sổ**, nên nếu sau khi lưu phiếu có chứng từ nhập hoặc xuất mang ngày trước hoặc bằng ngày kiểm kê được thêm vào, phần chênh lệch ghi vào sổ vẫn là chênh lệch thật.
- **Ghi sổ qua `IStockLedger`**, không có SQL riêng vào sổ kho. Sổ kho chỉ nhận một chiều cho mỗi lần ghi, nên phiếu kiểm kê ghi hai lần cùng một giao dịch: phần thiếu (xuất, mã nguồn `inv_audit_count_out`) rồi phần thừa (nhập, mã nguồn `inv_audit_count`).
- **Định giá:** phần thiếu do sổ kho tính theo bình quân của kho (như phiếu xuất). Phần thừa nhập theo **giá bình quân hiện có của vật tư trong kho tại ngày kiểm kê**; nếu vật tư chưa có tồn nên chưa có giá bình quân thì dùng **giá vốn người lập nhập tay** trên dòng (cột Giá vốn).
- Đơn vị tính của dòng luôn là **đơn vị tính gốc** của vật tư, vì sổ kho giữ tồn theo đơn vị gốc.

## 2. Phiếu kiểm kê

| Trường | Ghi chú |
|---|---|
| Kho kiểm kê | bắt buộc, kho của đơn vị cơ sở (kho dùng chung cũng được) |
| Ngày kiểm kê (chốt tồn) | ngày dùng tính tồn sổ sách; thuộc tháng chưa khóa sổ; quyết định kỳ của số phiếu |
| Người / ban kiểm kê | chữ tự do, in trên biên bản |
| Lý do / phạm vi kiểm kê | chữ tự do (ví dụ "Kiểm kê định kỳ cuối tháng 10 toàn kho") |
| Ghi chú | chữ tự do |

**Dòng kiểm kê:** vật tư (đang sử dụng và là vật tư tồn kho), số lô (bắt buộc với vật tư theo dõi lô, bỏ qua với vật tư khác), vị trí kho (bắt buộc với vật tư theo dõi vị trí và phải thuộc kho kiểm kê, bỏ qua với vật tư khác), **tồn thực tế** (từ 0), giá vốn (chỉ dùng cho phần thừa của vật tư chưa có tồn), ghi chú. Hai dòng cùng vật tư, cùng lô, cùng vị trí bị từ chối (`stockCount.duplicateLine`). Mỗi phiếu tối đa 2000 dòng.

Máy chủ trả về cho mỗi dòng: **tồn sổ sách**, **chênh lệch** (thực tế trừ sổ sách; dương là thừa, âm là thiếu), **giá vốn** và **giá trị chênh lệch** (có dấu). Đầu phiếu có giá trị thừa, giá trị thiếu (số dương) và tổng hai số này (độ lớn chênh lệch, dùng chọn cấp duyệt theo số tiền).

### Lấy tồn sổ sách

Nút **Lấy tồn sổ sách** trong phần chi tiết điền các dòng từ sổ kho: kho và ngày của phiếu, tùy chọn lọc theo nhóm vật tư, chỉ vật tư đánh dấu **kiểm kê định kỳ** (`is_cycle_counted` của danh mục vật tư), và có thể kèm cả vật tư có tồn bằng 0 (để ghi nhận hàng tìm thấy ngoài sổ). Với vật tư theo dõi lô hoặc vị trí, mỗi lô và mỗi vị trí là một dòng. **Số lượng thực tế điền sẵn bằng tồn sổ sách**, nên người kiểm kê chỉ sửa các dòng lệch. Dòng đã nhập số lượng thực tế cho cùng vật tư, lô và vị trí giữ nguyên số đã nhập; dòng gõ tay mà sổ kho không có (lô mới, vật tư chưa có tồn) vẫn giữ lại.

Chọn thêm một vật tư bằng tay thì giao diện tra tồn sổ sách của vật tư đó (nếu không theo lô hay vị trí) và điền giá vốn bình quân.

### Quét tem

Ô **Quét tem** trên lưới nhận mã từ máy quét cầm tay (hoặc gõ tay) theo dạng `MÃ#LÔ#VỊ TRÍ`: quét lần đầu đặt số thực tế của dòng, các lần sau cộng thêm; mã lạ báo lỗi; nút **Đặt 0 cho dòng chưa quét** coi dòng không quét là không tìm thấy hàng. Tem in từ phiếu nhập kho. Chi tiết: `docs/kho/tem-san-pham-va-quet-ma.md`.

## 3. Luồng và trạng thái

1. **Lập chứng từ**: lưu nháp; sửa và xóa được (chỉ phiếu ở trạng thái này).
2. **Chờ duyệt → Đã phê duyệt**: theo quy trình duyệt cấu hình ở Cài đặt (người có quyền Duyệt chức năng, hoặc màn Phê duyệt kiểm kê). Đơn vị có thể tắt bước "Chờ duyệt" ở Cài đặt › Trạng thái chứng từ. Người có đủ quyền còn **lưu thẳng** ở trạng thái mà quyền của họ tới được, kể cả Đã ghi sổ.
3. **Ghi sổ** (nút ghi sổ, hoặc lưu thẳng): máy chủ tính lại tồn sổ sách tại ngày kiểm kê, ghi lại vào dòng, rồi ghi **phần thiếu (xuất)** và **phần thừa (nhập)** vào sổ kho trong cùng một giao dịch. Phiếu không có chênh lệch vẫn ghi sổ được và không ghi dòng nào vào sổ.
4. **Bỏ ghi sổ**: đảo lại hai lần ghi bằng dòng đảo (không xóa dòng cũ), phiếu về Đã phê duyệt. Bị từ chối nếu việc đảo làm âm kho (ví dụ phần thừa đã được xuất đi).
5. **Hủy** (từ Đã phê duyệt, khi chưa ghi sổ) và **Khôi phục** (về Lập chứng từ).

Hai điểm khác phiếu xuất kho:

- **Phiếu đã ghi sổ không sửa, không xóa** (không dùng quyền `ST_EDIT_POSTED`): muốn đổi thì bỏ ghi sổ, sửa, ghi sổ lại. Phiếu chưa ghi sổ chỉ sửa và xóa được ở Lập chứng từ (`stockCount.editDraftOnly`, `stockCount.deleteDraftOnly`).
- **Ghi sổ có thể bị sổ kho từ chối** dù lúc lưu hợp lệ: phần thiếu tính theo tồn tại ngày kiểm kê, nhưng sổ kho kiểm âm kho trên tồn hiện tại. Nếu sau ngày kiểm kê hàng đã được xuất hết thì phần thiếu bị từ chối (`stock.insufficient`), và toàn bộ lần ghi sổ (hoặc lần lưu thẳng) được hoàn lại, không để lại phiếu nháp hay dòng sổ nào.

## 4. Cơ sở dữ liệu và API

Script `ServerService/sql/postgresql/54-stock-counts.sql` (chạy lại được, không khóa ngoại): `erp_stock_count` (đầu phiếu) và `erp_stock_count_line` (dòng). Mọi cột `*_code` có chỉ mục; `material_code` và `warehouse_code` được khai `[References]` nên vật tư hoặc kho đã có phiếu kiểm kê không xóa được.

| Việc | Đường dẫn |
|---|---|
| Danh sách (phân trang, lọc theo trạng thái, kho, mã, ngày), xuất Excel | `GET api/inventory/stock-counts`, `.../export` |
| Lựa chọn của form (kho của đơn vị, nhóm vật tư) | `GET .../options` |
| **Tồn sổ sách** để bắt đầu một phiếu | `GET .../book-stock?warehouseCode=&date=&group=&search=&includeZero=&cycleOnly=` |
| Một phiếu, thêm, sửa, xóa | `GET .../{id}`, `POST`, `PUT .../{id}`, `DELETE .../{id}` |
| Gửi duyệt, duyệt, ghi sổ, bỏ ghi sổ, hủy, khôi phục, rút lại | `POST .../{id}/submit\|approve\|post\|unpost\|cancel\|reopen\|withdraw` |
| Từ chối | `POST .../{id}/reject` |

`POST/PUT` nhận `SaveStockCountRequest`: `date`, `warehouseCode`, `counterName`, `reason`, `note`, `items[]` (`materialCode`, `lotNumber`, `position`, `countedQuantity`, `unitCost`, `note`), `version`, `targetStatus` (Draft, Pending, Approved, Posted). Phiếu **không nhận** tồn sổ sách hay chênh lệch.

`book-stock` cần quyền Thêm hoặc Sửa của `inv_audit_count` (nó đọc tồn kho của cả kho); giá vốn trả về là 0 nếu người dùng không có quyền xem giá vốn.

Lỗi thường gặp: `stockCount.lotRequired`, `stockCount.locationRequired`, `stockCount.duplicateLine`, `stockCount.warehouseNotForUnit`, `stockCount.lineInvalid`, `stockCount.itemsRequired`, `voucherLine.materialNotStock`, `stock.insufficient` (khi ghi sổ phần thiếu).

## 5. Quyền

Chức năng `inv_audit_count`: Xem, Thêm, Sửa, Xóa, Duyệt, In, Xuất; quyền đặc biệt `VIEW_COST` (xem giá vốn và giá trị chênh lệch; không có thì các cột đó là 0 và không sắp xếp được theo giá trị), `VIEW_ALL` (xem phiếu của người khác), và quyền theo trạng thái từng đơn vị `ST_PENDING`, `ST_APPROVED`, `ST_POSTED`, `ST_UNPOST`, `ST_CANCELLED` (ví dụ `inv_audit_count:ST_POSTED@DVCS01`). Quyền Duyệt trên màn `inv_approve_audit` có tác dụng như quyền Duyệt trên chính phiếu.

## 6. In biên bản

Nút in có hai mẫu: **biên bản kiểm kê** có đủ giá vốn và giá trị chênh lệch (cần `VIEW_COST`), và bản **không giá** cho thủ kho. Biên bản ghi kho, ngày chốt tồn, ban kiểm kê, lý do, từng dòng (tồn sổ sách, thực tế, chênh lệch) và ô ký của người lập, ban kiểm kê, thủ kho, kế toán trưởng.

## 7. Cài đặt và kiểm tra

1. Chạy script `54-stock-counts.sql` (sau `53`).
2. Khởi động lại backend: tự thêm mã chức năng `inv_approve_audit`, menu Phê duyệt kiểm kê và lưới chi tiết `PKK_ITEMS` (Cài đặt › Cấu hình lưới chứng từ).
3. Cấp quyền cho các vai trò không phải admin (`inv_audit_count`, `inv_approve_audit` và các quyền theo trạng thái).
4. `dotnet test` (476 test), `npm run lint`, `npm run check-menu`, `npm run check-policy`.

Kịch bản thử qua API (ngày 2027, vì các tháng 2026 của đơn vị thử đã khóa): tồn sổ sách tại các ngày khác nhau, thiếu và thừa, lô mới, ghi sổ rồi bỏ ghi sổ (sổ kho khớp: `GET api/inventory/stock/verify` trả rỗng), chứng từ nhập mang ngày trước ngày kiểm kê được thêm sau khi lưu phiếu, phiếu không chênh lệch, phần thiếu bị sổ kho từ chối khi hàng đã xuất hết, từ chối khi sai lô, trùng dòng, vật tư không phải tồn kho, tháng đã khóa, phiên bản cũ (409), người không có quyền (403).

## 8. Chưa làm

- Quét tem bằng **camera điện thoại** (ô quét hiện chỉ nhận mã từ máy quét cầm tay hoặc gõ tay).
- **Khóa xuất nhập kho** của kho trong lúc đang kiểm kê: hiện chứng từ khác vẫn lập được; việc ghi sổ tính lại tồn nên vẫn đúng, nhưng người kiểm kê cần phối hợp với thủ kho.
- Kiểm kê **một phần theo vị trí** hoặc theo từng đợt cùng một phiếu; đếm lại (kiểm kê lần hai) và so hai lần đếm.
- Phiếu điều chỉnh tồn riêng không qua kiểm kê.
- Tự gợi ý nguyên nhân chênh lệch, phân loại thiếu theo trách nhiệm (hao hụt định mức, mất mát) và bút toán kế toán đi kèm (chờ phân hệ tài chính hạch toán sổ cái).
- Kiểm kê theo **FIFO** theo lô nhập: sổ kho hiện chỉ định giá bình quân.

## 9. Tệp mã nguồn

| Phần | Nơi |
|---|---|
| Bảng | `ServerService/sql/postgresql/54-stock-counts.sql` |
| Thực thể | `Core.Domain/Modules/Inventory/Documents/StockCounts/StockCount.cs` |
| Hợp đồng | `Core.Application/Modules/Inventory/Documents/StockCounts/StockCountContracts.cs` |
| Dịch vụ | `Core.Infrastructure/Modules/Inventory/Documents/StockCounts/StockCountService.cs` |
| Tồn sổ sách | `.../StockCounts/Sql/StockCountBook.sql` |
| API | `Core/Modules/Inventory/Documents/StockCounts/StockCountsController.cs` |
| Màn hình | `Frontend/src/modules/inventory/documents/stock-counts/`, duyệt `approval-stock-count/` |
| Lưới, in | `mock/voucherGridConfigs.ts` (`PKK_ITEMS`), `documents/voucherPrint.ts` (`printStockCount`) |
