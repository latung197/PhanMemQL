using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Users;

/// <summary>Settings › "Người dùng & Phân quyền" (function sys_users).</summary>
[Route("api/settings/users")]
public sealed class UsersController(IUserService users) : ApiControllerBase
{
    private const string Function = "sys_users";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<UserProfileDto>> GetAll(CancellationToken ct) => users.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<UserProfileDto> Create(CreateUserRequest request, CancellationToken ct) =>
        users.CreateAsync(CurrentUserId, request, ct);

    [HttpPut("{userId:int}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<UserProfileDto> Update(int userId, UpdateUserRequest request, CancellationToken ct) =>
        users.UpdateAsync(CurrentUserId, userId, request, ct);

    /// <summary>Assigns the role and saves the user's permission matrix.</summary>
    [HttpPut("{userId:int}/permissions"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<UserProfileDto> SetPermissions(int userId, SetUserPermissionsRequest request, CancellationToken ct) =>
        users.SetPermissionsAsync(CurrentUserId, userId, request, ct);

    [HttpPut("{userId:int}/password"), RequirePermission(Function, PermissionAction.Edit)]
    public async Task<IActionResult> ResetPassword(int userId, ResetPasswordRequest request, CancellationToken ct)
    {
        await users.ResetPasswordAsync(CurrentUserId, userId, request, ct);
        return NoContent();
    }

    [HttpDelete("{userId:int}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(int userId, CancellationToken ct)
    {
        await users.DeleteAsync(CurrentUserId, userId, ct);
        return NoContent();
    }
}
