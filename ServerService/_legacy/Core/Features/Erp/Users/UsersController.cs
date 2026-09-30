using System.Security.Claims;
using Core.Application.Features.Erp.Users;
using Core.Application.Features.Erp.Organization;
using Core.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Features.Erp.Users;

[ApiController]
[Route("api/erp/users")]
[Authorize]
public sealed class UsersController(IUserManagementService users, IAccessControlService access,
    IOrganizationService organization) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Search([FromQuery] string? search, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        Ok(await users.SearchAsync(search, page, pageSize, ct));

    [HttpGet("{userId:int}")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Get(int userId, CancellationToken ct) =>
        await users.GetAsync(userId, ct) is { } user ? Ok(user) : NotFound();

    [HttpPost]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Create(CreateUserRequest request, CancellationToken ct)
    {
        try
        {
            var user = await users.CreateAsync(request, ct);
            return CreatedAtAction(nameof(Get), new { userId = user.Id }, user);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{userId:int}")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Update(int userId, UpdateUserRequest request, CancellationToken ct)
    {
        try { return await users.UpdateAsync(userId, request, ct) is { } user ? Ok(user) : NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{userId:int}")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Delete(int userId, CancellationToken ct)
    {
        try
        {
            return await users.DeleteAsync(userId, CurrentUserId, ct) ? NoContent() : NotFound();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("me/password")]
    public async Task<IActionResult> ChangeMyPassword(ChangeOwnPasswordRequest request,
        CancellationToken ct)
    {
        try { await users.ChangeOwnPasswordAsync(CurrentUserId, request, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("{userId:int}/access")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> GetAccess(int userId) => Ok(await access.GetUserAccessAsync(userId));

    [HttpPut("{userId:int}/roles")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SetRoles(int userId, SetUserRolesRequest request, CancellationToken ct)
    {
        try { await access.SetUserRolesAsync(userId, request.RoleIds, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{userId:int}/permissions")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SetPermissions(int userId, SetUserPermissionsRequest request, CancellationToken ct)
    {
        try { await access.SetUserPermissionsAsync(userId, request.Permissions, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("{userId:int}/plants")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> GetPlants(int userId, CancellationToken ct) =>
        Ok(await organization.GetUserPlantsAsync(userId, ct));

    [HttpGet("{userId:int}/units")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> GetUnits(int userId, CancellationToken ct) =>
        Ok(await organization.GetUserUnitsAsync(userId, ct));

    [HttpPut("{userId:int}/units")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SetUnits(int userId, SetUserUnitsRequest request, CancellationToken ct)
    {
        try { await organization.SetUserUnitsAsync(userId, request.UnitCodes, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{userId:int}/plants")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SetPlants(int userId, SetUserPlantsRequest request, CancellationToken ct)
    {
        try { await organization.SetUserPlantsAsync(userId, request.PlantCodes, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
