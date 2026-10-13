# Phiếu yêu cầu mua hàng và đơn mua hàng: từ cơ sở dữ liệu đến giao diện

Tài liệu này đi hết một chứng từ mua hàng theo thứ tự **cơ sở dữ liệu → backend → frontend**, lấy hai chứng từ có thật là **Phiếu yêu cầu mua hàng** (`pur_request`, số `YCM`) và **Đơn mua hàng** (`pur_order`, số `DMH`) làm ví dụ. Phần 6 là các bước làm một chứng từ mua hàng mới theo đúng mẫu đó. Tổng quan nghiệp vụ và báo cáo dự án xem `docs/mua-hang/mua-hang-va-du-an.md`; khung chung của mọi chứng từ xem `docs/phat-trien/them-chung-tu.md`.

Đường dẫn dưới đây tính từ gốc dự án. `{BE}` = `ServerService`, `{FE}` = `Frontend/src`.

---

## 1. Bức tranh chung

```
Phiếu yêu cầu mua hàng (YCM) ──lấy dòng──▶ Đơn mua hàng (DMH) ──lấy dòng──▶ Phiếu nhập kho (PNK)
  duyệt, KHÔNG ghi sổ                        duyệt, KHÔNG ghi sổ                 duyệt, GHI SỔ kho
```

Quy tắc xuyên suốt:

1. Chứng từ sau **trỏ về dòng** của chứng từ trước (`purchase_request_line_id`, `purchase_order_line_id`), không sao chép số lượng.
2. **Số đã xử lý không lưu**: "Đã đặt" của một dòng yêu cầu = tổng số lượng các dòng đơn mua trỏ tới nó (đơn chưa hủy); "Đã nhập" của một dòng đơn = tổng số lượng các dòng phiếu nhập trỏ tới nó (phiếu chưa hủy). Xóa hoặc hủy chứng từ sau thì số tự trả lại.
3. Hai chứng từ mua hàng **không đụng đến sổ kho**; chỉ phiếu nhập kho gọi `IStockLedger`.
4. Không có khóa ngoại: mọi liên kết là cột `*_code` hoặc `*_id` có chỉ mục, dịch vụ tự kiểm khi lưu và chặn xóa bản ghi đang được dùng.
5. Frontend là nguồn của mã chức năng, kiểu dữ liệu; backend làm theo.

---

## 2. Cơ sở dữ liệu

### 2.1. Script và thứ tự chạy

| Script (`{BE}/sql/postgresql/`) | Việc | Điều kiện |
|---|---|---|
| `43-voucher-status.sql` | Bảng trạng thái chứng từ theo đơn vị (`sys_voucher_status`) | chạy trước 44 |
| `44-purchasing.sql` | Hai chứng từ: đầu phiếu và dòng; cột nối sang phiếu nhập kho (`purchase_order_code`, `purchase_order_line_id`) | sau 42, 43 |
| `46-purchase-order-line-delivery.sql` | Cột `delivery_date` trên dòng đơn mua (ngày dự kiến nhận hàng theo từng vật tư); dòng cũ lấy ngày ở đầu đơn | sau 44 |
| `45-purchasing-catalogs.sql` | Danh mục dự án, điều khoản thanh toán, nhóm nhà cung cấp; cột `project_code` trên 5 chứng từ; `payment_term_code` trên đơn mua; `supplier_group_code` trên nhà cung cấp; dữ liệu mẫu | sau 44 |

Chạy **theo thứ tự tên file**, mỗi script chạy lại được (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Chạy bằng `psql` (có thể nằm ở `C:\Program Files\PostgreSQL\16\bin`), chỉ trên database `erp_dev`:

```bash
psql -h localhost -U postgres -d erp_dev -v ON_ERROR_STOP=1 -f ServerService/sql/postgresql/44-purchasing.sql
```

Không có EF migration: đổi cấu trúc là sửa hoặc thêm một script `NN-*.sql`.

### 2.2. Bảng `erp_purchase_request` (đầu phiếu yêu cầu)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigint, tự tăng, khóa chính | |
| `code` | varchar(64), duy nhất | Số chứng từ `YCM-DVCS01-202610-0001`; **duy nhất toàn hệ thống** vì vòng duyệt khóa theo số phiếu |
| `unit_code` | varchar(20) | Đơn vị cơ sở của phiếu (`[References<CompanyUnit>]`) |
| `document_date` | date | Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu) |
| `created_date` | date | Ngày lập (ngày hệ thống, UTC) |
| `required_date` | date, rỗng được | Ngày cần hàng |
| `warehouse_code` | varchar(20) | Kho nhận hàng; phải là kho dùng được cho `unit_code` |
| `voucher_type` | varchar(100) | Loại mua (trong nước, nhập khẩu, ...) |
| `department_code` | varchar(20), rỗng được | Bộ phận yêu cầu |
| `requester_name` | varchar(200) | Người yêu cầu (chữ tự do) |
| `supplier_code`, `supplier_name` | rỗng được | Nhà cung cấp đề nghị; tên chép từ danh mục lúc lưu |
| `currency_code`, `exchange_rate` | varchar(10), numeric(18,6) | Loại tiền, tỷ giá theo ngày chứng từ (`> 0`) |
| `note` | varchar(1000) | Diễn giải |
| `status` | varchar(20) | `Draft`, `Pending`, `Approved`, `Posted`, `Cancelled` (ràng buộc CHECK; phiếu này không bao giờ tới `Posted`) |
| `total_value` | numeric(18,2) | Tổng giá trị dự kiến **quy ra tiền hạch toán** = tổng thành tiền × tỷ giá |
| `approved_by_user_id` | integer | Người duyệt cuối |
| `project_code` | varchar(20), rỗng được | Dự án (script 45) |
| `created_at/by`, `updated_at/by` | | Dấu bản ghi, do `CoreContext` điền khi lưu, **không bao giờ do code nghiệp vụ gán** |

Chỉ mục: `(unit_code, document_date DESC)`, và một chỉ mục **bắt đầu bằng chính cột** cho mỗi cột `*_code` trỏ sang danh mục (`warehouse_code`, `currency_code`, `department_code`, `supplier_code`, `project_code`). Đây là điều kiện của test `TableReferenceTests`: khi xóa một danh mục, hệ thống tra các cột đó nhanh để biết còn ai dùng.

### 2.3. Bảng `erp_purchase_request_line` (dòng yêu cầu)

| Cột | Ý nghĩa |
|---|---|
| `request_id` | Đầu phiếu (không khóa ngoại, có chỉ mục `ix_..._request`) |
| `line_no` | Số dòng, duy nhất trong phiếu (`UNIQUE (request_id, line_no)`) |
| `material_code`, `material_name` | Mã vật tư (danh mục `erp_material`), tên **chép từ danh mục lúc lưu** |
| `uom_code` | Đơn vị tính (danh mục `erp_uom`) |
| `quantity` `> 0`, `unit_price` `>= 0`, `amount` | Số lượng, đơn giá (theo loại tiền của phiếu), thành tiền = số lượng × đơn giá |
| `note` | Ghi chú dòng |

