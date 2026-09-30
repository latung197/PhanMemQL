---
name: user-auth-flow
description: Sửa đăng nhập, tài khoản, mật khẩu, JWT, claim hoặc quyền truy cập API trong host Core của ServerService.
---

# Tài khoản và xác thực

Áp dụng khi thay đổi `SysUser`, đăng nhập hoặc quyền truy cập endpoint. Xem thêm `server-feature` nếu thay đổi DTO, entity hay repository.

## Luồng hiện tại

- `Core/Controllers/SysUserController.cs` nhận các thao tác tài khoản và `POST api/SysUser/login`. Login là anonymous và giới hạn 10 request/phút/IP; tìm kiếm/xem tài khoản cần quyền `USER`, các thao tác tạo/sửa/xóa cần `AccessAdmin`, đổi mật khẩu cần token và chỉ đổi cho chính mình.
- `Core.Application/Services/SysService/SysUserServiceImpl.cs` kiểm tra mật khẩu qua `IPasswordService`, phát JWT chứa user ID, username và role cũ. `PasswordService` ở Infrastructure dùng Identity PasswordHasher cho mật khẩu mới và nâng cấp mật khẩu mã hóa cũ sau đăng nhập thành công. Không trả password/hash từ API quản lý.
- `Core/Program.cs` cấu hình JwtBearer, kiểm tra tài khoản còn hoạt động trên mỗi token và đăng ký chính sách `FunctionAccess`/`AccessAdmin`. `Core/Security/FunctionAuthorization.cs` ánh xạ controller/action sang chức năng và thao tác; `Core.Infrastructure/Security/AccessControlService.cs` đọc quyền nhóm và quyền riêng từ DB trên mỗi request. Các khóa JWT nằm dưới `Tokens` trong cấu hình host.
- `Core/Controllers/AccessControlController.cs` quản lý nhóm, quyền nhóm và quyền riêng; `GET /api/access-control/me` trả quyền hiệu lực. Bảng và script ở `sql/postgresql/access-control.sql`, `sql/sqlserver/access-control.sql`. Quyền riêng cộng thêm vào quyền nhóm; nhóm `ADMIN` và `auth_fl=0` cũ có toàn quyền.
- `SysUserCommandServiceImpl` là nhánh service khác, đã đăng ký DI nhưng không phải service mà `SysUserController` đang gọi. Xác định nhánh thực sự được gọi trước khi sửa.

## Khi sửa

1. Lần theo endpoint → `ISysUserService` → `SysUserServiceImpl` → repository. Với quyền chức năng, kiểm tra `FunctionAuthorizationHandler.ResolvePermission`, `IAccessControlService` và các entity `SysRole`, `SysRoleCommand`, `SysUserRole`, `SysUserCommand`.
2. Nếu thêm action/controller, thêm mã chức năng và ánh xạ action; kiểm tra `[Authorize]`/`[AllowAnonymous]`. Nếu đổi claim, đồng bộ nơi phát JWT, nơi đọc claim và cấu hình xác thực. Nếu đổi DTO/entity, kiểm tra cả script schema.
3. Chạy `tests/Core.Security.Tests`; nếu đổi worker import, chạy thêm `tests/Worker.Application.Tests`. Với database thử, kiểm tra tài khoản không có quyền bị 403, tài khoản bị khóa bị 401 và quyền mới có hiệu lực cho token cũ. Không ghi mật khẩu, token hoặc khóa ký vào skill và báo cáo.
