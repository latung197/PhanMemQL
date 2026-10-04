using Core.Application.Common.Catalogs;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

[Route("api/inventory/warehouse-types")]
public sealed class WarehouseTypesController(IWarehouseTypeService types, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_warehouse_type_cat";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<WarehouseTypeDto>> GetAll(CancellationToken ct) => types.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<WarehouseTypeDto> Create(SaveWarehouseTypeRequest request, CancellationToken ct) => types.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<WarehouseTypeDto> Update(string code, SaveWarehouseTypeRequest request, CancellationToken ct) =>
        types.UpdateAsync(code, request, ct);

    [HttpPost("import"), RequirePermission(Function, PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<SaveWarehouseTypeRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert) await permissions.EnsureAllowedAsync(CurrentUserId, Function, PermissionAction.Edit, ct);
        return await types.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), RequirePermission(Function, PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) => types.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await types.DeleteAsync(code, ct);
        return NoContent();
    }
}
