using Core.Infrastructure.Common.Caching;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Core.Tests.Common;

public sealed class AppCacheTests
{
    private static MemoryAppCache NewCache() => new(new MemoryCache(new MemoryCacheOptions()));

    [Theory]
    [InlineData("INSERT INTO erp_uom (code, name) VALUES (@p0, @p1) RETURNING xmin;", "erp_uom")]
    [InlineData("UPDATE sys_users AS s SET language = @p WHERE s.user_id = @id", "sys_users")]
    [InlineData("UPDATE \"sys_users\" SET \"language\" = @p0", "sys_users")]
    [InlineData("DELETE FROM public.sys_audit_log WHERE id IN (SELECT id FROM sys_audit_log LIMIT 10)", "sys_audit_log")]
    [InlineData("UPDATE sys_role SET x = 1;\nDELETE FROM sys_role_command WHERE role_id = 1;\nINSERT INTO sys_role_right (a) VALUES (1);",
        "sys_role,sys_role_command,sys_role_right")]
    [InlineData("SELECT s.update_time, s.updated_by FROM sys_users AS s", "")]
    public void FindsTheTablesACommandWrites(string sql, string expected) =>
        Assert.Equal(expected, string.Join(",", CacheInvalidationInterceptor.TablesWritten(sql)));

    [Fact]
    public async Task EntryIsReadOnceThenDroppedByAWriteToItsTable()
    {
        var cache = NewCache();
        var reads = 0;
        Task<int> Read(CancellationToken _) => Task.FromResult(++reads);

        Assert.Equal(1, await cache.GetOrCreateAsync("k", ["erp_uom"], Read, default));
        Assert.Equal(1, await cache.GetOrCreateAsync("k", ["erp_uom"], Read, default));
        cache.InvalidateTables(["sys_language"]);
        Assert.Equal(1, await cache.GetOrCreateAsync("k", ["erp_uom"], Read, default));
        cache.InvalidateTables(["ERP_UOM"]);
        Assert.Equal(2, await cache.GetOrCreateAsync("k", ["erp_uom"], Read, default));
    }

    /// <summary>A write that lands while the value is being read must not leave the old value cached.</summary>
    [Fact]
    public async Task WriteDuringTheReadExpiresTheEntry()
    {
        var cache = NewCache();
        var reads = 0;
        Assert.Equal(1, await cache.GetOrCreateAsync("k", ["erp_uom"], _ =>
        {
            cache.InvalidateTables(["erp_uom"]);
            return Task.FromResult(++reads);
        }, default));
        Assert.Equal(2, await cache.GetOrCreateAsync("k", ["erp_uom"], _ => Task.FromResult(++reads), default));
    }

    [Fact]
    public async Task ConcurrentReadersShareOneRead()
    {
        var cache = NewCache();
        var reads = 0;
        var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => cache.GetOrCreateAsync("k", ["t"], async ct =>
        {
            Interlocked.Increment(ref reads);
            await Task.Delay(50, ct);
            return 42;
        }, default)));
        Assert.All(results, r => Assert.Equal(42, r));
        Assert.Equal(1, reads);
    }
}
