# Các danh mục của phân hệ Mua hàng

Tài liệu này mô tả ba danh mục mới của Mua hàng — **Dự án**, **Điều khoản thanh toán**, **Nhóm nhà cung cấp** — và chỗ chúng nối với danh mục nhà cung cấp và các chứng từ. Với mỗi danh mục: dùng để làm gì, các trường, quy tắc, cơ sở dữ liệu, backend, API, giao diện, nhập / xuất Excel, ai đang dùng nó. Cuối tài liệu là các bước thêm một danh mục mua hàng mới.

Đường dẫn tính từ gốc dự án; `{BE}` = `ServerService`, `{FE}` = `Frontend/src`. Luồng chứng từ xem `docs/mua-hang/mua-hang-va-du-an.md` và `docs/mua-hang/phieu-mua-hang-tu-database-den-giao-dien.md`; khung danh mục chung xem `docs/phat-trien/them-danh-muc.md`.

---

## 1. Tổng quan

| Danh mục | Mã chức năng | Bảng | API | Tra cứu (lookup) | Menu |
|---|---|---|---|---|---|
| Dự án | `pur_project_cat` | `erp_project` | `api/purchasing/projects` | `projects` | Mua hàng › 3. Danh mục mua hàng |
| Điều khoản thanh toán | `pur_payment_term_cat` | `erp_payment_term` | `api/purchasing/payment-terms` | `paymentTerms` | như trên |
| Nhóm nhà cung cấp | `pur_supplier_group_cat` | `erp_supplier_group` | `api/purchasing/supplier-groups` | `supplierGroups` | như trên |
| Nhà cung cấp (có từ trước, thêm cột Nhóm) | `inv_supplier_cat` | `erp_supplier` | `api/inventory/suppliers` | `suppliers` | Kho › danh mục |

Cả ba danh mục **không viết tay phần chung**: đều chạy trên khung danh mục (`CatalogService`, `CatalogControllerBase`, `createCatalogApi`, `CatalogScreen`). Mỗi danh mục chỉ **khai báo** phần riêng: cột sắp xếp, trường tìm kiếm, kiểm dữ liệu, cột xuất Excel, form. Nhờ đó cả ba có sẵn:

- danh sách phân trang ở máy chủ, tìm không dấu, lọc theo trạng thái dùng, sắp xếp;
- thêm, sửa, xóa, **xóa nhiều**, **nhập Excel** (có file mẫu, xem trước, báo lỗi từng dòng; tất cả hoặc không dòng nào), **xuất Excel** thật từ máy chủ;
- chống ghi đè khi nhiều người cùng sửa (`Version` → 409);
- dấu bản ghi (người tạo, người sửa, thời điểm) và nhật ký thay đổi tự động;
- nút **Cột** để mỗi người ẩn / sắp xếp / đổi độ rộng cột (lưu trên máy chủ);
- chặn xóa bản ghi đang được chứng từ khác dùng.

---

## 2. Danh mục Dự án (`pur_project_cat`)

### 2.1. Dùng để làm gì

Dự án là một **chiều theo dõi**: chứng từ mua hàng và kho ghi `project_code`, nhờ đó cộng được chi phí theo dự án (báo cáo *Chi phí theo dự án*) và sau này cả doanh thu để tính lãi lỗ. Dự án **không** tự tạo chứng từ nào.

### 2.2. Các trường

| Trường | Cột | Bắt buộc | Ghi chú |
|---|---|---|---|
| Mã dự án | `code` (khóa chính, 20) | có | Chữ hoa, **không đổi sau khi tạo** (ví dụ `DA-2026-01`) |
| Tên dự án | `name` (200) | có | **Không trùng** tên khác (không phân biệt hoa thường) |
| Phòng ban phụ trách | `department_code` (20) | không | Trỏ `sys_department`, chọn bằng tra cứu `departments` |
| Khách hàng | `customer_name` (200) | không | Chữ tự do (danh mục khách hàng chưa lên backend) |
| Người quản lý | `manager_name` (100) | không | Chữ tự do |
| Ngày bắt đầu / kết thúc | `start_date`, `end_date` | không | Ngày kết thúc **không trước** ngày bắt đầu |
| Ngân sách | `budget` numeric(18,2) | không (mặc định 0) | Chi phí dự kiến, **tiền hạch toán**, từ 0, tối đa 2 chữ số thập phân; báo cáo so chi phí thực tế với số này |
| Trạng thái | `status` (12) | có | `PLANNING` lập kế hoạch, `ACTIVE` đang thực hiện, `ONHOLD` tạm dừng, `DONE` hoàn thành, `CANCELLED` hủy |
| Ghi chú | `note` (500) | không | |
| Đang sử dụng | `is_active` | — | Mặc định có |
| Thứ tự | `sort_order` | — | Dùng khi sắp xếp mặc định |
| Dấu bản ghi | `created_at/by`, `updated_at/by` | — | Tự điền |

