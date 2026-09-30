using System.Security.Claims;
using Core.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Controllers;

[ApiController]
[Route("api/access-control")]
[Authorize]
public sealed class AccessControlController(IAccessControlService access) : ControllerBase
{
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Unauthorized();
        return Ok(await access.GetUserAccessAsync(userId));
    }

    [HttpGet("commands")]
    public async Task<IActionResult> Commands() => Ok(await access.GetCommandsAsync());

    [HttpPost("seed-api-functions")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SeedApiFunctions()
    {
        await access.SeedApiFunctionsAsync();
        return NoContent();
    }

    [HttpGet("roles")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Roles() => Ok(await access.GetRolesAsync());

    [HttpPut("roles")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SaveRole(SaveRoleRequest request)
    {
        try { return Ok(new { roleId = await access.SaveRoleAsync(request) }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("users/{userId:int}")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> UserAccess(int userId) => Ok(await access.GetUserAccessAsync(userId));

    [HttpPut("users/{userId:int}/roles")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SetRoles(int userId, SetUserRolesRequest request)
    {
        try { await access.SetUserRolesAsync(userId, request.RoleIds); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("users/{userId:int}/permissions")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SetPermissions(int userId, SetUserPermissionsRequest request)
    {
        try { await access.SetUserPermissionsAsync(userId, request.Permissions); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
