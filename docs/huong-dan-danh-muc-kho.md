# DANH MỤC KHO — HƯỚNG DẪN SỬ DỤNG VÀ QUY TRÌNH THÊM MỚI

Phiên bản: 2.0 · Cập nhật: 08/10/2026 · Áp dụng cho S-ERP tại `Frontend/` và `ServerService/`.

## 1. Phạm vi và trạng thái hiện tại

Danh mục kho là chức năng `inv_warehouse_cat`, truy cập ở **Kho hàng → Danh mục kho**. Dữ liệu của màn này được lưu ở bảng PostgreSQL `erp_warehouse` thông qua API `/api/inventory/warehouses`. Màn hỗ trợ thêm, sửa, ngừng sử dụng, xóa, tìm kiếm, lọc theo trạng thái, loại kho và đơn vị cơ sở, xuất và nhập Excel. Danh sách phân trang và xuất Excel làm ở máy chủ; mỗi kho có **loại kho** (danh mục loại kho) và danh sách **đơn vị cơ sở sử dụng** (chọn nhiều).

Các màn phiếu nhập, phiếu xuất, tồn kho, định mức tồn và vị trí lưu kho vẫn dùng dữ liệu mẫu trong `localStorage` của trình duyệt. Kho mới tạo trong danh mục **chưa tự động xuất hiện** ở các màn đó. Khi tích hợp các nghiệp vụ này với backend, cần chuyển chúng sang dùng `/api/lookups/warehouses` và thống nhất mã kho.

**Kho theo đơn vị cơ sở.** Mỗi kho có danh sách đơn vị cơ sở được dùng (bảng `erp_warehouse_unit`). **Để trống nghĩa là kho dùng chung**: mọi đơn vị cơ sở đều dùng được. Khi đã chọn đơn vị thì chỉ các đơn vị đó dùng kho: ô chọn kho của phiếu nhập kho chỉ liệt kê kho dùng được cho đơn vị đang đăng nhập, và lưu phiếu với kho không dành cho đơn vị đó bị từ chối. Chỉ chọn thêm được đơn vị đang hoạt động; đơn vị đã gán sẵn thì giữ lại dù sau này bị tạm dừng. Một đơn vị cơ sở còn được kho dùng thì không xóa được.

### 1.1. Quyền thao tác

| Quyền | Có thể làm |
| --- | --- |
| Xem | Mở danh mục và xem danh sách. |
| Thêm | Tạo kho; mở màn nhập Excel ở chế độ chỉ thêm. |
| Sửa | Sửa thông tin hoặc đổi trạng thái; kết hợp với Thêm để nhập Excel kiểu cập nhật bản ghi có sẵn. |
| Xóa | Xóa một kho hoặc xóa nhiều kho đã chọn. |
| Xuất | Xuất ra Excel mọi dòng khớp bộ lọc hiện tại (máy chủ làm file và ghi nhật ký). Cần cả quyền Xem. |

Quản trị viên có toàn quyền. Nếu không thấy nút thao tác, kiểm tra quyền của tài khoản tại **Cài đặt → Người dùng & phân quyền**. Không có quyền Xem thì chức năng không xuất hiện trong menu.

## 2. Hướng dẫn sử dụng cho người dùng

### 2.1. Mở màn danh mục

1. Mở `http://localhost:3000` và đăng nhập vào đơn vị cơ sở cần làm việc.
2. Trong menu bên trái, chọn **Kho hàng → Danh mục kho**.
3. Kiểm tra danh sách kho, số dòng, trạng thái và các cột người tạo/người sửa. Danh mục mới có thể trống; dữ liệu mẫu ở các màn nghiệp vụ không tự nạp vào đây.

### 2.2. Thêm mới một kho — thao tác chi tiết

1. Bấm **Thêm kho**.
2. Nhập **Mã kho**: bắt buộc, tối đa 20 ký tự; hệ thống lưu bằng chữ hoa. Không dùng khoảng trắng, dấu hai chấm `:` hoặc dấu phẩy `,`. Ví dụ: `KH-HCM-01`.
3. Nhập **Tên kho**: bắt buộc, tối đa 100 ký tự và không trùng tên kho đã có. Ví dụ: `Kho Tổng TP. Hồ Chí Minh`.
   Chọn **Đơn vị cơ sở sử dụng**: gõ mã rồi Enter, hoặc bấm kính lúp / F2 để tìm và đánh dấu nhiều đơn vị. Để trống nếu mọi đơn vị cơ sở đều dùng kho này.
   Chọn **Loại kho** (tra cứu danh mục loại kho; không bắt buộc).