### 2.3. Quy tắc nghiệp vụ

- **Dự án nào được gắn vào chứng từ mới:** chỉ dự án **đang sử dụng** (`is_active`) **và** ở trạng thái `PLANNING` hoặc `ACTIVE` (`ProjectStatuses.TakesVouchers`). Dự án khác (tạm dừng, hoàn thành, hủy, ngừng sử dụng) bị từ chối với `project.closed`.
- **Chứng từ cũ giữ dự án cũ** dù dự án sau đó đã đóng: khi **sửa** một chứng từ mà không đổi dự án thì máy chủ không kiểm lại trạng thái (`ProjectChecks.EnsureAsync(db, code, current, ct)`: nếu mã trùng `current` thì cho qua).
- **Không xóa được** dự án còn chứng từ dùng (xem 2.5). Muốn ngưng dùng thì đổi trạng thái hoặc bỏ tích **Đang sử dụng**.
- Dự án có thể để trống trên chứng từ; không bắt buộc.

### 2.4. Cơ sở dữ liệu

`{BE}/sql/postgresql/45-purchasing-catalogs.sql` (chạy lại được):

```sql
CREATE TABLE IF NOT EXISTS erp_project (
    code varchar(20) PRIMARY KEY, name varchar(200) NOT NULL, department_code varchar(20),
    customer_name varchar(200), manager_name varchar(100), start_date date, end_date date,
    budget numeric(18,2) NOT NULL DEFAULT 0, status varchar(12) NOT NULL DEFAULT 'ACTIVE',
    note varchar(500), is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), created_by integer, updated_at timestamptz, updated_by integer,
    CONSTRAINT ck_erp_project_status CHECK (status IN ('PLANNING','ACTIVE','ONHOLD','DONE','CANCELLED')),
    CONSTRAINT ck_erp_project_budget CHECK (budget >= 0),
    CONSTRAINT ck_erp_project_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date));
CREATE UNIQUE INDEX IF NOT EXISTS ux_erp_project_name ON erp_project (lower(name));
CREATE INDEX IF NOT EXISTS ix_erp_project_department_code ON erp_project (department_code) WHERE department_code IS NOT NULL;
```

Các ràng buộc CHECK là lớp bảo vệ cuối: dịch vụ đã kiểm trước nên người dùng luôn nhận thông báo tiếng Việt rõ ràng, không phải lỗi cơ sở dữ liệu thô. Cột `project_code` trên năm chứng từ nằm cùng script (mỗi cột có chỉ mục bắt đầu bằng chính nó): `erp_purchase_request`, `erp_purchase_order`, `erp_goods_receipt`, `erp_goods_issue`, `erp_issue_request`.

### 2.5. Backend

| Tệp | Việc |
|---|---|
| `Core.Domain/Modules/Purchasing/Categories/Projects/Project.cs` | Thực thể (`ErpEntity`, `ICatalogRecord`, `[Audited("pur_project_cat","project", Label="{Code} - {Name}")]`, `[References<Department>(Optional = true)]`) và `ProjectStatuses` |
| `Core.Application/Modules/Purchasing/Categories/PurchasingCategoryContracts.cs` | `ProjectDto`, `SaveProjectRequest`, `IProjectService : ICatalogService<,>` |
| `Core.Infrastructure/Modules/Purchasing/Categories/ProjectService.cs` | `CatalogService<Project,…>`: sắp xếp, tìm, lọc, cột xuất, `MapAsync`, `ApplyAsync` |
| `Core.Infrastructure/Modules/Purchasing/Categories/ProjectChecks.cs` | `Normalize`, `EnsureAsync`: kiểm dự án cho **mọi chứng từ** |
| `Core/Modules/Purchasing/Categories/PurchasingCategoriesControllers.cs` | `ProjectsController` (5 dòng) |
| `Core.Infrastructure/Common/Lookups/LookupCatalogs.cs` | Tra cứu `projects` (kèm cột phụ `status`, `departmentCode`) |
| `Core.Infrastructure/Common/Persistence/CoreContext.cs`, `DependencyInjection.cs` | `DbSet<Project>`, đăng ký dịch vụ |

