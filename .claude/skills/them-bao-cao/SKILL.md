---
name: them-bao-cao
description: Thêm một báo cáo mới chạy thật trên backend cho S-ERP: hàm PostgreSQL rpt_*, file SQL gọi hàm, service che tiền khi thiếu VIEW_COST, xuất Excel có nhật ký, màn hình dùng ReportKit, phân quyền, đa ngôn ngữ và kiểm tra. Dùng khi người dùng muốn thêm / làm báo cáo, bảng kê, sổ chi tiết hoặc màn tra cứu số liệu (ví dụ "làm báo cáo hàng chậm luân chuyển", "thêm báo cáo công nợ phải thu", "chuyển báo cáo X từ mock lên backend").
---

# Thêm một báo cáo mới

Quy trình chuẩn để thêm một báo cáo **mà không phải đọc cả dự án**. Chỉ đọc đúng các file nêu dưới đây.

- Hướng dẫn đầy đủ, có code mẫu từng lớp: `docs/phat-trien/them-bao-cao.md`; số mục (§2...) dưới đây là mục trong file đó. **Đọc file đó trước khi viết code.**
- Mẫu đang chạy thật:
  - hàm: `ServerService/sql/postgresql/55-inventory-reports.sql`, `56-stock-norms.sql` (`rpt_stock_balance`, `rpt_stock_nxt`, `rpt_stock_movements`, `rpt_stock_aging`, `rpt_stock_availability`, `rpt_stock_monthly_cost`);
  - backend: `Core.Infrastructure/Modules/Inventory/Reports/StockReportService.cs` (`QueryAsync`, `Limited`, `Code`, `Pattern`, `Day`, `FileAsync`), `Sql/*.sql`, `StockReportRules` + `StockReportRulesTests`, controller `StockReportsController`;
  - frontend: `Frontend/src/modules/inventory/reports/` (`ReportKit.tsx`, `api.ts`, `AgingReportView.tsx`, `MonthlyCostView.tsx`).
- Tài liệu người dùng mẫu: `docs/kho/bao-cao-kho.md`.

## Quy tắc làm việc

- Trả lời người dùng bằng **tiếng Việt**. Chữ trên màn, thông báo lỗi và tài liệu viết tiếng Việt; chú thích trong code viết tiếng Anh, ngắn.
- **Không commit** nếu người dùng không yêu cầu.
- Không in mật khẩu database (đọc từ `ServerService/Core/appsettings.Local.json` bằng lệnh).
- Dữ liệu thử dùng mã `ZZ*` và **ngày năm 2027**; xóa hết khi xong.
- Quy tắc nghiệp vụ không cần cơ sở dữ liệu (khoảng ngày, giá trị mặc định, ngưỡng) nằm ở lớp quy tắc có test, **không** trong SQL; quyền, che tiền, ngôn ngữ cũng không tính trong SQL.

## Bước 0. Chốt thông tin trước khi làm (§1)

Hỏi người dùng (một lần, gộp các câu) những gì chưa rõ:

| Thông tin | Quy ước |
| --- | --- |
| Tên (vi / en), mã chức năng | chữ thường, `_`, tiền tố phân hệ: `inv_report_slow`. **Không đổi về sau** |
| Báo cáo trả lời câu hỏi gì, nguồn dữ liệu | sổ kho (`erp_stock_movement`, `erp_stock_balance`) hoặc phiếu đã duyệt / ghi sổ; không đọc mock |
| Bộ lọc | ngày / khoảng ngày, kho, nhóm, từ khóa... mỗi bộ lọc là một tham số `p_*` |
| Có tiền không | có thì cần `VIEW_COST` (hoặc `VIEW_PRICE`) của chính báo cáo; thiếu quyền trả `null` |
| Phải khớp số với báo cáo nào | dựng trên cùng hàm / cùng cách tính |
| Số dòng tối đa | `StockReportRules.MaxRows` |

Kiểm tra trước: `ls ServerService/sql/postgresql` (số script, phải **lớn hơn** script của bảng nó đọc), `grep` mã chức năng trong `FunctionCatalog.cs` và `Frontend/src/types/index.ts` (mã có sẵn của màn mock thì dùng lại).

## Bước 1. Hàm PostgreSQL (§2)

1. Viết `DROP FUNCTION IF EXISTS rpt_<ten>(<kiểu tham số>); CREATE FUNCTION rpt_<ten>(p_unit text, ...) RETURNS TABLE (...) LANGUAGE sql STABLE` trong script của phân hệ hoặc script mới. `p_unit` luôn có; tham số lọc có thể null; tìm không dấu bằng `sys_search_match`; tính dòng đảo của sổ kho đúng quy ước §2.
2. Chạy script **hai lần** trên `erp_dev`, gọi thử `select * from rpt_<ten>('DVCS01', ...)` và so với tính tay.

