# Phân hệ Mua hàng và theo dõi chi phí dự án

Tài liệu này mô tả luồng mua hàng của S-ERP, ba danh mục mới (dự án, điều khoản thanh toán, nhóm nhà cung cấp), cách gắn **dự án** vào chứng từ và báo cáo **chi phí theo dự án**. Cách làm chung của một chứng từ (trạng thái, duyệt, lưu thẳng trạng thái) xem `docs/kho/so-kho-va-phieu-nhap-kho.md` và `docs/he-thong/trang-thai-chung-tu.md`.

## 1. Luồng mua hàng

```
Phiếu yêu cầu mua hàng (YCM)  →  Đơn mua hàng (DMH)  →  Phiếu nhập kho (PNK)
   bộ phận đề nghị                  đặt nhà cung cấp         nhận hàng, ghi sổ kho
   (không ghi sổ)                   (không ghi sổ)           (ghi sổ nhập)
```

- Mỗi bước **lấy từ bước trước**: đơn mua hàng có nút **Lấy từ phiếu yêu cầu mua hàng**, phiếu nhập kho có nút **Lấy từ đơn mua hàng**. Cửa sổ chọn chia hai phần: trên là các chứng từ đã duyệt còn hàng chưa xử lý, dưới là vật tư của chứng từ đang bấm; tích vật tư cần lấy và sửa số lượng (mặc định là số còn lại, không được vượt).
- Một chứng từ có thể lấy từ nhiều chứng từ trước, miễn cùng **kho và loại tiền** (phiếu nhập còn phải cùng **nhà cung cấp**). Cột ở cuối mỗi dòng ghi số chứng từ nguồn; dòng nhập lại cùng dòng nguồn thì cộng dồn số lượng.
- Cột **Đã đặt** (phiếu yêu cầu) và **Đã nhập** (đơn mua) do máy chủ tính từ các chứng từ sau chưa hủy; vượt số còn lại bị từ chối.
- Chứng từ trước **không hủy được** khi còn chứng từ sau (chưa hủy) lấy từ nó.

**Có cần phiếu "nhập hàng mua" riêng không?** Không. Phiếu nhập kho hiện có đã là phiếu nhập hàng mua: loại *Nhập mua mới*, có nhà cung cấp, và lấy hàng từ đơn mua hàng. Nhập kho khác (trả lại, sản xuất, điều chuyển) vẫn dùng chính phiếu này.

## 2. Hai chứng từ mới

| | Phiếu yêu cầu mua hàng | Đơn mua hàng |
|---|---|---|
| Chức năng / mã số phiếu | `pur_request` / `YCM` | `pur_order` / `DMH` |
| Ghi sổ kho | Không (dừng ở Đã phê duyệt) | Không (dừng ở Đã phê duyệt) |
| Đầu phiếu | loại mua, kho nhận, bộ phận, người yêu cầu, nhà cung cấp đề nghị, ngày cần hàng, loại tiền, dự án | loại mua, kho nhận, **nhà cung cấp (bắt buộc)**, điều khoản thanh toán, **thuế suất**, **ngày dự kiến nhận hàng** (mặc định cho mọi dòng; từng dòng có ngày riêng ở tab **Lịch giao hàng**), loại tiền, dự án |
| Tiền | tổng giá trị dự kiến | tiền hàng, tiền thuế (theo loại tiền của đơn), tổng cộng quy ra tiền hạch toán |
| Duyệt | `pur_approve_request` | `pur_approve_order` |
| Bảng | `erp_purchase_request`, `..._line` | `erp_purchase_order`, `..._line` |

Cả hai dùng chung khung chứng từ: trạng thái Lập chứng từ → Chờ duyệt → Đã phê duyệt (và Hủy), quyền theo trạng thái theo đơn vị (`ST_*`), ô **Trạng thái** của form chọn mức lưu theo quyền (nút **Lưu Nháp** luôn lưu nháp), số phiếu `{loại}-{ĐVCS}-{yyyymm}-{số}`, in hai mẫu (có giá / không giá), xuất Excel, quyền xem đơn giá `VIEW_PRICE`.

