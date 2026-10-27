using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Sales.Documents.SalesOrders;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Sales.Documents.SalesOrders;

[Route("api/sales/sales-orders")]
public sealed class SalesOrdersController(ISalesOrderService orders) : ApiControllerBase
{
    private const string Function = "sales_orders";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;customer=KH001&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<SalesOrderDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        orders.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await orders.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<SalesOrderOptionsDto> Options(CancellationToken ct) => orders.GetOptionsAsync(CurrentUnitCode, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<SalesOrderDto> Get(long id, CancellationToken ct) =>
        orders.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<SalesOrderDto> Create(SaveSalesOrderRequest request, CancellationToken ct) =>
        orders.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<SalesOrderDto> Update(long id, SaveSalesOrderRequest request, CancellationToken ct) =>
        orders.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<SalesOrderDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        orders.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<SalesOrderDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        orders.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await orders.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
