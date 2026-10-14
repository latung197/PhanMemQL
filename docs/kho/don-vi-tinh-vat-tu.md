# Đơn vị tính của vật tư và quy đổi

Tài liệu này giải thích cách S-ERP quản lý đơn vị tính (ĐVT) của vật tư và tồn kho: một **đơn vị gốc** cố định cho mỗi vật tư, thêm **bảng đơn vị quy đổi** ngay trên form vật tư, và cách các phiếu dùng chúng.

## 1. Nguyên tắc

- Mỗi vật tư có **một đơn vị gốc** (`erp_material.uom_code`, tab **2. ĐVT, lô & cờ quản lý**). Tồn kho, sổ kho và giá bình quân **luôn tính theo đơn vị gốc**.
- Các đơn vị khác muốn dùng trên phiếu (mua theo *kiện*, xuất theo *bộ*...) phải được khai báo ở tab **5. Đơn vị quy đổi** của vật tư: *1 đơn vị đó = bao nhiêu đơn vị gốc*.
- Trên phiếu, ô ĐVT của một dòng chỉ liệt kê **đơn vị gốc và các đơn vị đã quy đổi của đúng vật tư đó**. Dòng chọn đơn vị khác thì máy chủ từ chối ngay khi lưu phiếu (thông báo "Chưa có quy đổi từ đơn vị tính … sang đơn vị gốc …"), không đợi đến lúc ghi sổ.
- Ghi sổ: số lượng của dòng được đổi về đơn vị gốc rồi mới vào sổ kho; sổ lưu cả hai (số lượng gốc và `line_uom_code`, `line_quantity` của dòng phiếu). Xóa đơn vị khỏi bảng quy đổi **không** ảnh hưởng tồn đã ghi, vì tồn lưu theo đơn vị gốc.

Ví dụ: thép tấm, đơn vị gốc **TẤM**; quy đổi **1 KIỆN = 10 TẤM**. Phiếu nhập 2 KIỆN → tồn tăng **20 TẤM**; đơn giá 100 / KIỆN thì giá trị nhập là 200.

## 2. Khai báo trên form vật tư

Kho › Khai báo vật tư & SP › mở vật tư › tab **5. Đơn vị quy đổi**:

| Cột | Ý nghĩa |
|---|---|
| Đơn vị | Đơn vị khác đơn vị gốc, chọn trong danh mục ĐVT (mã + F2) |
| 1 đơn vị = ? đơn vị gốc | Hệ số, lớn hơn 0, tối đa 8 chữ số thập phân |
| Ghi chú | Tùy chọn |

- Một đơn vị chỉ khai một lần; không được trùng đơn vị gốc.
- Bảng được lưu **cùng lúc với vật tư** trong một giao dịch; dòng bị xóa khỏi bảng thì bị xóa khỏi danh mục quy đổi. Sửa riêng bảng quy đổi cũng làm tăng phiên bản của vật tư (chống ghi đè như các form khác).
- **Đổi đơn vị gốc** của vật tư đã có quy đổi: phải khai báo lại bảng (hệ số cũ tính theo đơn vị gốc cũ), nếu không máy chủ từ chối. Chỉ nên đổi khi vật tư chưa có tồn.
- Import Excel vật tư không có cột quy đổi: giữ nguyên các quy đổi đã lưu.
- Xóa vật tư thì xóa luôn các quy đổi của nó; vật tư đã có phiếu / sổ kho thì vẫn không xóa được như trước.

## 3. Trên phiếu

- Chọn vật tư → ĐVT tự điền **đơn vị gốc**; mở ô ĐVT thấy các đơn vị đã quy đổi.
- **Đổi đơn vị trên dòng thì đơn giá tự quy đổi** theo tỷ lệ hệ số (đơn giá mới = đơn giá cũ × hệ số đơn vị mới ÷ hệ số đơn vị cũ), thành tiền tính lại theo số lượng hiện có. Ví dụ đơn giá 100 / TẤM đổi sang KIỆN (1 KIỆN = 10 TẤM) thành 1.000 / KIỆN. Có thể sửa lại giá sau đó.
- Áp dụng cho các lưới chi tiết dùng chung: phiếu nhập kho, phiếu xuất kho, phiếu yêu cầu xuất kho, phiếu yêu cầu mua hàng, đơn mua hàng.
- Máy chủ kiểm lại khi lưu (`UomRules.EnsureUsableAsync`): đơn vị phải là đơn vị gốc hoặc có quy đổi (của vật tư, hoặc quy đổi chung đang sử dụng).

## 4. Quy đổi chung và danh mục Quy đổi ĐVT

Danh mục **Quy đổi ĐVT** (`inv_uom_conversion_cat`) vẫn còn:

- Dòng **có mã vật tư** là quy đổi riêng; chính là các dòng của bảng ở tab 5 (mã `VT001@KIEN`). Cột vật tư của danh mục giờ chọn từ danh mục vật tư thật và trỏ `[References<Material>]`.
- Dòng **không có mã vật tư** là quy đổi **chung** (ví dụ 1 THÙNG = 12 HỘP cho mọi vật tư có đơn vị gốc HỘP). Quy đổi riêng của vật tư được ưu tiên hơn quy đổi chung; quy đổi viết ngược chiều thì được nghịch đảo.
- Mã quy đổi dài tối đa 80 ký tự (script `47-material-uom-conversions.sql` nới từ 40 và chuyển các dòng trỏ tới vật tư không còn trong danh mục thành quy đổi chung).

## 5. API và mã nguồn

| Việc | Nơi |
|---|---|
| Vật tư kèm `conversions` (`uomCode`, `factor`, `note`, `isActive`); gửi `conversions: null` thì giữ nguyên | `GET/POST/PUT api/inventory/materials`, `MaterialService.AfterApplyAsync` |
| Danh sách ĐVT dùng được cho một vật tư (đơn vị gốc trước, kèm `factor`) | `GET api/lookups/materialUoms?material=VT001`, `MaterialUomLookup` |
| Kiểm đơn vị khi lưu phiếu | `UomRules.EnsureUsableAsync` (năm dịch vụ phiếu) |
| Quy đổi khi ghi sổ | `StockLedgerService.FactorAsync` |
| Form vật tư (tab 5) | `Frontend/src/modules/inventory/categories/materials/MaterialForm.tsx` |
| Ô ĐVT theo vật tư và đổi giá | `Frontend/src/components/common/VoucherDetailGrid.tsx` |

Lỗi thường gặp: `material.conversionSameAsBase`, `material.conversionDuplicate`, `uomConversion.invalidFactor`, `uomConversion.unitUnavailable`, `material.uomChangeNeedsConversions`, `stock.uomNotConvertible`.
