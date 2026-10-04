# Quy trình thêm danh mục Quy đổi đơn vị tính

Tài liệu này ghi lại các bước đã dùng để đưa **Kho › Quy đổi đơn vị tính** từ dữ liệu trình duyệt sang danh mục lưu ở PostgreSQL. Khi làm một danh mục tương tự, dùng [quy trình thêm danh mục chung](them-danh-muc.md) làm chuẩn; phần dưới nêu các quyết định và file cụ thể của quy đổi đơn vị tính.

## 1. Xác định chức năng và dữ liệu

| Thành phần | Giá trị |
| --- | --- |
| Mã chức năng, quyền và nhật ký | `inv_uom_conversion_cat` |
| Đường dẫn màn hình | `/inventory/uom-conversions` |
| API danh mục | `/api/inventory/uom-conversions` |
| Bảng | `erp_uom_conversion` |
| Tra cứu cho màn hình khác | `uomConversions` |
| Tra cứu đơn vị nguồn/đích | `uoms` |

Mã chức năng đã có trong danh sách chức năng backend, `Frontend/src/types/index.ts`, `Frontend/src/config/functions.ts` và `Frontend/src/mock/initialMenuData.ts`; khi triển khai chỉ kiểm tra và dùng lại mã đó. Giữ cùng một mã trong controller, `CatalogDefinition`, menu, phân quyền và `[Audited]`.

Quy tắc nghiệp vụ: `1` đơn vị nguồn bằng `factor` đơn vị đích. Ví dụ `THUNG → HOP`, hệ số `20` nghĩa là một thùng bằng 20 hộp. Quy đổi có thể áp dụng chung (`material_code` rỗng) hoặc cho một mã vật tư. Mỗi bộ `(vật tư hoặc áp dụng chung, đơn vị nguồn, đơn vị đích)` chỉ có một dòng. Cặp chiều ngược lại là một dòng riêng.

## 2. Database

Tạo script [15-inventory-uom-conversions.sql](../ServerService/sql/postgresql/15-inventory-uom-conversions.sql) theo thứ tự script trong `ServerService/sql/postgresql/`. Script tạo `erp_uom_conversion` với các trường:

| Nhóm | Cột và ràng buộc |
| --- | --- |
| Định danh | `code varchar(40) PRIMARY KEY` |
| Phạm vi vật tư | `material_code varchar(50)`, `material_name varchar(200)`; để trống cho quy đổi chung |
| Cặp đơn vị | `from_uom_code`, `to_uom_code` kiểu `varchar(20) NOT NULL`; hai mã phải khác nhau |
| Hệ số | `factor numeric(20,8) NOT NULL`, lớn hơn `0` |
| Hiển thị | `note varchar(300)`, `is_active`, `sort_order` |
| Dấu vết | `created_at`, `created_by`, `updated_at`, `updated_by` theo `ErpEntity` |

Unique index dùng `coalesce(material_code, '')` để cả các dòng áp dụng chung cũng không bị trùng cặp. Có index cho mã vật tư và hai mã đơn vị. Dùng `CREATE ... IF NOT EXISTS` để script chạy lại được. Dự án không dùng khóa ngoại cho các mã danh mục này; service phải tự kiểm tra tham chiếu. Áp dụng script vào database **trước** khi chạy API mới. `Version` không cần cột riêng vì EF ánh xạ PostgreSQL `xmin`.

## 3. Backend

Làm theo luồng **entity → DbContext → contract → service → DI/lookup → controller → thông báo**:

1. [UomConversion.cs](../ServerService/Core.Domain/Modules/Inventory/Categories/uom-conversions/UomConversion.cs): kế thừa `ErpEntity`, ánh xạ `[Table("erp_uom_conversion")]` và các `[Column]`. Gắn `[Audited("inv_uom_conversion_cat", "uomConversion", Label = "{Code}")]` để ghi nhật ký thêm, sửa, xóa.
2. [CoreContext.cs](../ServerService/Core.Infrastructure/Common/Persistence/CoreContext.cs): khai báo `DbSet<UomConversion> UomConversions`. `ErpEntity` cung cấp dấu vết và `Version` dùng `xmin`.
3. [UomConversionContracts.cs](../ServerService/Core.Application/Modules/Inventory/Categories/uom-conversions/UomConversionContracts.cs): khai báo `UomConversionDto`, `SaveUomConversionRequest`, `IUomConversionService`. DTO trả cả tên đơn vị nguồn/đích, `Stamp` và `Version`; request sửa nhận `uint? Version`.
4. [UomConversionService.cs](../ServerService/Core.Infrastructure/Modules/Inventory/Categories/uom-conversions/UomConversionService.cs): viết đọc danh sách, thêm, sửa, xóa, import và xóa nhiều. Dùng `Guard.Code`/`Guard.Optional`, `RecordStamps`, `CachedAsync` và `CatalogBatch` như các danh mục hiện có. Cache danh sách phụ thuộc `erp_uom_conversion`, `erp_uom`, `sys_users` vì DTO có tên đơn vị và người sửa.
5. [DependencyInjection.cs](../ServerService/Core.Infrastructure/DependencyInjection.cs): đăng ký `IUomConversionService` và lookup `uomConversions`; chi tiết ở phần 5.
6. [UomConversionsController.cs](../ServerService/Core/Modules/Inventory/Categories/uom-conversions/UomConversionsController.cs): route `api/inventory/uom-conversions`, kế thừa `ApiControllerBase`; gắn quyền theo từng action.
7. [Messages.vi.json](../ServerService/Core.Application/Common/Localization/Messages.vi.json) và [Messages.en.json](../ServerService/Core.Application/Common/Localization/Messages.en.json): thêm khóa tên trường và lỗi nghiệp vụ cho cả hai ngôn ngữ.