### 2.4. Bảng đơn mua hàng

`erp_purchase_order` khác phiếu yêu cầu ở các cột:

| Cột | Ý nghĩa |
|---|---|
| `delivery_date` | Ngày giao hàng dự kiến |
| `supplier_code` **NOT NULL**, `supplier_name` | Nhà cung cấp bắt buộc |
| `payment_terms` | Chữ điều khoản thanh toán **lúc lưu** (hoặc chữ tự do cũ) |
| `payment_term_code` | Điều khoản chọn từ danh mục `erp_payment_term` (rỗng được) |
| `tax_rate_code`, `tax_rate` | Mã thuế (danh mục `sys_tax_rate`) và **thuế suất đã chép** (7,4 chữ số) |
| `sub_total`, `tax_amount` | Tiền hàng và tiền thuế **theo loại tiền của đơn** |
| `total_value` | (tiền hàng + tiền thuế) × tỷ giá = **tiền hạch toán** |
| `purchase_request_code` | Danh sách số phiếu yêu cầu mà đơn lấy (cách nhau dấu phẩy, **do dịch vụ suy ra từ các dòng**, không phải nguồn sự thật) |
| `project_code` | Dự án |

`erp_purchase_order_line` thêm `delivery_date` (**ngày dự kiến nhận của từng dòng**; dòng lưu không kèm ngày thì lấy `delivery_date` ở đầu đơn, nên mặc định mọi dòng cùng ngày, vật tư nào giao khác thì sửa riêng; ngày dòng không được trước ngày chứng từ, khóa thông báo `purchaseOrder.lineDeliveryDateInvalid`) và `purchase_request_line_id` (bigint, rỗng được, có chỉ mục một phần): **đây là nguồn sự thật** của việc "đơn này lấy dòng yêu cầu nào".

### 2.5. Cột nối sang phiếu nhập kho

`erp_goods_receipt.purchase_order_code` (danh sách số đơn, suy ra) và `erp_goods_receipt_line.purchase_order_line_id` (nguồn sự thật), có chỉ mục một phần.

### 2.6. Các bảng dùng chung mà hai phiếu dựa vào (không tạo mới)

| Bảng | Dùng để |
|---|---|
| `sys_voucher_numbering`, `sys_voucher_sequence` | Mẫu số và bộ đếm số phiếu theo loại + đơn vị + kỳ; mẫu mặc định có `{DVCS}` |
| `sys_document_approval` | Các cấp duyệt của một phiếu (khóa theo mã chức năng + số phiếu) |
| `sys_approval_rule` | Quy tắc phê duyệt (người duyệt theo cấp, theo giá trị) |
| `sys_voucher_status` | Tên trạng thái đổi theo đơn vị, và bật / tắt bước **Chờ duyệt** |
| `sys_fiscal_period` | Khóa sổ theo tháng |
| `sys_audit_log` | Nhật ký thay đổi (tự ghi) |
| `sys_command`, `sys_menu` | Mã chức năng và menu, tự thêm khi backend khởi động |
| `sys_table_ref` | Bản đồ tham chiếu, ghi lại mỗi lần khởi động từ các thuộc tính `[References]` |

Dòng của hai chứng từ **không** ghi vào `erp_stock_*`.

---

## 3. Backend

Kiến trúc một chiều: `Core → Core.Infrastructure → Core.Application → Core.Domain`. Mỗi lớp có thư mục `Modules/Purchasing/` (chứng từ ở `Documents/<Tên>/`).

### 3.1. Danh sách tệp

| Lớp | Tệp (`{BE}/…`) | Việc |
|---|---|---|
| Domain | `Core.Domain/Modules/Purchasing/Documents/PurchaseRequests/PurchaseRequest.cs` | Thực thể đầu phiếu + dòng, `IApprovableDocument`, `[Audited]`, `[References]` |
| | `…/PurchaseOrders/PurchaseOrder.cs` | Như trên cho đơn mua |
| Application | `Core.Application/Modules/Purchasing/Documents/PurchaseRequests/PurchaseRequestContracts.cs` | DTO, request lưu, tùy chọn, dòng "còn đặt được", `IPurchaseRequestService` |
| | `…/PurchaseOrders/PurchaseOrderContracts.cs` | Như trên cho đơn mua (+ đơn "còn nhận được") |
| | `Core.Application/Common/Paging/VoucherListQuery.cs` | Bộ lọc chung của danh sách chứng từ |
| | `Core.Application/Common/Documents/VoucherCatalog.cs` | Loại chứng từ, số phiếu, màn duyệt |
| | `Core.Application/Common/Permissions/FunctionCatalog.cs` | Mã chức năng |
| | `Core.Application/Common/Localization/Messages.vi.json` / `.en.json` | Thông báo lỗi và nhãn |
| Infrastructure | `Core.Infrastructure/Modules/Purchasing/Documents/PurchaseRequests/PurchaseRequestService.cs` | Toàn bộ nghiệp vụ |
| | `…/PurchaseOrders/PurchaseOrderService.cs` | Nghiệp vụ đơn mua |
| | `Core.Infrastructure/Modules/Purchasing/Categories/ProjectChecks.cs` | Kiểm dự án dùng chung cho 5 chứng từ |
| | `Core.Infrastructure/Modules/Approvals/DocumentApprovalService.cs` | Chuyển trạng thái khi duyệt (ba chỗ khai chứng từ) |
| | `Core.Infrastructure/Common/Persistence/CoreContext.cs` | `DbSet` |
| | `Core.Infrastructure/DependencyInjection.cs` | Đăng ký dịch vụ |
| API | `Core/Modules/Purchasing/Documents/PurchaseRequests/PurchaseRequestsController.cs` | `api/purchasing/purchase-requests` |
| | `…/PurchaseOrders/PurchaseOrdersController.cs` | `api/purchasing/purchase-orders` |
| Dữ liệu | `Core/SeedData/menu.json` | Nút menu |

### 3.2. Thực thể (Domain)

