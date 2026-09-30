using System.Security.Claims;
using Core.Application.Features.Erp.Auth;
using Core.Application.Features.Erp.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Features.Erp.Settings;

[ApiController]
[Route("api/erp/system-config")]
[Authorize]
public sealed class FrontendSystemConfigController(IFrontendSystemConfigService service) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "ErpContext")]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        Ok(await service.GetEffectiveAsync(User.FindFirstValue(ErpClaimTypes.UnitCode)!, ct));

    [HttpPut("{section}")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Save(string section, SaveFrontendConfigRequest request,
        CancellationToken ct)
    {
        try
        {
            await service.SaveAsync(int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
                section, request, ct);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