- **Sắp xếp** (`SortMap`): `order` (mặc định), `code`, `name`, `departmentCode`, `customerName`, `managerName`, `startDate`, `endDate`, `budget`, `projectStatus`, `isActive` và các cột dấu bản ghi. Khóa phụ là mã, nên thứ tự luôn ổn định.
- **Tìm**: mã, tên, khách hàng, người quản lý (không dấu).
- **Bộ lọc riêng** (tham số URL, nằm trong `CatalogListQuery.Filters`): `projectStatus=ACTIVE` và `department=PB01`. Màn hình dùng bộ lọc **Trạng thái dự án** (`projectStatus`).
- **`ApplyAsync`** kiểm: tên bắt buộc và không trùng, trạng thái hợp lệ (`project.statusInvalid`), ngày kết thúc không trước ngày bắt đầu (`project.dateOrder`), ngân sách hợp lệ (`project.budgetInvalid`). Mã trùng do khung kiểm (`project.codeExists`).
- **Xóa**: khung tự tra các cột `[References<Project>]` — `project_code` của năm chứng từ — và từ chối nếu còn dùng, nêu tên bảng bằng nhãn `table.erp_purchase_request`, ... (ví dụ: *"…đang được dùng ở: Phiếu xuất kho (1), Đơn mua hàng (1). Hãy đặt ngừng sử dụng thay vì xóa."*). Không có code kiểm xóa riêng trong `ProjectService`.

### 2.6. API

Thừa hưởng từ `CatalogControllerBase` (quyền theo `pur_project_cat`: Xem / Xem + Xuất / Thêm / Sửa / Xóa; **không** viết `[RequirePermission]`):

| Lệnh | Việc |
|---|---|
| `GET api/purchasing/projects?page=&pageSize=&sort=&dir=&search=&status=&projectStatus=&department=` | Danh sách phân trang (`pageSize` tối đa 200); `status` = đang dùng / ngừng dùng |
| `GET .../export` (cùng bộ lọc) | File `.xlsx` mọi dòng thỏa bộ lọc (cần Xem + Xuất) |
| `POST` | Thêm |
| `PUT .../{code}` | Sửa, kèm `version` |
| `DELETE .../{code}` | Xóa |
| `POST .../import`, `POST .../delete-many` | Nhập Excel, xóa nhiều |
| `GET /api/lookups/projects?q=&page=&pageSize=&includeInactive=` | **Tra cứu** cho form chứng từ: mã, tên, `status`, `departmentCode`; mở cho mọi người đã đăng nhập |

Mẫu thêm:

```json
{ "code": "DA-2026-01", "name": "Dự án lắp đặt camera tòa nhà A", "departmentCode": "KT",
  "customerName": "Công ty TNHH Bất động sản Hòa Bình", "managerName": "Nguyễn Văn An",
  "startDate": "2026-10-01", "endDate": "2027-03-31", "budget": 500000000, "status": "ACTIVE",
  "note": "", "isActive": true }
```

Lỗi tiêu biểu: `400 Mã dự án DA-2026-01 đã tồn tại.`, `400 Trạng thái dự án phải là PLANNING, ACTIVE, ONHOLD, DONE hoặc CANCELLED.`, `400 Dự án DA-2026-02 không còn nhận chứng từ mới…`, `409` khi sửa bằng `version` cũ.

### 2.7. Giao diện