- Đầu phiếu kế thừa `ErpEntity` (4 cột dấu bản ghi + `Version` ánh xạ vào `xmin` làm khóa chống ghi đè) và cài `IApprovableDocument` (`Code`, `Status`, `ApprovedByUserId`) để `DocumentApprovalService` đổi được trạng thái.
- `[Audited("pur_request", "purchaseRequest", Label = "{Code}")]` bật nhật ký tự động cho đầu phiếu; dòng khai `[NotAudited("...")]` vì dịch vụ ghi thay đổi dòng vào bản ghi của đầu phiếu (`audit.Attach`).
- Mỗi cột `*_code` khai `[References<Bảng đích>]` (`Optional = true` khi được rỗng): `unit_code`→`CompanyUnit`, `warehouse_code`→`Warehouse`, `currency_code`→`Currency`, `department_code`→`Department`, `supplier_code`→`Supplier`, `project_code`→`Project`; dòng: `material_code`→`Material`, `uom_code`→`Uom`. Cột mã thuế khai `[References<TaxRate>]`. Có thuộc tính này thì danh mục đích không xóa được khi còn phiếu dùng, và khi lưu hệ thống kiểm mã tham chiếu có thật.
- Dòng đơn mua có `PurchaseRequestLineId` (long?) — **không** khai `[References]` vì đó là id, không phải mã.

### 3.3. Hợp đồng (Application)

Ví dụ phiếu yêu cầu (rút gọn):

```csharp
public sealed record SavePurchaseRequestLine(string MaterialCode, string UomCode, decimal Quantity, decimal UnitPrice, string? Note);

public sealed record SavePurchaseRequestRequest(DateOnly Date, DateOnly? RequiredDate, string WarehouseCode, string VoucherType,
    string? DepartmentCode, string? RequesterName, string? SupplierCode, string CurrencyCode, decimal ExchangeRate,
    string? Note, IReadOnlyList<SavePurchaseRequestLine> Items, uint? Version = null,
    string? TargetStatus = null, string? ProjectCode = null);
```

- `Version`: số phiên bản khi **sửa**; lệch thì 409.
- `TargetStatus`: `Draft` (mặc định), `Pending`, `Approved` — trạng thái muốn lưu thẳng (xem 3.6). `Posted` bị từ chối (`…noPosting`).
- DTO trả về mang `Version`, `Items` (có `OrderedQuantity` / `ReceivedQuantity`), `ProjectCode`; **người không có `VIEW_PRICE` nhận mọi giá bằng 0** (backend không gửi giá về).
- Dòng "còn lấy được" cho cửa sổ chọn: `OpenPurchaseRequestLineDto(LineId, MaterialCode, ..., RequestedQuantity, OrderedQuantity, RemainingQuantity, UnitPrice, Note)` gói trong `OpenPurchaseRequestDto` (một phiếu yêu cầu đã duyệt còn hàng); tương tự `OpenPurchaseOrderDto` cho phiếu nhập kho.

### 3.4. Dịch vụ: từng hàm

Cả hai dịch vụ cùng một khung (sao từ `IssueRequestService`/`GoodsIssueService`). Thành phần được tiêm: `CoreContext db`, `IUnitOfWork`, `IVoucherNumberService`, `IFiscalPeriodService`, `IExchangeRateService`, `IPermissionService`, `IDocumentApprovalService`, `IAuditLog`, `IVoucherStatusService`, `IExcelExporter`.

**`ListAsync` / `ExportAsync`** — `FilterAsync` dựng truy vấn: luôn lọc theo đơn vị của phiên; không có quyền đặc biệt `VIEW_ALL` thì chỉ thấy phiếu mình lập (`CreatedBy`); áp bộ lọc `status`, `warehouse`, `project`, `voucherType`, `department` (yêu cầu) hoặc `supplier` (đơn), `from`/`to`, `code` (một hoặc nhiều mã), `search` (số phiếu, ghi chú, nhà cung cấp, kho, mã và tên vật tư của dòng). `SortMap` là danh sách cột được sắp xếp; sắp theo `totalValue` khi không có `VIEW_PRICE` bị từ chối (thứ tự sẽ lộ giá). Xuất Excel cần quyền Xem + Xuất, tối đa `PagingLimits.MaxExportRows` dòng, và ghi nhật ký `Export`.

**`CreateAsync`**

1. `permissions.EnsureAllowedAsync(Create)`.
2. `ValidateAsync` (3.5) trả về `Checked` (tỷ giá, tên vật tư, ...).
3. `ProjectChecks.EnsureAsync` kiểm dự án.
4. `EnsureTargetAllowedAsync`: lưu thẳng trạng thái cao hơn Nháp thì kiểm quyền trạng thái theo đơn vị (`ST_*`).
5. Trong **một giao dịch** (`unitOfWork.ExecuteAsync`): thêm đầu phiếu, **cấp số** `numbers.NextAsync("YCM", unit, ngày, token)` (nguyên tử, không trùng khi nhiều người lưu cùng lúc), lưu để có `id`, thêm dòng (`LineNo` 1, 2, ...), `audit.Attach(row, [AuditChange("items", null, tóm tắt dòng)])`, lưu, rồi `AdvanceAsync` đưa phiếu tới `TargetStatus`.
6. Đọc lại phiếu và trả DTO.

**`UpdateAsync`**

1. Nạp phiếu có theo dõi; `EnsureActionAsync(Edit)`; chỉ khi `Draft` (`…editDraftOnly`: phải rút khỏi quy trình duyệt trước).
2. Kiểm khóa sổ **cả ngày cũ** (`row.DocumentDate`) và ngày mới.
3. **Giữ giá cũ** nếu người sửa không có `VIEW_PRICE` (`KeepPrice`): form của họ chỉ có giá 0, nếu không giữ thì lưu sẽ ghi đè giá về 0.
4. `ValidateAsync`, `ProjectChecks`, `EnsureTargetAllowedAsync`, rồi **`db.ExpectVersion(row, request.Version, touch: true)`** ngay trước khi sửa (lệch → `ConflictException("record.changed")` → HTTP 409).
5. Giao dịch: ghi lại đầu phiếu, **xóa dòng cũ và thêm dòng mới** (id dòng đổi sau mỗi lần sửa), nhật ký dòng trước → sau, `AdvanceAsync`.

**`ChangeStatusAsync(action)`** — `submit`, `approve`, `cancel`, `withdraw` (không có `post`/`unpost`):

- `withdraw`: chỉ người lập, chỉ khi `Pending`; gọi `approvals.WithdrawAsync`, về `Draft`.
- `submit`: `DocumentStatusPolicy.Check` rồi `approvals.SubmitAsync` (dựng các cấp duyệt theo quy tắc và giá trị phiếu, gửi thông báo cho người duyệt); bước **Chờ duyệt** phải đang bật ở đơn vị (`statuses.EnsureEnabledAsync`).
- `approve`: `approvals.ApproveAsync`; khi mọi cấp xong (`APPROVED`) thì phiếu sang `Approved` và ghi `ApprovedByUserId`. **Người lập không tự duyệt qua nút Duyệt.**
- `cancel`: chỉ từ `Approved`; **chặn nếu còn chứng từ sau chưa hủy** lấy từ nó (`PurchaseRequestProgress.HasOrdersAsync`, `PurchaseOrderProgress.HasReceiptsAsync`).
- `RejectAsync(reason)`: từ chối kèm lý do, về `Draft`.

