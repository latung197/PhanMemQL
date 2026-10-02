using System.Collections.Concurrent;
using Core.Application.Common.Caching;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;

namespace Core.Infrastructure.Common.Caching;

/// <summary>
/// IAppCache in the memory of this API instance. Each table has a cancellation token; an entry expires when one of
/// the tokens of its tables is cancelled (a write) or after its time to live. The tokens are taken before the data is
/// read, so a write that lands while the entry is being built expires it straight away instead of leaving stale data.
/// </summary>
public sealed class MemoryAppCache(IMemoryCache memory) : IAppCache
{
    public static readonly TimeSpan DefaultTimeToLive = TimeSpan.FromMinutes(10);

    private readonly ConcurrentDictionary<string, CancellationTokenSource> _tables = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new(StringComparer.Ordinal);

    public async Task<T> GetOrCreateAsync<T>(string key, IReadOnlyCollection<string> tables,
        Func<CancellationToken, Task<T>> factory, CancellationToken ct, TimeSpan? timeToLive = null)
    {
        if (memory.TryGetValue(key, out T? cached)) return cached!;

        // One reader per key: the other requests wait for its result instead of all hitting the database.
        var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (memory.TryGetValue(key, out cached)) return cached!;
            var tokens = tables.Select(t => _tables.GetOrAdd(t, _ => new CancellationTokenSource()).Token).ToList();
            var value = await factory(ct);
            var options = new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = timeToLive ?? DefaultTimeToLive };
            foreach (var token in tokens) options.AddExpirationToken(new CancellationChangeToken(token));
            memory.Set(key, value, options);
            return value;
        }
        finally
        {
            gate.Release();
        }
    }

    public void InvalidateTables(IEnumerable<string> tables)
    {
        foreach (var table in tables)
            if (_tables.TryRemove(table, out var source))
            {
                source.Cancel();
                source.Dispose();
            }
    }

    public void Remove(string key) => memory.Remove(key);
}
