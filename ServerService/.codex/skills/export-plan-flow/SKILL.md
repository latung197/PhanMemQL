---
name: export-plan-flow
description: Sửa nghiệp vụ kế hoạch xuất hàng, quét thùng, lịch sử xuất và trạng thái đơn/thùng trong Core của ServerService.
---

# Luồng kế hoạch xuất hàng

Áp dụng cho các thay đổi về `ExportListPlan`, `ExportHistoryList`, `BoxInfo`, dữ liệu master liên quan hoặc kết quả quét thùng. Dùng cùng skill `server-feature` khi thay đổi endpoint, DTO hay repository.

## Điểm vào và dữ liệu

- `Core/Controllers/ExportPlanController.cs` chứa API tìm kiếm kế hoạch, chuẩn bị hàng, lịch sử xuất, nhập kế hoạch, quét thùng và cập nhật trạng thái. Luồng Handy riêng đi qua `HandyController` và `Core.Application/Services/HandyServiceImpl.cs`; dữ liệu master qua `MstDataController` và `MstDataServiceImpl.cs`.
- `Core.Application/Interface/IExportPlanService.cs` và các file partial `Services/ExportPlanServiceImpl.*.cs` chứa nghiệp vụ chính, chia theo tìm kiếm, thêm, cập nhật, xóa. DTO, điều kiện tìm kiếm và model quét nằm trong `Core.Application/CustomModels`; entity/repository nằm trong `Core.Domain` và `Core.Infrastructure`.
- Các truy vấn kế hoạch ghép `ExportListPlan` với `MstData`; lịch sử liên hệ `ExportHistoryList`, `BoxInfo` và dữ liệu ECU. Kiểm tra cả nhánh ASSY và xuất rời khi thay đổi khóa ghép, mã sản phẩm hoặc quy cách đóng gói.

## Điều cần giữ đúng khi sửa

1. Đọc phương thức service cụ thể cùng endpoint gọi nó. `ExportPlanServiceImpl` có các biến thể tìm kiếm và quét thùng (`Insert...`, `Add...`, `...V2`); đừng suy ra hành vi của một biến thể từ tên của biến thể khác.
2. Dùng các enum trong `Core.Application/Enum` thay vì số trạng thái rải rác. `EnumOrderState` phân biệt chưa xuất, đang xuất, đã đủ, đã xuất, hủy; `EnumBoxState` phân biệt đang chuẩn bị, đã đủ, đã xuất, hủy. Khi sửa quét thùng, kiểm tra đơn hàng, thùng đã thuộc đơn khác, loại ASSY/xuất rời, mã sản phẩm và tổng số lượng so với `IndicatorQuantity` theo luồng hiện có.
3. Kiểm tra việc cập nhật đồng bộ `ExportListPlan`, `ExportHistoryList` và `BoxInfo` trước khi đổi trạng thái hoặc xóa. `SearchExportHistoryPlanById` là truy vấn đọc; việc chuyển ECU từ `EcuData` sang `EcuExported` thuộc các thao tác ghi trong `ExportPlanServiceImpl.Insert.cs`.
4. Nếu đổi response hoặc quy tắc import/quét, đối chiếu các DTO và client gọi API. Kiểm tra `[AllowAnonymous]` trên từng action liên quan; một số action mở cho thiết bị ngoài dù controller có `[Authorize]`.

## Xác minh

Build `Core/Core.csproj`, sau đó kiểm tra trường hợp đơn chưa xuất, thùng đã thuộc đơn, sai mã sản phẩm, sai số lượng và trạng thái sau quét trên dữ liệu thử phù hợp với phần vừa sửa. Chỉ xác minh luồng có ghi dữ liệu trên DB thử.
