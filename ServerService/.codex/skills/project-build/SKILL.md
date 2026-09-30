---
name: project-build
description: Build, chạy và kiểm tra solution .NET ServerService theo đúng host Core, Core.WorkerService, Core.API hoặc PCMain và các project phụ thuộc.
---

# Build và kiểm tra ServerService

Áp dụng khi thiết lập môi trường, xác minh thay đổi hoặc xử lý lỗi build/chạy trong repo này.

## Chọn project

- `Core.sln` gồm 9 project ứng dụng/thư viện và 2 project test. `Core` là host ASP.NET Core chứa controller nghiệp vụ và Razor Pages mẫu; `Core.API` là host riêng hiện có controller WeatherForecast mẫu.
- `Core.WorkerService` là Generic Host/Windows Service cho hai tác vụ quét CSV; phụ thuộc `Worker.Application`. `PCMain` là ứng dụng WPF Windows, hiện chỉ có cửa sổ chính cơ bản.
- `Core.Application` phụ thuộc `Core.Domain` và `Core.Utils`; `Core.Infrastructure` phụ thuộc `Core.Application`, `Core.Domain` và `Core.Utils`. `Core.Utils` target `net9.0`, các project còn lại target `net10.0` (`PCMain` là `net10.0-windows`). Dùng SDK .NET 10 trên Windows khi build cả solution.

## Quy trình xác minh

1. Chọn project có thay đổi và host tiêu thụ nó. Build project đích bằng `dotnet build <path-to-csproj>`; build `dotnet build Core.sln` khi thay đổi thư viện dùng chung hoặc hợp đồng qua nhiều host. `dotnet restore Core.sln` chỉ cần khi assets/package chưa có; `--no-restore` chỉ dùng sau khi restore thành công.
2. Chạy `dotnet test tests/Worker.Application.Tests/Worker.Application.Tests.csproj` cho thay đổi luồng CSV và `dotnet test tests/Core.Security.Tests/Core.Security.Tests.csproj` cho thay đổi đăng nhập/phân quyền. Nếu cần xác minh runtime, dùng launch profile của đúng host và cấu hình thử; `Core` cần kết nối DB với bảng quyền, worker cần API, tài khoản có quyền `ECU_DATA / import` và thư mục CSV phù hợp. Worker chỉ xóa file khi API báo nhập thành công nhưng vẫn chỉ nên chạy thử trên thư mục riêng.
3. Khi báo kết quả, nêu lệnh đã chạy, project/host được kiểm tra và giới hạn của xác minh. Một build thành công không chứng minh được endpoint hoặc luồng DB hoạt động.

Các giá trị bí mật cục bộ nằm trong `appsettings.Local.json` đã được git bỏ qua; môi trường triển khai nên cấp chúng qua biến môi trường hoặc kho bí mật. Khi đọc lỗi cấu hình, chỉ nêu tên khóa cần thiết; tránh chép giá trị bí mật vào log, skill hay báo cáo.