- `{FE}/modules/purchasing/categories/ProjectCategoryView.tsx` — khai báo `CatalogDefinition<ProjectRecord, SaveProjectInput>`: cột (mã, tên, khách hàng, người quản lý, phòng ban, ngày bắt đầu / kết thúc, ngân sách, trạng thái dự án bằng huy hiệu màu, đang dùng, dấu bản ghi), bộ lọc `projectStatus`, cột Excel, form 2 cột (mã + tên; khách hàng + người quản lý; phòng ban + trạng thái; ngày + ngân sách; ghi chú; đang sử dụng).
- `{FE}/modules/purchasing/categories/api.ts` — `projectsApi = createCatalogApi({ url: '/api/purchasing/projects', fileName: 'DanhMucDuAn' })` cùng kiểu `ProjectRecord`, `SaveProjectInput`.
- Chọn dự án trên form chứng từ: `<CatalogLookup lookup="projects" ... />` (gõ mã + Enter, hoặc F2 để tìm có phân trang). **Không** gọi `list` của danh mục từ màn khác (cần quyền Xem danh mục), luôn dùng tra cứu.
- Chữ trên màn: `{FE}/locales/{vi,en}/purchasing.json` (khóa `projects.*`).
- Cột Excel (tiêu đề **trùng** với tiêu đề file nhập): Mã dự án, Tên dự án, Mã phòng ban, Khách hàng, Người quản lý, Ngày bắt đầu, Ngày kết thúc, Ngân sách, Trạng thái, Ghi chú, Đang sử dụng. Ngày dạng `yyyy-MM-dd`, trạng thái là mã (`ACTIVE`...).

### 2.8. Ai đang dùng dự án

| Chỗ | Cách dùng |
|---|---|
| Phiếu yêu cầu mua hàng, đơn mua hàng, phiếu nhập kho, phiếu yêu cầu xuất kho, phiếu xuất kho | Ô **Dự án** (tùy chọn), kiểm `ProjectChecks`; danh sách có bộ lọc `project` |
| Báo cáo chi phí theo dự án (`pur_report_project`) | So ngân sách với đã đặt, đã nhập, chi phí thực tế (phiếu xuất kho đã ghi sổ) |
| Danh mục dự án | Trỏ phòng ban (`department_code`) |

---

## 3. Danh mục Điều khoản thanh toán (`pur_payment_term_cat`)

### 3.1. Dùng để làm gì

Chuẩn hóa điều khoản trả tiền nhà cung cấp (thanh toán ngay, công nợ 30 ngày, ...) để chọn trên **đơn mua hàng** thay vì gõ chữ tự do; số ngày công nợ là dữ liệu có cấu trúc để sau này tính hạn thanh toán.

### 3.2. Các trường

| Trường | Cột | Ghi chú |
|---|---|---|
| Mã điều khoản | `code` (khóa chính, 20) | Chữ hoa, không đổi sau khi tạo (`NET30`) |
| Tên điều khoản | `name` (100) | Bắt buộc, **không trùng** tên khác |
| Số ngày công nợ | `days` | 0 = trả ngay; từ 0 đến 1000 (`paymentTerm.daysInvalid`); CHECK ở cơ sở dữ liệu |
| Ghi chú | `note` (300) | |
| Đang sử dụng, thứ tự, dấu bản ghi | | Như dự án |

### 3.3. Cơ sở dữ liệu và dữ liệu mẫu

`erp_payment_term` trong script 45 (khóa chính `code`, `ux_erp_payment_term_name` duy nhất theo `lower(name)`, `ck_erp_payment_term_days`). Script **nạp sẵn sáu điều khoản khi bảng còn trống**: `TT-NGAY` thanh toán ngay, `COD` thanh toán khi nhận hàng, `NET15`, `NET30`, `NET45`, `NET60` (công nợ 15 / 30 / 45 / 60 ngày).

Đơn mua hàng có hai cột: `payment_term_code` (điều khoản chọn từ danh mục, `[References<PaymentTerm>(Optional = true)]`) và `payment_terms` (**chữ lúc lưu**). Khi chọn điều khoản, máy chủ chép tên vào `payment_terms` — nên đơn đã in vẫn ghi đúng chữ dù sau này đổi tên điều khoản; đơn cũ có chữ tự do vẫn giữ nguyên.

### 3.4. Backend, API, giao diện

