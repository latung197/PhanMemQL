using Core.Application.Modules.Inventory.Documents.GoodsReceipts;
using Core.Application.Modules.Approvals;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.GoodsReceipts;

[Route("api/inventory/goods-receipts")]
public sealed class GoodsReceiptsController(IGoodsReceiptService receipts) : ApiControllerBase
{
    private const string Function = "inv_receipt";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<GoodsReceiptDto>> GetAll(CancellationToken ct) =>
        receipts.GetAllAsync(CurrentUserId, CurrentUnitCode, ct);

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsReceiptOptionsDto> Options(CancellationToken ct) => receipts.GetOptionsAsync(ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsReceiptDto> Get(long id, CancellationToken ct) =>
        receipts.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<GoodsReceiptDto> Create(SaveGoodsReceiptRequest request, CancellationToken ct) =>
        receipts.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<GoodsReceiptDto> Update(long id, SaveGoodsReceiptRequest request, CancellationToken ct) =>
        receipts.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    [HttpPost("{id:long}/{action}")]
    public Task<GoodsReceiptDto> ChangeStatus(long id, string action, CancellationToken ct) =>
        receipts.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, action, ct);

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
