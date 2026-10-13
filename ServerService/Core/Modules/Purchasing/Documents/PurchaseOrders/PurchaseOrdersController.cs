using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Purchasing.Documents.PurchaseOrders;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Purchasing.Documents.PurchaseOrders;

[Route("api/purchasing/purchase-orders")]
public sealed class PurchaseOrdersController(IPurchaseOrderService orders, Core.Application.Modules.Purchasing.Documents.PurchaseRequests.IPurchaseRequestService requests) : ApiControllerBase
{
    private const string Function = "pur_order";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;supplier=NCC001&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<PurchaseOrderDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        orders.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await orders.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<PurchaseOrderOptionsDto> Options(CancellationToken ct) => orders.GetOptionsAsync(CurrentUnitCode, ct);

    /// <summary>Approved purchase requests with something left to order: what "Lấy từ phiếu yêu cầu mua hàng" lists (needs the purchase order View right).</summary>
    [HttpGet("open-requests"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<Core.Application.Modules.Purchasing.Documents.PurchaseRequests.OpenPurchaseRequestDto>> OpenRequests([FromQuery] long? orderId, CancellationToken ct) =>
        requests.GetOpenAsync(CurrentUserId, CurrentUnitCode, orderId, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<PurchaseOrderDto> Get(long id, CancellationToken ct) =>
        orders.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<PurchaseOrderDto> Create(SavePurchaseOrderRequest request, CancellationToken ct) =>
        orders.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<PurchaseOrderDto> Update(long id, SavePurchaseOrderRequest request, CancellationToken ct) =>
        orders.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<PurchaseOrderDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        orders.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<PurchaseOrderDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        orders.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await orders.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