- `PaymentTermService.cs` (sắp xếp: `order`, `code`, `name`, `days`, `isActive`; tìm: mã, tên, ghi chú; `ApplyAsync` kiểm tên và số ngày), `PaymentTermsController` (`api/purchasing/payment-terms`), tra cứu `paymentTerms` (cột phụ `days`).
- Đơn mua hàng kiểm điều khoản khi lưu: mã phải có và đang dùng, nếu không báo `paymentTerm.invalid`. Không xóa được điều khoản còn đơn dùng.
- Giao diện: `{FE}/modules/purchasing/categories/SimpleCategoryViews.tsx` → `PaymentTermCategoryView` (cột mã, tên, số ngày — 0 hiện chữ **Ngay** —, ghi chú, trạng thái). Chọn trên đơn: `CatalogLookup lookup="paymentTerms"`.
- Cột Excel: Mã điều khoản, Tên điều khoản, Số ngày công nợ, Ghi chú, Đang sử dụng.

---

## 4. Danh mục Nhóm nhà cung cấp (`pur_supplier_group_cat`)

### 4.1. Dùng để làm gì

Gom nhà cung cấp theo loại (vật tư, thiết bị, dịch vụ ...) để lọc, thống kê và về sau phân quyền / chính sách giá theo nhóm.

### 4.2. Các trường

`code` (20), `name` (100, không trùng), `note` (300), `is_active`, `sort_order`, dấu bản ghi. Bảng `erp_supplier_group`; script 45 **nạp sẵn ba nhóm khi trống**: `NCC-VT` nhà cung cấp vật tư, `NCC-TB` nhà cung cấp thiết bị, `NCC-DV` nhà cung cấp dịch vụ.

### 4.3. Nối với danh mục nhà cung cấp

- Bảng `erp_supplier` có thêm cột `supplier_group_code` (20, tùy chọn, có chỉ mục một phần), `[References<SupplierGroup>(Optional = true)]` trong thực thể `Supplier`.
- `SupplierService` (danh mục nhà cung cấp): thêm `SupplierGroupCode` vào request và DTO, trả kèm **tên nhóm** (`SupplierGroupName`, đọc một lần cho cả trang), lưu mã chữ hoa; **bộ lọc `group=`** của danh sách; cột xuất Excel `supplierGroupCode`; tra cứu `suppliers` có cột phụ thứ ba là mã nhóm.
- Màn **Danh mục nhà cung cấp** (`{FE}/modules/inventory/categories/suppliers/SupplierCategoryView.tsx`): thêm cột **Nhóm**, bộ lọc **Nhóm** (nạp qua `lookupApi.search('supplierGroups', ...)`), ô chọn nhóm trong form (`CatalogLookup lookup="supplierGroups"`), cột Excel **Mã nhóm nhà cung cấp**. Chữ: `locales/{vi,en}/inventory.json` khóa `suppliers.group`, `suppliers.groupCode`.
- Không xóa được nhóm còn nhà cung cấp thuộc nó (nhãn `table.erp_supplier`).

### 4.4. Backend, API, giao diện

`SupplierGroupService.cs`, `SupplierGroupsController` (`api/purchasing/supplier-groups`), tra cứu `supplierGroups`; màn `SupplierGroupCategoryView` trong `SimpleCategoryViews.tsx`. Cột Excel: Mã nhóm, Tên nhóm, Ghi chú, Đang sử dụng.

---

## 4b. Đổi mã và gộp mã

Hệ thống không có khóa ngoại, nên mọi chỗ dùng mã của một danh mục được biết nhờ **bản đồ tham chiếu** (`[References<...>]` → bảng `sys_table_ref`). Khung danh mục dùng bản đồ đó để **đổi mã** và **gộp mã** cho nhiều danh mục cùng lúc, không viết riêng từng danh mục.

**Danh mục đang cho đổi / gộp mã** (đợt 1): nhà cung cấp, nhóm nhà cung cấp, dự án, điều khoản thanh toán, loại kho, nhóm vật tư, loại vật tư. Các danh mục có mã dán vào mã khác (lô `VT001@LOT-2610`, tỷ giá `USD@ngày`, quy đổi đơn vị tính) và vật tư, kho, đơn vị tính (có sổ kho, quy đổi) **chưa** cho, sẽ làm ở đợt sau.

