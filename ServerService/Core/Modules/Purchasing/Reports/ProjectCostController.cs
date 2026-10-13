using Core.Application.Common.Permissions;
using Core.Application.Modules.Purchasing.Reports;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Purchasing.Reports;

/// <summary>Mua hàng › Báo cáo chi phí theo dự án (<c>pur_report_project</c>); the money values need its VIEW_COST right.</summary>
[Route("api/purchasing/project-cost")]
public sealed class ProjectCostController(IProjectCostReport report, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "pur_report_project";

    /// <summary>Every project with its budget and what the vouchers of the unit add up to: ?project=&amp;projectStatus=&amp;search=&amp;from=&amp;to=.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public async Task<IReadOnlyList<ProjectCostRowDto>> Get([FromQuery] ProjectCostQuery query, CancellationToken ct) =>
        await report.GetAsync(CurrentUnitCode, query, await CanSeeCostAsync(ct), ct);

    /// <summary>The vouchers behind one project (all kinds, newest first).</summary>
    [HttpGet("{code}/vouchers"), RequirePermission(Function, PermissionAction.View)]
    public async Task<IReadOnlyList<ProjectCostVoucherDto>> Vouchers(string code, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct) =>
        await report.GetVouchersAsync(CurrentUnitCode, code, from, to, await CanSeeCostAsync(ct), ct);

    private Task<bool> CanSeeCostAsync(CancellationToken ct) => permissions.HasRightAsync(CurrentUserId, Function, SpecialRightCatalog.ViewCost, ct);
}
