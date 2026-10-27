using Core.Application.Common.Permissions;
using Core.Application.Modules.Purchasing.Reports;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Purchasing.Reports;

/// <summary>Mua hàng › Báo cáo công nợ phải trả (<c>pur_report_payable</c>); the money values need its VIEW_COST right.</summary>
[Route("api/purchasing/payables")]
public sealed class PayablesController(IPayableReport report, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "pur_report_payable";

    /// <summary>Every supplier with an approved invoice of the unit: ?supplier=&amp;search=&amp;asOf=&amp;from=.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public async Task<IReadOnlyList<PayableRowDto>> Get([FromQuery] PayableQuery query, CancellationToken ct) =>
        await report.GetAsync(CurrentUnitCode, query, await CanSeeCostAsync(ct), ct);

    /// <summary>The invoices behind one supplier (oldest due date first).</summary>
    [HttpGet("{code}/invoices"), RequirePermission(Function, PermissionAction.View)]
    public async Task<IReadOnlyList<PayableInvoiceDto>> Invoices(string code, [FromQuery] DateOnly? asOf, [FromQuery] DateOnly? from, CancellationToken ct) =>
        await report.GetInvoicesAsync(CurrentUnitCode, code, asOf, from, await CanSeeCostAsync(ct), ct);

    private Task<bool> CanSeeCostAsync(CancellationToken ct) => permissions.HasRightAsync(CurrentUserId, Function, SpecialRightCatalog.ViewCost, ct);
}
