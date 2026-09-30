using Core.Application.Modules.CompanyUnits;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.CompanyUnits;

/// <summary>Settings › "Đơn vị cơ sở" (function inv_company_unit_cat).</summary>
[Route("api/settings/company-units")]
public sealed class CompanyUnitsController(ICompanyUnitService units) : ApiControllerBase
{
    private const string Function = "inv_company_unit_cat";

    /// <summary>All units, for every signed-in user (header unit picker, lookups).</summary>
    [HttpGet]
    public Task<IReadOnlyList<CompanyUnitDto>> GetAll(CancellationToken ct) => units.GetAllAsync(false, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<CompanyUnitDto> Create(SaveCompanyUnitRequest request, CancellationToken ct) =>
        units.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<CompanyUnitDto> Update(string code, SaveCompanyUnitRequest request, CancellationToken ct) =>
        units.UpdateAsync(code, request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await units.DeleteAsync(code, ct);
        return NoContent();
    }
}
