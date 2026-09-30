---
name: backup-workflow
description: Sửa API liệt kê file backup, tạo bản sao PostgreSQL hoặc các batch script backup/restore của ServerService.
---

# Luồng backup dữ liệu

Áp dụng khi thay đổi `Core/Controllers/BackupController.cs`, `Core.Application/Services/BackupServiceImpl.cs` hoặc `Core.Application/Scripts`.

## Luồng hiện tại

- `BackupController` có endpoint tìm file backup và `GET api/Backup/database`; controller gắn `[Authorize]`.
- `BackupServiceImpl.SearchFileBackup` liệt kê file trong thư mục lấy từ khóa `BackupFolder`; nếu thư mục chưa có, service tạo thư mục. `Database()` chạy `Scripts/backup.bat` từ thư mục chạy ứng dụng và trả về standard output của process.
- `backup.bat` gọi `pg_dump` rồi copy file backup. `Core.Application.csproj` chỉ đánh dấu `backup.bat` để copy ra output; các file `backup1/2/3.bat`, `restore.bat`, `copyfile*.bat` và `query.sql` là script riêng trong source. Kiểm tra đường dẫn output/publish nếu thay đổi cách gọi script.
- Các script copy file line 3/4 chuyển CSV từ nguồn sang thư mục quét mà `Core.WorkerService` sử dụng. Xem skill `ecu-csv-import` khi sửa luồng này.

## Khi sửa hoặc kiểm tra

1. Đọc đúng script được endpoint hoặc thao tác vận hành gọi; các biến thư mục, DB và công cụ PostgreSQL đang nằm trong batch file. Không sao chép giá trị môi trường hoặc thông tin đăng nhập vào skill, log hay báo cáo.
2. Với backup, kiểm tra mã thoát của process và sự tồn tại của file đầu ra trên môi trường thử; standard output riêng nó không chứng minh backup thành công. Với restore hoặc SQL có `DELETE`, xác định DB đích và dùng dữ liệu thử trước khi thực thi.
3. Khi thay đổi vị trí file hoặc cách đóng gói, kiểm tra cả `BackupFolder`, đường dẫn `Scripts/backup.bat`, `Core.Application.csproj` và quyền truy cập thư mục của Windows Service.
