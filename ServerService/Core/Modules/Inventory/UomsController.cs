using Core.Application.Modules.Users;
using Core.Application.Common.Catalogs;
using Core.Application.Modules.Inventory;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục đơn vị tính (function inv_uom_cat).</summary>
[Route("api/inventory/uoms")]
public sealed class UomsController(IUomService uoms, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_uom_cat";

    /// <summary>The full catalog, for users who may view it. Other screens pick units with the lookup
    /// (GET /api/lookups/uoms: code, name, symbol).</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<UomDto>> GetAll(CancellationToken ct) => uoms.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<UomDto> Create(SaveUomRequest request, CancellationToken ct) => uoms.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<UomDto> Update(string code, SaveUomRequest request, CancellationToken ct) => uoms.UpdateAsync(code, request, ct);

    /// <summary>Nhập Excel. Mode "upsert" also updates existing codes and needs the edit right too.</summary>
    [HttpPost("import"), RequirePermission(Function, PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<SaveUomRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert) await permissions.EnsureAllowedAsync(CurrentUserId, Function, PermissionAction.Edit, ct);
        return await uoms.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), RequirePermission(Function, PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) => uoms.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await uoms.DeleteAsync(code, ct);
        return NoContent();
    }
}
