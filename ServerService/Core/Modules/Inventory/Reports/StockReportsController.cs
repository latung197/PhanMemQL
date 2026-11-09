using Core.Application.Common.Export;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Inventory.Reports;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Reports;

/// <summary>
/// Kho › các báo cáo đọc từ sổ kho: tồn kho (<c>inv_report_stock</c>), nhập xuất tồn (<c>inv_report_nxt</c>), hàng nhập (<c>inv_report_inward</c>),
/// hàng xuất (<c>inv_report_outward</c>) và tuổi hàng tồn (<c>inv_report_aging</c>). Mỗi báo cáo cần quyền Xem của chức năng của nó, file Excel cần thêm
/// quyền Xuất; giá vốn và giá trị chỉ trả về cho người có quyền đặc biệt VIEW_COST của chính chức năng đó.
/// </summary>
[Route("api/inventory/reports")]
public sealed class StockReportsController(IStockReports reports, IPermissionService permissions) : ApiControllerBase
{
    private const string StockFn = "inv_report_stock", NxtFn = "inv_report_nxt", InwardFn = "inv_report_inward", OutwardFn = "inv_report_outward", AgingFn = "inv_report_aging", MonthlyFn = "inv_calc_monthly_cost", InstantFn = "inv_calc_instant_stock";

    private Task<bool> CanSeeCostAsync(string function, CancellationToken ct) => permissions.HasRightAsync(CurrentUserId, function, SpecialRightCatalog.ViewCost, ct);

    private IActionResult Excel(ExportFile file) => File(file.Content, ExportFile.ContentType, file.FileName);

    // ---- tồn kho tại một ngày: ?asOf=&warehouse=&group=&search=&includeZero=
    [HttpGet("stock"), RequirePermission(StockFn, PermissionAction.View)]
    public async Task<IReadOnlyList<StockReportRowDto>> Stock([FromQuery] StockReportQuery query, CancellationToken ct) =>
        await reports.GetStockAsync(CurrentUnitCode, query, await CanSeeCostAsync(StockFn, ct), ct);

    [HttpGet("stock/export"), RequirePermission(StockFn, PermissionAction.View), RequirePermission(StockFn, PermissionAction.Export)]
    public async Task<IActionResult> StockExport([FromQuery] StockReportQuery query, CancellationToken ct) =>
        Excel(await reports.ExportStockAsync(CurrentUserId, CurrentUnitCode, query, await CanSeeCostAsync(StockFn, ct), ct));

    // ---- nhập xuất tồn của một kỳ: ?from=&to=&warehouse=&group=&search=&includeZero=
    [HttpGet("nxt"), RequirePermission(NxtFn, PermissionAction.View)]
    public async Task<IReadOnlyList<NxtRowDto>> Nxt([FromQuery] NxtReportQuery query, CancellationToken ct) =>
        await reports.GetNxtAsync(CurrentUnitCode, query, await CanSeeCostAsync(NxtFn, ct), ct);

    [HttpGet("nxt/export"), RequirePermission(NxtFn, PermissionAction.View), RequirePermission(NxtFn, PermissionAction.Export)]
    public async Task<IActionResult> NxtExport([FromQuery] NxtReportQuery query, CancellationToken ct) =>
        Excel(await reports.ExportNxtAsync(CurrentUserId, CurrentUnitCode, query, await CanSeeCostAsync(NxtFn, ct), ct));

    // ---- bảng kê hàng nhập: ?from=&to=&warehouse=&group=&search=&mode=detail|summary
    [HttpGet("inward"), RequirePermission(InwardFn, PermissionAction.View)]
    public async Task<MovementReportDto> Inward([FromQuery] MovementReportQuery query, CancellationToken ct) =>
        await reports.GetMovementAsync(CurrentUnitCode, true, query, await CanSeeCostAsync(InwardFn, ct), ct);