4. Nhập **Địa chỉ** (tối đa 300 ký tự), **Thủ kho phụ trách** (tối đa 100 ký tự) và **Sức chứa** (tối đa 100 ký tự). Các trường này có thể bỏ trống; sức chứa hiện là mô tả văn bản, ví dụ `5.000 m²`.
5. Giữ chọn **Đang hoạt động** nếu kho được phép sử dụng. Bỏ chọn để tạo kho ở trạng thái tạm dừng.
6. Bấm **Lưu**. Màn hình tự tải lại danh sách và hiện thông báo kết quả.
7. Tìm kho vừa tạo bằng mã hoặc tên để xác nhận. Nếu báo trùng mã/tên, đổi giá trị rồi lưu lại.

Mã kho là khóa của bản ghi và không đổi được sau khi tạo. Nếu cần mã khác, tạo kho mới rồi xử lý kho cũ theo quy trình dữ liệu của đơn vị.

### 2.3. Sửa thông tin hoặc tạm dừng kho

1. Tìm dòng kho cần sửa, bấm nút **Sửa** hoặc mở dòng.
2. Sửa tên, địa chỉ, thủ kho, sức chứa hoặc trạng thái. Mã kho bị khóa trong form.
3. Bấm **Lưu** và kiểm tra thông báo. Nếu người khác đã thay đổi cùng bản ghi trước đó, hệ thống từ chối ghi đè; tải lại rồi thực hiện lại trên dữ liệu mới.
4. Nên dùng **Tạm dừng** thay cho xóa khi muốn giữ lịch sử kho. Kho tạm dừng không có trong tra cứu mặc định cho lựa chọn mới.

### 2.4. Tìm kiếm, lọc và làm mới

1. Gõ mã, tên, mã loại kho, địa chỉ, thủ kho, sức chứa hoặc mã đơn vị cơ sở vào ô tìm kiếm. Tìm kiếm không phân biệt chữ hoa/chữ thường và hỗ trợ tiếng Việt không dấu.
2. Mở **Bộ lọc** để chọn trạng thái (**Đang hoạt động** hoặc **Tạm dừng**), **Loại kho** hoặc **Đơn vị cơ sở sử dụng** (kho đơn vị đó dùng được, kể cả kho dùng chung). Xóa bộ lọc khi cần xem lại toàn bộ.
3. Bấm **Làm mới** để nạp lại từ API sau khi người khác cập nhật.
4. Có thể chỉnh cột hiển thị, độ rộng, thứ tự sắp xếp và số dòng mỗi trang; bố cục được lưu theo người dùng.

### 2.5. Nhập và xuất Excel

**Xuất:** Lọc danh sách nếu cần, rồi bấm **Xuất Excel**. File chỉ chứa các dòng đang hiển thị sau tìm kiếm/lọc.

**Nhập:**

1. Bấm **Nhập Excel → Tải file mẫu**. Sử dụng file `.xlsx` có các cột Mã kho, Tên kho, Đơn vị cơ sở sử dụng (mã cách nhau dấu phẩy, ví dụ `DVCS01, DVCS02`; ô trống = dùng chung), Mã loại kho, Địa chỉ, Thủ kho phụ trách, Sức chứa, Đang hoạt động. File xuất ra dùng đúng các cột này nên sửa xong nhập lại được; nếu file nhập không có cột đơn vị thì kho giữ nguyên đơn vị đang có.
2. Điền dữ liệu; mỗi dòng là một kho. Mã kho và Tên kho là bắt buộc. Không lặp mã trong cùng file.
3. Chọn file để xem trước các dòng và lỗi trước khi gửi.
4. Chọn **Chỉ thêm** nếu các mã đều mới. Chọn chế độ **Thêm hoặc cập nhật** khi muốn sửa mã đã có; chế độ này cần cả quyền Thêm và Sửa.
5. Xác nhận nhập. Nếu một dòng lỗi, toàn bộ lần nhập được hủy và hệ thống hiển thị lỗi theo dòng; sửa file rồi nhập lại.

### 2.6. Xóa kho

1. Bấm **Xóa** ở một dòng hoặc đánh dấu nhiều dòng rồi chọn **Xóa đã chọn**.
2. Đọc hộp xác nhận và xác nhận nếu đúng kho cần xóa.
3. Xóa là thao tác xóa bản ghi khỏi `erp_warehouse`. Kho đã có phiếu nhập kho thì không xóa được: hệ thống báo "đang được dùng ở: Phiếu nhập kho (n)". Các chứng từ mẫu còn ở trình duyệt thì backend chưa kiểm tra được. Kiểm tra dữ liệu nghiệp vụ trước khi xóa; ưu tiên tạm dừng kho đang dùng.

