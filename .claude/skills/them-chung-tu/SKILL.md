---
name: them-chung-tu
description: Thêm một chứng từ mới (phiếu có trạng thái, phê duyệt, số tự cấp, khóa sổ, có thể ghi sổ kho) chạy thật trên backend cho S-ERP, đủ SQL, backend .NET, màn hình React, danh sách phân trang, xuất Excel, lưới chi tiết, phân quyền theo đơn vị, nhật ký, chống ghi đè và kiểm tra. Dùng khi người dùng muốn thêm / tạo / làm chứng từ hoặc phiếu mới (ví dụ "làm phiếu thu", "thêm hóa đơn bán hàng", "chuyển phiếu giao hàng từ mock lên backend"), kể cả chứng từ lấy dòng từ chứng từ trước.
---

# Thêm một chứng từ mới

Quy trình chuẩn để thêm một chứng từ **mà không phải đọc cả dự án**. Chỉ đọc đúng các file nêu dưới đây.

- **Dùng công cụ sinh trước**: `npm run tao-chung-tu -- <mo-ta.json>` (trong `Frontend/`, hướng dẫn `docs/phat-trien/them-chung-tu-nhanh.md`, mẫu `docs/phat-trien/mau-chung-tu/vi-du-danh-gia-nha-cung-cap.json`) sinh trọn một chứng từ không ghi sổ: SQL, thực thể, hợp đồng, dịch vụ, controller, màn hình khai báo trên `components/voucher/VoucherScreen.tsx` và mọi chỗ đăng ký (dòng đánh dấu `[tao-chung-tu]` / `[tao-danh-muc]`). Chạy `--thu` trước, rồi chạy thật, rồi thêm tay phần riêng (luật trong `ValidateAsync`, ghi sổ, lấy dòng từ chứng từ trước, màn phê duyệt, mẫu in) theo các bước dưới. Sai thì `--hoan-tac <mã>`.
- Hướng dẫn đầy đủ: `docs/phat-trien/them-chung-tu.md`; số mục (§5.4...) dưới đây là mục trong file đó. **Đọc file đó trước khi viết code.**
- Mẫu đang chạy thật, sao rồi sửa:
  - chứng từ ghi sổ kho: phiếu xuất kho `GoodsIssueService.cs`, `GoodsIssuesController.cs`, `Frontend/src/modules/inventory/documents/goods-issues/`, SQL `39-inventory-goods-issues.sql`;
  - chứng từ không ghi sổ, danh sách phân trang gọn nhất: đơn bán hàng `SalesOrderService.cs`, `SalesOrdersController.cs`, `Frontend/src/modules/sales/documents/sales-orders/`, SQL `53-sales-orders.sql`;
  - chứng từ nối tiếp (lấy dòng từ chứng từ trước): đơn mua ← yêu cầu mua, phiếu xuất ← đơn bán (§10).
- Khối dùng chung (không viết lại): `IFiscalPeriodService`, `IVoucherNumberService`, `IExchangeRateService`, `DocumentStatusPolicy` / `DocumentActor`, `IDocumentApprovalService`, `IStockLedger`, `PostedEdit`, `VoucherListQuery` + `SortMap` + `ToPagedAsync`, `IExcelExporter`, `PermissionGate`, `UomRules`; frontend `usePagedList`, `GridView serverSide`, `VoucherDetailGrid`, `SaveStatusSelect`, `OpenDocumentPicker`, `voucherPrint.ts`.

## Quy tắc làm việc

- Trả lời người dùng bằng **tiếng Việt**. Chữ trên màn, thông báo lỗi và tài liệu viết tiếng Việt; chú thích trong code viết tiếng Anh, ngắn, giống code xung quanh.
- **Không commit** nếu người dùng không yêu cầu.
- Không in mật khẩu: lấy mật khẩu database từ `ServerService/Core/appsettings.Local.json` bằng lệnh, không ghi ra màn hình hay file.
- Dữ liệu thử dùng **ngày năm 2027** (các tháng 2026 của DVCS01 đã khóa) và mã `ZZ*`; xóa hết khi xong.
- Không sửa `ServerService/_legacy/`.

