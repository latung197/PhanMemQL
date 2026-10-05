using Core.Application.Common.Paging;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Paging;

public static class PagingExtensions
{
    /// <summary>One page of an already filtered query, with the total number of rows that match.</summary>
    public static async Task<PagedResult<T>> ToPagedAsync<T>(this IQueryable<T> query, IPagedQuery paging, SortMap<T> sorts,
        CancellationToken ct)
    {
        var (page, size) = PagingLimits.Normalize(paging);
        var ordered = sorts.Apply(query, paging.Sort, paging.Dir);
        var total = await query.CountAsync(ct);
        var items = await ordered.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new PagedResult<T>(items, total, page, size);
    }

    /// <summary>"%text%" for ILike (escape character \), with the characters LIKE treats specially taken literally.</summary>
    public static string ContainsPattern(string text) =>
        "%" + text.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
