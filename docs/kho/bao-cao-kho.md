# Báo cáo kho

Năm báo cáo của phân hệ Kho đọc thẳng từ **sổ kho** (`erp_stock_movement`), theo đơn vị cơ sở đang làm việc. Không còn dữ liệu mẫu.

| Báo cáo | Chức năng | Câu hỏi nó trả lời |
|---|---|---|
| Báo cáo tồn kho | `inv_report_stock` | Đến ngày X, mỗi kho còn bao nhiêu của từng vật tư, trị giá bao nhiêu, có dưới tối thiểu / vượt tối đa không |
| Báo cáo nhập - xuất - tồn | `inv_report_nxt` | Trong kỳ từ ngày A đến ngày B: tồn đầu, nhập, xuất, tồn cuối (số lượng và giá trị) |
| Báo cáo hàng nhập | `inv_report_inward` | Những dòng nhập kho nào trong kỳ (chi tiết từng dòng chứng từ hoặc tổng hợp theo vật tư) |
| Báo cáo hàng xuất | `inv_report_outward` | Như trên, cho hàng xuất |
| Báo cáo tuổi hàng tồn | `inv_report_aging` | Hàng tồn đến ngày X đã nằm kho bao lâu: 0-30, 31-60, 61-90, 91-180, trên 180 ngày |

## 1. Cách viết: hàm trong cơ sở dữ liệu

Mỗi báo cáo là một **hàm PostgreSQL** `rpt_*` trong script `sql/postgresql/55-inventory-reports.sql` (chạy lại nhiều lần được: xóa rồi tạo lại); riêng `rpt_stock_balance` nằm trong `56-stock-norms.sql` vì đọc bảng định mức tồn kho theo kho (chạy 55 trước 56). Mã .NET chỉ gọi hàm. Tồn tức thời và giá trung bình tháng viết cùng cách: xem `ton-tuc-thoi-gia-binh-quan-dinh-muc.md`.

| Hàm | Báo cáo |
|---|---|
| `rpt_stock_balance(đơn vị, đến ngày, kho, nhóm, từ khóa, gồm cả tồn 0)` | tồn kho |
| `rpt_stock_nxt(đơn vị, từ ngày, đến ngày, kho, nhóm, từ khóa)` | nhập xuất tồn |
| `rpt_stock_movements(đơn vị, chiều, từ ngày, đến ngày, kho, nhóm, từ khóa, giới hạn)` | hàng nhập / xuất, chi tiết |
| `rpt_stock_movement_summary(...)` | hàng nhập / xuất, tổng hợp |
| `rpt_stock_aging(đơn vị, đến ngày, kho, nhóm, từ khóa)` | tuổi hàng tồn |

Đường đi: `StockReportsController` (`api/inventory/reports`) → `StockReportService` → file `Core.Infrastructure/Modules/Inventory/Reports/Sql/*.sql` (một dòng `SELECT * FROM rpt_...`) → hàm. Quy tắc nghiệp vụ không nằm trong SQL (khoảng ngày mặc định, mức tồn dưới / vượt định mức, che giá trị) nằm ở `StockReportRules`, có test `StockReportRulesTests`.

Muốn đổi cách tính một báo cáo: sửa hàm trong script 55 rồi chạy lại script, không cần biên dịch lại.

## 2. Cách tính

- **Tồn kho**: tổng số lượng và giá trị của sổ kho đến hết ngày chọn; giá vốn bình quân = giá trị / số lượng. Mặc định bỏ dòng tồn bằng 0.
- **Nhập xuất tồn**: tồn đầu = tồn trước `từ ngày`; nhập / xuất trong kỳ theo chiều của dòng sổ; dòng đảo (bỏ ghi sổ) được tính vào chiều của dòng gốc nên phiếu đã bỏ ghi sổ triệt tiêu đúng. Tồn cuối = đầu + nhập − xuất.
- **Hàng nhập / xuất**: chỉ lấy dòng sổ còn hiệu lực (không phải dòng đảo, chưa bị đảo). Nguồn gồm phiếu nhập / xuất kho, xuất / nhập điều chuyển và kiểm kê thừa / thiếu; có số phiếu, đối tác, loại phiếu, lô.
- **Tuổi hàng tồn**: tồn hiện có được gán cho các lần nhập **mới nhất** (hàng nhập trước xuất trước); phần dư nếu có vào khoảng trên 180 ngày. Giá trị mỗi khoảng là phần của giá trị trong sổ theo tỷ lệ số lượng nên tổng các khoảng luôn bằng giá trị tồn.
- Khoảng ngày bỏ trống = từ đầu tháng đến hôm nay; từ ngày lớn hơn đến ngày bị từ chối (`report.dateRange`). Tối đa 20.000 dòng; vượt thì báo thu hẹp bộ lọc (`report.tooMany`). Màn hình hiện 300 dòng đầu, nút "Xem thêm"; file Excel có đủ mọi dòng.

Ba báo cáo tồn / nhập xuất tồn / tuổi hàng tồn luôn khớp nhau ở cùng một ngày.

## 3. Quyền

- Xem: quyền **Xem** của chức năng; Excel cần thêm **Xuất file**; nút In cần **In**.
- Giá trị tiền (giá, giá trị, giá vốn) cần quyền đặc biệt `{chức năng}:VIEW_COST`. Không có quyền: số lượng vẫn xem được, các cột tiền để trống và màn hình báo lý do.
- Mỗi lần xuất Excel ghi nhật ký (`Export`).

## 4. Màn hình

Mỗi màn có bộ lọc (ngày, kho, nhóm vật tư, từ khóa; hàng nhập / xuất còn chọn "Chi tiết / Tổng hợp theo vật tư"), thẻ tổng, bảng, **Xuất Excel** (do máy chủ làm theo đúng bộ lọc) và **In báo cáo** (khổ A4 ngang, có tên công ty). Mã chung ở `Frontend/src/modules/inventory/reports/ReportKit.tsx`; hàng nhập và hàng xuất dùng chung `MovementReportView`.

## 5. Kiểm tra sau khi triển khai

1. Chạy script `55-inventory-reports.sql` trên cơ sở dữ liệu (sau script 54).
2. Cấp quyền Xem / Xuất file (và `VIEW_COST` nếu cần) cho vai trò ở Cài đặt › Phân quyền; chỉ vai trò quản trị có sẵn quyền.
3. Mở từng báo cáo, chọn khoảng ngày rộng; so tồn cuối của nhập xuất tồn với báo cáo tồn kho và tuổi hàng tồn cùng ngày: phải bằng nhau.
4. Thiếu hàm (chưa chạy script) máy chủ trả `report.functionMissing`.
