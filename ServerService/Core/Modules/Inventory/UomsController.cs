using Core.Application.Modules.Inventory;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục đơn vị tính (function inv_uom_cat).</summary>
[Route("api/inventory/uoms")]
public sealed class UomsController(IUomService uoms) : ApiControllerBase
{
    private const string Function = "inv_uom_cat";

    /// <summary>For every signed-in user: materials, conversions and voucher lines pick units from it.</summary>
    [HttpGet]
    public Task<IReadOnlyList<UomDto>> GetAll(CancellationToken ct) => uoms.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<UomDto> Create(SaveUomRequest request, CancellationToken ct) => uoms.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<UomDto> Update(string code, SaveUomRequest request, CancellationToken ct) => uoms.UpdateAsync(code, request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await uoms.DeleteAsync(code, ct);
        return NoContent();
    }
}