## 3. Danh mục mới

Menu **Mua hàng › 3. Danh mục mua hàng**; cả ba theo khung danh mục chung (tìm, lọc, Excel, nhập Excel, xóa nhiều, chặn xóa khi còn dùng).

| Danh mục | Chức năng | Bảng | API | Tra cứu |
|---|---|---|---|---|
| Dự án | `pur_project_cat` | `erp_project` | `api/purchasing/projects` | `projects` |
| Điều khoản thanh toán | `pur_payment_term_cat` | `erp_payment_term` | `api/purchasing/payment-terms` | `paymentTerms` |
| Nhóm nhà cung cấp | `pur_supplier_group_cat` | `erp_supplier_group` | `api/purchasing/supplier-groups` | `supplierGroups` |

- **Dự án** có mã, tên, phòng ban phụ trách, khách hàng, người quản lý, ngày bắt đầu / kết thúc, **ngân sách** (tiền hạch toán) và trạng thái `PLANNING` (lập kế hoạch), `ACTIVE` (đang thực hiện), `ONHOLD` (tạm dừng), `DONE` (hoàn thành), `CANCELLED` (hủy). Chỉ dự án **đang sử dụng và ở trạng thái PLANNING / ACTIVE** mới gắn được vào chứng từ **mới**; chứng từ cũ vẫn giữ dự án cũ dù dự án đã đóng.
- **Điều khoản thanh toán**: mã, tên, số ngày công nợ (0 = trả ngay). Chọn trên đơn mua hàng; tên được chép vào đơn để in. Script `45-purchasing-catalogs.sql` nạp sẵn sáu điều khoản (thanh toán ngay, khi nhận hàng, công nợ 15 / 30 / 45 / 60 ngày) và ba nhóm nhà cung cấp (vật tư, thiết bị, dịch vụ).
- **Nhóm nhà cung cấp**: gom nhà cung cấp (vật tư, thiết bị, dịch vụ...); chọn ở màn Danh mục nhà cung cấp (cột và bộ lọc **Nhóm**), nhập / xuất Excel có cột mã nhóm.

Cả ba danh mục đều có cột trỏ `*_code` khai `[References]`, nên **không xóa được** bản ghi còn được dùng (thông báo nêu bảng đang dùng; hãy đặt ngừng sử dụng).

## 4. Dự án trên chứng từ

Năm chứng từ có cột `project_code` (tùy chọn): phiếu yêu cầu mua hàng, đơn mua hàng, phiếu nhập kho, phiếu yêu cầu xuất kho, phiếu xuất kho. Trên form là ô **Dự án** (chọn bằng mã + F2). Bộ lọc danh sách của máy chủ có tham số `project` (và `supplier` cho phiếu mua).

Máy chủ kiểm khi lưu: dự án phải có, đang sử dụng và còn nhận chứng từ mới (khi **sửa** một chứng từ giữ nguyên dự án cũ thì không kiểm trạng thái).

## 5. Báo cáo chi phí theo dự án

Menu **Mua hàng › 4. Báo cáo mua hàng › Báo cáo chi phí theo dự án** (`pur_report_project`).

| Cột | Cách tính (tiền hạch toán, trong đơn vị cơ sở đang làm việc) |
|---|---|
| Ngân sách | `erp_project.budget` |
| Đã đặt mua | tổng giá trị các **đơn mua hàng đã phê duyệt** của dự án (cam kết chi, đã gồm thuế) |
| Đã nhập kho | tổng giá trị các **phiếu nhập kho đã ghi sổ** của dự án |
| Chi phí thực tế | tổng giá trị các **phiếu xuất kho đã ghi sổ** cho dự án (vật tư dự án đã dùng, tính theo giá bình quân của kho) |
| Còn lại | Ngân sách − Chi phí thực tế |
| % ngân sách | Chi phí thực tế ÷ Ngân sách (xanh, vàng khi trên 80 %, đỏ khi vượt) |

