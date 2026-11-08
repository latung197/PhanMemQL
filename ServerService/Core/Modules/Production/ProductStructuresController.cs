using Core.Application.Common.Paging;
using Core.Application.Modules.Production;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Production;

/// <summary>Sản xuất › Danh mục cấu trúc sản phẩm (<c>prod_structure_cat</c>): one structure (BOM) per product, key = the material code of the product.</summary>
[Route("api/production/product-structures")]
public sealed class ProductStructuresController(IProductStructureService structures) : ApiControllerBase
{
    private const string Function = "prod_structure_cat";

    /// <summary>One page: ?page=1&amp;pageSize=50&amp;search=...&amp;mode=parent (the products that contain the searched material)&amp;status=active.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<ProductStructureListItemDto>> GetAll([FromQuery] ProductStructureListQuery query, CancellationToken ct) =>
        structures.ListAsync(query, ct);

    [HttpGet("{materialCode}"), RequirePermission(Function, PermissionAction.View)]
    public Task<ProductStructureDto> Get(string materialCode, CancellationToken ct) => structures.GetAsync(materialCode, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<ProductStructureDto> Create(SaveProductStructureRequest request, CancellationToken ct) => structures.CreateAsync(request, ct);

    [HttpPut("{materialCode}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<ProductStructureDto> Update(string materialCode, SaveProductStructureRequest request, CancellationToken ct) =>
        structures.UpdateAsync(materialCode, request, ct);

    [HttpDelete("{materialCode}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string materialCode, CancellationToken ct)
    {
        await structures.DeleteAsync(materialCode, ct);
        return NoContent();
    }
}