## Bước 2. Backend (§3)

| # | Việc |
| --- | --- |
| 2.1 | `Core.Infrastructure/Modules/<PhanHe>/Reports/Sql/<Ten>.sql`: một dòng `SELECT * FROM rpt_<ten>(@unit, @asof::date, @x::text, ...)`, **ép kiểu mọi tham số** |
| 2.2 | Query + DTO (tiền là `decimal?`), quy tắc trong `...ReportRules` + test |
| 2.3 | Service: `Get...Async` (`QueryAsync`, `Limited`, ngày truyền bằng `DateTime` qua `Day`, che tiền theo `canSeeCost`), `Export...Async` (cột tiền chỉ khi được xem, `FileAsync` ghi nhật ký `Export`); interface; DI nếu service mới |
| 2.4 | Controller: `GET` cần View; `GET .../export` cần View **và** Export; `CanSeeCostAsync(<mã>)` |
| 2.5 | `FunctionCatalog`; **`SpecialRightCatalog.PricedCatalogsAndReports`** nếu có tiền; **`LookupAccessCatalog`** (mảng `StockReports` hoặc `Consumers`) cho các ô chọn trên màn lọc; `Messages.vi.json` + `Messages.en.json` (`export.report.*`, `report.*`, `function.<ma>` en); nút trong nhóm báo cáo của `Core/SeedData/menu.json` |

## Bước 3. Frontend (§4)

| # | Việc |
| --- | --- |
| 3.1 | `types/index.ts`, `config/functions.ts` (loại `'report'`), `navigation.subMenus.<ma>` (vi + en) và `function.<ma>` (en), `case` trong `<PhanHe>Module.tsx` |
| 3.2 | `api.ts`: kiểu hàng (tiền `number \| null`) và hàm đọc + tên file xuất |
| 3.3 | Màn `<Ten>ReportView.tsx` dùng `ReportKit` (`useReport`, `ReportFrame`, `CommonFilters`, `useRowLimit`); không tự kiểm quyền (khung lo nút Xuất / In); số bằng `useNumberFormat`; chữ bằng `t()`; export trong `reports/index.ts` |

## Bước 4. Kiểm tra (bắt buộc, báo kết quả thật) (§5)

1. Dừng backend nếu đang chạy, rồi:
   ```bash
   cd /d/TungLV/Project/PhanMemQL/ServerService && dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj
   cd /d/TungLV/Project/PhanMemQL/Frontend && npm run lint && npm run check-i18n && npm run check-menu
   ```
2. Chạy `backend` và `frontend` bằng preview, đăng nhập `admin` / `admin`.
3. API: số liệu khớp tay và khớp báo cáo cùng chủ đề; bộ lọc; giá trị sai → 400; chưa chạy script → `report.functionMissing` (không phải 500); quyền: không Xem → 403, chỉ Xem → tiền `null` và Excel 403, có Xuất → tải được, có `VIEW_COST` → có tiền; ô chọn trên màn lọc vẫn 200 với người chỉ xem báo cáo; Excel đúng số dòng, tiêu đề theo ngôn ngữ, có dòng nhật ký `EXPORT`.
4. Trình duyệt: đổi bộ lọc, xuất, in, màn hẹp, tiếng Anh. Cấp quyền bằng SQL thì khởi động lại backend.
5. Dọn dữ liệu thử; báo cáo kho thì `GET /api/inventory/stock/verify` phải rỗng.

## Bước 5. Tài liệu và báo cáo (§6)

- Tài liệu người dùng trong `docs/<phan-he>/` (mẫu `docs/kho/bao-cao-kho.md`), dựng Word bằng `node docs/cong-cu/build-word.cjs`, thêm dòng vào `docs/README.md`; cập nhật `CLAUDE.md`, `README.md`, bảng API trong `ServerService/README.md`; có bảng mới thì chạy lại từ điển cơ sở dữ liệu.
- Nếu phải làm khác `docs/phat-trien/them-bao-cao.md` để chạy được, **sửa lại tài liệu** trong cùng lần làm.

Báo bằng tiếng Việt, ngắn: file thêm / sửa (link), script đã chạy, kết quả test / lint kèm số, đã thử gì (kể cả tài khoản không phải quản trị), đã dọn dữ liệu thử, việc người dùng còn phải làm (cấp Xem / Xuất và `VIEW_COST` cho vai trò ở Cài đặt › Người dùng & phân quyền).

Không commit.
