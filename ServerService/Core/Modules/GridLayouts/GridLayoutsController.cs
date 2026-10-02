using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Layouts;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.GridLayouts;

/// <summary>
/// How a list of a screen is shown (columns shown, order, width, sort, rows per page). Anyone who may view the
/// function keeps their own layout; an administrator also sets the company default.
/// </summary>
[Route("api/grid-layouts/{functionCode}/{gridKey}")]
public sealed class GridLayoutsController(IGridLayoutService layouts, IPermissionService permissions) : ApiControllerBase
{
    [HttpGet]
    public async Task<GridLayoutDto> Get(string functionCode, string gridKey, CancellationToken ct)
    {
        await EnsureViewAsync(functionCode, ct);
        return await layouts.GetAsync(CurrentUserId, functionCode, gridKey, ct);
    }

    [HttpPut("me")]
    public async Task<IActionResult> SaveMine(string functionCode, string gridKey, [FromBody] JsonElement layout, CancellationToken ct)
    {
        await EnsureViewAsync(functionCode, ct);
        await layouts.SaveAsync(CurrentUserId, CurrentUserId, functionCode, gridKey, layout, ct);
        return NoContent();
    }

    /// <summary>Back to the company default.</summary>
    [HttpDelete("me")]
    public async Task<IActionResult> ResetMine(string functionCode, string gridKey, CancellationToken ct)
    {
        await EnsureViewAsync(functionCode, ct);
        await layouts.ResetAsync(CurrentUserId, functionCode, gridKey, ct);
        return NoContent();
    }

    [HttpPut("company")]
    public async Task<IActionResult> SaveCompany(string functionCode, string gridKey, [FromBody] JsonElement layout, CancellationToken ct)
    {
        await EnsureViewAsync(functionCode, ct);
        await permissions.EnsureAdminAsync(CurrentUserId, ct);
        await layouts.SaveAsync(CurrentUserId, null, functionCode, gridKey, layout, ct);
        return NoContent();
    }

    /// <summary>Back to the layout of the code.</summary>
    [HttpDelete("company")]
    public async Task<IActionResult> ResetCompany(string functionCode, string gridKey, CancellationToken ct)
    {
        await EnsureViewAsync(functionCode, ct);
        await permissions.EnsureAdminAsync(CurrentUserId, ct);
        await layouts.ResetAsync(null, functionCode, gridKey, ct);
        return NoContent();
    }

    private async Task EnsureViewAsync(string functionCode, CancellationToken ct)
    {
        if (!FunctionCatalog.IsFunction(functionCode)) throw new NotFoundException("permission.unknownFunction", functionCode);
        await permissions.EnsureAllowedAsync(CurrentUserId, functionCode, PermissionAction.View, ct);
    }
}
