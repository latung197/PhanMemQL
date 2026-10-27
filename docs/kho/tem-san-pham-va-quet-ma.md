# Tem sản phẩm và quét mã khi kiểm kê

Khi hàng về kho, người nhận in **tem sản phẩm** từ phiếu nhập kho; khi kiểm kê, thủ kho **quét tem** để điền đúng dòng của phiếu kiểm kê thay vì gõ mã vật tư và số lô. Tính năng chỉ ở phía giao diện (trình duyệt): không có bảng hay API mới, nên không có script SQL cần chạy.

Màn hình: Kho › Phiếu nhập kho (nút **In tem**), Kho › Phiếu kiểm kê (ô **Quét tem**). Hướng dẫn kiểm kê đầy đủ ở `docs/kho/phieu-kiem-ke.md`.

## 1. Mã trên tem

Mã in trên tem (và đọc lại khi quét) có dạng:

```
MÃ_VẬT_TƯ#SỐ_LÔ#VỊ_TRÍ
```

| Ví dụ | Ý nghĩa |
|---|---|
| `VT001` | vật tư không theo dõi lô, không theo dõi vị trí |
| `VT001#LOT-2610` | vật tư theo dõi lô |
| `VT001#LOT-2610#A-01` | vật tư theo dõi lô và vị trí |
| `VT001##A-01` | chỉ có vị trí, không có lô (hai dấu `#` liền nhau) |

Quy tắc:

- **Viết hoa**, bỏ khoảng trắng hai đầu; phần rỗng ở cuối được bỏ.
- Dấu ngăn cách là `#`, vì mọi bàn phím mà máy quét có thể giả lập đều gõ ra cùng một ký tự (`|` thì không, nhiều bố cục bàn phím gõ ra ký tự khác). Khi **đọc** mã, hệ thống chấp nhận cả `#` và `|` để dùng được tem in từ nơi khác.
- Nếu mã vật tư, số lô hoặc vị trí có chứa `#` hoặc `|` thì khi in tem ký tự đó đổi thành `-`. Danh mục không cấm các ký tự này, nên nên tránh dùng chúng khi đặt mã.
- Mã **không** chứa số lượng: một tem nhận diện **vật tư + lô + vị trí**, không nhận diện từng thùng hay từng kiện. Theo dõi từng kiện cần thêm đơn vị theo dõi trong sổ kho, chưa làm.

Mã hóa và giải mã nằm ở `Frontend/src/utils/stockLabel.ts` (`encodeStockLabel`, `parseStockLabel`); `npm run check-label` kiểm các ca mẫu.

## 2. In tem ở phiếu nhập kho

Nút **In tem** có ở form phiếu nhập kho (khi mở một phiếu đã lưu) và ở cột thao tác trên danh sách (biểu tượng mã QR); cần quyền **In** của phiếu nhập kho.

Hộp thoại **In Tem Sản Phẩm**:

- Liệt kê các dòng hàng của phiếu (mã vật tư, tên, số lô, vị trí, số lượng nhập) và ô **Số tem** cho từng dòng. Mặc định mỗi dòng 1 tem. Nút **Số tem = số lượng nhập** đặt số tem bằng số lượng nhập (làm tròn lên), nút **Mỗi dòng 1 tem** đặt lại. Số tem 0 là không in dòng đó (tối đa 999 mỗi dòng).
- **Khổ tem:** 50 × 30, 70 × 40 hoặc 100 × 50 mm.
- **Loại mã:**
  - **Code 128** (mặc định): mã vạch một chiều, mọi máy quét cầm tay đều đọc được.
  - **QR:** đọc được bằng camera điện thoại và máy quét 2D, chứa được nhiều chữ hơn.
- Lần chọn khổ tem và loại mã được nhớ trong trình duyệt (`localStorage['s_erp_label_options']`); nếu không lưu được thì lần sau về mặc định.

Tem in ra có: tên vật tư, mã vạch hoặc mã QR, dòng chữ của mã (để đọc bằng mắt và gõ tay khi tem hỏng), số lô, vị trí, đơn vị tính, số phiếu nhập và ngày chứng từ.

**In bằng gì:** trình duyệt in mỗi tem một trang đúng khổ (`@page size` theo mm, lề 0, ngắt trang sau mỗi tem), nên chạy với bất kỳ máy in tem cài như máy in thường (Zebra, TSC, Xprinter...). Khi in, chọn **đúng máy in tem**, khổ giấy **theo khổ đã chọn trong hộp thoại**, tắt đầu trang và chân trang của trình duyệt, tỷ lệ 100%. Nếu trình duyệt chặn cửa sổ in thì phải cho phép cửa sổ bật lên (popup) cho trang này.