| | Đổi mã (ví dụ `NCC001` → `NCC-HCM01`) | Gộp mã (A vào B) |
|---|---|---|
| Việc | Trong **một giao dịch**: đổi mã ở chính bản ghi và ở **mọi cột đang trỏ tới** (kể cả chứng từ đã ghi sổ hoặc ở tháng đã khóa, bảng bản dịch) | Mọi cột đang trỏ tới A chuyển sang B; bản dịch của A bị xóa (B giữ bản dịch riêng); **A chuyển sang ngừng sử dụng**, ghi chú tự thêm "Đã gộp vào B." |
| Điều kiện | Mã mới hợp lệ (chữ hoa, không khoảng trắng, dấu `:` `,`), không trùng mã đã có, `version` còn mới (409 nếu có người sửa) | Mã đích có thật và **đang sử dụng**, khác chính nó |
| Sau đó | Mã cũ không còn | A còn để tra cứu; xóa được khi không còn gì dùng |
| Nhật ký | `CODE_CHANGE`: mã cũ → mã mới, ghi chú số dòng đã cập nhật | `MERGE`: mã gộp → mã đích, số dòng đã chuyển |

- **Quyền:** quyền **Sửa** của danh mục **và** quyền đặc biệt **Đổi mã, gộp mã** (`{chức năng}:CHANGE_CODE`, cấp ở Cài đặt › Người dùng & phân quyền; quản trị viên luôn có). Thiếu một trong hai → 403.
- **Giao diện:** hai nút trên mỗi dòng danh mục (**Đổi mã**, **Gộp mã**) chỉ hiện khi danh mục cho phép và người dùng đủ quyền. Hộp thoại **xem trước** các bảng đang dùng mã và số dòng sẽ bị cập nhật, rồi mới xác nhận.
- **API** (trên mọi controller danh mục, danh mục chưa cho thì từ chối): `GET {route}/{mã}/code-change?into={mã đích}` (xem trước), `POST {route}/{mã}/rename` `{ "newCode": "...", "version": 12 }`, `POST {route}/{mã}/merge` `{ "intoCode": "..." }`.
- **Không đổi** những chữ đã **chép lúc lưu** trên chứng từ cũ (tên nhà cung cấp, tên vật tư...): chúng ghi đúng tên tại thời điểm lập. Mã nằm trong JSON (cấu hình, bố cục lưới, nhật ký cũ) cũng không đổi.
- **Bật cho một danh mục mới:** `CodeChange: true` ở `CatalogSpec` của dịch vụ **và** thêm mã chức năng vào `SpecialRightCatalog.CodeChangeCatalogs` (test `CodeChangeTests` bắt hai danh sách lệch nhau), `codeChange: { lookup: 'tên tra cứu' }` ở `CatalogDefinition` của màn hình. Danh mục có chữ copy mã ở chỗ không khai `[References]` thì ghi đè `AfterCodeChangeAsync` để sửa trong cùng giao dịch.
- **Code:** `CatalogService.RenameAsync/MergeAsync/PreviewCodeChangeAsync`, `CatalogCodeChange` (viết lại các cột theo bản đồ tham chiếu, tên bảng và cột chỉ lấy từ mô hình, mã luôn là tham số), `CodeChangeDialog.tsx`.

---

## 5. Quyền

| Chức năng | Hành động | Ai cần |
|---|---|---|
| `pur_project_cat`, `pur_payment_term_cat`, `pur_supplier_group_cat` | Xem | Mở màn danh mục và `GET` danh sách |
| | Xem + Xuất | Xuất Excel |
| | Thêm | Thêm, **nhập Excel** (nhập dạng cập nhật cần thêm Sửa) |
| | Sửa | Sửa bản ghi |
| | Xóa | Xóa, xóa nhiều |
| *(không cần quyền danh mục)* | | Chọn dự án / điều khoản / nhóm trên form khác qua `/api/lookups/*`, mở cho mọi người đã đăng nhập |

Cấp quyền ở Cài đặt › Người dùng & phân quyền. Tài khoản quản trị luôn đủ quyền.

---

## 6. Kiểm tra nhanh một danh mục

1. Thêm bản ghi hợp lệ; thêm trùng mã (lỗi *đã tồn tại*); thêm trùng tên; trạng thái / số ngày / ngân sách sai (lỗi rõ).
2. Danh sách: `?page=2&pageSize=2`, `sort=name&dir=desc`, `search=` có và không dấu, `status=inactive`, `projectStatus=DONE`; `pageSize=99999` bị kẹp về 200; `sort=cotla` → 400.
3. Xuất Excel: tiêu đề đúng ngôn ngữ, số dòng khớp bộ lọc, có dòng nhật ký `EXPORT`.
4. Nhập Excel có dòng sai: **không lưu dòng nào**, báo lỗi từng dòng.
5. Sửa bằng `version` cũ → 409.
6. Dùng bản ghi ở chứng từ rồi xóa → bị từ chối, nêu tên bảng; gỡ chỗ dùng (hoặc xóa chứng từ) rồi xóa lại được.
7. Tài khoản không có quyền Xem: `GET` danh sách → 403, tra cứu → 200.
8. Cài đặt › Nhật ký thay đổi có các dòng Tạo / Sửa / Xóa của danh mục.
9. Dọn dữ liệu thử.

