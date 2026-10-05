using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using Core.Application.Common.Paging;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Domain.Common;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Catalogs;

/// <summary>
/// What is specific to one catalog besides its fields. The message keys follow <paramref name="ObjectType"/>:
/// <c>{ObjectType}.notFound</c>, <c>{ObjectType}.codeExists</c>, <c>export.{ObjectType}.sheet</c> (add them to Messages.vi / en).
/// </summary>
/// <param name="Function">Function code the rights come from (inv_uom_cat), used for the change log of exports.</param>
/// <param name="ObjectType">Short name in camelCase, also the change log's object type: "uom", "uomConversion".</param>
/// <param name="CodeField">Label key of the code for validation messages: "field.uomCode".</param>
/// <param name="CodeLength">Longest code, as in the database column.</param>
/// <param name="FileName">Base name of the exported file, without date or extension: "DanhMucDonViTinh".</param>
public sealed record CatalogSpec(string Function, string ObjectType, string CodeField, int CodeLength, string FileName);

/// <summary>
/// The service of a catalog (danh mục), written once: paged and filtered list, Excel export, create, update with the
/// lost-update check, delete, Excel import and bulk delete. A catalog inherits it and only says what is its own:
/// <list type="bullet">
/// <item><see cref="Spec"/>, <see cref="Sorts"/> (columns the list may be sorted by) and <see cref="Search"/> (what the search box matches);</item>
/// <item><see cref="ApplyAsync"/> (request → fields, with the catalog's checks) and <see cref="MapAsync"/> (rows → DTOs);</item>
/// <item><see cref="ExportColumns"/> (same columns and texts as the Excel import file);</item>
/// <item>optionally <see cref="AfterApplyAsync"/> (child rows such as translations) and <see cref="BeforeDeleteAsync"/> (in-use checks).</item>
/// </list>
/// The change log, record stamps, version and cache invalidation come from CoreContext. Guide: docs/them-danh-muc.md.
/// </summary>
public abstract class CatalogService<TEntity, TDto, TRequest>(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : ICatalogService<TDto, TRequest>
    where TEntity : ErpEntity, ICatalogRecord, new()
    where TRequest : class, ICatalogRequest
{
    protected CoreContext Db { get; } = db;

    protected abstract CatalogSpec Spec { get; }

    /// <summary>Sortable columns by the names of the grid columns; the default order is usually "order" (SortOrder).</summary>
    protected abstract SortMap<TEntity> Sorts { get; }

    /// <summary>Narrows <paramref name="rows"/> to those the search text matches; <paramref name="pattern"/> is for <c>EF.Functions.ILike</c>.</summary>
    protected abstract IQueryable<TEntity> Search(IQueryable<TEntity> rows, string pattern);

    /// <summary>Rows → DTOs, in the same order. Read related data (names, translations) for all rows at once.</summary>
    protected abstract Task<IReadOnlyList<TDto>> MapAsync(IReadOnlyList<TEntity> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct);

    /// <summary>Copies the request into the entity after checking it (<c>Guard.*</c>, references to other catalogs, duplicates).</summary>
    protected abstract Task ApplyAsync(TEntity row, TRequest request, CancellationToken ct);

    /// <summary>The same request without its version (an import row has none): <c>request with { Version = null }</c>.</summary>
    protected abstract TRequest WithoutVersion(TRequest request);

    /// <summary>Columns of the Excel export. Header texts are messages <c>export.{ObjectType}.*</c>, equal to the import file headers.</summary>
    protected abstract IReadOnlyList<ExportColumn<TEntity>> ExportColumns();

    /// <summary>
    /// The catalog's own filters (query parameters such as <c>groupCode=NVL</c>) on top of the search and status: read the ones
    /// the catalog knows and narrow <paramref name="rows"/>; ignore the others. Used by the list and the Excel export.
    /// </summary>
    protected virtual IQueryable<TEntity> ApplyFilters(IQueryable<TEntity> rows, IReadOnlyDictionary<string, string> filters) => rows;

    /// <summary>Called after <see cref="ApplyAsync"/>, before saving: child rows such as translations.</summary>
    protected virtual Task AfterApplyAsync(TEntity row, TRequest request, bool isNew, CancellationToken ct) => Task.CompletedTask;

    /// <summary>Called before deleting: refuse when other data uses the record, delete child rows.</summary>
    protected virtual Task BeforeDeleteAsync(TEntity row, CancellationToken ct) => Task.CompletedTask;

    protected static string YesNo(bool value) => Messages.T(value ? "export.yes" : "export.no");

    private DbSet<TEntity> Rows => Db.Set<TEntity>();

    // ---- List and export -------------------------------------------------------------------------------------------

    /// <summary>The rows the search text and the status ("active" / "inactive") leave; shared by the list and the export.</summary>
    private IQueryable<TEntity> Filter(CatalogListQuery query)
    {
        var rows = ApplyFilters(Rows.AsNoTracking(), query.Filters ?? new Dictionary<string, string>());
        if (!string.IsNullOrWhiteSpace(query.Search)) rows = Search(rows, PagingExtensions.ContainsPattern(query.Search));
        return query.Status switch
        {
            "active" => rows.Where(x => x.IsActive),
            "inactive" => rows.Where(x => !x.IsActive),
            _ => rows
        };
    }

    public async Task<PagedResult<TDto>> ListAsync(CatalogListQuery query, CancellationToken ct)
    {
        var page = await Filter(query).ToPagedAsync(query, Sorts, ct);
        var stamp = await RecordStamps.ForAsync(Db, page.Items, ct);
        return new PagedResult<TDto>(await MapAsync(page.Items, stamp, ct), page.Total, page.Page, page.PageSize);
    }

    public async Task<ExportFile> ExportAsync(CatalogListQuery query, CancellationToken ct)
    {
        var rows = Filter(query);
        var total = await rows.CountAsync(ct);
        if (total > PagingLimits.MaxExportRows) throw new BusinessRuleException("export.tooMany", PagingLimits.MaxExportRows);
        var list = await Sorts.Apply(rows, query.Sort, query.Dir).ToListAsync(ct);
        var content = excel.Write($"export.{Spec.ObjectType}.sheet", ExportColumns(), list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Spec.Function, Spec.ObjectType, "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}"
            + string.Concat((query.Filters ?? new Dictionary<string, string>()).Select(x => $"; {x.Key}={x.Value}"))), ct);
        await Db.SaveChangesAsync(ct);
        return new ExportFile(content, $"{Spec.FileName}_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    // ---- Create, update, delete ------------------------------------------------------------------------------------

    public async Task<TDto> CreateAsync(TRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, Spec.CodeLength, Spec.CodeField);
        if (await Rows.AnyAsync(x => x.Code == code, ct)) throw new BusinessRuleException($"{Spec.ObjectType}.codeExists", code);
        var row = new TEntity { Code = code, SortOrder = (await Rows.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        Rows.Add(row);
        await AfterApplyAsync(row, request, isNew: true, ct);
        await Db.SaveChangesAsync(ct);
        return await ResultAsync(row, ct);
    }

    public async Task<TDto> UpdateAsync(string code, TRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        Db.ExpectVersion(row, request.Version);
        await ApplyAsync(row, request, ct);
        await AfterApplyAsync(row, request, isNew: false, ct);
        await Db.SaveChangesAsync(ct);
        return await ResultAsync(row, ct);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        await BeforeDeleteAsync(row, ct);
        Rows.Remove(row);
        await Db.SaveChangesAsync(ct);
    }

    // ---- Excel import and bulk delete (every row goes through the methods above) ------------------------------------

    public Task<ImportResult> ImportAsync(ImportRequest<TRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => Rows.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, WithoutVersion(row), token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    // ---- Helpers for the catalog -----------------------------------------------------------------------------------

    /// <summary>The tracked record of this code, or "{ObjectType}.notFound".</summary>
    protected async Task<TEntity> FindAsync(string code, CancellationToken ct) =>
        await Rows.FirstOrDefaultAsync(x => x.Code == code, ct) ?? throw new NotFoundException($"{Spec.ObjectType}.notFound");

    private async Task<TDto> ResultAsync(TEntity row, CancellationToken ct) =>
        (await MapAsync([row], await RecordStamps.ForAsync(Db, [row], ct), ct))[0];
}
