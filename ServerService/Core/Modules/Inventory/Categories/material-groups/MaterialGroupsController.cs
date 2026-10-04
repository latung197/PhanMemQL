using Core.Application.Common.Catalogs;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

[Route("api/inventory/material-groups")]
public sealed class MaterialGroupsController(IMaterialGroupService groups, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_material_group_cat";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<MaterialGroupDto>> GetAll(CancellationToken ct) => groups.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<MaterialGroupDto> Create(SaveMaterialGroupRequest request, CancellationToken ct) => groups.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<MaterialGroupDto> Update(string code, SaveMaterialGroupRequest request, CancellationToken ct) => groups.UpdateAsync(code, request, ct);

    [HttpPost("import"), RequirePermission(Function, PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<SaveMaterialGroupRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert) await permissions.EnsureAllowedAsync(CurrentUserId, Function, PermissionAction.Edit, ct);
        return await groups.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), RequirePermission(Function, PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) => groups.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await groups.DeleteAsync(code, ct);
        return NoContent();
    }
}
