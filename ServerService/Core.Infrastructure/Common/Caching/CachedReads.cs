using Core.Application.Common.Caching;
using Core.Infrastructure.Common.Persistence;

namespace Core.Infrastructure.Common.Caching;

public static class CachedReads
{
    /// <summary>
    /// Reads through the shared cache, except inside an open transaction: what that transaction sees may not be
    /// committed (and may be rolled back), so it is read directly and never shared with other requests.
    /// </summary>
    public static Task<T> CachedAsync<T>(this CoreContext db, IAppCache cache, string key, IReadOnlyCollection<string> tables,
        Func<CancellationToken, Task<T>> factory, CancellationToken ct, TimeSpan? timeToLive = null) =>
        db.Database.CurrentTransaction is null
            ? cache.GetOrCreateAsync(key, tables, factory, ct, timeToLive)
            : factory(ct);
}
