using System.Linq.Expressions;
using Core.Application.Common.Exceptions;
using Core.Domain.Common;

namespace Core.Infrastructure.Common.Paging;

/// <summary>
/// The columns a list may be sorted by (a whitelist: a request never names a database column) plus the default order.
/// A tie-breaker on a unique column is always added last, so pages never repeat or skip a row.
/// </summary>
public sealed class SortMap<T>
{
    private readonly Dictionary<string, Func<IQueryable<T>, bool, IOrderedQueryable<T>>> _sorts = new(StringComparer.OrdinalIgnoreCase);
    private readonly Func<IOrderedQueryable<T>, bool, IOrderedQueryable<T>> _tieBreaker;
    private readonly string _defaultSort;
    private readonly bool _defaultDescending;

    private SortMap(Func<IOrderedQueryable<T>, bool, IOrderedQueryable<T>> tieBreaker, string defaultSort, bool defaultDescending)
    {
        _tieBreaker = tieBreaker;
        _defaultSort = defaultSort;
        _defaultDescending = defaultDescending;
    }

    /// <param name="tieBreaker">A unique column: the id, or the code of a catalog.</param>
    /// <param name="defaultSort">Name of a column added with <see cref="Add{TKey}"/>.</param>
    public static SortMap<T> By<TTie>(Expression<Func<T, TTie>> tieBreaker, string defaultSort, bool defaultDescending = false) =>
        new((q, desc) => desc ? q.ThenByDescending(tieBreaker) : q.ThenBy(tieBreaker), defaultSort, defaultDescending);

    public SortMap<T> Add<TKey>(string name, Expression<Func<T, TKey>> key)
    {
        _sorts[name] = (q, desc) => desc ? q.OrderByDescending(key) : q.OrderBy(key);
        return this;
    }

    /// <summary>Who and when created / last changed a record (the "createdAt" / "updatedAt" columns of every business table).</summary>
    public SortMap<T> AddRecordStamps()
    {
        if (!typeof(ErpEntity).IsAssignableFrom(typeof(T))) throw new InvalidOperationException($"{typeof(T).Name} is not an ErpEntity.");
        var x = Expression.Parameter(typeof(T), "x");
        Add("createdAt", Expression.Lambda<Func<T, DateTime>>(Expression.Property(x, nameof(ErpEntity.CreatedAt)), x));
        Add("updatedAt", Expression.Lambda<Func<T, DateTime?>>(Expression.Property(x, nameof(ErpEntity.UpdatedAt)), x));
        return this;
    }

    public IOrderedQueryable<T> Apply(IQueryable<T> query, string? sort, string? dir)
    {
        var name = string.IsNullOrWhiteSpace(sort) ? _defaultSort : sort.Trim();
        if (!_sorts.TryGetValue(name, out var order)) throw new BusinessRuleException("paging.sortInvalid");
        var descending = string.IsNullOrWhiteSpace(sort) ? _defaultDescending
            : string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase);
        return _tieBreaker(order(query, descending), descending);
    }
}
