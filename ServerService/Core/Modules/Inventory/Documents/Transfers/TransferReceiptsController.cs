using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Inventory.Documents.Transfers;
using Core.Application.Modules.Approvals;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.Transfers;

[Route("api/inventory/transfer-receipts")]
public sealed class TransferReceiptsController(ITransferReceiptService vouchers, ITransferIssueService issues) : ApiControllerBase
{
    private const string Function = "inv_transfer_receipt";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;warehouse=KHO01&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<TransferDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        vouchers.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await vouchers.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<TransferOptionsDto> Options(CancellationToken ct) => vouchers.GetOptionsAsync(CurrentUnitCode, ct);

    /// <summary>Posted transfer issues with something left to receive: what "Lấy từ phiếu xuất điều chuyển" lists (needs the transfer receipt View right).</summary>
    [HttpGet("open-issues"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<OpenTransferDto>> OpenIssues([FromQuery] long? receiptId, CancellationToken ct) =>
        issues.GetOpenAsync(CurrentUserId, CurrentUnitCode, receiptId, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<TransferDto> Get(long id, CancellationToken ct) =>
        vouchers.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<TransferDto> Create(SaveTransferRequest request, CancellationToken ct) =>
        vouchers.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<TransferDto> Update(long id, SaveTransferRequest request, CancellationToken ct) =>
        vouchers.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<TransferDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        vouchers.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<TransferDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        vouchers.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await vouchers.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