### 2.7. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không thấy menu/nút | Nhờ quản trị viên kiểm tra quyền `inv_warehouse_cat`. |
| Trùng mã kho hoặc tên kho | Tìm bản ghi có sẵn; dùng mã/tên khác hoặc sửa bản ghi đó. |
| Không lưu được vì dữ liệu đã thay đổi | Tải lại danh sách và sửa trên bản mới nhất. |
| Nhập Excel bị từ chối | Xem lỗi theo dòng, kiểm tra cột bắt buộc, mã trùng và giới hạn ký tự. |
| Danh mục rỗng dù màn chứng từ có kho | Hai nguồn dữ liệu hiện chưa đồng bộ; xem Mục 1. |
| Phiếu nhập báo "Kho X không dành cho đơn vị cơ sở Y" | Kho chỉ dành cho một số đơn vị; chọn kho khác hoặc thêm đơn vị Y vào danh mục kho |
| Không chọn được đơn vị cơ sở cho kho | Đơn vị đó đang tạm dừng hoặc không tồn tại; kiểm tra ở Cài đặt → Đơn vị cơ sở |
| API không kết nối | Kiểm tra frontend `:3000`, API `:2512` và `/health` của API. |

## 3. Kiểm tra cấu trúc triển khai hiện tại

### 3.1. Sơ đồ luồng dữ liệu

`WarehouseCategoryView` → `CatalogScreen` → `warehousesApi` (`createCatalogApi`) → `WarehousesController : CatalogControllerBase` → `WarehouseService : CatalogService` → `CoreContext` → `erp_warehouse`, `erp_warehouse_unit`.

API kiểm tra quyền `inv_warehouse_cat` cho từng việc; service chỉ khai báo phần riêng của kho (cột sắp xếp, tìm kiếm, bộ lọc, cột xuất, kiểm tra tên, danh sách đơn vị); khung `CatalogService` lo phân trang, xuất, tạo, sửa, xóa, nhập. Khai báo `[References]` của `erp_warehouse.warehouse_type_code`, `erp_warehouse_unit.unit_code` và `erp_goods_receipt.warehouse_code` giúp chặn xóa kho, loại kho, đơn vị đang được dùng và kiểm tra mã khi lưu. `[Audited]` ghi nhật ký thay đổi, `xmin` ngăn ghi đè và cache danh sách được xóa khi bảng thay đổi. `CatalogBatch` xử lý nhập Excel và xóa nhiều trong giao dịch. Mục tra cứu `warehouses` cung cấp mã kho cho màn khác (`LookupCatalogs.cs`); các ô chọn đơn vị cơ sở và loại kho trên màn kho dùng tra cứu `companyUnits` và `warehouseTypes`.

### 3.2. Đối chiếu với quy ước dự án

| Quy ước | Triển khai danh mục kho | Kết quả |
| --- | --- | --- |
| Bảng nghiệp vụ `erp_*`, cột `snake_case`, SQL tăng số | `erp_warehouse`, `17-inventory-warehouses.sql` | Đúng |
| Entity ở Domain | `Core.Domain/Modules/Inventory/Categories/warehouses/Warehouse.cs` | Đúng |
| DTO và interface ở Application | `Core.Application/Modules/Inventory/Categories/warehouses/WarehouseContracts.cs` | Đúng |
| Quy tắc ở Infrastructure, controller mỏng | `WarehouseService.cs`, `WarehousesController.cs` | Đúng |
| Mã quyền chung, từng hành động có quyền | `inv_warehouse_cat`, `RequirePermission` | Đúng |
| Frontend dùng API chung và `CatalogScreen` | `modules/inventory/categories/warehouses/` | Đúng |
| Việt/Anh, nhật ký, chống ghi đè, Excel, tra cứu | Đã đăng ký và kiểm tra | Đúng |
| Dữ liệu danh mục dùng trong nghiệp vụ | Chứng từ/tồn kho vẫn dùng mock trình duyệt | Chưa tích hợp |
| Phạm vi kho theo đơn vị cơ sở | `erp_warehouse_unit` (chọn nhiều; trống = dùng chung); phiếu nhập kiểm tra | Đúng (phiếu nhập); các chứng từ khác khi chuyển lên backend |

### 3.3. Bản đồ tệp

