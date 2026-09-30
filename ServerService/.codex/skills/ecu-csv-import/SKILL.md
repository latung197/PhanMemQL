---
name: ecu-csv-import
description: Sửa luồng quét CSV ECU line 3/4, chuyển dữ liệu từ Core.WorkerService qua Worker.Application đến endpoint nhập ECU của Core.
---

# Luồng nhập ECU từ CSV

Áp dụng khi đổi cấu trúc CSV, quy tắc quét file, dữ liệu ECU gửi qua HTTP hoặc cách server lưu dữ liệu ECU.

## Đường đi hiện tại

`Core.WorkerService/Program.cs` đăng ký `WorkerLine3` và `WorkerLine4`; mỗi worker gọi `IWorkerService.ScanFolderLine3/4()` rồi chờ một giờ. `Worker.Application/Services/WorkerServiceImpl.cs` đọc thư mục và tiền tố tên file từ cấu hình worker, lọc file `.csv` có ngày `yyyyMMdd` trong tên, parse bằng `Core.Utils/CsvUtils.cs` và các model `EcuCsvDataLine3/4` có cột `[Index]`.

`Core.Application/Scripts/copyfile_line3.bat` và `copyfile_line4.bat` là các script copy CSV từ nguồn tới thư mục đích trước bước quét. Chúng có cấu hình đường dẫn riêng, không được worker gọi trực tiếp.

Sau khi bỏ dòng thiếu `LaserPrinting`, line 3 lấy `Result` từ CSV (`OK` là valid), còn line 4 gán mặc định valid và `NgCode = 0000`. `WorkerServiceClientImpl` đăng nhập bằng `WorkerUsername`/`WorkerPassword`, rồi POST danh sách `Worker.Application/CustomModels/Dtos/EcuDataDto` kèm JWT tới `api/ecudata/import-list-ecu-data` trên `ApiDomain`. Tài khoản worker cần `ECU_DATA / canImport`; lỗi xác thực hoặc nhập dữ liệu giữ lại CSV. Endpoint nằm ở `Core/Controllers/EcuDataController.cs`, gọi `Core.Application/Services/EcuDataServiceImpl.cs` để kiểm tra trùng và ghi qua repository. `Core.API` không chứa endpoint này.

## Khi sửa luồng

1. Đối chiếu cột CSV thực tế với model line tương ứng và `WorkerServiceImpl`. Nếu đổi payload, cập nhật DTO ở cả `Worker.Application` và `Core.Application`, route/client khi cần, mapping Mapperly trong `Core.Application/Mapping/CoreMapper.cs`, cùng entity/repository nếu dữ liệu lưu thay đổi.
2. Xem logic trùng trong `EcuDataServiceImpl` trên cả `EcuData` và `EcuExported`; kiểm tra ảnh hưởng của khóa so sánh trước khi đổi cách nhập hoặc kết quả line 3/4.
   `Core.Application/Services/HandyServiceImpl.cs` còn dùng `HUCode`, `LaserPrinting`, `Result` và `PackState` để kiểm tra sản phẩm; rà luồng Handy nếu đổi các trường này.
3. `WorkerServiceImpl` chỉ xóa file khi API trả `Code = Success`; file được giữ lại nếu parse, xác thực, HTTP hoặc nghiệp vụ nhập lỗi. Khi đổi quy tắc này, chạy `tests/Worker.Application.Tests` cho cả line 3 và line 4. Chỉ thử worker với thư mục CSV dùng một lần.
4. Nếu thêm service/client mới, đăng ký ở `Worker.Application/Wrapper/DIServiceWrapper.cs`; nếu thêm hosted worker, đăng ký ở `Core.WorkerService/Program.cs`. Kiểm tra các khóa cấu hình `ApiDomain`, `FolderScanLine3/4`, `FileNameLine3/4`, `WorkerUsername`, `WorkerPassword` mà không ghi giá trị môi trường vào tài liệu.

## Xác minh

Build `Core.WorkerService/Core.WorkerService.csproj` và `Core/Core.csproj` khi sửa hợp đồng xuyên hai host. Với thay đổi parse hoặc lọc, kiểm tra bằng CSV mẫu ở thư mục tạm; với thay đổi HTTP/database, kiểm tra response và bản ghi ở môi trường thử trước khi để worker xử lý file thật.