## Bước 0. Chốt thông tin trước khi làm

Hỏi người dùng (một lần, gộp các câu) những gì chưa rõ, đề xuất sẵn giá trị theo bảng §1:

| Thông tin | Quy ước | Ví dụ |
| --- | --- | --- |
| Tên chứng từ (vi / en) | | Phiếu thu / Cash receipt |
| Mã chức năng | chữ thường, `_`, tiền tố phân hệ. **Không đổi về sau** | `fin_receipt_voucher` |
| Loại số chứng từ | 2 đến 4 chữ in hoa | `PT` |
| Bảng | `erp_<ten>`, `erp_<ten>_line` | `erp_cash_receipt`, `erp_cash_receipt_line` |
| API | `api/<phan-he>/<so-nhieu>` | `api/finance/cash-receipts` |
| Màn phê duyệt riêng | `<phan-he>_approve_<ten>` hoặc không | |
| Ghi sổ không, chiều nào | sổ kho In / Out, hoặc không ghi sổ (`NonPosting`) | |
| Lấy dòng từ chứng từ trước không | cột `<chứng từ trước>_line_id` | |
| Đối tác, danh mục tham chiếu | mỗi cột `*_code` là một `[References]` | khách hàng, loại tiền |
| Quyền đặc biệt thêm | `VIEW_COST`, `ST_EDIT_POSTED` | |
| Icon (lucide-react) | | `Wallet` |

Mã chức năng đã có trong `Frontend/src/types/index.ts` (màn đang là mock) thì **dùng lại mã đó**. Kiểm tra trước: `ls ServerService/sql/postgresql` (số script tiếp theo), `grep` mã chức năng trong `FunctionCatalog.cs`, `VoucherCatalog.cs`, `types/index.ts`.

## Bước 1. Database (§2)

1. Tạo `ServerService/sql/postgresql/NN-<phan-he>-<ten>.sql`: chạy lại được, **Kiểu cột bằng domain `ud_*` của `00-helpers.sql`** (`ud_code20`, `ud_text200`, `ud_dec18_2`, `ud_status`, `ud_user_id`...), không gõ `varchar(N)` / `numeric(P,S)` tay; cột `*_code` trỏ sang danh mục dài đúng bằng mã của danh mục đó (`ColumnLengthTests`); entity ghi `MaxLength` khớp. **Không khóa ngoại**, 4 cột dấu bản ghi, `CHECK` trạng thái, chỉ mục `(unit_code, document_date DESC)`, **chỉ mục bắt đầu bằng chính cột cho mỗi cột `*_code`**, chỉ mục cho cột nối `*_line_id`, trigger xóa phiếu nếu ghi sổ kho (`erp_voucher_delete_cleanup`).
2. Chạy script **hai lần** trên `erp_dev`, không in mật khẩu:
   ```bash
   cd /d/TungLV/Project/PhanMemQL/ServerService
   export PGPASSWORD=$(node -e "const c=require('./Core/appsettings.Local.json').ConnectionStrings.CoreContext;process.stdout.write(/Password=([^;]+)/i.exec(c)[1])")
   "C:/Program Files/PostgreSQL/15/bin/psql.exe" -h localhost -U postgres -d erp_dev -v ON_ERROR_STOP=1 -f sql/postgresql/NN-<ten>.sql
   ```

## Bước 2. Backend (`ServerService/`)