| Thành phần | Đường dẫn |
| --- | --- |
| SQL | `ServerService/sql/postgresql/17-inventory-warehouses.sql`, `19-inventory-warehouse-types.sql` (loại kho), `25-inventory-warehouse-units.sql` (đơn vị cơ sở sử dụng) |
| Entity | `ServerService/Core.Domain/Modules/Inventory/Categories/warehouses/Warehouse.cs` (có `WarehouseUnit`) |
| DTO, request, interface | `ServerService/Core.Application/Modules/Inventory/Categories/warehouses/WarehouseContracts.cs` |
| Service | `ServerService/Core.Infrastructure/Modules/Inventory/Categories/warehouses/WarehouseService.cs` |
| EF DbSet | `ServerService/Core.Infrastructure/Common/Persistence/CoreContext.cs` |
| DI và tra cứu | `ServerService/Core.Infrastructure/DependencyInjection.cs` |
| API | `ServerService/Core/Modules/Inventory/Categories/warehouses/WarehousesController.cs` |
| Menu/quyền | `FunctionCatalog.cs`, `Frontend/src/config/functions.ts`, `ServerService/Core/SeedData/menu.json` |
| UI và API client | `Frontend/src/modules/inventory/categories/warehouses/` |
| Ngôn ngữ | `Messages.vi.json`, `Messages.en.json`, `Frontend/src/locales/{vi,en}/inventory.json` |

## 4. Quy trình thêm một danh mục mới cho lập trình viên

Ví dụ dưới đây dùng **danh mục kho** để chỉ rõ vị trí và thứ tự công việc. Khi tạo danh mục khác, thay `warehouse`, `warehouses`, `Warehouse` và `inv_warehouse_cat` bằng tên tương ứng. Hướng dẫn tổng quát ở `docs/them-danh-muc.md`; mẫu danh mục có danh sách chọn nhiều là Phần 5.1 của tài liệu đó; khai báo tham chiếu giữa các bảng ở `docs/tham-chieu-danh-muc.md`.

### Bước 1. Chốt mã và trường dữ liệu

Ghi trước mã chức năng, route, bảng, API, tên tra cứu, khóa chính, độ dài từng trường, quy tắc trùng và trạng thái. Với kho: `inv_warehouse_cat`, `/inventory/warehouses`, `erp_warehouse`, `/api/inventory/warehouses`, tra cứu `warehouses`, khóa `code` tối đa 20 ký tự. Xác định các nghiệp vụ nào sẽ dùng danh mục để lập kế hoạch chuyển khỏi mock.

### Bước 2. Tạo script cơ sở dữ liệu

Thêm file số tiếp theo trong `ServerService/sql/postgresql/`. Dùng `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`; có cột `created_at`, `created_by`, `updated_at`, `updated_by`, `is_active`, `sort_order`; tên cột `snake_case`. Tạo ràng buộc duy nhất cho tên nếu nghiệp vụ yêu cầu. Chạy script theo thứ tự tên file. Không sửa script đã triển khai để thay đổi dữ liệu cũ; tạo script mới cho lần thay đổi kế tiếp.

### Bước 3. Khai báo entity Domain

Tạo `Core.Domain/Modules/Inventory/Categories/warehouses/Warehouse.cs`: `[Table("erp_warehouse")]`, `[Column(...)]`, `[Key]`, `[MaxLength]`, kế thừa `ErpEntity`, gắn `[Audited("inv_warehouse_cat", ...)]`. `ErpEntity` cung cấp dấu thời gian và `Version` từ PostgreSQL `xmin`.

### Bước 4. Khai báo contract Application

Tạo `Core.Application/Modules/Inventory/Categories/warehouses/WarehouseContracts.cs`: DTO trả về, request lưu và `IWarehouseService`. DTO cần `Stamp` và `Version`; request sửa có `Version` để phát hiện xung đột. Khai báo các hàm danh sách, thêm, sửa, xóa, nhập và xóa nhiều.

### Bước 5. Đăng ký EF và triển khai service

Thêm `DbSet<Warehouse>` vào `CoreContext`. Tạo `WarehouseService` trong `Core.Infrastructure/Modules/Inventory/`: chuẩn hóa mã bằng `Guard.Code`; kiểm tra mã/tên trùng; kiểm tra độ dài bằng `Guard`; dùng `db.ExpectVersion` khi sửa; sắp thứ tự hiển thị; chuyển entity sang DTO; dùng `CachedAsync` cho danh sách. Nếu bảng nghiệp vụ thật đã tham chiếu kho, chặn xóa kho đang dùng và khuyến nghị ngừng sử dụng.

### Bước 6. Đăng ký DI, tra cứu và API

