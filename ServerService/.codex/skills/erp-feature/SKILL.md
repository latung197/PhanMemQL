---
name: erp-feature
description: Thêm module backend ERP vào ServerService theo cấu trúc feature, context đơn vị/nhà máy và phân quyền hiện có.
---

# Thêm module ERP

Áp dụng khi thêm hoặc sửa chức năng trong `/api/erp` của host `Core`. Đọc module gần nhất trong `Core.Application/Features/Erp`, `Core.Infrastructure/Features/Erp`, `Core/Features/Erp` trước khi viết. Mỗi chức năng có contract/DTO, service, controller riêng; entity ở `Core.Domain/Entity/Erp` và cấu hình EF ở `CoreContext`. Đăng ký service ở `Core.Infrastructure/DependencyInjection.cs`.

API theo nhà máy dùng policy `ErpContext`. Lấy `erp_unit` và `erp_plant` từ claims sau khi policy xác thực rồi lọc dữ liệu ở truy vấn, không lấy mã nhà máy từ body làm nguồn tin cậy. API quản trị dùng `AccessAdmin`; nếu cần cả context và quyền admin, áp dụng cả hai policy. Quyền chức năng dùng `sys_command` và `IAccessControlService`; khi thêm mã chức năng, cập nhật seed và menu tương ứng.

Thay đổi bảng cần script riêng cho PostgreSQL và SQL Server trong `sql/`; đối chiếu tên bảng/cột với EF, không giả định database tự migrate. Viết test cho quy tắc phạm vi hoặc phép biến đổi có ý nghĩa; build và test `Core.sln` trước khi giao.