**`DeleteAsync`**: chỉ phiếu `Draft`, kiểm khóa sổ; xóa dòng rồi đầu phiếu trong một giao dịch.

**`GetOpenAsync`**: các phiếu `Approved` của đơn vị còn dòng chưa xử lý hết. `Remaining = Quantity − đã đặt`, trong đó "đã đặt" tính qua `PurchaseRequestProgress.OrderedByLineAsync(db, lineIds, exceptOrderId)`; `exceptOrderId` là đơn đang sửa (số nó đã lấy không bị tính là đã đặt, để sửa lại không tự chặn mình). Giá lấy sang là 0 nếu người dùng thiếu `VIEW_PRICE` của chức năng **nhận** (đơn mua / phiếu nhập).

### 3.5. Kiểm dữ liệu khi lưu (`ValidateAsync`)

Thứ tự của phiếu yêu cầu (đơn mua thêm các mục có dấu *):

1. Ngày chứng từ không thuộc kỳ đã khóa sổ hoặc trước ngày bắt đầu nhập liệu (`fiscal.EnsureDateOpenAsync`).
2. Kho có, đang dùng và **dùng được cho đơn vị** (`db.UsableBy(unit)`).
3. Loại tiền có và đang dùng; tỷ giá theo **ngày chứng từ** (`rates.GetRateAsync`).
4. Có dòng, tối đa 500 dòng; độ dài các chuỗi (`Guard.*` dùng nhãn `field.*`).
5. Ngày cần hàng / ngày giao không trước ngày chứng từ.
6. Bộ phận, nhà cung cấp có và đang dùng (tên nhà cung cấp chép từ danh mục). \*Đơn mua: nhà cung cấp **bắt buộc**; điều khoản thanh toán có thì chép tên vào `payment_terms`; mã thuế có và đang dùng, thuế suất chép vào `tax_rate`.
7. Mỗi dòng: số lượng `> 0`, giá `>= 0`; vật tư có, đang dùng và **là hàng tồn kho** (`IsStockItem`); đơn vị tính có và đang dùng; tên vật tư lấy từ danh mục.
8. \*Đơn mua: `ValidateRequestLinkAsync` cho các dòng mang `PurchaseRequestLineId` — phiếu yêu cầu phải `Approved`, cùng kho, dòng phải cùng vật tư và đơn vị tính, và số lượng đặt (cộng với số đã đặt ở đơn khác) **không vượt** số yêu cầu. Chuỗi `purchase_request_code` được suy ra từ các dòng ở đây.

Tính tiền (`Apply`): `Amount = Quantity × UnitPrice` (làm tròn 2); yêu cầu: `TotalValue = tổng thành tiền × tỷ giá`; đơn mua: `SubTotal = tổng thành tiền`, `TaxAmount = SubTotal × thuế suất / 100`, `TotalValue = (SubTotal + TaxAmount) × tỷ giá`.

Mọi lỗi nghiệp vụ là `throw new BusinessRuleException("khóa", đối số)` — **không bao giờ viết câu** trong `throw`; câu chữ nằm trong `Messages.vi.json` / `.en.json`.

### 3.6. Lưu thẳng ở một trạng thái (`TargetStatus`)

Người có quyền tới trạng thái nào thì lưu thẳng ở trạng thái đó được (ô **Trạng thái** của form chính là lựa chọn này):

| Muốn lưu ở | Điều kiện | `AdvanceAsync` làm |
|---|---|---|
| Lập chứng từ | luôn được | chỉ lưu |
| Chờ duyệt | quyền Thêm / Sửa + `ST_PENDING` của đơn vị, bước Chờ duyệt đang bật | `approvals.SubmitAsync` |
| Đã phê duyệt | quyền **Duyệt**, `ST_APPROVED` của đơn vị, và là người duyệt của **mọi cấp** | `EnsureCanApproveDirectAsync` + `ApproveDirectAsync` (ghi mỗi cấp một dòng đã duyệt bởi chính người này). Nếu đơn vị **tắt** bước Chờ duyệt: `ApproveWithoutFlowAsync`, không cần người duyệt |

Quyền cho một trạng thái sau **bao gồm** các bước trước (Chờ duyệt < Đã duyệt). Một bước bị từ chối thì **cả lần lưu bị hủy** nhờ giao dịch chung: không bao giờ để phiếu dở dang.

### 3.7. Quyền

- Chức năng có 7 hành động `view / create / edit / delete / approve / print / export`: `POST` → Create, `PUT` → Edit, `DELETE` → Delete, mọi `GET` → View (test `ReadAccessContractTests` chặn thiếu).
- Quyền đặc biệt do `VoucherCatalog` cấp tự động: `VIEW_PRICE` (xem giá), `VIEW_ALL` (xem phiếu người khác) và quyền trạng thái **theo đơn vị** `ST_PENDING`, `ST_APPROVED`, `ST_CANCELLED` lưu dạng `pur_request:ST_APPROVED@DVCS01`. Hai chứng từ này nằm trong `VoucherStatusCatalog.NonPosting` nên **không có** `ST_POSTED`, `ST_UNPOST`.
- Chuyển trạng thái đi qua `DocumentStatusPolicy.Check(action, status, actor)` với `DocumentActor.For(..., unitCode)`; bản sao phía frontend là `{FE}/utils/documentPolicy.ts`, hai bản phải khớp (`npm run check-policy` kiểm với `DocumentPolicyCases.json`).

### 3.8. Controller và đăng ký

Controller mỏng, kế thừa `ApiControllerBase` (đòi đăng nhập và quyền vào đơn vị của token):

```csharp
[Route("api/purchasing/purchase-orders")]
public sealed class PurchaseOrdersController(IPurchaseOrderService orders, IPurchaseRequestService requests) : ApiControllerBase
{
    private const string Function = "pur_order";
    [HttpGet, RequirePermission(Function, PermissionAction.View)] ...            // danh sách phân trang
    [HttpGet("export"), RequirePermission(View), RequirePermission(Export)] ...  // Excel
    [HttpGet("options")] ...                                                     // kho, tiền tệ, nhà cung cấp, thuế
    [HttpGet("open-requests")] ...                                               // phiếu yêu cầu còn đặt được
    [HttpGet("{id:long}")], [HttpPost], [HttpPut("{id:long}")], [HttpDelete("{id:long}")]
    [HttpPost("{id:long}/{operation}")] ...                                      // submit | approve | cancel | withdraw
    [HttpPost("{id:long}/reject")] ...
}
```

**Tên tham số đường dẫn không được là `action`, `controller`, `area`, `handler`, `page`** (tên dành riêng của ASP.NET Core, route sẽ không bao giờ khớp): vì vậy là `{operation}`. Đăng ký ở `DependencyInjection.cs`: `services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();`.

