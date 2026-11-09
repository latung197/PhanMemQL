using Core.Application.Common.Paging;
using Core.Application.Common.Security;
using Core.Application.Modules.Auth;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Users;

/// <summary>Settings › Người dùng &amp; phân quyền › Bảo mật đăng nhập (function sys_users): the security policy and the login history.</summary>
[Route("api/settings/security")]
public sealed class SecurityController(ISecurityPolicyService policies, ILoginHistoryService history, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "sys_users";

    [HttpGet("policy"), RequirePermission(Function, PermissionAction.View)]
    public Task<SecurityPolicy> GetPolicy(CancellationToken ct) => policies.GetAsync(ct);

    /// <summary>The policy applies to every unit, so only an administrator changes it.</summary>
    [HttpPut("policy"), RequirePermission(Function, PermissionAction.Edit)]
    public async Task<SecurityPolicy> SavePolicy(SecurityPolicy policy, CancellationToken ct)
    {
        await permissions.EnsureAdminAsync(CurrentUserId, ct);
        return await policies.SaveAsync(CurrentUserId, policy, ct);
    }

    /// <summary>Sign-ins, failures and sign-outs, newest first; a non-administrator sees the accounts sharing a unit with them.</summary>
    [HttpGet("login-history"), RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<LoginHistoryDto>> LoginHistory([FromQuery] LoginHistoryQuery query, CancellationToken ct) =>
        history.QueryAsync(CurrentUserId, query, ct);
}