Đã thử như trên cho ba danh mục (trùng mã, trạng thái sai, ngày sai, tra cứu, xuất Excel, gắn vào chứng từ, dự án đã hoàn thành bị từ chối trên chứng từ mới, chặn xóa khi còn chứng từ dùng).

---

## 7. Các bước thêm một danh mục mua hàng mới

Ví dụ thêm **Danh mục đơn vị giao hàng** (`pur_carrier_cat`, bảng `erp_carrier`). Làm theo skill `/them-danh-muc` và `docs/phat-trien/them-danh-muc.md`; dưới đây là bản tóm tắt với tên tệp của phân hệ Mua hàng.

1. **Chốt**: tên, mã chức năng (`pur_<ten>_cat`, không đổi về sau), bảng `erp_<ten>`, đường dẫn `api/purchasing/<so-nhieu>`, tên tra cứu (camelCase số nhiều), các trường, cột nào trỏ sang danh mục khác (`<bảng đích>_code`), bảng nào sẽ trỏ tới danh mục này. Quy ước **bắt buộc**: khóa và tên luôn là `code` và `name`.
2. **SQL**: thêm `NN-purchasing-<ten>.sql` (hoặc phần vào script mua hàng đang làm): bảng có `code` khóa chính, `name`, `is_active`, `sort_order`, 4 cột dấu bản ghi, unique index tên (`lower(name)`), **chỉ mục bắt đầu bằng chính cột** cho mỗi `*_code` trỏ danh mục khác, **không khóa ngoại**, chạy hai lần trên `erp_dev`.
3. **Backend**
   - Thực thể `Core.Domain/Modules/Purchasing/Categories/<Ten>/<Ten>.cs`: `ErpEntity, ICatalogRecord`, `[Audited(...)]`, `[Table]`, `[Column]`, `[References<...>]` cho mọi `*_code` (hoặc `[NotReference("lý do")]`); `DbSet` ở `CoreContext`.
   - Hợp đồng vào `PurchasingCategoryContracts.cs`: `<Ten>Dto(..., RecordStampDto Stamp, uint Version)`, `Save<Ten>Request(..., bool IsActive = true, uint? Version = null) : ICatalogRequest`, `I<Ten>Service : ICatalogService<,>`.
   - Dịch vụ `Core.Infrastructure/Modules/Purchasing/Categories/<Ten>Service.cs` sao từ `PaymentTermService.cs`: `Spec`, `Sorts`, `Search`, `ExportColumns`, `WithoutVersion`, `MapAsync`, `ApplyAsync`. **Không** tự viết kiểm xóa "đang dùng".
   - Controller 5 dòng trong `PurchasingCategoriesControllers.cs`; `AddScoped` ở `DependencyInjection.cs`; tra cứu: một mục `LookupDefinition` ở `LookupCatalogs.cs` (nhớ liệt kê **mọi bảng** mà tra cứu đọc, nếu thiếu test `EveryLookupNamesEveryTableItReads` đỏ).
   - `FunctionCatalog.cs` thêm mã chức năng.
   - Thông báo vi + en: `<loai>.notFound`, `<loai>.codeExists`, `<loai>.nameExists`, `field.<ten>Code`, `field.<ten>Name`, `export.<loai>.sheet` và từng cột, `table.<tên bảng>` (nếu bảng khác sẽ trỏ tới), `function.<ma>` (bản en).