### 3.9. Đăng ký chức năng (một lần cho mỗi chứng từ)

| Việc | Ở đâu |
|---|---|
| Mã chức năng | `FunctionCatalog.cs`: `["pur_order"] = "Đơn mua hàng"` |
| Loại số + quyền đặc biệt + chỗ trong màn Quy tắc phê duyệt | `VoucherCatalog.All`: `new("pur_order", "DMH", "Đơn mua hàng")` |
| Chứng từ không ghi sổ | `VoucherStatusCatalog.NonPosting` |
| Màn phê duyệt riêng | `VoucherCatalog.ApprovalScreens`: `["pur_approve_order"] = ["pur_order"]` |
| Đổi trạng thái khi duyệt | `DocumentApprovalService`: **ba chỗ** `IsVoucherFunction`, `FindVoucherAsync`, `NotFoundKey` (quên một chỗ thì duyệt xong phiếu vẫn "Chờ duyệt", chưa có test chặn) |
| Menu | `menu.json`, nhóm "Cập nhật số liệu" của Mua hàng: `MNU_PUR_ORDER` với `subKey = pur_order` |
| Thông báo | `purchaseOrder.*`, `export.purchaseOrder.*`, `field.*`, `function.pur_order` và `voucher.DMH` (chỉ bản en; bản vi lấy tên trong `VoucherCatalog`) |

Quy tắc đặt khóa thông báo: dùng tiền tố riêng của chứng từ (`purchaseOrder.*`); **không** đặt khóa mới bắt đầu bằng `voucher.` ngoài tên loại chứng từ (test `EveryFunctionAndVoucherHasAnEnglishName`).

### 3.10. Phiếu nhập kho lấy từ đơn mua

`GoodsReceiptService.ValidateOrderLinkAsync` cùng cách với 3.5 mục 8 nhưng chặt hơn: đơn phải `Approved`, **cùng kho, cùng loại tiền, cùng nhà cung cấp**, dòng cùng vật tư và đơn vị tính, số nhập không vượt số còn lại (`PurchaseOrderProgress.ReceivedByLineAsync`). Controller phiếu nhập có `GET .../open-orders?receiptId=` (cần quyền Xem **phiếu nhập**, không cần quyền Xem đơn mua).

Khi lấy dữ liệu từ đơn, phiếu nhập **tự lấy dự án của đơn** (nếu phiếu chưa chọn dự án), mỗi dòng hiện **số đơn mua** và **ngày dự kiến nhận** của dòng đơn (`GoodsReceiptLineDto.OrderDeliveryDate`, cột chỉ đọc "Dự Kiến Nhận" ở lưới). Màn hình còn **cảnh báo ngay khi nhập vượt số còn lại của đơn** (khung vàng phía trên lưới, tính từ `GET .../open-orders?receiptId=`); máy chủ vẫn là nơi từ chối khi lưu.

### 3.11. Báo cáo chi phí theo dự án

Không đi qua EF: `ProjectCostService` đọc hai tệp SQL nhúng `Core.Infrastructure/Modules/Purchasing/Reports/Sql/ProjectCost.sql` và `ProjectCostVouchers.sql` qua `ISqlExecutor` (luôn tham số hóa `@unit`, `@project`, `@from`, `@to`). Chi tiết ở `docs/mua-hang/mua-hang-va-du-an.md`.

---

## 4. Ví dụ gọi API

Đăng nhập: `POST /api/auth/login` `{ "username": "admin", "password": "…", "unitCode": "DVCS01" }` → `{ "token": "…" }`; mọi lệnh sau gửi `Authorization: Bearer <token>`.

(Mã vật tư, đơn vị tính, nhà cung cấp, thuế trong các ví dụ dưới đây chỉ để minh họa; dùng mã có thật trong danh mục của mày.)

**Lập phiếu yêu cầu rồi lưu thẳng "Đã phê duyệt"** (`POST /api/purchasing/purchase-requests`):

```json
{
  "date": "2027-08-01", "requiredDate": "2027-08-10", "warehouseCode": "KHO-HCM",
  "voucherType": "Mua hàng trong nước", "currencyCode": "VND", "exchangeRate": 1,
  "projectCode": "DA-2026-01", "note": "Vật tư cho dự án camera",
  "targetStatus": "Approved",
  "items": [ { "materialCode": "HUB-USB-7P", "uomCode": "CAI", "quantity": 10, "unitPrice": 90000, "note": null } ]
}
```

**Lập đơn mua lấy từ phiếu yêu cầu** (`POST /api/purchasing/purchase-orders`): dòng mang `purchaseRequestLineId` là `id` của dòng trong phiếu yêu cầu.

```json
{
  "date": "2027-08-02", "warehouseCode": "KHO-HCM", "voucherType": "Mua hàng trong nước",
  "supplierCode": "NCC001", "paymentTermCode": "NET30", "taxRateCode": "VAT10",
  "currencyCode": "VND", "exchangeRate": 1, "projectCode": "DA-2026-01", "targetStatus": "Approved",
  "items": [ { "materialCode": "HUB-USB-7P", "uomCode": "CAI", "quantity": 6, "unitPrice": 90000, "purchaseRequestLineId": 14 } ]
}
```

**Phiếu nhập kho lấy từ đơn** (`POST /api/inventory/goods-receipts`): dòng `ITEM` mang `purchaseOrderLineId`.

Chuyển trạng thái: `POST …/{id}/submit`, `…/approve`, `…/withdraw`, `…/cancel`; từ chối: `POST …/{id}/reject` `{ "note": "lý do" }`. Sửa: `PUT …/{id}` kèm `"version"` lấy từ lần đọc trước.

Lỗi trả về luôn là `{ "message": "…" }` (tiếng Việt hoặc theo `Accept-Language`) với mã 400 (nghiệp vụ), 401, 403, 404, 409 (đã bị người khác sửa).

---

## 5. Frontend

### 5.1. Danh sách tệp (`{FE}/…`)

