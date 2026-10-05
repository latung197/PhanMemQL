using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Paging;

namespace Core.Infrastructure.Common.Lookups;

/// <summary>
/// The lookup search done in memory on a list of records (a cached catalog, or what a custom lookup loaded; same rules as
/// the database search in <see cref="LookupService"/>): part of the code or name ignoring case and accents ("thung" finds
/// "Thùng"), an exact code first, then codes starting with the text, then the rest by code; inactive records only when
/// asked; paged.
/// </summary>
public static class LookupSearch
{
    public static (IReadOnlyList<LookupItem> Items, int Total) Run(IReadOnlyList<LookupItem> rows, LookupQuery query)
    {
        var text = query.Q?.Trim() ?? string.Empty;
        var folded = SearchFunctions.Fold(text);
        var found = query.IncludeInactive ? rows : rows.Where(x => x.IsActive).ToList();
        if (text.Length > 0)
            found = found.Where(x => SearchFunctions.Fold(x.Code).Contains(folded, StringComparison.Ordinal)
                || SearchFunctions.Fold(x.Name).Contains(folded, StringComparison.Ordinal)).ToList();

        IEnumerable<LookupItem> ordered = text.Length == 0
            ? found.OrderBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            : found.OrderBy(x => SearchFunctions.Fold(x.Code) == folded ? 0
                    : SearchFunctions.Fold(x.Code).StartsWith(folded, StringComparison.Ordinal) ? 1 : 2)
                .ThenBy(x => x.Code, StringComparer.OrdinalIgnoreCase);

        var size = Math.Clamp(query.PageSize, 1, LookupLimits.MaxPageSize);
        var page = Math.Max(1, query.Page);
        return (ordered.Skip((page - 1) * size).Take(size).ToList(), found.Count);
    }
}
