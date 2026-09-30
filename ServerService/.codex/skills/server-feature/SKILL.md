---
name: server-feature
description: Thêm hoặc sửa chức năng HTTP, nghiệp vụ hay dữ liệu của ServerService theo luồng Core controller, Core.Application service và Core.Domain/Core.Infrastructure repository.
---

# Thay đổi chức năng server

Áp dụng khi sửa endpoint hoặc nghiệp vụ trong `Core`, `Core.Application`, `Core.Domain`, `Core.Infrastructure`. Đọc các file liên quan đến chức năng trước khi sửa. `Core.API` hiện chỉ có `WeatherForecastController` mẫu; các endpoint nghiệp vụ hiện nằm trong `Core/Controllers`.

## Vị trí trách nhiệm

- `Core/Program.cs`: cấu hình host, xác thực, database, DI và mapping. `Core/Controllers`: route `api/[controller]`, nhận request và gọi service. `Core/Pages` và `Core/wwwroot`: giao diện Razor và static files.
- `Core.Application/Interface` và `Services`: hợp đồng và nghiệp vụ. `CustomModels/Dtos`, `SearchConditions`, `Others`: kiểu dữ liệu request/response. `Mapping/CoreMapper.cs`: ánh xạ DTO và entity bằng Mapperly; khai báo hàm map có kiểu rõ ràng cho cả tạo mới và cập nhật entity. `Wrapper/DIServiceWrapper.cs`: đăng ký service và mapper; `Security` chứa abstraction ngữ cảnh người dùng và tên claim.
- `Core.Domain/Entity`, `Interface`: entity và hợp đồng repository. `Core.Infrastructure/Repositories`: triển khai repository; `BaseRepositoryWrapperImpl` gom các repository. `Core.Infrastructure/Context/CoreContext.cs`: DbSet, chọn PostgreSQL/SQL Server và audit khi `SaveChangesAsync`. `Core.Infrastructure/DependencyInjection.cs`: đăng ký repository, người dùng hiện tại và HTTP client. `Core.Application` không tham chiếu `Core.Infrastructure`.
- `Core.Utils`: tiện ích dùng chung. Chỉ sửa ở đây khi thay đổi thực sự được nhiều project dùng.

## Luồng sửa một chức năng

1. Tìm controller, interface service và implementation hiện có của cùng nghiệp vụ; giữ route, kiểu request/response và quyền truy cập tương thích trừ khi yêu cầu đổi chúng. Kiểm tra `[Authorize]` và các `[AllowAnonymous]` ở từng action.
2. Đặt quy tắc nghiệp vụ trong service, dùng `ServiceResult` hoặc `GenericResponseResult<T>` theo API hiện có. Nếu cần trường dữ liệu mới, đối chiếu DTO, entity và mapping; nếu cần truy cập dữ liệu mới, cập nhật interface repository, implementation, wrapper và `CoreContext` theo phạm vi thực tế.
3. Khi ghi bằng EF Core, kiểm tra điểm gọi `_repo.SaveAync()` (đó là tên phương thức hiện có). `CoreContext` tự điền trường audit cho entity `IAuditable` khi lưu. Xác nhận cách cập nhật DB trước khi thêm schema hoặc migration.
4. Kiểm tra client gọi endpoint nếu thay đổi hợp đồng. Riêng đường nhập ECU, xem skill `ecu-csv-import` trước khi đổi DTO hoặc route.

Các luồng có quy tắc riêng được mô tả ở `export-plan-flow`, `user-auth-flow` và `backup-workflow`; đọc skill tương ứng khi thay đổi chúng.

## Xác minh

- Build project chịu tác động và các project phụ thuộc bằng .NET SDK 10; build `Core/Core.csproj` khi sửa API nghiệp vụ, hoặc `Core.sln` khi sửa thành phần dùng chung. Chỉ dùng `--no-restore` nếu đã có assets NuGet.
- `tests/Worker.Application.Tests` kiểm tra luồng CSV. Với logic dữ liệu khác, thêm kiểm thử có ý nghĩa khi phù hợp; nếu cần chạy endpoint với DB, dùng môi trường thử và không đưa thông tin kết nối hay token vào skill, log hoặc báo cáo.
- `Core.API` và `Core` là hai host khác nhau. Kết quả chạy `Core.API` không xác minh endpoint nghiệp vụ trong `Core`.
