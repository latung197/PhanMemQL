# Danh mục bán hàng: nhóm khách hàng, khách hàng, bảng giá bán

Giai đoạn 1 của phân hệ Bán hàng: ba danh mục chạy thật trên backend (trước đây khách hàng là dữ liệu giả trong trình duyệt). Chúng là nền cho đơn bán hàng, phiếu xuất kho bán hàng và hóa đơn bán hàng ở các giai đoạn sau. Cả ba theo khung danh mục chung (xem `docs/phat-trien/them-danh-muc.md`): danh sách phân trang ở máy chủ, tìm không dấu, lọc, xuất và nhập Excel, xóa nhiều, nút **Cột**, chống ghi đè (`version`), nhật ký thay đổi, chặn xóa khi còn được dùng.

Menu: Bán hàng › Danh mục (Khách hàng, Nhóm khách hàng, Bảng giá bán). Cấp quyền ở Cài đặt › Người dùng & phân quyền.

| Danh mục | Chức năng | Bảng | API | Tra cứu | Đổi mã / gộp mã |
|---|---|---|---|---|---|
| Nhóm khách hàng | `sales_customer_group_cat` | `erp_customer_group` | `api/sales/customer-groups` | `customerGroups` | có |
| Khách hàng | `sales_customers` | `erp_customer` | `api/sales/customers` | `customers` | có |
| Bảng giá bán | `sales_price_list_cat` | `erp_price_list`, `erp_price_list_line` | `api/sales/price-lists` | `priceLists` | không |

## 1. Nhóm khách hàng

Mã (tối đa 20 ký tự, không đổi sau khi tạo), tên (không trùng, không phân biệt hoa thường), ghi chú, đang sử dụng. Khách hàng và bảng giá trỏ tới nhóm bằng `customer_group_code`; nhóm còn được dùng thì không xóa được (thông báo nêu bảng đang dùng), muốn bỏ thì chuyển sang ngừng sử dụng. Đổi mã hoặc gộp mã thì khách hàng và bảng giá đi theo.

## 2. Khách hàng

| Trường | Ghi chú |
|---|---|
| Mã, tên | bắt buộc; mã không đổi sau khi tạo |
| Mã số thuế | không trùng giữa các khách hàng; để trống thì không kiểm (nhiều khách có thể không có mã số thuế) |
| Người liên hệ, điện thoại, email, địa chỉ | tùy chọn |
| Nhóm khách hàng | danh mục nhóm (tùy chọn): quyết định bảng giá riêng của nhóm |
| Điều khoản thanh toán | danh mục điều khoản của Mua hàng (tùy chọn): mặc định cho đơn bán của khách |
| Hạn mức công nợ | theo tiền hạch toán; `0` là không giới hạn. Giai đoạn này chỉ lưu; đơn bán và báo cáo công nợ phải thu sẽ cảnh báo khi vượt |

Bộ lọc: theo nhóm khách hàng. Tra cứu `customers` trả thêm mã số thuế, nhóm, điều khoản thanh toán để chứng từ điền sẵn.

## 3. Bảng giá bán

Một bảng giá có: mã, tên (không trùng), **loại tiền**, **hiệu lực từ ngày** (bắt buộc), **hiệu lực đến ngày** (trống là không hết hạn, không được trước ngày bắt đầu), **nhóm khách hàng áp dụng** (trống là bảng giá chung cho mọi khách), ghi chú, đang sử dụng, và các **dòng giá**.

**Dòng giá** là lưới trong form (lưu cùng lúc với bảng giá, trong một giao dịch):

| Cột | Ý nghĩa |
|---|---|
| Vật tư | vật tư đang sử dụng (không bắt buộc là hàng tồn kho: dịch vụ cũng có giá) |
| Đơn vị tính | đơn vị gốc của vật tư hoặc một đơn vị đã quy đổi của nó (như chứng từ) |
| Từ số lượng | giá bậc thang: mua từ số lượng này trở lên thì áp giá này; `0` là từ đơn vị đầu tiên |
| Đơn giá | trước thuế, theo loại tiền của bảng giá, không âm |
| Ghi chú | tùy chọn |

Một vật tư, một đơn vị tính và một bậc "từ số lượng" chỉ có một dòng trong một bảng giá. Tối đa 5000 dòng giá mỗi bảng giá. Màn hình chỉ tải các dòng khi mở form một bảng giá (danh sách chỉ hiện số dòng), nên danh sách nhẹ dù bảng giá lớn. Khi lưu, các dòng không còn trong lưới bị xóa; lưu mà không gửi các dòng (nhập Excel, sửa qua API) thì giữ nguyên các dòng cũ. Sửa riêng các dòng cũng làm tăng `version` của bảng giá, nên hai người mở cùng một bảng giá thì người lưu sau bị báo ghi đè (409).

