# Định mức tồn kho, tồn kho tức thời và giá trung bình tháng

Ba màn còn lại của phân hệ Kho (trước đây là dữ liệu mẫu) nay chạy thật trên backend, cùng nguồn với năm báo cáo kho: **sổ kho** (`erp_stock_movement`) và các bảng số dư.

| Màn | Chức năng | Làm gì |
|---|---|---|
| Định mức tồn kho | `inv_stock_norm_cat` | Danh mục: tồn tối thiểu, tối đa, an toàn và điểm đặt hàng lại của từng vật tư **theo từng kho** |
| Tính tồn kho tức thời | `inv_calc_instant_stock` | Tồn hiện có, số đã giữ chỗ, số khả dụng; nút kiểm tra và dựng lại số dư |
| Tính giá trung bình tháng | `inv_calc_monthly_cost` | Giá bình quân gia quyền của một tháng, tính từ sổ kho (chỉ để xem) |

## 1. Định mức tồn kho

- Bảng `erp_stock_norm` (script `56-stock-norms.sql`). Khóa là **vật tư + kho**, viết thành mã `VT001@KHO1` (giống mã lô); vật tư và kho của định mức đã lưu **không đổi được**, muốn đổi thì xóa và thêm lại.
- Số lượng tính theo **đơn vị tính gốc** của vật tư. Để trống = chưa khai. Tối thiểu không được lớn hơn tối đa; điểm đặt hàng lại không được lớn hơn tối đa; không số âm.
- Chỉ vật tư đang sử dụng và là hàng tồn kho mới có định mức; kho phải đang sử dụng. Định mức dùng chung cho mọi đơn vị cơ sở (kho là danh mục chung).
- Màn hình là màn danh mục chuẩn: tìm kiếm, lọc theo kho, chọn cột, nhập / xuất Excel, xóa nhiều, chống ghi đè (409 khi sửa bản cũ), có nhật ký thay đổi. Vật tư đã có định mức không xóa được (thông báo "đang được dùng ở: Định mức tồn kho").
- **Báo cáo tồn kho dùng định mức này**: hàm `rpt_stock_balance` lấy tối thiểu / tối đa của dòng định mức đang hoạt động của kho đó; thiếu (hoặc bằng 0) thì dùng tồn tối thiểu / tối đa khai trên vật tư. Nhờ vậy cùng một vật tư có thể có mức khác nhau ở mỗi kho. Mức "dưới tối thiểu / vượt tối đa" trên báo cáo đổi theo.
- Điểm đặt hàng lại và tồn an toàn hiện chỉ để khai báo và xuất Excel; chưa có báo cáo nào dùng.

## 2. Tính tồn kho tức thời

Bảng theo kho và vật tư của đơn vị đang làm việc, đọc hàm `rpt_stock_availability` (script `55`):

| Cột | Cách tính |
|---|---|
| Tồn hiện có | Số dư kho `erp_stock_balance` (luôn bằng tổng sổ kho), đơn vị tính gốc |
| Giữ chỗ (yêu cầu xuất) | Phần **chưa xuất** của các phiếu yêu cầu xuất kho **đã duyệt** của kho đó |
| Giữ chỗ (đơn bán) | Phần chưa xuất của các đơn bán hàng **đã duyệt** của kho đó |
| Khả dụng | Tồn hiện có − giữ chỗ yêu cầu − giữ chỗ đơn bán. Âm (màu đỏ) khi đã hứa nhiều hơn tồn |

Quy tắc giữ chỗ:

- Phần chưa xuất của một dòng = số lượng dòng − số lượng đã xuất trên các phiếu xuất **đã ghi sổ** nối vào dòng đó. Phiếu xuất chưa ghi sổ (nháp, chờ duyệt, đã duyệt) chưa lấy hàng ra khỏi kho nên vẫn còn giữ chỗ; hủy phiếu xuất thì số giữ chỗ trở lại.
- Dòng dùng đơn vị khác đơn vị tính gốc được đổi theo danh mục quy đổi đúng như sổ kho (quy đổi riêng của vật tư thắng quy đổi chung, quy đổi viết ngược thì lấy nghịch đảo).
- Yêu cầu xuất và đơn bán là hai nguồn riêng, cộng lại. Phiếu nháp, chờ duyệt và đã hủy không giữ chỗ.
- Các thẻ trên đầu cộng tổng; có Excel (`availability/export`) và In báo cáo.

Hai nút kiểm tra (công cụ bảo trì, dùng sẵn `IStockLedger`):

