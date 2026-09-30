using System.Security.Claims;
using Core.Application.Features.Erp.Auth;
using Core.Application.Features.Erp.Settings;
using Core.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Features.Erp.Settings;

[ApiController]
[Route("api/erp/settings")]
[Authorize]
public sealed class SettingsController(ISettingService service, IAccessControlService access) : ControllerBase
{
    [HttpGet("effective")]
    [Authorize(Policy = "ErpContext")]
    public async Task<IReadOnlyList<SettingDto>> Effective(CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var isAdmin = await access.IsAdminAsync(userId, ct);
        return await service.GetEffectiveAsync(User.FindFirstValue(ErpClaimTypes.UnitCode)!,
            User.FindFirstValue(ErpClaimTypes.PlantCode), isAdmin, ct);
    }

    [HttpGet]
    [Authorize(Policy = "AccessAdmin")]
    public Task<IReadOnlyList<SettingDto>> All(CancellationToken ct) => service.GetAllAsync(ct);

    [HttpPut]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Save(SaveSettingRequest request, CancellationToken ct)
    {
        try
        {
            await service.SaveAsync(int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), request, ct);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
