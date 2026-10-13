using Core.Application.Modules.Approvals;
using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Inventory.Documents.IssueRequests;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.IssueRequests;

[Route("api/inventory/issue-requests")]
public sealed class IssueRequestsController(IIssueRequestService requests) : ApiControllerBase
{
    private const string Function = "inv_issue_request";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...&amp;status=Approved&amp;warehouse=KHO01&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<IssueRequestDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        requests.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await requests.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<IssueRequestOptionsDto> Options(CancellationToken ct) => requests.GetOptionsAsync(CurrentUnitCode, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<IssueRequestDto> Get(long id, CancellationToken ct) =>
        requests.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<IssueRequestDto> Create(SaveIssueRequestRequest request, CancellationToken ct) =>
        requests.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<IssueRequestDto> Update(long id, SaveIssueRequestRequest request, CancellationToken ct) =>
        requests.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<IssueRequestDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        requests.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<IssueRequestDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        requests.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await requests.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
