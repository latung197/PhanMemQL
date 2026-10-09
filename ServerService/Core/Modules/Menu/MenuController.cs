using Core.Application.Common.Security;
using Core.Application.Modules.Menu;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Menu;

[Route("api/menu")]
public sealed class MenuController(IMenuService menu, IPermissionService permissions, ISuperAdmin superAdmin) : ApiControllerBase
{
    /// <summary>
    /// Menu structure from sys_command, only the part the user may open (View right; the landing page is always
    /// there). The whole tree is cached and cut per user. Hiding by choice (hide_yn) is applied by the frontend.
    /// </summary>
    [HttpGet]
    public async Task<List<MenuNodeDto>> Get(CancellationToken ct)
    {
        var tree = await menu.GetTreeAsync(ct);
        var rights = await permissions.GetEffectiveAsync(CurrentUserId, ct);
        return MenuFilter.ForUser(tree, code => rights.TryGetValue(code, out var actions) && actions.View);
    }

    /// <summary>Whether the signed-in account may change the structure (screen Settings › Quản lý menu).</summary>
    [HttpGet("access")]
    public async Task<MenuAccessDto> Access(CancellationToken ct) =>
        new(superAdmin.IsSuperAdminName(User.Identity?.Name) && await permissions.IsAdminAsync(CurrentUserId, ct));

    /// <summary>The whole tree, nothing cut by rights, for the structure editor.</summary>
    [HttpGet("manage"), Authorize(Policy = Policies.SuperAdmin)]
    public Task<List<MenuNodeDto>> Manage(CancellationToken ct) => menu.GetTreeAsync(ct);

    [HttpPut("nodes/{id}"), Authorize(Policy = Policies.SuperAdmin)]
    public Task<MenuNodeDto> UpdateNode(string id, SaveMenuNodeRequest request, CancellationToken ct) =>
        menu.UpdateNodeAsync(id, request, ct);

    [HttpPost("groups"), Authorize(Policy = Policies.SuperAdmin)]
    public Task<MenuNodeDto> CreateGroup(CreateMenuGroupRequest request, CancellationToken ct) =>
        menu.CreateGroupAsync(request, ct);

    [HttpPut("order"), Authorize(Policy = Policies.SuperAdmin)]
    public async Task<IActionResult> Reorder(ReorderMenuRequest request, CancellationToken ct)
    {
        await menu.ReorderAsync(request, ct);
        return NoContent();
    }
}
