using Core.Application.Common.Export;
using Core.Application.Common.Paging;

namespace Core.Application.Common.Catalogs;

/// <summary>A catalog's save request (form and Excel row): the code it is stored under and the version it was loaded at.</summary>
public interface ICatalogRequest
{
    string Code { get; }
    /// <summary>Row version when the form loaded the record (lost-update check); null for new records and imports.</summary>
    uint? Version { get; }
}

/// <summary>
/// What every catalog service offers, the same for all catalogs (see CatalogService in Infrastructure): one page of the
/// list, the Excel export of the same filter, create, update, delete, and the Excel import / bulk delete.
/// A catalog's own interface extends this one (<c>IUomService : ICatalogService&lt;UomDto, SaveUomRequest&gt;</c>).
/// </summary>
public interface ICatalogService<TDto, TRequest> where TRequest : class, ICatalogRequest
{
    /// <summary>One page, sorted and filtered by the server (query: Page, PageSize, Sort, Dir, Search, Status).</summary>
    Task<PagedResult<TDto>> ListAsync(CatalogListQuery query, CancellationToken ct);

    /// <summary>Every row matching the filters as an Excel file, same columns and texts as the import file.</summary>
    Task<ExportFile> ExportAsync(CatalogListQuery query, CancellationToken ct);

    Task<TDto> CreateAsync(TRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed.</summary>
    Task<TDto> UpdateAsync(string code, TRequest request, CancellationToken ct);

    /// <summary>Refused while other data uses the record (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);

    /// <summary>Nhập Excel: every row checked like the form, all saved or none (CatalogBatch).</summary>
    Task<ImportResult> ImportAsync(ImportRequest<TRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
