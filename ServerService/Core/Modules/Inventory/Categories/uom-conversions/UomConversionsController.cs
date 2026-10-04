using Core.Application.Common.Catalogs;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

[Route("api/inventory/uom-conversions")]
public sealed class UomConversionsController(IUomConversionService conversions, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_uom_conversion_cat";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<UomConversionDto>> GetAll(CancellationToken ct) => conversions.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<UomConversionDto> Create(SaveUomConversionRequest request, CancellationToken ct) => conversions.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<UomConversionDto> Update(string code, SaveUomConversionRequest request, CancellationToken ct) =>
        conversions.UpdateAsync(code, request, ct);

    [HttpPost("import"), RequirePermission(Function, PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<SaveUomConversionRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert) await permissions.EnsureAllowedAsync(CurrentUserId, Function, PermissionAction.Edit, ct);
        return await conversions.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), RequirePermission(Function, PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) => conversions.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await conversions.DeleteAsync(code, ct);
        return NoContent();
    }
}
