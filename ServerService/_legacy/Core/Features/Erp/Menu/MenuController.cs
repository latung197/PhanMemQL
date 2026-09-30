using System.Security.Claims;
using Core.Application.Features.Erp.Menu;
using Core.Application.Features.Erp.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Features.Erp.Menu;

[ApiController]
[Route("api/erp/menu")]
[Authorize]
public sealed class MenuController(IMenuService service) : ControllerBase
{
    [HttpGet("mine")]
    [Authorize(Policy = "ErpContext")]
    public Task<IReadOnlyList<MenuNodeDto>> Mine(CancellationToken ct) =>
        service.GetMyMenuAsync(int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
            User.FindFirstValue(ErpClaimTypes.UnitCode)!, ct);

    [HttpGet]
    [Authorize(Policy = "AccessAdmin")]
    public Task<IReadOnlyList<MenuNodeDto>> All(CancellationToken ct) => service.GetAllAsync(ct);

    [HttpPut]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Save(SaveMenuRequest request, CancellationToken ct)
    {
        try { await service.SaveAsync(request, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