    [HttpGet("inward/export"), RequirePermission(InwardFn, PermissionAction.View), RequirePermission(InwardFn, PermissionAction.Export)]
    public async Task<IActionResult> InwardExport([FromQuery] MovementReportQuery query, CancellationToken ct) =>
        Excel(await reports.ExportMovementAsync(CurrentUserId, CurrentUnitCode, true, query, await CanSeeCostAsync(InwardFn, ct), ct));

    // ---- bảng kê hàng xuất
    [HttpGet("outward"), RequirePermission(OutwardFn, PermissionAction.View)]
    public async Task<MovementReportDto> Outward([FromQuery] MovementReportQuery query, CancellationToken ct) =>
        await reports.GetMovementAsync(CurrentUnitCode, false, query, await CanSeeCostAsync(OutwardFn, ct), ct);

    [HttpGet("outward/export"), RequirePermission(OutwardFn, PermissionAction.View), RequirePermission(OutwardFn, PermissionAction.Export)]
    public async Task<IActionResult> OutwardExport([FromQuery] MovementReportQuery query, CancellationToken ct) =>
        Excel(await reports.ExportMovementAsync(CurrentUserId, CurrentUnitCode, false, query, await CanSeeCostAsync(OutwardFn, ct), ct));

    // ---- tồn kho tức thời, số đã giữ chỗ và khả dụng: ?warehouse=&group=&search=&includeZero=
    [HttpGet("availability"), RequirePermission(InstantFn, PermissionAction.View)]
    public async Task<IReadOnlyList<AvailabilityRowDto>> Availability([FromQuery] AvailabilityQuery query, CancellationToken ct) =>
        await reports.GetAvailabilityAsync(CurrentUnitCode, query, ct);

    [HttpGet("availability/export"), RequirePermission(InstantFn, PermissionAction.View), RequirePermission(InstantFn, PermissionAction.Export)]
    public async Task<IActionResult> AvailabilityExport([FromQuery] AvailabilityQuery query, CancellationToken ct) =>
        Excel(await reports.ExportAvailabilityAsync(CurrentUserId, CurrentUnitCode, query, ct));

    // ---- giá trung bình tháng: ?year=&month=&warehouse=&group=&search=&includeZero=
    [HttpGet("monthly-cost"), RequirePermission(MonthlyFn, PermissionAction.View)]
    public async Task<IReadOnlyList<MonthlyCostRowDto>> MonthlyCost([FromQuery] MonthlyCostQuery query, CancellationToken ct) =>
        await reports.GetMonthlyCostAsync(CurrentUnitCode, query, await CanSeeCostAsync(MonthlyFn, ct), ct);

    [HttpGet("monthly-cost/export"), RequirePermission(MonthlyFn, PermissionAction.View), RequirePermission(MonthlyFn, PermissionAction.Export)]
    public async Task<IActionResult> MonthlyCostExport([FromQuery] MonthlyCostQuery query, CancellationToken ct) =>
        Excel(await reports.ExportMonthlyCostAsync(CurrentUserId, CurrentUnitCode, query, await CanSeeCostAsync(MonthlyFn, ct), ct));

    // ---- tuổi hàng tồn tại một ngày: ?asOf=&warehouse=&group=&search=
    [HttpGet("aging"), RequirePermission(AgingFn, PermissionAction.View)]
    public async Task<IReadOnlyList<AgingRowDto>> Aging([FromQuery] AgingReportQuery query, CancellationToken ct) =>
        await reports.GetAgingAsync(CurrentUnitCode, query, await CanSeeCostAsync(AgingFn, ct), ct);

    [HttpGet("aging/export"), RequirePermission(AgingFn, PermissionAction.View), RequirePermission(AgingFn, PermissionAction.Export)]
    public async Task<IActionResult> AgingExport([FromQuery] AgingReportQuery query, CancellationToken ct) =>
        Excel(await reports.ExportAgingAsync(CurrentUserId, CurrentUnitCode, query, await CanSeeCostAsync(AgingFn, ct), ct));
}