Trong `ApplyAsync`, kiểm tra hai đơn vị khác nhau và đều còn hoạt động; hệ số có tối đa 8 chữ số thập phân, từ `0.00000001` đến dưới `1_000_000_000_000`; cặp đơn vị không trùng trong cùng phạm vi vật tư. `UpdateAsync` gọi `db.ExpectVersion(row, request.Version)` ngay sau khi lấy bản ghi để trả HTTP 409 nếu người khác đã sửa. `CatalogBatch` xử lý import và xóa nhiều theo giao dịch; upsert import gọi cập nhật với `Version = null` theo quy ước batch của dự án.

Trong [UomService.cs](../ServerService/Core.Infrastructure/Modules/Inventory/Categories/uom/UomService.cs), thêm kiểm tra trước khi xóa đơn vị: nếu đơn vị đang là nguồn hoặc đích của bất kỳ quy đổi nào thì báo `uom.inUse`. Ngừng sử dụng và xóa là hai thao tác khác nhau; service quy đổi chỉ cho chọn đơn vị đang hoạt động khi lưu.

| Endpoint | Quyền `inv_uom_conversion_cat` |
| --- | --- |
| `GET /api/inventory/uom-conversions` | View |
| `POST /api/inventory/uom-conversions` | Create |
| `PUT /api/inventory/uom-conversions/{code}` | Edit |
| `DELETE /api/inventory/uom-conversions/{code}` | Delete |
| `POST /api/inventory/uom-conversions/import` | Create; chế độ upsert còn cần Edit |
| `POST /api/inventory/uom-conversions/delete-many` | Delete |

## 4. Frontend

Đặt màn hình trong `Frontend/src/modules/inventory/categories/uom-conversions/`:

1. [types.ts](../Frontend/src/modules/inventory/categories/uom-conversions/types.ts): `UomConversionRecord` khớp DTO (`stamp`, `version`), `SaveUomConversionInput` khớp request.
2. [api.ts](../Frontend/src/modules/inventory/categories/uom-conversions/api.ts): cài `CatalogScreenApi` bằng `apiRequest` cho 6 thao tác của controller. Mã URL dùng `encodeURIComponent`.
3. [UomConversionCategoryView.tsx](../Frontend/src/modules/inventory/categories/uom-conversions/UomConversionCategoryView.tsx): khai báo `CatalogDefinition` rồi truyền cho `CatalogScreen`. Khai báo `functionCode`, cột lưới, `searchText`, cột Excel, `emptyInput`, `toInput`, `normalize` và `renderForm`. Dùng `recordStampColumns` cho cột người tạo/người sửa; `CatalogScreen` lo tải dữ liệu, quyền, phiên bản, nhập/xuất Excel, xóa nhiều và lưu bố cục lưới.
4. [InventoryModule.tsx](../Frontend/src/modules/inventory/InventoryModule.tsx): mount màn hình ở case `inv_uom_conversion_cat`, truyền `currentUser` và danh sách `products` hiện có.
5. [inventory.json (vi)](../Frontend/src/locales/vi/inventory.json) và [inventory.json (en)](../Frontend/src/locales/en/inventory.json): thêm cùng bộ khóa `uomConversions.*`.

Form dùng `CatalogLookup lookup="uoms"` cho **cả** đơn vị nguồn và đơn vị đích. Đây là tra cứu chọn một dùng chung: gõ mã, nhấn Enter, hoặc mở cửa sổ bằng F2/nút tìm. Không tự tạo ô chọn đơn vị riêng. Phần vật tư hiện dùng `SelectInput` từ `products` của frontend và lưu cả `materialCode`/`materialName`.

Khi thay màn hình mock bằng API, bỏ state và thao tác localStorage cũ khỏi luồng màn hình. Dữ liệu quy đổi cũ lưu trong trình duyệt **không tự chuyển** vào PostgreSQL; nếu cần giữ, xuất/nhập dữ liệu trước khi chuyển môi trường. Cột Excel hiện có: mã, mã/tên vật tư, đơn vị nguồn, đơn vị đích, hệ số, ghi chú và trạng thái.

## 5. Tra cứu chọn một và chọn nhiều