## 3. Quét tem ở phiếu kiểm kê

Trong form phiếu kiểm kê (khi phiếu còn ở trạng thái Lập chứng từ) có ô **Quét tem** phía trên lưới chi tiết. Máy quét cầm tay loại USB hoặc Bluetooth ở chế độ bàn phím gõ mã vào ô đang chọn rồi bấm Enter, nên không cần cài thêm gì; cũng có thể gõ tay mã (kể cả `MÃ#LÔ#VỊ TRÍ`) rồi Enter. Enter trong ô này **không** gửi form.

Mỗi lần quét:

1. Tìm vật tư trong danh mục theo mã. Không có thì báo đỏ "Mã … không có trong danh mục vật tư" kèm tiếng bíp thấp, và không đổi gì.
2. Tìm **dòng** có cùng vật tư, lô và vị trí. Không có dòng đó nhưng vật tư đã có một dòng chưa ghi lô và vị trí thì dòng ấy nhận lô và vị trí của tem. Vẫn không có thì **thêm dòng mới** (đọc tồn sổ sách của dòng đó từ sổ kho nếu có; giá vốn lấy theo giá bình quân của vật tư trong kho).
3. Đặt **số thực tế**: **lần quét đầu tiên** của một dòng trong lần mở phiếu này đặt số thực tế bằng số lượng mỗi lần quét, **các lần sau cộng thêm**. Nhờ vậy số điền sẵn từ "Lấy tồn sổ sách" không bị cộng nhầm vào số đếm.
4. Hiện dòng kết quả (xanh) ví dụ `ZZKK2 · lô L1 → thực tế 3` và bíp ngắn.

Các điều khiển kèm theo:

- **SL mỗi lần quét** (mặc định 1): nếu mỗi tem đại diện cho cả thùng 12 cái thì đặt 12.
- Nút **Đặt 0 cho dòng chưa quét** (hiện sau lần quét đầu): theo nguyên tắc kiểm kê bằng quét, dòng nào không quét tem coi như không tìm thấy hàng, nên số thực tế về 0 và chênh lệch là thiếu toàn bộ tồn sổ sách. Có hộp xác nhận trước khi đặt.

Quy trình khuyên dùng: lập phiếu, bấm **Lấy tồn sổ sách** (để có đủ các dòng), quét từng tem, bấm **Đặt 0 cho dòng chưa quét**, rà các dòng lệch, **Lưu**. Với kho chỉ kiểm một phần, bỏ qua bước đặt 0 và chỉ quét những dòng thật sự đếm.

Như mọi phiếu kiểm kê, **tồn sổ sách, chênh lệch và giá trị do máy chủ tính lại khi lưu và khi ghi sổ**; những gì giao diện hiện lúc quét chỉ để theo dõi.

## 4. Giới hạn

- Tem nhận diện vật tư + lô + vị trí, không nhận diện từng thùng; quét hai lần cùng một tem là cộng hai lần (không phát hiện quét trùng).
- Giao diện không biết vật tư nào theo dõi lô hay vị trí; tem thiếu lô của vật tư theo dõi lô vẫn quét được vào dòng nhưng bị máy chủ từ chối khi lưu (`stockCount.lotRequired`).
- **Quét bằng camera điện thoại chưa làm.** Cần trang chạy bằng **HTTPS** (hoặc `localhost`) thì trình duyệt mới cho mở camera.
- Chưa in tem từ các chứng từ khác (nhập điều chuyển, nhập từ sản xuất) và chưa in tem cho vật tư ngoài phiếu (ví dụ tem vị trí kệ).
- Chưa có khổ tem tùy ý hay mẫu tem theo công ty (logo, tên công ty).

## 5. Tệp mã nguồn

| Phần | Nơi |
|---|---|
| Mã hóa / giải mã mã tem | `Frontend/src/utils/stockLabel.ts` |
| Dựng và in tem | `Frontend/src/modules/inventory/documents/stockLabelPrint.ts` (thư viện `jsbarcode`, `qrcode`) |
| Hộp thoại In tem | `Frontend/src/modules/inventory/documents/StockLabelDialog.tsx` |
| Nút In tem | `goods-receipts/GoodsReceiptView.tsx` |
| Ô Quét tem | `stock-counts/StockCountView.tsx` (`handleScan`, `handleZeroUnscanned`) |
| Kiểm tra mã | `Frontend/scripts/check-stock-label.ts` (`npm run check-label`) |