4. **Frontend**
   - `types/index.ts` (`SubMenuKey`) và `config/functions.ts` (`fn('purchasing', '/purchasing/<duong-dan>', 'Tên', 'catalog')`).
   - `modules/purchasing/categories/api.ts`: kiểu bản ghi, kiểu lưu, `createCatalogApi`.
   - Màn: sao `SimpleCategoryViews.tsx` → `CatalogDefinition` (cột, tìm, Excel, form).
   - `PurchasingModule.tsx`: thêm `case`; chữ ở `locales/{vi,en}/purchasing.json`; icon mới thêm vào `components/common/DynamicIcon.tsx`.
   - Menu: `ServerService/Core/SeedData/menu.json`, nút trong nhóm "Danh mục mua hàng" (`GRP_PUR_CATALOGS`); backend tự thêm vào `sys_menu` khi khởi động.
5. **Kiểm tra**: `dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj` (dừng backend trước), `npm run lint && npm run check-menu`, rồi các bước ở mục 6; dọn dữ liệu thử.
6. **Tài liệu**: thêm mục vào tài liệu này, dòng "Backend-backed" ở `CLAUDE.md`, bảng API ở `ServerService/README.md`, sinh lại Word.

### Các test tự động canh cho danh mục

| Test | Bắt lỗi |
|---|---|
| `TableReferenceTests` | cột `*_code` thiếu `[References]` / chỉ mục; bảng được trỏ tới thiếu nhãn `table.<tên bảng>` |
| `CatalogFrameworkTests` | thiếu khóa `<loai>.notFound`, `<loai>.codeExists`, `export.<loai>.sheet`, nhãn mã `field.*` |
| `CatalogPermissionFilterTests` | controller không dùng đúng quyền danh mục |
| `MessagesTests` | câu tiếng Việt trong `throw`, thiếu khóa vi / en |
| `MenuSeedFileTests` | `menu.json` và `FunctionCatalog` lệch nhau |
| `AuditDeclarationTests` | thực thể thiếu `[Audited]` / `[NotAudited]` |
| `BusinessTablesHaveRecordStamps`, `VersionedRecordsUseXminAsConcurrencyToken` | bảng nghiệp vụ thiếu dấu bản ghi / phiên bản |

---

## 8. Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách tránh |
|---|---|---|
| `TableReferenceTests` báo thiếu chỉ mục | chỉ mục tạo trong khối `DO $$ … $$` nên test (đọc chữ của script) không thấy | viết `CREATE INDEX IF NOT EXISTS` tĩnh |
| `TablesThatKeepARowInUseHaveAMessageLabel` đỏ | bảng mới có bảng khác trỏ tới nhưng thiếu `table.<tên bảng>` | thêm nhãn vi + en |
| Chọn dự án trên chứng từ bị từ chối "không còn nhận chứng từ mới" | dự án tạm dừng / hoàn thành / hủy / ngừng dùng | đổi trạng thái dự án về lập kế hoạch hoặc đang thực hiện |
| Xóa danh mục báo "đang được dùng ở: …" | còn bản ghi khác trỏ tới | đặt **ngừng sử dụng**, hoặc gỡ chỗ dùng rồi xóa |
| Màn khác không tải được danh sách chọn | gọi `list` của danh mục (cần quyền Xem danh mục) | dùng `CatalogLookup` / `/api/lookups/{name}` |
| Cột Excel nhập không nhận | tiêu đề khác tiêu đề xuất | tiêu đề Excel và `export.<loai>.*` phải **cùng chữ** |
| Đổi tên cột đã lưu bố cục người dùng bị mất cài đặt cột | `key` của cột là tên lưu bố cục | không đổi `key` cột đã có |
| Ngày ở Excel nhập sai | không đúng `yyyy-MM-dd` | dùng đúng định dạng của file mẫu |

---

## 9. Giới hạn hiện tại

- Khách hàng và người quản lý của dự án là **chữ tự do** (chưa nối danh mục khách hàng / nhân sự vì còn dữ liệu mẫu trên trình duyệt).
- Dự án chưa có phân quyền theo từng dự án (ai thấy dự án nào): quyền chỉ theo chức năng.
- Ngân sách là một con số; chưa chia theo hạng mục hay theo kỳ.
- Điều khoản thanh toán chưa tự tính hạn thanh toán / công nợ phải trả (cần chứng từ hóa đơn mua hàng, chưa có).
- Nhóm nhà cung cấp chưa gắn chính sách giá hay hạn mức.
- Hai dự án mẫu `DA-2026-01`, `DA-2026-02` chỉ nằm trong database phát triển (tạo qua API), không nằm trong script.