**File Excel** của bảng giá chỉ gồm đầu bảng giá (không có dòng giá): nhập Excel tạo hoặc cập nhật đầu bảng giá và giữ nguyên các dòng; các dòng giá nhập trong form.

### Cách lấy giá (đơn bán hàng sẽ dùng)

`GET api/sales/price-lists/resolve?customer=KH001&material=VT001&uom=TAM&currency=VND&date=2026-10-20&quantity=12` trả `{ priceListCode, priceListName, currencyCode, uomCode, minQuantity, unitPrice }`, hoặc không có nội dung (204) khi chưa có bảng giá nào cho giá:

1. Chỉ xét bảng giá **đang sử dụng**, cùng **loại tiền**, **hiệu lực** vào ngày hỏi (mặc định hôm nay), và là bảng giá chung hoặc của **nhóm khách hàng** của khách đó (khách không có nhóm hoặc không có trong danh mục thì chỉ có bảng giá chung).
2. Trong số đó, bảng giá **của nhóm** đứng trước bảng giá chung; cùng loại thì bảng giá **bắt đầu hiệu lực muộn hơn** đứng trước.
3. Trong bảng giá được chọn lấy dòng giá cùng vật tư và đơn vị tính có **"từ số lượng" cao nhất mà không vượt số lượng hỏi**.

Cần quyền Xem của bảng giá bán (đơn bán hàng sau này sẽ cho phép theo quyền lập đơn). Giá tìm không ra thì đơn bán để người lập tự nhập.

## 4. Cơ sở dữ liệu

Script `ServerService/sql/postgresql/52-sales-catalogs.sql` (chạy lại được, không khóa ngoại): `erp_customer_group`, `erp_customer` (chỉ mục duy nhất cho mã số thuế khác rỗng), `erp_price_list` (ràng buộc `valid_to >= valid_from`), `erp_price_list_line` (chỉ mục duy nhất `price_list_code, material_code, uom_code, min_quantity`). Mọi cột `*_code` khai `[References]`: khách hàng → nhóm, điều khoản thanh toán; bảng giá → loại tiền, nhóm; dòng giá → bảng giá (không chặn xóa: dòng đi theo bảng giá), vật tư, đơn vị tính (chặn xóa: vật tư hoặc đơn vị đang có trong bảng giá không xóa được, đặt ngừng sử dụng).

## 5. Mã nguồn

| Phần | Nơi |
|---|---|
| Thực thể | `Core.Domain/Modules/Sales/Categories/{CustomerGroups,Customers,PriceLists}/` |
| Hợp đồng | `Core.Application/Modules/Sales/Categories/SalesCategoryContracts.cs` |
| Dịch vụ | `Core.Infrastructure/Modules/Sales/Categories/{CustomerGroupService,CustomerService,PriceListService}.cs` (`PriceListService.AfterApplyAsync` lưu dòng giá, `ResolveAsync` lấy giá) |
| API | `Core/Modules/Sales/Categories/SalesCategoriesControllers.cs` (thêm `GET {code}/lines`, `GET resolve` cho bảng giá) |
| Màn hình | `Frontend/src/modules/sales/categories/{customers,customer-groups,price-lists}/` |
| Chữ trên màn | `Frontend/src/locales/{vi,en}/sales.json` |

## 6. Cài đặt và kiểm tra

1. Chạy script `52-sales-catalogs.sql` (sau `45`).
2. Khởi động lại backend: tự thêm mã chức năng `sales_customer_group_cat`, `sales_price_list_cat` và các mục menu mới.
3. `dotnet test` (468 test), `npm run lint`, `npm run check-menu`.

## 7. Còn lại của phân hệ bán hàng

Đơn bán hàng (lấy giá từ bảng giá, cảnh báo vượt hạn mức công nợ), phiếu xuất kho bán hàng lấy từ đơn bán, hóa đơn bán hàng, báo cáo công nợ phải thu, báo giá, phiếu trả hàng bán, báo cáo doanh số và lãi gộp. Các màn bán hàng khác (đơn bán, giao hàng, báo cáo doanh số) vẫn là dữ liệu giả trong trình duyệt cho tới khi làm các giai đoạn đó.
