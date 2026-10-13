using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Inventory.Documents.GoodsIssues;
using Core.Application.Modules.Inventory.Documents.IssueRequests;
using Core.Application.Modules.Approvals;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.GoodsIssues;

[Route("api/inventory/goods-issues")]
public sealed class GoodsIssuesController(IGoodsIssueService issues, IIssueRequestService requests) : ApiControllerBase
{
    private const string Function = "inv_issue";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;warehouse=KHO01&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<GoodsIssueDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        issues.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await issues.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsIssueOptionsDto> Options(CancellationToken ct) => issues.GetOptionsAsync(CurrentUnitCode, ct);

    /// <summary>Approved issue requests with something left to issue: what "Lấy từ phiếu yêu cầu" lists (needs the goods issue View right).</summary>
    [HttpGet("open-requests"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<OpenIssueRequestDto>> OpenRequests([FromQuery] long? issueId, CancellationToken ct) =>
        requests.GetOpenAsync(CurrentUserId, CurrentUnitCode, issueId, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsIssueDto> Get(long id, CancellationToken ct) =>
        issues.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<GoodsIssueDto> Create(SaveGoodsIssueRequest request, CancellationToken ct) =>
        issues.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<GoodsIssueDto> Update(long id, SaveGoodsIssueRequest request, CancellationToken ct) =>
        issues.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<GoodsIssueDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        issues.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<GoodsIssueDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        issues.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await issues.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
