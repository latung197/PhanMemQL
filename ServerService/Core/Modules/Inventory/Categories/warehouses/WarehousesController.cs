using Core.Application.Common.Catalogs;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

[Route("api/inventory/warehouses")]
public sealed class WarehousesController(IWarehouseService warehouses, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_warehouse_cat";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<WarehouseDto>> GetAll(CancellationToken ct) => warehouses.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<WarehouseDto> Create(SaveWarehouseRequest request, CancellationToken ct) => warehouses.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<WarehouseDto> Update(string code, SaveWarehouseRequest request, CancellationToken ct) => warehouses.UpdateAsync(code, request, ct);

    [HttpPost("import"), RequirePermission(Function, PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<SaveWarehouseRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert) await permissions.EnsureAllowedAsync(CurrentUserId, Function, PermissionAction.Edit, ct);
        return await warehouses.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), RequirePermission(Function, PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) => warehouses.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await warehouses.DeleteAsync(code, ct);
        return NoContent();
    }
}