| Tệp | Việc |
|---|---|
| `types/index.ts` | `SubMenuKey` (`'pur_order'`, `'pur_approve_order'`), kiểu `GoodsVoucher` và `VoucherItem` (dùng chung mọi chứng từ kho / mua) |
| `config/functions.ts` | `FUNCTION_REGISTRY`: `pur_order: fn('purchasing', '/purchasing/orders', 'Đơn mua hàng', 'voucher')`. Thiếu một mã là lỗi biên dịch. Đường dẫn URL, breadcrumb, ma trận phân quyền đều sinh từ đây |
| `modules/purchasing/PurchasingModule.tsx` | `switch (subKey)` chọn màn |
| `modules/purchasing/documents/purchase-orders/api.ts` | Gọi API, **đổi qua lại** giữa dữ liệu máy chủ và `GoodsVoucher` |
| `modules/purchasing/documents/purchase-orders/PurchaseOrderView.tsx` | Danh sách + form |
| `modules/purchasing/documents/purchase-orders/index.ts` | Xuất ra |
| `modules/purchasing/documents/approval-purchase-order/PurchaseOrderApprovalView.tsx` | Màn Phê duyệt đơn mua hàng |
| `modules/purchasing/documents/OpenDocumentPicker.tsx` | Cửa sổ "Lấy từ chứng từ trước" dùng chung đơn mua và phiếu nhập |
| `mock/voucherGridConfigs.ts` | Cấu hình lưới dòng (`purchaseOrderItemsGridConfig`, id `DMH_ITEMS`): cột nào, kiểu gì, chỉ đọc |
| `modules/inventory/documents/voucherPrint.ts` | Mẫu in (`kind: 'purchaseOrder'`) |
| `utils/permissions.ts` | `APPROVAL_SCREENS`: `pur_approve_order: ['pur_order']` (bản sao của backend) |
| `locales/{vi,en}/common.json` | Tên chức năng, nhãn nhật ký |

### 5.2. `api.ts`: cầu nối dữ liệu

Máy chủ trả `OrderRecord` (tên trường như DTO backend: `warehouseCode`, `items[].materialCode`, `status: 'Draft'`...). Màn hình lại làm việc với `GoodsVoucher` (`warehouseId`, `items[].sku`, `status: 'Lập chứng từ'`...). `api.ts` có ba hàm đổi:

- `toVoucher(row)`: dữ liệu máy chủ → `GoodsVoucher` (trạng thái đổi sang nhãn tiếng Việt qua `statusLabels`).
- `toItem(line)`: dòng máy chủ → `VoucherItem` (gồm `receivedQuantity`, `purchaseRequestLineId`, `purchaseRequestCode`).
- `toRequest(voucher, targetStatus)`: form → request lưu (gồm `version`, `targetStatus`, dòng `purchaseRequestLineId`).

Và đối tượng `purchaseOrdersApi` với `getPage(query)` (phân trang), `exportAll(query)` (tải Excel), `getOptions()`, `getOpenRequests(editingOrderId?)`, `create`, `update`, `changeStatus(id, 'submit'|'withdraw'|'approve'|'cancel')`, `remove`. Mọi lời gọi đi qua `apiRequest`/`apiDownload` của `services/apiClient.ts` (gắn token, bắt 401 để đăng xuất); **màn hình không gọi `fetch` trực tiếp**.

### 5.3. `PurchaseOrderView.tsx`: các khối

1. **Dữ liệu tra cứu** (`loadData`): `getOptions()` (kho dùng được cho đơn vị, tiền tệ, nhà cung cấp, thuế), `loadMaterialOptions()` và `loadSupplierOptions()` từ `services/lookupOptions.ts`. Tải lại khi đổi đơn vị.
2. **Danh sách phân trang ở máy chủ**: state `page`, `pageSize`, `sort`, các bộ lọc; `listFilters` gom bộ lọc thành tham số (`status`, `warehouse`, `voucherType`, `supplier`, `project`, `code`, `from`, `to`); ô tìm kiếm và mã được **debounce** 300 ms; đổi bộ lọc quay về trang 1; `usePagedList(fetchPage, listQuery)` gọi `getPage`; `GridView serverSide` hiển thị. Cột "Tổng tiền" ẩn khi không có `VIEW_PRICE`.
3. **Nút thao tác trên dòng** theo trạng thái và quyền: Gửi duyệt (khi Lập chứng từ, có quyền Thêm/Sửa **và** bước Chờ duyệt đang bật: `voucherStatusService.isEnabled('DMH','Pending')`), Duyệt (khi Chờ duyệt, `canApproveVoucher`), Rút lại (người lập), Hủy (khi Đã phê duyệt, `reachesStatus(..., 'Cancelled')`), In, Xóa. **Kiểm ở frontend chỉ để hiển thị**; máy chủ mới là nơi quyết định.
4. **Form** (cửa sổ toàn màn hình, `Modal fullScreen`): khối I thông tin nghiệp vụ (loại mua, kho, nhà cung cấp, điều khoản, dự án, thuế, ngày giao, "Theo phiếu yêu cầu" chỉ đọc), khối II chứng từ và tiền tệ (đơn vị, **số chứng từ chỉ đọc** lấy từ `voucherNumberingApi.preview('DMH', ngày)`, ô Trạng thái, người lập, ngày CT, ngày lập, loại tiền, tỷ giá), rồi lưới dòng `VoucherDetailGrid` và thanh tóm tắt (tiền hàng, thuế, tổng cộng).
5. **Ô Trạng thái** = lựa chọn `TargetStatus`: `saveStatusChoices(user, 'pur_order', { voucherType: 'DMH', posts: false })` trả các mức người dùng được chọn theo quyền (không có "Đã ghi sổ"). Nút **Lưu Nháp** luôn lưu `Draft` (cờ `saveAsDraftRef`), nút **Lưu** lưu theo ô Trạng thái.
6. **Tính tiền** phía màn hình chỉ để hiển thị: `formSubTotal`, `formTaxAmount = làm tròn(tiền hàng × thuế suất) / 100`, `formTotalValue = (tiền hàng + thuế) × tỷ giá`. Số chính thức do máy chủ tính lại khi lưu.
7. **Đổi loại tiền hoặc ngày chứng từ** gọi `exchangeRatesApi.getRate`; đổi ngày (khi lập mới) gọi lại `voucherNumberingApi.preview` để số phiếu hiển thị đúng tháng.
8. **Lấy từ phiếu yêu cầu**: `handleOpenRequestPicker` gọi `getOpenRequests(editingVoucherId)`; `OpenDocumentPicker` hiển thị; `handleConfirmRequest(picked)` đưa các dòng đã tích vào lưới (mỗi dòng giữ `purchaseRequestLineId` và `purchaseRequestCode`), điền đầu phiếu theo phiếu yêu cầu **đầu tiên** (kho, loại mua, nhà cung cấp, tiền tệ), cộng dồn số lượng nếu dòng nguồn đã có trong form, ghi chú tự động. `takenByForm` cho cửa sổ biết form đang giữ bao nhiêu mỗi dòng nguồn (trừ vào số còn lại). `formRequestCode` suy ra từ các dòng; nút × bỏ liên kết (`handleClearRequest`).
9. **Mở từ thông báo** (`useOpenDocumentRequest('pur_order', ...)`): tìm phiếu trong trang đang hiển thị, không có thì hỏi máy chủ theo mã.
10. **Lỗi**: mọi lỗi từ máy chủ hiện qua `showToast.error(getErrorMessage(error))`; lưu hỏng thì tải lại dữ liệu.

