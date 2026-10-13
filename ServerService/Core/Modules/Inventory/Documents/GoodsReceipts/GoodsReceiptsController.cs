using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Inventory.Documents.GoodsReceipts;
using Core.Application.Modules.Approvals;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.GoodsReceipts;

[Route("api/inventory/goods-receipts")]
public sealed class GoodsReceiptsController(IGoodsReceiptService receipts, Core.Application.Modules.Purchasing.Documents.PurchaseOrders.IPurchaseOrderService orders) : ApiControllerBase
{
    private const string Function = "inv_receipt";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;warehouse=KHO01&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<GoodsReceiptDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        receipts.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await receipts.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsReceiptOptionsDto> Options(CancellationToken ct) => receipts.GetOptionsAsync(CurrentUnitCode, ct);

    /// <summary>Approved purchase orders with something left to receive: what "Lấy từ đơn mua hàng" lists (needs the goods receipt View right).</summary>
    [HttpGet("open-orders"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<Core.Application.Modules.Purchasing.Documents.PurchaseOrders.OpenPurchaseOrderDto>> OpenOrders([FromQuery] long? receiptId, CancellationToken ct) =>
        orders.GetOpenAsync(CurrentUserId, CurrentUnitCode, receiptId, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsReceiptDto> Get(long id, CancellationToken ct) =>
        receipts.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<GoodsReceiptDto> Create(SaveGoodsReceiptRequest request, CancellationToken ct) =>
        receipts.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<GoodsReceiptDto> Update(long id, SaveGoodsReceiptRequest request, CancellationToken ct) =>
        receipts.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<GoodsReceiptDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        receipts.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<GoodsReceiptDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        receipts.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await receipts.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