Trong `DependencyInjection.cs`, đăng ký một lookup chung cho các màn hình khác dùng:

```csharp
services.AddLookup(new LookupDefinition("uomConversions", db => db.UomConversions.Select(x =>
    new LookupRow { Code = x.Code, Name = x.FromUomCode + " → " + x.ToUomCode,
        IsActive = x.IsActive, Extra1 = x.MaterialCode, Extra2 = x.Factor.ToString() }),
    "materialCode", "factor"));
```

Khung [CatalogLookup.tsx](../Frontend/src/components/catalog/CatalogLookup.tsx) dùng cùng tên lookup cho chọn một hoặc chọn nhiều. Ví dụ ở **màn hình tiêu thụ** quy đổi:

```tsx
<CatalogLookup lookup="uomConversions" label="Quy đổi" value={conversionCode}
  onChange={setConversionCode}
  extraColumns={[{ key: 'materialCode', title: 'Vật tư' }, { key: 'factor', title: 'Hệ số' }]} />

<CatalogMultiLookup lookup="uomConversions" label="Các quy đổi" value={conversionCodes}
  onChange={setConversionCodes} />
```

`onChange` của chọn nhiều còn nhận đối số thứ hai là các `LookupItem` đã chọn. Khung gọi `GET /api/lookups/uomConversions?q=...` để tìm phân trang và `GET /api/lookups/uomConversions/codes?codes=A,B` để lấy lại các mã đã chọn. Mặc định chỉ hiện bản ghi hoạt động. Lookup yêu cầu đăng nhập nhưng không yêu cầu quyền View của cả danh mục; dữ liệu trả về chỉ gồm mã, tên, trạng thái và các cột `extra` đã đăng ký. Form quy đổi hiện chỉ **dùng** lookup `uoms` chọn một; `uomConversions` được đăng ký để các màn hình khác dùng cả hai kiểu tra cứu khi cần.

## 6. Phân quyền và giới hạn hiện tại

Kiểm tra mã `inv_uom_conversion_cat` trong function catalog backend, cấu hình frontend và menu. Quyền của API do controller kiểm soát; `CatalogScreen` dùng cùng mã để ẩn/hiện thao tác tương ứng. Nếu triển khai ở database hoặc môi trường đã có người dùng, kiểm tra quyền của vai trò trong màn phân quyền sau khi lên phiên bản mới.

Danh mục vật tư hiện còn là dữ liệu mock trong trình duyệt. Vì vậy backend lưu mã/tên vật tư được gửi lên, **chưa thể** kiểm tra mã vật tư có tồn tại hoặc còn hoạt động và chưa có lookup backend cho vật tư. Khi danh mục vật tư chuyển sang backend, thay `SelectInput` bằng `CatalogLookup` vật tư và bổ sung kiểm tra trong service; không giả định rằng tra cứu `uomConversions` đã giải quyết phần chọn vật tư.

## 7. Kiểm tra sau khi thêm

1. Áp dụng script SQL, khởi động API và frontend theo [README](../README.md) và [ServerService/README](../ServerService/README.md).
2. Kiểm tra GET danh sách và tìm `uomConversions`; tạo hai đơn vị đang hoạt động rồi tạo quy đổi. Kiểm tra tên đơn vị, `stamp`, `version` trong phản hồi.
3. Thử nguồn trùng đích, hệ số `0`, mã đơn vị không hoạt động, cặp quy đổi trùng: API phải từ chối. Thử xóa đơn vị đang được quy đổi sử dụng: API phải từ chối.
4. Mở cùng bản ghi ở hai nơi, lưu nơi thứ nhất rồi lưu bản cũ ở nơi thứ hai: lần lưu sau phải trả 409 và màn hình nạp lại dữ liệu.
5. Thử import có một dòng sai để kiểm tra rollback; thử import hợp lệ, upsert và xóa nhiều. Kiểm tra quyền Create/Edit/Delete riêng cho các endpoint batch.
6. Mở form, thử F2 ở hai ô đơn vị; ở màn tiêu thụ có lookup quy đổi, thử cả chọn một và chọn nhiều. Kiểm tra tìm kiếm, mã đã chọn được nạp lại và cột `extra`.
7. Chạy `dotnet test` trong `ServerService/`, `npm.cmd run build` và `npm.cmd run check-i18n` trong `Frontend/`. Chạy lint nếu môi trường yêu cầu; đối chiếu lỗi với các lỗi TypeScript đã có từ trước ở `WarehouseCategoryView.tsx` và `LanguageCategoryView.tsx`.

Trước khi bàn giao, kiểm tra thay đổi bằng `git diff --check`, đối chiếu SQL/DTO/TypeScript, và bảo đảm mọi khóa dịch có ở cả tiếng Việt lẫn tiếng Anh. Xem thêm [chống ghi đè](chong-ghi-de.md) và [phân quyền](phan-quyen.md) khi áp dụng mẫu này cho danh mục khác.