| # | Việc | Mục |
| --- | --- | --- |
| 2.1 | Thực thể đầu phiếu `: ErpEntity, IApprovableDocument` với `[Audited]`, dòng `[NotAudited]`; `[References<...>]` cho mọi `*_code`; `DbSet` trong `CoreContext` | §3 |
| 2.2 | Hợp đồng: DTO (kèm `Version`), `Save...Request(..., uint? Version = null, string? TargetStatus = null)`, interface có `ListAsync` + `ExportAsync` (nhận `VoucherListQuery`), **không** có `GetAll` | §3 |
| 2.3 | `FunctionCatalog`, `VoucherCatalog.All` (+ `ApprovalScreens`), `VoucherStatusCatalog.NonPosting` nếu không ghi sổ, `SpecialRightCatalog` (`VIEW_COST`, `ST_EDIT_POSTED`) nếu cần | §4 |
| 2.4 | **`LookupAccessCatalog`**: thêm mã vào nhóm `StockVouchers` / `PurchaseVouchers` / `SalesVouchers` / `FinanceVouchers` (hoặc `Consumers`, `SensitiveFor`). Quên thì mọi ô chọn trả 403 cho người không phải quản trị | §4 |
| 2.5 | Thông báo vi + en: `<tiền tố>.*` (không bắt đầu bằng `voucher.` trừ tên loại), `voucher.<LOAI>`, `function.<ma>` (en), `table.<bang>`, `export.<loai>.*`, `field.*` | §4 |
| 2.6 | Dịch vụ (sao từ mẫu): kiểm tra, cấp số trong transaction, khóa sổ, `PermissionGate.EnsureTouchAsync` đầu `ChangeStatus` / `Reject`, chính sách trạng thái, duyệt, ghi sổ qua `IStockLedger`, nhật ký `audit.Attach`, `ExpectVersion`, `TargetStatus`, giữ giá đã lưu khi người sửa không có `VIEW_PRICE` (`KeepPrices`) (`EnsureTargetAllowedAsync` + `AdvanceAsync`) | §5.1 đến §5.3 |
| 2.7 | `FilterAsync` + `ListAsync` + `ExportAsync` với `SortMap`, `EnsureSortAllowed` (cột tiền), che giá khi thiếu `VIEW_PRICE`, nhật ký `Export` rồi `SaveChangesAsync` | §5.4 |
| 2.8 | `reopen`: tháng mở, `EnsureLinksStillFitAsync`, về Draft | §5.5 |
| 2.9 | Chứng từ nối tiếp: lớp `...Progress`, `Validate...LinkAsync`, chặn hủy chứng từ trước, endpoint `open-*` | §10 |
| 2.10 | `DocumentApprovalService` **ba chỗ** (`IsVoucherFunction`, `FindVoucherAsync`, `NotFoundKey`); controller (mọi `GET` có `RequirePermission` View, `GET export` View + Export, route `{id:long}/{operation}` không bao giờ tên `action`); đăng ký DI | §6 |

Bắt buộc: `throw new BusinessRuleException("khóa", args)`, không viết câu trong `throw`; không gán dấu bản ghi, không tự xóa cache; không viết SQL ghi sổ riêng.

## Bước 3. Frontend (`Frontend/src/`) (§7)

| # | Việc |
| --- | --- |
| 3.1 | `types/index.ts` (`SubMenuKey`), `config/functions.ts` (loại `'voucher'`), `locales/{vi,en}/common.json` (`navigation.subMenus.<ma>`, `function.<ma>` en, `audit.objectType.<loai>`), `menu.json`, icon mới vào cả hai chỗ của `DynamicIcon.tsx`, `case` trong `<PhanHe>Module.tsx` |
| 3.2 | `api.ts`: `getPage`, `exportAll`, `getOptions`, `create` / `update` (kèm `targetStatus`), `changeStatus` (gồm `reopen`), `remove`; chỉ `apiRequest` / `apiDownload` |
| 3.3 | Màn phiếu: danh sách `usePagedList` + `GridView serverSide` (sao từ `SalesOrderView.tsx`), mở phiếu từ thông báo kể cả khi không nằm trên trang, ô chọn bằng `CatalogLookup`, trường Trạng thái bằng `saveStatusChoices`, nút Khôi phục, in phiếu (`voucherPrint.ts` `KINDS`) |
| 3.4 | Lưới chi tiết: `VoucherGridInfo` trong `mock/voucherGridConfigs.ts` (`gridId` = `<LOAI>_ITEMS`) + `systemVoucherGridRegistry`, truyền `gridInfo` cho `VoucherDetailGrid`, rồi `npm run export-voucher-grids` |
| 3.5 | Màn phê duyệt riêng (nếu có) + `APPROVAL_SCREENS` trong `utils/permissions.ts` |
| 3.6 | Chữ mới bằng `t()` ở `locales/{vi,en}/<phân hệ>.json` |

