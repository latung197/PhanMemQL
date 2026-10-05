using System.Reflection;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Common.Controllers;

/// <summary>
/// The endpoints of every catalog (danh mục), written once. A catalog's controller only inherits it and declares its route
/// and function: <c>[Route("api/inventory/uoms")] [CatalogFunction("inv_uom_cat")]</c>. The rights come from
/// <see cref="CatalogFunctionAttribute"/> and each endpoint's <see cref="CatalogRightAttribute"/>, checked by
/// <see cref="CatalogPermissionFilter"/>:
/// GET (page) = View; GET export = View + Export; POST = Create; PUT = Edit; DELETE and delete-many = Delete;
/// import = Create (+ Edit for mode "upsert"). Other screens pick codes with the lookup, not with these endpoints.
/// </summary>
[ServiceFilter(typeof(CatalogPermissionFilter))]
public abstract class CatalogControllerBase<TDto, TRequest>(ICatalogService<TDto, TRequest> catalog, IPermissionService permissions)
    : ApiControllerBase where TRequest : class, ICatalogRequest
{
    /// <summary>The query with the catalog's own filters: the query parameters beyond paging, search and status.</summary>
    private CatalogListQuery WithFilters(CatalogListQuery query) =>
        query.WithFilters(Request.Query.Select(x => KeyValuePair.Create(x.Key, x.Value.ToString())));

    /// <summary>One page of the catalog (sorted, filtered and cut by the server).</summary>
    [HttpGet, CatalogRight(PermissionAction.View)]
    public Task<PagedResult<TDto>> List([FromQuery] CatalogListQuery query, CancellationToken ct) =>
        catalog.ListAsync(WithFilters(query), ct);

    /// <summary>Excel file of every row matching the list filters (not just one page).</summary>
    [HttpGet("export"), CatalogRight(PermissionAction.View), CatalogRight(PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] CatalogListQuery query, CancellationToken ct)
    {
        var file = await catalog.ExportAsync(WithFilters(query), ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpPost, CatalogRight(PermissionAction.Create)]
    public Task<TDto> Create(TRequest request, CancellationToken ct) => catalog.CreateAsync(request, ct);

    [HttpPut("{code}"), CatalogRight(PermissionAction.Edit)]
    public Task<TDto> Update(string code, TRequest request, CancellationToken ct) => catalog.UpdateAsync(code, request, ct);

    /// <summary>Nhập Excel. Mode "upsert" also updates existing codes and needs the edit right too.</summary>
    [HttpPost("import"), CatalogRight(PermissionAction.Create)]
    public async Task<ImportResult> Import(ImportRequest<TRequest> request, CancellationToken ct)
    {
        if (request.IsUpsert)
            await permissions.EnsureAllowedAsync(CurrentUserId, GetType().GetCustomAttribute<CatalogFunctionAttribute>()!.Function,
                PermissionAction.Edit, ct);
        return await catalog.ImportAsync(request, ct);
    }

    [HttpPost("delete-many"), CatalogRight(PermissionAction.Delete)]
    public Task<DeleteManyResult> DeleteMany(DeleteManyRequest request, CancellationToken ct) => catalog.DeleteManyAsync(request, ct);

    [HttpDelete("{code}"), CatalogRight(PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await catalog.DeleteAsync(code, ct);
        return NoContent();
    }
}