- **Kiểm tra sổ kho** (quyền Xem): so ba bảng số dư (theo kho, lô, vị trí) với tổng sổ kho; báo "khớp" hoặc liệt kê các dòng lệch.
- **Dựng lại số dư** (quyền Sửa): xóa và dựng lại các bảng số dư của đơn vị từ sổ kho, có hỏi xác nhận; sổ kho không bị thay đổi. Chỉ cần dùng khi kiểm tra báo lệch (ví dụ sau khi sửa dữ liệu trực tiếp trong cơ sở dữ liệu).

## 3. Tính giá trung bình tháng

Chọn tháng, kho, nhóm, từ khóa. Mỗi dòng là một vật tư trong một kho (hàm `rpt_stock_monthly_cost`, dựng trên `rpt_stock_nxt`):

| Cột | Cách tính |
|---|---|
| Tồn đầu, Nhập, Xuất, Tồn cuối | Như báo cáo nhập xuất tồn của đúng tháng đó (số lượng và giá trị) |
| **Giá BQ tháng** | (giá trị tồn đầu + giá trị nhập) / (số lượng tồn đầu + số lượng nhập); để trống khi không có gì để bình quân |
| Giá vốn cuối kỳ | Giá trị tồn cuối / số lượng tồn cuối: giá bình quân di động mà sổ kho đang giữ |

Ví dụ: đầu tháng tồn 25 giá trị 3.000; nhập 25 giá trị 5.000 → giá BQ tháng = (3.000 + 5.000) / 50 = 160.

**Màn hình chỉ để xem và đối chiếu.** Phiếu xuất khi ghi sổ đã được sổ kho tính ngay theo bình quân di động của kho; màn này không tính lại giá của phiếu đã ghi sổ, nên không có nút "Tính" hay "Cập nhật giá". Hai cột giá đặt cạnh nhau để thấy chênh lệch giữa cách bình quân tháng và bình quân di động.

Giá trị cần quyền đặc biệt `inv_calc_monthly_cost:VIEW_COST`; không có thì số lượng vẫn xem được, các cột giá để trống. Excel (`monthly-cost/export`) cần quyền Xuất file và được ghi nhật ký.

## 4. API

| Việc | Đường dẫn | Quyền |
|---|---|---|
| Danh mục định mức | `api/inventory/stock-norms` (7 API chuẩn của danh mục; bộ lọc `materialCode`, `warehouseCode`) | Chức năng `inv_stock_norm_cat` |
| Tồn tức thời | `GET api/inventory/reports/availability` + `/export` (`warehouse`, `materialGroup`, `search`, `includeZero`) | Xem / Xuất của `inv_calc_instant_stock` |
| Kiểm tra / dựng lại | `GET api/inventory/stock/verify`, `POST api/inventory/stock/rebuild` | Xem / Sửa của `inv_calc_instant_stock` |
| Giá trung bình tháng | `GET api/inventory/reports/monthly-cost` + `/export` (`year`, `month` 1-12, `warehouse`, `materialGroup`, `search`) | Xem / Xuất của `inv_calc_monthly_cost`, giá cần `VIEW_COST` |

Tháng ngoài 1-12 hoặc năm ngoài 2000-2100 bị từ chối (`report.monthInvalid`).

## 5. Triển khai

1. Chạy script `55-inventory-reports.sql` rồi `56-stock-norms.sql` (hàm `rpt_stock_balance` nay nằm trong script 56 vì cần bảng định mức; script 55 không còn hàm này nên **luôn chạy 55 trước 56**).
2. Cấp quyền cho vai trò ở Cài đặt › Phân quyền: Xem / Sửa của ba chức năng, Xuất file nếu cần, và quyền đặc biệt Xem giá vốn của giá trung bình tháng. Chỉ vai trò quản trị có sẵn quyền.
3. Nhập định mức cho các vật tư cần theo dõi theo kho (hoặc nhập Excel), rồi mở Báo cáo tồn kho kiểm tra cột mức tồn.

## 6. Kiểm tra đã làm

- 514 test backend đạt (thêm test tháng hợp lệ / không hợp lệ).
- Thử bằng API trên dữ liệu thật: giá tháng 3/2027 (nhập 10@100 và 20@130, xuất 5 → giá BQ 120; tháng 4 nhập 25@200 → giá BQ 160), định mức (tạo, sửa, trùng, sai khoảng, âm, đổi kho, 409, lọc, xuất Excel, chặn xóa vật tư), báo cáo tồn đổi mức theo định mức rồi quay về mức của vật tư khi xóa định mức, tồn tức thời khớp số tay (VT001 giữ chỗ 70 = 50 + 20) và phép quy đổi (12 LIT × 0,2 + 6 = 8,4), `verify` trả rỗng.
- Đã mở ba màn trên trình duyệt: danh sách, form thêm, bộ lọc tháng, nút Kiểm tra sổ kho. Dữ liệu thử đã xóa.