## Bước 4. Kiểm tra (bắt buộc, báo kết quả thật) (§8)

1. Dừng backend nếu đang chạy (DLL bị khóa), rồi:
   ```bash
   cd /d/TungLV/Project/PhanMemQL/ServerService && dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj
   cd /d/TungLV/Project/PhanMemQL/Frontend && npm run lint && npm run check-i18n && npm run check-menu && npm run check-policy
   ```
   `check-i18n` còn lỗi cũ không liên quan; chỉ cần không thêm lỗi mới.
2. Chạy `backend` và `frontend` bằng preview (`.claude/launch.json`), đăng nhập `admin` / `admin`.
3. Thử bằng API (script trong scratchpad, gửi JSON tiếng Việt từ file UTF-8) và trình duyệt, đủ danh sách ở §8: lập / sửa / 409 / khóa sổ; gửi duyệt, duyệt, từ chối, rút lại; ghi sổ / bỏ ghi sổ và `GET /api/inventory/stock/verify` rỗng sau mỗi bước; lưu thẳng ở từng trạng thái; danh sách phân trang, sắp xếp, lọc, xuất Excel; hủy rồi khôi phục; lưới chi tiết trong Cài đặt › Cấu hình lưới chứng từ.
4. **Thử bằng một tài khoản không phải quản trị viên**: chỉ Xem + Thêm thì các ô chọn vẫn tải được; quyền trạng thái ở đơn vị chưa cấp bị từ chối; không có `VIEW_PRICE` thì giá 0, không sắp theo cột tiền, Excel không có cột tiền.
5. Xóa dữ liệu thử: phiếu, dòng, dòng sổ kho, vòng duyệt, nhật ký, `sys_voucher_sequence` của tháng thử, tài khoản / vai trò tạm.

## Bước 5. Tài liệu và báo cáo (§9)

- Viết `docs/<phan-he>/<ten>.md` theo mẫu `docs/kho/phieu-xuat-kho.md`, dựng Word bằng `node docs/cong-cu/build-word.cjs <md> <docx> "<chân trang>" "<tiêu đề>"`; thêm dòng vào `docs/README.md`; cập nhật `CLAUDE.md`, `README.md`, bảng API trong `ServerService/README.md`, bảng chứng từ trong `docs/he-thong/phan-quyen.md` (A5, A8); từ điển cơ sở dữ liệu (`docs/cong-cu/gen-database-doc.cjs` + `database-notes.cjs` + `database-scripts.cjs`, chạy rồi dựng Word).
- Nếu phải làm khác `docs/phat-trien/them-chung-tu.md` để chạy được, **sửa lại tài liệu** trong cùng lần làm.

Báo bằng tiếng Việt, ngắn: file thêm / sửa (link `[file](path)`), script SQL đã chạy, kết quả test / lint kèm số, đã thử gì trên API / trình duyệt (kể cả tài khoản không phải quản trị), đã dọn dữ liệu thử, việc người dùng còn phải làm (cấp quyền và quyền trạng thái theo đơn vị cho vai trò, khai quy tắc phê duyệt).

Không commit.
