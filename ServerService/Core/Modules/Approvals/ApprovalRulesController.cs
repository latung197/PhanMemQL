using Core.Application.Modules.Approvals;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Approvals;

/// <summary>Settings › Người dùng & Phân quyền › Quy trình phê duyệt (function sys_users).</summary>
[Route("api/settings/approval-rules")]
public sealed class ApprovalRulesController(IApprovalRuleService rules) : ApiControllerBase
{
    private const string Function = "sys_users";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<ApprovalRuleDto>> GetAll([FromQuery] string? function, CancellationToken ct) =>
        rules.GetAllAsync(function, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<ApprovalRuleDto> Create(SaveApprovalRuleRequest request, CancellationToken ct) =>
        rules.CreateAsync(CurrentUserId, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<ApprovalRuleDto> Update(long id, SaveApprovalRuleRequest request, CancellationToken ct) =>
        rules.UpdateAsync(CurrentUserId, id, request, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await rules.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>"If this user creates a document of this amount, who approves it?"</summary>
    [HttpPost("preview"), RequirePermission(Function, PermissionAction.View)]
    public Task<ApprovalPreview> Preview(PreviewApprovalRequest request, CancellationToken ct) =>
        rules.PreviewAsync(request, CurrentUnitCode, ct);
}
