using Core.Application.Modules.Roles;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Roles;

/// <summary>Settings › "Danh mục Roles / Vai trò" (part of function sys_users).</summary>
[Route("api/settings/roles")]
public sealed class RolesController(IRoleService roles) : ApiControllerBase
{
    private const string Function = "sys_users";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<RoleDto>> GetAll(CancellationToken ct) => roles.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<RoleDto> Create(SaveRoleRequest request, CancellationToken ct) =>
        roles.CreateAsync(CurrentUserId, request, ct);

    [HttpPut("{roleId:int}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<RoleDto> Update(int roleId, SaveRoleRequest request, CancellationToken ct) =>
        roles.UpdateAsync(CurrentUserId, roleId, request, ct);

    /// <summary>Copies the role matrix to all users holding the role.</summary>
    [HttpPost("{roleId:int}/sync-users"), RequirePermission(Function, PermissionAction.Edit)]
    public async Task<IActionResult> SyncUsers(int roleId, CancellationToken ct) =>
        Ok(new { count = await roles.SyncUsersAsync(CurrentUserId, roleId, ct) });

    [HttpDelete("{roleId:int}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(int roleId, CancellationToken ct)
    {
        await roles.DeleteAsync(CurrentUserId, roleId, ct);
        return NoContent();
    }
}