Form đơn mua có **hai tab** dưới đầu phiếu: **Chi tiết hàng đặt mua** (lưới dòng) và **Lịch giao hàng** (bảng mã vật tư, số đặt, đã nhập, còn thiếu và ô ngày dự kiến nhận của từng dòng; dòng quá hạn mà còn thiếu được tô đỏ; nút *Đặt lại theo ngày đầu đơn*). Đổi **Ngày dự kiến nhận hàng** ở đầu đơn thì các dòng chưa sửa riêng đi theo (`handleHeaderDeliveryDate`); dòng mới tự nhận ngày đầu đơn.

### 5.4. `OpenDocumentPicker.tsx`

Thành phần chung, cho chứng từ nguồn dạng `PickerDocument` (mã, ngày, ba cột thông tin, `lockKey`, các dòng `PickerLine`). Hai phần: trên là danh sách chứng từ nguồn (tìm không dấu), dưới là dòng của chứng từ đang bấm; tích dòng, sửa số lượng (mặc định = còn lại, không vượt, kiểm ngay trên ô). **`lockKey`** (kho + tiền tệ [+ nhà cung cấp]): khi đã tích một dòng hoặc form đã có liên kết, chứng từ khác khóa thì mờ đi và không tích được. Cột **Dự kiến nhận** (`dueDate` của dòng) hiện ngày giao theo từng dòng đơn và tô đỏ khi đã quá hạn. Màn đơn mua dùng khóa kho + tiền tệ; màn phiếu nhập dùng kho + tiền tệ + nhà cung cấp.

### 5.5. Màn phê duyệt

`PurchaseOrderApprovalView.tsx` đọc `GET /api/approvals/pending`, lọc `function === 'pur_order'`, mỗi dòng có Duyệt (`POST /api/approvals/pur_order/{số phiếu}/approve`) và Từ chối (bắt buộc nhập lý do, `…/reject`). Hiện trong menu ở nhóm "Phê duyệt".

### 5.6. In phiếu

`printVoucher({ kind: 'purchaseOrder', withPrice, voucher, company, format, printedBy })` mở cửa sổ in; hai mẫu **có giá** và **không giá** (`PrintMenuButton`); mẫu có giá chỉ khi `VIEW_PRICE`.

### 5.7. Chữ trên màn hình

Các màn chứng từ kho và mua hàng hiện còn viết chữ tiếng Việt trực tiếp (ngoài phạm vi kiểm `check-i18n`); danh mục mua hàng dùng `locales/{vi,en}/purchasing.json`. Chữ trên màn danh mục và báo lỗi từ máy chủ đều theo ngôn ngữ của người dùng.

---

## 6. Các bước làm một chứng từ mua hàng mới

Ví dụ giả định cần thêm **Phiếu đề nghị thanh toán** (`pur_payment_request`, số `DNT`). Làm theo thứ tự; mỗi bước xong thì build.

**A. Chốt trước** (ghi ra giấy): tên, mã chức năng (chữ thường, tiền tố phân hệ, **không đổi về sau**), loại số, bảng, đường dẫn API, có ghi sổ không (mua hàng thường **không**), lấy dữ liệu từ chứng từ nào, có dòng không, các cột `*_code` trỏ sang danh mục nào.

**B. Cơ sở dữ liệu**

1. Tạo `NN-purchasing-<ten>.sql` (số tiếp theo trong `sql/postgresql/`), sao cấu trúc `erp_purchase_request` và dòng. Bắt buộc: `id`, `code` duy nhất, `unit_code`, `document_date`, `created_date`, `status` có CHECK, `total_value`, `approved_by_user_id`, 4 cột dấu bản ghi, **không khóa ngoại**, chỉ mục cho mọi `*_code`.
2. Cột nối sang chứng từ sau: id của dòng nguồn (bigint) ở dòng chứng từ sau + chỉ mục một phần; cột danh sách số phiếu ở đầu phiếu (suy ra).
3. Chạy hai lần trên `erp_dev`, lần hai không lỗi.

**C. Backend**

1. **Thực thể** `Core.Domain/Modules/Purchasing/Documents/<Ten>/<Ten>.cs`: kế thừa `ErpEntity`, cài `IApprovableDocument`, `[Audited]`, `[References]` cho mọi cột `*_code`, dòng `[NotAudited("lý do")]`. Thêm `DbSet` vào `CoreContext`.
2. **Hợp đồng** `Core.Application/Modules/Purchasing/Documents/<Ten>/<Ten>Contracts.cs`: DTO (có `Version`, tiền = 0 khi thiếu `VIEW_PRICE`), request lưu (có `Version`, `TargetStatus`, `ProjectCode` nếu cần), `I<Ten>Service` (List, Export, Options, Get, Create, Update, ChangeStatus, Reject, Delete, và `GetOpen` nếu chứng từ sau lấy từ nó).
3. **Khai báo**: `FunctionCatalog` (cả mã phê duyệt), `VoucherCatalog.All` + `ApprovalScreens`, `VoucherStatusCatalog.NonPosting` nếu không ghi sổ, `DocumentApprovalService` ba chỗ.
4. **Dịch vụ**: sao `PurchaseRequestService.cs` rồi sửa: tên bảng, `Function`, loại số, `ValidateAsync`, `Apply`, `Lines`, `ToDtosAsync`, nhãn xuất Excel. **Không bỏ** các khối: khóa sổ ngày cũ và mới, `ExpectVersion`, giữ giá cũ khi thiếu `VIEW_PRICE`, `TargetStatus`, cấp số **trong** giao dịch, nhật ký dòng, chặn hủy khi còn chứng từ sau.
5. **Controller** sao `PurchaseOrdersController.cs`; tham số route là `{operation}`. Đăng ký `AddScoped` ở `DependencyInjection.cs`.
6. **Thông báo** vi + en (`<tiền tố>.notFound`, `.itemsRequired`, `.deleteDraftOnly`, `.editDraftOnly`, `.noPosting`, `.warehouseInvalid`, ..., `export.<tiền tố>.*`, `function.<ma>` bản en, `voucher.<LOAI>`, nhãn `field.*`). Mỗi bảng khác sẽ trỏ tới danh mục cần `table.<tên bảng>`.
7. **Menu** `menu.json`: nút của chứng từ và nút phê duyệt.
8. `dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj` (dừng backend đang chạy trước vì DLL bị khóa).

**D. Frontend**