Lọc theo từ khóa, trạng thái dự án và khoảng ngày chứng từ; bấm một dòng để xem **các chứng từ** của dự án (cả năm loại, mới nhất trước). Các cột tiền cần quyền đặc biệt **Xem giá vốn** (`pur_report_project:VIEW_COST`); thiếu quyền thì chỉ thấy số chứng từ.

API: `GET api/purchasing/project-cost?search=&projectStatus=&from=&to=` và `GET api/purchasing/project-cost/{mã dự án}/vouchers`. SQL nằm ở `Core.Infrastructure/Modules/Purchasing/Reports/Sql/`.

**Lãi lỗ dự án:** hệ thống chưa có doanh thu (Bán hàng và Tài chính chưa làm lại), nên báo cáo hiện chỉ là **chi phí**. Khi có hóa đơn bán, doanh thu cũng gắn `project_code` và báo cáo thêm hai cột Doanh thu và Lãi/Lỗ = Doanh thu − Chi phí; cấu trúc dữ liệu đã sẵn.

## 6. Quyền

| Chức năng | Việc |
|---|---|
| `pur_request`, `pur_order` | Xem, thêm, sửa, xóa, duyệt, in, xuất như mọi chứng từ; quyền đặc biệt `VIEW_PRICE`, `VIEW_ALL`, `ST_*` theo đơn vị |
| `pur_approve_request`, `pur_approve_order` | Màn Phê duyệt (duyệt hoặc từ chối kèm lý do) |
| `pur_project_cat`, `pur_payment_term_cat`, `pur_supplier_group_cat` | Quyền danh mục chuẩn |
| `pur_report_project` | Xem báo cáo; `VIEW_COST` để thấy tiền |
| `inv_receipt` | Nút **Lấy từ đơn mua hàng** chỉ cần quyền xem phiếu nhập (không cần quyền xem đơn mua); giá lấy sang là 0 nếu thiếu `VIEW_PRICE` |

Chọn dự án / điều khoản / nhóm nhà cung cấp ở form khác dùng các **tra cứu** (`/api/lookups/projects`, `paymentTerms`, `supplierGroups`), mở cho mọi người đã đăng nhập, không cần quyền xem danh mục.

## 7. Cài đặt và kiểm tra

1. Chạy `ServerService/sql/postgresql/44-purchasing.sql` rồi `45-purchasing-catalogs.sql` (chạy lại được).
2. Khởi động backend: tự thêm mã chức năng mới vào `sys_command` và các nút menu mới vào `sys_menu`.
3. Cấp quyền cho vai trò ở Cài đặt › Người dùng & phân quyền.
4. Kiểm tra: `dotnet test` (có `TableReferenceTests`, `MessagesTests`, `MenuSeedFileTests`), `npm run lint`, `npm run check-menu`.

Kiểm bằng tay (ngày chứng từ dùng năm 2027 vì các tháng 2026 của DVCS01 đã khóa): tạo dự án → tạo phiếu yêu cầu mua hàng có dự án, duyệt → tạo đơn mua hàng lấy từ phiếu → duyệt → phiếu nhập kho lấy từ đơn, ghi sổ → phiếu xuất kho cho dự án, ghi sổ → xem báo cáo (đã đặt, đã nhập, chi phí) → xóa dự án đang dùng phải bị từ chối.

## 8. Giới hạn hiện tại

- Chưa có doanh thu và lãi / lỗ dự án (xem mục 5).
- Chưa tách riêng đơn mua nhiều đợt giao hay giá theo bảng giá nhà cung cấp.
- Chi phí thực tế lấy từ phiếu xuất kho cho dự án; nhập kho thẳng vào dự án mà chưa xuất chỉ hiện ở cột *Đã nhập kho*.
- Phiếu nhập kho không tự suy dự án từ đơn mua; chọn dự án trên phiếu nhập nếu muốn nó vào báo cáo cột *Đã nhập kho*.
