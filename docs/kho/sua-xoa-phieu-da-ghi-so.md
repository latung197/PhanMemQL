# Sửa và xóa phiếu đã ghi sổ

Phiếu nhập kho, phiếu xuất kho, phiếu xuất điều chuyển và phiếu nhập điều chuyển sau khi **ghi sổ** vẫn sửa và xóa được, với điều kiện việc đó **không làm âm kho**. Phiếu yêu cầu, đơn mua, lệnh điều chuyển không ghi sổ nên không thuộc phần này (chúng sửa được khi còn ở trạng thái Lập chứng từ).

## 1. Quyền

Quyền đặc biệt **Sửa / xóa phiếu đã ghi sổ** (`ST_EDIT_POSTED`), cấp **theo từng đơn vị cơ sở** như các quyền trạng thái khác (Cài đặt › Người dùng & phân quyền, nhóm quyền trạng thái của chức năng). Người dùng còn cần quyền **Sửa** (để sửa) hoặc **Xóa** (để xóa) của chức năng. Quản trị viên có sẵn mọi quyền. Thiếu quyền, máy chủ trả lời: *Cần quyền "Sửa / xóa phiếu đã ghi sổ" của đơn vị cơ sở này…*.

## 2. Sửa phiếu đã ghi sổ

Mở phiếu đã ghi sổ trên danh sách (trạng thái "Chuyển sổ kho"), sửa, bấm **Lưu & Cập Nhật** (không có nút Lưu Nháp, phiếu vẫn ở trạng thái đã ghi sổ). Máy chủ làm trong **một giao dịch**:

1. kiểm tra quyền, kỳ chưa khóa, phiên bản (chống ghi đè);
2. đảo bút toán sổ kho của bản cũ và ghi sổ bản mới (`IStockLedger.ReplaceAsync`);
3. **chỉ kiểm tra âm kho trên kết quả cuối**, ở các kho / vật tư / lô / vị trí mà hai bản chạm tới;
4. có chỗ âm thì hủy cả lần lưu: phiếu và sổ kho giữ nguyên như trước khi sửa, thông báo nêu vật tư, kho và số thiếu: *Sau khi sửa, vật tư … tại … sẽ bị âm …: các phiếu xuất khác đã lấy hàng từ phiếu này.*

Ví dụ: phiếu nhập 120, đã xuất 100 (tồn 20). Sửa phiếu nhập xuống 110 → được (tồn 10). Sửa xuống 50 → bị từ chối (tồn sẽ là −50). Phiếu xuất 100 sửa lên 105 → được nếu kho còn đủ 5; sửa lên 200 → bị từ chối.

Sửa số lượng, vật tư, kho, lô, vị trí, ngày chứng từ đều đi qua cùng cách kiểm tra. Nhật ký thay đổi ghi bản cũ và bản mới của các dòng.

## 3. Xóa phiếu đã ghi sổ

Nút **Xóa** hiện cho phiếu đã ghi sổ khi người dùng có quyền xóa và quyền ở mục 1. Máy chủ bỏ ghi sổ phiếu (đảo bút toán, **kiểm tra âm kho ngay**) rồi xóa phiếu và dòng chi tiết; trigger `erp_voucher_delete_cleanup` dọn nốt các dòng sổ đã triệt tiêu. Phiếu nhập đã có hàng bị xuất đi thì không xóa được (tồn sẽ âm) cho tới khi xóa hoặc sửa các phiếu xuất đó.

## 4. Những trường hợp bị chặn

- **Kỳ đã khóa** (theo đơn vị): không sửa / xóa phiếu của tháng đó, như mọi chứng từ.
- **Phiếu xuất điều chuyển đã có phiếu nhập điều chuyển** (chưa hủy) nhận hàng từ nó: không sửa, không xóa; cần hủy hoặc xóa các phiếu nhập trước.
- **Phiếu đã hủy**: chỉ xem.
- Phiếu **chưa ghi sổ** vẫn theo quy tắc cũ: chỉ sửa / xóa khi ở trạng thái Lập chứng từ (đã duyệt hay đang chờ duyệt thì rút hoặc bỏ ghi sổ về trước).

## 5. Giá vốn

Phiếu xuất tính giá vốn theo giá bình quân của kho **tại thời điểm ghi sổ**. Khi sửa hoặc xóa một phiếu nhập cũ, giá bình quân thay đổi nhưng **các phiếu xuất đã ghi sổ sau đó giữ giá cũ**, nên giá vốn có thể lệch nhẹ cho tới khi có chức năng tính lại giá bình quân theo kỳ. Phiếu xuất được sửa thì tính lại theo giá bình quân hiện tại. Phiếu nhập điều chuyển không bị ảnh hưởng vì mang giá trị của phiếu xuất.

## 6. Mã nguồn

| Phần | Nơi |
|---|---|
| Quyền `ST_EDIT_POSTED` | `SpecialRightCatalog.StatusEditPosted`, nhãn `right.statusEditPosted.*` |
| Kiểm tra quyền khi sửa / xóa phiếu đã ghi sổ | `Core.Infrastructure/Modules/Inventory/Documents/PostedEdit.cs` |
| Đảo và ghi sổ lại, kiểm âm kho cuối | `IStockLedger.ReplaceAsync` (`StockLedgerService`) |
| Dịch vụ phiếu | `UpdateAsync` / `DeleteAsync` của `GoodsReceiptService`, `GoodsIssueService`, `TransferIssueService`, `TransferReceiptService` |
| Màn hình | `GoodsReceiptView`, `GoodsIssueView`, `TransferVoucherView`: `canEditPosted`, `editingPosted` |

Lỗi thường gặp: `policy.editPostedRight`, `stock.insufficientAfterChange`, `stock.insufficient` (khi xóa), `transferIssue.editHasReceipts`, `fiscal.locked`.
