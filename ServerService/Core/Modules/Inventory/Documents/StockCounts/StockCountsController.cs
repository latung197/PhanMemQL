using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Inventory.Documents.StockCounts;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.StockCounts;

/// <summary>Kho › Phiếu kiểm kê (<c>inv_audit_count</c>): book stock against counted stock; posting writes the differences to the stock ledger.</summary>
[Route("api/inventory/stock-counts")]
public sealed class StockCountsController(IStockCountService counts) : ApiControllerBase
{
    private const string Function = "inv_audit_count";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;warehouse=KHO01&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<StockCountDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        counts.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await counts.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<StockCountOptionsDto> Options(CancellationToken ct) => counts.GetOptionsAsync(CurrentUnitCode, ct);

    /// <summary>The book stock of a warehouse at a date (?warehouseCode=&amp;date=&amp;group=&amp;search=&amp;includeZero=&amp;cycleOnly=): what "Lấy tồn sổ sách" fills the count with.</summary>
    [HttpGet("book-stock"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<StockCountBookLineDto>> BookStock([FromQuery] StockCountBookQuery query, CancellationToken ct) =>
        counts.GetBookStockAsync(CurrentUserId, CurrentUnitCode, query, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<StockCountDto> Get(long id, CancellationToken ct) => counts.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<StockCountDto> Create(SaveStockCountRequest request, CancellationToken ct) =>
        counts.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<StockCountDto> Update(long id, SaveStockCountRequest request, CancellationToken ct) =>
        counts.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<StockCountDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        counts.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<StockCountDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        counts.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await counts.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
