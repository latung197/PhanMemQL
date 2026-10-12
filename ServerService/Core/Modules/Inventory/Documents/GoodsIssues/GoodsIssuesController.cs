using Core.Application.Modules.Inventory.Documents.GoodsIssues;
using Core.Application.Modules.Approvals;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Documents.GoodsIssues;

[Route("api/inventory/goods-issues")]
public sealed class GoodsIssuesController(IGoodsIssueService issues) : ApiControllerBase
{
    private const string Function = "inv_issue";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<GoodsIssueDto>> GetAll(CancellationToken ct) =>
        issues.GetAllAsync(CurrentUserId, CurrentUnitCode, ct);

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<GoodsIssueOptionsDto> Options(CancellationToken ct) => issues.GetOptionsAsync(CurrentUnitCode, ct);

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
