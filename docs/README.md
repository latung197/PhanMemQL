# Tài liệu S-ERP

Tài liệu chia thư mục theo **chức năng**. Mỗi tài liệu có bản Markdown (nguồn, sửa ở đây) và, nếu cần phát cho người dùng, bản Word `.docx` cùng thư mục (sinh lại bằng script ở `cong-cu/`).

```
docs/
  kho/          Nghiệp vụ Kho: cấu trúc module, danh mục kho, phiếu nhập kho và sổ kho, quy đổi đơn vị tính
  he-thong/     Cài đặt hệ thống: phân quyền, quản lý menu, thông báo đăng nhập và thanh thông báo
  phat-trien/   Khung kỹ thuật cho người viết code: thêm danh mục, tham chiếu danh mục, chống ghi đè
  cong-cu/      Script sinh file Word từ Markdown
```

## Kho (`kho/`)

| Tài liệu | Nội dung | Word |
|---|---|---|
| [cau-truc-module-kho.md](kho/cau-truc-module-kho.md) | Cấu trúc thư mục mã nguồn module Kho (phân hệ → nhóm → chức năng) và cách thêm chức năng | `Cau-truc-module-kho.docx` |
| [huong-dan-danh-muc-kho.md](kho/huong-dan-danh-muc-kho.md) | Hướng dẫn dùng màn Danh mục kho (thêm, sửa, lọc, Excel) và quy trình thêm một danh mục theo mẫu kho | `Huong-dan-danh-muc-kho.docx` |
| [so-kho-va-phieu-nhap-kho.md](kho/so-kho-va-phieu-nhap-kho.md) | Phiếu nhập kho từng bước, các bảng của phiếu, **sổ kho và ba bảng tồn**, danh mục và bảng hệ thống dùng chung, vận hành | `So-kho-va-phieu-nhap-kho.docx` |
| [them-quy-doi-don-vi-tinh.md](kho/them-quy-doi-don-vi-tinh.md) | Ghi lại các bước đưa Quy đổi đơn vị tính từ dữ liệu mẫu lên backend (ví dụ làm theo) | `Them-quy-doi-don-vi-tinh.docx` |

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
| [chong-ghi-de.md](phat-trien/chong-ghi-de.md) | Chống ghi đè khi nhiều người cùng sửa (`Version`, `xmin`, lỗi 409) | `Chong-ghi-de.docx` |

## Công cụ (`cong-cu/`)

- `build-word.cjs`: chuyển một file Markdown bất kỳ sang Word (tiêu đề, bảng, danh sách, khung mã, trích dẫn).
  ```bash
  node docs/cong-cu/build-word.cjs <nguon.md> <dich.docx> "<chữ chân trang>" "<tiêu đề tài liệu>"
  ```
- `build-warehouse-word.cjs`: sinh lại `kho/Huong-dan-danh-muc-kho.docx` từ nguồn Markdown của nó.

## Quy ước khi thêm tài liệu

- Đặt vào thư mục theo **chức năng** đang nói tới (không đặt thẳng ở `docs/`); chưa có thư mục phù hợp thì tạo mới và thêm vào mục lục này.
- Tên file `chữ-thường-có-gạch-nối.md`, tiếng Việt không dấu; bản Word đặt cùng thư mục, tên viết hoa chữ đầu.
- Đường dẫn trong code và tài liệu viết đầy đủ từ gốc dự án (`docs/kho/so-kho-va-phieu-nhap-kho.md`); liên kết giữa hai tài liệu dùng đường dẫn tương đối.
- Sửa Markdown rồi mới sinh lại Word; không sửa trực tiếp file Word.
- Hướng dẫn tổng quan (cài đặt, quy ước, quy trình thêm chức năng) nằm ở `README.md` gốc và `ServerService/README.md`; `CLAUDE.md` là hướng dẫn cho trợ lý lập trình.
