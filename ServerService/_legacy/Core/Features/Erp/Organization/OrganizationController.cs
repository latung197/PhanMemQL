using Core.Application.Features.Erp.Organization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Features.Erp.Organization;

[ApiController]
[Route("api/erp/organization")]
[Authorize]
public sealed class OrganizationController(IOrganizationService service) : ControllerBase
{
    [HttpGet("units")]
    [Authorize(Policy = "AccessAdmin")]
    public Task<IReadOnlyList<UnitDto>> Units(CancellationToken ct) => service.GetUnitsAsync(ct);

    [HttpGet("plants")]
    [Authorize(Policy = "AccessAdmin")]
    public Task<IReadOnlyList<PlantDto>> Plants(CancellationToken ct) => service.GetPlantsAsync(ct);

    [HttpPut("units")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SaveUnit(SaveUnitRequest request, CancellationToken ct)
    {
        try { await service.SaveUnitAsync(request, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("plants")]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> SavePlant(SavePlantRequest request, CancellationToken ct)
    {
        try { await service.SavePlantAsync(request, ct); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

}
