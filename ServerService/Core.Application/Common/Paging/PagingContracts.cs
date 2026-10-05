namespace Core.Application.Common.Paging;

/// <summary>
/// Query string of every paged list (GET api/.../?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;search=...). A screen's own
/// query record implements it and adds its filters; the same record also drives that screen's Excel export.
/// </summary>
public interface IPagedQuery
{
    int Page { get; }
    int PageSize { get; }
    /// <summary>Column name from the screen's <c>SortMap</c>; null = the default order.</summary>
    string? Sort { get; }
    /// <summary>"asc" or "desc".</summary>
    string? Dir { get; }
    /// <summary>Free text matched against the screen's searchable fields.</summary>
    string? Search { get; }
}

public static class PagingLimits
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 200;
    /// <summary>Most rows one Excel export may hold; more asks the user to narrow the filter.</summary>
    public const int MaxExportRows = 100_000;

    public static (int Page, int PageSize) Normalize(IPagedQuery query) =>
        (Math.Max(1, query.Page), query.PageSize <= 0 ? DefaultPageSize : Math.Min(query.PageSize, MaxPageSize));
}

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize)
{
    public PagedResult<TOut> Map<TOut>(Func<T, TOut> map) => new(Items.Select(map).ToList(), Total, Page, PageSize);
}

/// <summary>
/// Query of a catalog list (danh mục), the same for every catalog and for its Excel export. Status: "active" /
/// "inactive" (catalogs without an active flag ignore it). A catalog needing more filters declares its own record.
/// </summary>
public sealed record CatalogListQuery(int Page = 1, int PageSize = PagingLimits.DefaultPageSize, string? Sort = null,
    string? Dir = null, string? Search = null, string? Status = null) : IPagedQuery
{
    /// <summary>
    /// The catalog's own filters: every other query parameter of the request (<c>?groupCode=NVL</c>), filled by the controller.
    /// A catalog reads the ones it knows in <c>CatalogService.ApplyFilters</c>; unknown ones are ignored.
    /// </summary>
    public IReadOnlyDictionary<string, string>? Filters { get; init; }

    /// <summary>Names the framework itself reads from the query string; every other name is a filter of the catalog.</summary>
    public static readonly IReadOnlySet<string> ReservedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "page", "pageSize", "sort", "dir", "search", "status", "filters" };

    /// <summary>This query with the catalog's own filters taken from the request's query parameters (empty values dropped).</summary>
    public CatalogListQuery WithFilters(IEnumerable<KeyValuePair<string, string>> parameters) => this with
    {
        Filters = parameters.Where(x => !ReservedNames.Contains(x.Key) && !string.IsNullOrWhiteSpace(x.Value))
            .ToDictionary(x => x.Key, x => x.Value.Trim(), StringComparer.OrdinalIgnoreCase)
    };
}
