# Tài liệu S-ERP

Tài liệu chia thư mục theo **chức năng**. Mỗi tài liệu có bản Markdown (nguồn, sửa ở đây) và, nếu cần phát cho người dùng, bản Word `.docx` cùng thư mục (sinh lại bằng script ở `cong-cu/`).

```
docs/
  kho/          Nghiệp vụ Kho: cấu trúc module, danh mục kho, phiếu nhập kho và sổ kho, phiếu xuất kho, quy đổi đơn vị tính
  mua-hang/     Nghiệp vụ Mua hàng: luồng yêu cầu → đơn → nhập kho, danh mục dự án, báo cáo chi phí theo dự án
  he-thong/     Cài đặt hệ thống: phân quyền, quản lý menu, thông báo đăng nhập và thanh thông báo
  phat-trien/   Khung kỹ thuật cho người viết code: kiến trúc dự án, thêm danh mục, thêm chứng từ, tham chiếu danh mục, chống ghi đè
  cong-cu/      Script sinh file Word từ Markdown
```

## Kho (`kho/`)

| Tài liệu | Nội dung | Word |
|---|---|---|
| [cau-truc-module-kho.md](kho/cau-truc-module-kho.md) | Cấu trúc thư mục mã nguồn module Kho (phân hệ → nhóm → chức năng) và cách thêm chức năng | `Cau-truc-module-kho.docx` |
| [huong-dan-danh-muc-kho.md](kho/huong-dan-danh-muc-kho.md) | Hướng dẫn dùng màn Danh mục kho (thêm, sửa, lọc, Excel) và quy trình thêm một danh mục theo mẫu kho | `Huong-dan-danh-muc-kho.docx` |
| [so-kho-va-phieu-nhap-kho.md](kho/so-kho-va-phieu-nhap-kho.md) | Phiếu nhập kho và phiếu xuất kho từng bước, các bảng của hai phiếu, xóa phiếu và trigger dọn sổ, **sổ kho và ba bảng tồn**, danh mục và bảng hệ thống dùng chung, vận hành | `So-kho-va-phieu-nhap-kho.docx` |
| [trang-thai-chung-tu.md](he-thong/trang-thai-chung-tu.md) | Danh mục trạng thái chứng từ theo đơn vị cơ sở (đổi tên, tắt bước Chờ duyệt) và quyền theo trạng thái theo đơn vị: cấp đến trạng thái nào thì lưu phiếu được đến đó, mã quyền có đơn vị, màn phân quyền, chuyển dữ liệu từ quyền cũ, chính sách, API, giới hạn | `Trang-thai-chung-tu.docx` |
| [phieu-xuat-kho.md](kho/phieu-xuat-kho.md) | Phiếu xuất kho đầy đủ: màn hình, trạng thái và duyệt, ghi sổ trừ tồn theo giá bình quân (ví dụ chạy số), từng cột hai bảng, xóa phiếu và trigger, quyền, API kèm mẫu JSON, lỗi, cách cài đặt và kiểm tra, giới hạn, danh sách tệp | `Phieu-xuat-kho.docx` |
| [phieu-yeu-cau-xuat-kho.md](kho/phieu-yeu-cau-xuat-kho.md) | Phiếu yêu cầu xuất kho (YCX, không ghi sổ) và chức năng "Lấy từ phiếu yêu cầu" của phiếu xuất kho: luồng, số đã xuất, quy tắc kiểm, bảng, quyền, API, giới hạn | `Phieu-yeu-cau-xuat-kho.docx` |
| [them-quy-doi-don-vi-tinh.md](kho/them-quy-doi-don-vi-tinh.md) | Ghi lại các bước đưa Quy đổi đơn vị tính từ dữ liệu mẫu lên backend (ví dụ làm theo) | `Them-quy-doi-don-vi-tinh.docx` |

## Mua hàng (`mua-hang/`)

| Tài liệu | Nội dung | Word |
|---|---|---|
| [mua-hang-va-du-an.md](mua-hang/mua-hang-va-du-an.md) | Luồng phiếu yêu cầu mua hàng → đơn mua hàng → phiếu nhập kho (lấy từ chứng từ trước), ba danh mục mới (dự án, điều khoản thanh toán, nhóm nhà cung cấp), gắn dự án vào chứng từ, báo cáo chi phí theo dự án, quyền, cài đặt, giới hạn | `Mua-hang-va-du-an.docx` |
| [phieu-mua-hang-tu-database-den-giao-dien.md](mua-hang/phieu-mua-hang-tu-database-den-giao-dien.md) | Phiếu yêu cầu mua hàng và đơn mua hàng từ đầu đến cuối: bảng và cột, backend từng hàm, kiểm dữ liệu, trạng thái và quyền, API kèm mẫu JSON, frontend từng khối, các bước làm một chứng từ mua hàng mới (database, backend, frontend, kiểm tra), lỗi hay gặp | `Phieu-mua-hang-tu-database-den-giao-dien.docx` |
| [danh-muc-mua-hang.md](mua-hang/danh-muc-mua-hang.md) | Ba danh mục mua hàng: Dự án, Điều khoản thanh toán, Nhóm nhà cung cấp (và cột Nhóm của danh mục nhà cung cấp): các trường, quy tắc, cơ sở dữ liệu, backend, API, giao diện, nhập / xuất Excel, quyền, kiểm tra, các bước thêm một danh mục mua hàng mới, lỗi hay gặp, giới hạn | `Danh-muc-mua-hang.docx` |