Trong `Core.Infrastructure/DependencyInjection.cs`, đăng ký `IWarehouseService` và `AddLookup("warehouses", ...)`. Tạo `Core/Modules/Inventory/Categories/warehouses/WarehousesController.cs` với `GET`, `POST`, `PUT /{code}`, `DELETE /{code}`, `POST /import`, `POST /delete-many`. Gắn `RequirePermission` tương ứng Xem/Thêm/Sửa/Xóa. Import kiểu cập nhật phải kiểm tra thêm quyền Sửa.

### Bước 7. Thêm mã chức năng và menu

Thêm cùng mã `inv_warehouse_cat` vào `FunctionCatalog.cs`, `SubMenuKey` trong `Frontend/src/types/index.ts`, `FUNCTION_REGISTRY` trong `Frontend/src/config/functions.ts`, nút menu trong `ServerService/Core/SeedData/menu.json` và case trong `InventoryModule.tsx`. Với danh mục kho các mục này đã tồn tại; danh mục mới phải tự bổ sung. Mã này cũng là khóa của quyền, nhật ký và bố cục lưới.

### Bước 8. Viết API client và màn hình

Trong `Frontend/src/modules/inventory/<ten>/`, tạo `types.ts`, `api.ts`, `CategoryView.tsx`, `index.ts`. Dùng `apiRequest` cho mọi request; dùng `CatalogScreen` để khai báo cột, form, văn bản, Excel, tìm kiếm và trạng thái. Không gọi `fetch` trực tiếp trong màn. Đặt `keyOf` bằng khóa backend; giữ mã bất biến khi sửa; chuẩn hóa dữ liệu trước khi lưu.

### Bước 9. Thêm hai ngôn ngữ và lỗi nghiệp vụ

Thêm nhãn UI vào `Frontend/src/locales/vi/inventory.json` và `en/inventory.json`. Thêm khóa lỗi/trường vào `ServerService/Core.Application/Common/Localization/Messages.vi.json` và `.en.json`. Nội dung hiển thị cho người dùng viết tiếng Việt, có bản tiếng Anh tương ứng.

### Bước 10. Áp dụng, kiểm tra và bàn giao

1. Chạy script SQL mới vào database mục tiêu theo thứ tự. Với kho: `psql -h localhost -U postgres -d erp_dev -v ON_ERROR_STOP=1 -f ServerService/sql/postgresql/17-inventory-warehouses.sql` (thay thông số theo `appsettings.Local.json`).
2. Chạy `dotnet build Core.sln --no-restore` và `dotnet test tests/Core.Tests/Core.Tests.csproj --no-build --no-restore` tại `ServerService/`.
3. Chạy `npm run lint`, `npm run check-i18n`, `npm run build` tại `Frontend/`.
4. Khởi động API và frontend; kiểm tra `/health` trả `Healthy`.
5. Đăng nhập tài khoản có quyền; thử thêm, sửa, tìm kiếm, lọc, tạm dừng, xóa, xuất và nhập Excel. Thử tài khoản thiếu quyền. Kiểm tra lỗi trùng mã/tên và xung đột phiên bản.
6. Thử `/api/lookups/warehouses` và xác nhận màn nghiệp vụ dùng mã kho thống nhất trước khi tuyên bố tích hợp hoàn toàn.
7. Cập nhật README và hướng dẫn sử dụng; ghi rõ phần còn dùng dữ liệu mẫu.

## 5. Kết quả xác minh tại thời điểm viết (08/10/2026)

- `dotnet build` 0 lỗi, 0 cảnh báo; 339 bài kiểm thử backend đạt; `tsc` sạch.
- Kiểm tra API trên backend chạy thật: phân trang, tìm không dấu, sắp xếp, xuất `.xlsx`, nhập Excel (có dòng sai thì không lưu dòng nào), xóa nhiều, tra cứu, 401 / 403 / 409; nhiều đơn vị cơ sở cho một kho (tách bằng dấu phẩy hoặc chấm phẩy, mã lạ bị từ chối, bỏ trường thì giữ nguyên, để trống thì thành dùng chung), lọc theo đơn vị, tìm theo mã đơn vị, phiếu nhập từ chối kho không dành cho đơn vị, xóa đơn vị đang gán cho kho bị chặn.
- Màn hình `Kho hàng → Danh mục kho` mở đúng, hộp thêm mới có ô chọn nhiều đơn vị cơ sở.

Giới hạn hiện tại: danh mục kho đã gắn với phiếu nhập kho (backend); các chứng từ và tồn kho còn lại vẫn dùng dữ liệu mẫu ở trình duyệt, khi chuyển lên backend phải khai `[References<Warehouse>]` và kiểm tra kho theo đơn vị bằng `db.UsableBy(unitCode)`.