1. `types/index.ts`: thêm mã vào `SubMenuKey`; nếu chứng từ có loại hiển thị mới, thêm vào `GoodsVoucher.type`. Thêm các trường riêng vào `GoodsVoucher` / `VoucherItem`.
2. `config/functions.ts`: `fn('purchasing', '/purchasing/<duong-dan>', 'Tên', 'voucher')` (và `'process'` cho màn duyệt).
3. `mock/voucherGridConfigs.ts`: cấu hình lưới (`gridId`, các cột, cột chỉ đọc), đăng ký vào `systemVoucherGridRegistry`.
4. Thư mục `modules/purchasing/documents/<ten>/`: `api.ts` (sao `purchase-orders/api.ts`: `toVoucher`, `toItem`, `toRequest`, đối tượng API), `<Ten>View.tsx` (sao `PurchaseOrderView.tsx`, bỏ các khối không cần), `index.ts`.
5. Màn duyệt: sao `PurchaseOrderApprovalView.tsx`, đổi mã chức năng; thêm vào `APPROVAL_SCREENS` ở `utils/permissions.ts`.
6. `PurchasingModule.tsx`: thêm `case` cho cả hai màn.
7. In phiếu: thêm `kind` vào `voucherPrint.ts` nếu cần mẫu riêng.
8. Locale: tên chức năng (`navigation.subMenus.<ma>`, `function.<ma>` bản en).
9. `npm run lint && npm run check-menu && npm run check-policy`.

**E. Kiểm tra bằng tay** (kịch bản đầy đủ ở `docs/phat-trien/them-chung-tu.md` mục 8; ngày chứng từ dùng năm **2027** vì các tháng 2026 của DVCS01 đã khóa)

1. Lập, sửa, sửa bằng `version` cũ (409), ngày thuộc kỳ khóa (bị chặn), kho / vật tư / đơn vị tính sai (lỗi rõ).
2. Gửi duyệt, người khác duyệt, từ chối, rút lại; người lập không tự duyệt bằng nút Duyệt.
3. Lưu thẳng từng trạng thái với tài khoản đủ quyền và thiếu quyền (`ST_*`).
4. Chứng từ sau lấy từ nó: đặt vượt số còn lại bị từ chối; hủy chứng từ trước khi còn chứng từ sau bị chặn; hủy chứng từ sau thì số trả lại.
5. Tài khoản không có quyền Xem gọi danh sách → 403; không có `VIEW_PRICE` thấy giá 0 **và sửa không làm mất giá**; không có `VIEW_ALL` chỉ thấy phiếu của mình.
6. **Dọn dữ liệu thử**: phiếu, dòng, vòng duyệt (`sys_document_approval`), nhật ký, dải số `sys_voucher_sequence` của tháng thử, tài khoản và vai trò tạm. Phiếu đã duyệt không rút về nháp bằng API được: đặt `status = 'Draft'` bằng SQL rồi xóa qua API (xóa trực tiếp bằng SQL sẽ để lại dòng mồ côi vì không có khóa ngoại).

**F. Tài liệu**: viết `docs/mua-hang/<ten>.md`, sinh Word `node docs/cong-cu/build-word.cjs <md> <docx> "<chân trang>" "<tiêu đề>"`, thêm dòng vào `docs/README.md`, cập nhật dòng "Backend-backed" ở `CLAUDE.md` và bảng API ở `ServerService/README.md`.

---

## 7. Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách tránh |
|---|---|---|
| Route chuyển trạng thái 404 | tham số đường dẫn tên `action` | dùng `{operation}` |
| `TableReferenceTests` đỏ | cột `*_code` thiếu `[References]`, hoặc chỉ mục tạo trong khối `DO` / không bắt đầu bằng chính cột | khai thuộc tính, viết `CREATE INDEX` tĩnh |
| `TablesThatKeepARowInUseHaveAMessageLabel` đỏ | bảng mới được trỏ tới nhưng thiếu `table.<tên bảng>` | thêm nhãn vi + en |
| `MessagesTests` đỏ | thiếu khóa vi hoặc en, hoặc khóa mới bắt đầu bằng `voucher.` | đủ hai ngôn ngữ, đổi tiền tố |
| Duyệt xong phiếu vẫn "Chờ duyệt" | quên một trong ba chỗ của `DocumentApprovalService` | kiểm cả ba |
| Lưu phiếu báo "chưa có người duyệt hợp lệ" | người lập là người duyệt duy nhất, không tự duyệt được | thêm người duyệt khác ở Quy tắc phê duyệt, hoặc cấp `ST_APPROVED` + quyền Duyệt để lưu thẳng |
| Giá về 0 sau khi sửa | người sửa không có `VIEW_PRICE`, form gửi giá 0 | dịch vụ phải giữ giá cũ (đã làm ở hai phiếu mua) |
| Trạng thái đổi tên theo đơn vị không ăn trên màn | màn dùng sai loại chứng từ khi tra nhãn (từng nhầm `YCX` thay `YCM`) | dùng đúng mã loại ở `VoucherStatusBadge`, `saveStatusChoices`, `voucherStatusService` |
| Số phiếu trùng giữa các đơn vị | mẫu số thiếu `{DVCS}` | mẫu mặc định đã có |
| Lỗi 500 khi đọc ngày từ SQL | thuộc tính ngày kiểu `DateTime` | dùng `DateOnly` trong lớp hàng của Dapper |
| Số "đã đặt / đã nhập" sai | đếm cả chứng từ đã hủy, hoặc quên loại trừ chứng từ đang sửa | dùng `…Progress.*ByLineAsync` với `exceptXxxId` |
| Lưới trên máy tính cuộn cả trang | ô input ẩn (`sr-only`) của `Checkbox` nằm ngoài vùng cuộn | `Checkbox` đã có `relative` |
| Test ghi sổ lỗi vì kỳ khóa | ngày thử thuộc 2026 | dùng ngày 2027 |
| Đăng nhập thử bị 429 | giới hạn 10 lần / phút / địa chỉ | gom các lần đăng nhập, chờ một phút |

---

## 8. Danh sách việc (tóm tắt)

- [ ] Chốt tên, mã chức năng, loại số, bảng, API, có ghi sổ hay không, chứng từ nguồn
- [ ] Script SQL: đầu phiếu, dòng, chỉ mục cho mọi `*_code`, cột nối; chạy hai lần
- [ ] Thực thể + `DbSet`; hợp đồng + giao diện dịch vụ
- [ ] `FunctionCatalog`, `VoucherCatalog` (+ `ApprovalScreens`), `NonPosting`, menu, thông báo vi / en
- [ ] Dịch vụ: kiểm, cấp số, khóa sổ, chính sách, duyệt, `TargetStatus`, giữ giá, chống ghi đè, tiến độ chứng từ sau
- [ ] `DocumentApprovalService` ba chỗ; controller; đăng ký DI
- [ ] Frontend: mã chức năng, lưới, `api.ts`, màn phiếu, màn duyệt, `PurchasingModule`, in, `APPROVAL_SCREENS`
- [ ] Build, test, lint, `check-menu`, `check-policy`; thử đủ kịch bản; dọn dữ liệu thử
- [ ] Tài liệu md + Word, `docs/README.md`, CLAUDE.md, `ServerService/README.md`