## Hệ thống (`he-thong/`)

| Tài liệu | Nội dung | Word |
|---|---|---|
| [phan-quyen.md](he-thong/phan-quyen.md) | Mô hình quyền: vai trò, ngoại lệ, quyền đặc biệt, trạng thái chứng từ, các bảng liên quan | `Phan-quyen-S-ERP.docx` (và bản cũ `Phan-quyen-S-ERP (cu).docx`) |
| [quan-ly-menu.md](he-thong/quan-ly-menu.md) | Menu lưu ở đâu, thêm chức năng vào menu, ai thấy gì, sửa cấu trúc menu (super admin) | `Quan-ly-menu-S-ERP.docx` |
| [thong-bao-dang-nhap-va-thanh-thong-bao.md](he-thong/thong-bao-dang-nhap-va-thanh-thong-bao.md) | Thông báo và ảnh nền ở trang đăng nhập, khẩu hiệu và chân trang lấy từ hồ sơ doanh nghiệp, thanh thông báo hệ thống dưới header (cách dùng, bảng, API, luồng ảnh, kiểm tra) | `Thong-bao-dang-nhap-va-thanh-thong-bao.docx` |

## Phát triển (`phat-trien/`)

| Tài liệu | Nội dung | Word |
|---|---|---|
| [them-danh-muc.md](phat-trien/them-danh-muc.md) | Quy trình và mã mẫu đầy đủ để thêm một danh mục (SQL, backend, frontend, kiểm tra). Đi cùng skill `/them-danh-muc` | `Them-danh-muc-S-ERP.docx` |
| [tham-chieu-danh-muc.md](phat-trien/tham-chieu-danh-muc.md) | `[References]`, chặn xóa bản ghi đang dùng, bảng `sys_table_ref` | `Tham-chieu-danh-muc-S-ERP.docx` |
| [mo-ta-co-so-du-lieu.md](phat-trien/mo-ta-co-so-du-lieu.md) | **Từ điển dữ liệu** toàn bộ cơ sở dữ liệu: quy ước, danh sách 63 bảng, bản đồ tham chiếu, từng bảng (cột, kiểu, null, mặc định, khóa, mô tả, chỉ mục, ràng buộc, trigger), view, hàm, các script SQL. **Sinh tự động từ database thật** | `Mo-ta-co-so-du-lieu.docx` |
| [kien-truc-du-an.md](phat-trien/kien-truc-du-an.md) | Kiến trúc và thiết kế dự án cho người mới: các lớp, quy ước cơ sở dữ liệu, khung danh mục, chứng từ và sổ kho, phân quyền, frontend, đa ngôn ngữ, phần nào đã chạy thật | `Kien-truc-du-an.docx` |
| [them-chung-tu.md](phat-trien/them-chung-tu.md) | Thêm một chứng từ mới từng bước (SQL, thực thể, dịch vụ, duyệt, ghi sổ, lưu thẳng trạng thái, frontend, in, kiểm tra, lỗi hay gặp, danh sách việc) | `Them-chung-tu.docx` |
| [chong-ghi-de.md](phat-trien/chong-ghi-de.md) | Chống ghi đè khi nhiều người cùng sửa (`Version`, `xmin`, lỗi 409) | `Chong-ghi-de.docx` |

## Công cụ (`cong-cu/`)

- `build-word.cjs`: chuyển một file Markdown bất kỳ sang Word (tiêu đề, bảng, danh sách, khung mã, trích dẫn).
  ```bash
  node docs/cong-cu/build-word.cjs <nguon.md> <dich.docx> "<chữ chân trang>" "<tiêu đề tài liệu>"
  ```
- `gen-database-doc.cjs` (kèm `database-notes.cjs`, `database-scripts.cjs`): sinh `phat-trien/mo-ta-co-so-du-lieu.md` từ database `erp_dev` thật. Chạy lại mỗi khi đổi cấu trúc: `node docs/cong-cu/gen-database-doc.cjs`, rồi `build-word.cjs` để ra bản Word.
- `build-warehouse-word.cjs`: sinh lại `kho/Huong-dan-danh-muc-kho.docx` từ nguồn Markdown của nó.

## Quy ước khi thêm tài liệu

- Đặt vào thư mục theo **chức năng** đang nói tới (không đặt thẳng ở `docs/`); chưa có thư mục phù hợp thì tạo mới và thêm vào mục lục này.
- Tên file `chữ-thường-có-gạch-nối.md`, tiếng Việt không dấu; bản Word đặt cùng thư mục, tên viết hoa chữ đầu.
- Đường dẫn trong code và tài liệu viết đầy đủ từ gốc dự án (`docs/kho/so-kho-va-phieu-nhap-kho.md`); liên kết giữa hai tài liệu dùng đường dẫn tương đối.
- Sửa Markdown rồi mới sinh lại Word; không sửa trực tiếp file Word.
- Hướng dẫn tổng quan (cài đặt, quy ước, quy trình thêm chức năng) nằm ở `README.md` gốc và `ServerService/README.md`; `CLAUDE.md` là hướng dẫn cho trợ lý lập trình.
