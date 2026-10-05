using Core.Application.Common.Exceptions;
using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Core.Tests.Common;

/// <summary>The framework of custom lookups (LookupProvider): parameters, caching, scope, rights, typed columns, names.</summary>
public sealed class LookupProviderTests
{
    private sealed class FakeProvider : LookupProvider
    {
        public int Loads { get; private set; }
        public bool Allowed { get; set; } = true;
        public string Scope { get; set; } = "";
        public IReadOnlyCollection<string> CachedTables { get; set; } = ["t_units"];

        public override string Name => "fake";
        public override IReadOnlyCollection<string> Tables => CachedTables;
        public override IReadOnlyCollection<string> ParameterNames => ["warehouse"];

        public override Task AuthorizeAsync(LookupContext context, CancellationToken ct) =>
            Allowed ? Task.CompletedTask : throw new ForbiddenException("permission.denied");

        public override Task<string> CacheScopeAsync(LookupContext context, CancellationToken ct) => Task.FromResult(Scope);

        public override Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
        {
            Loads++;
            var warehouse = context.Param("warehouse") ?? "ALL";
            return Task.FromResult<IReadOnlyList<LookupItem>>(
            [
                new("A1", "Alpha " + warehouse, true, new Dictionary<string, object?> { ["stock"] = 12.5m, ["inStock"] = true, ["note"] = null }),
                new("B2", "Beta", true, new Dictionary<string, object?> { ["stock"] = 0m }),
                new("C3", "Gone", false, new Dictionary<string, object?>())
            ]);
        }
    }

    private static (LookupService Service, FakeProvider Provider, MemoryAppCache Cache) Create(params LookupDefinition[] definitions)
    {
        var provider = new FakeProvider();
        var cache = new MemoryAppCache(new MemoryCache(new MemoryCacheOptions()));
        var context = new CoreContext(new DbContextOptionsBuilder<CoreContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);
        return (new LookupService(context, cache, null!, definitions, [provider]), provider, cache);
    }

    private static LookupCaller Caller(params (string Key, string Value)[] parameters) =>
        new(1, "DVCS01", parameters.ToDictionary(x => x.Key, x => x.Value));

    [Fact]
    public async Task SearchesTheProvidersRecordsAndKeepsTypedValues()
    {
        var (service, _, _) = Create();
        var page = await service.SearchAsync("fake", new LookupQuery("alp"), Caller(), default);
        var item = Assert.Single(page.Items);
        Assert.Equal("A1", item.Code);
        Assert.Equal(12.5m, item.Extra["stock"]);
        Assert.Equal(true, item.Extra["inStock"]);
        Assert.Null(item.Extra["note"]);
        Assert.Equal(2, (await service.SearchAsync("fake", new LookupQuery(), Caller(), default)).Total);   // inactive left out
    }

    [Fact]
    public async Task OneCachedCopyPerDeclaredParameterValue()
    {
        var (service, provider, _) = Create();
        await service.SearchAsync("fake", new LookupQuery(), Caller(("warehouse", "KHO1")), default);
        await service.SearchAsync("fake", new LookupQuery("beta"), Caller(("warehouse", "KHO1")), default);
        Assert.Equal(1, provider.Loads);

        var other = await service.SearchAsync("fake", new LookupQuery("alp"), Caller(("warehouse", "KHO2")), default);
        Assert.Equal(2, provider.Loads);
        Assert.Equal("Alpha KHO2", other.Items[0].Name);

        // A parameter the lookup does not declare changes nothing and cannot fill the cache with variations.
        await service.SearchAsync("fake", new LookupQuery(), Caller(("warehouse", "KHO1"), ("junk", "1")), default);
        await service.SearchAsync("fake", new LookupQuery(), Caller(("junk", "2")), default);
        Assert.Equal(3, provider.Loads);   // only the new "no warehouse" combination
    }

    [Fact]
    public async Task CachedCopyIsDroppedWhenATableIsWritten()
    {
        var (service, provider, cache) = Create();
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        Assert.Equal(1, provider.Loads);

        cache.InvalidateTables(["t_other"]);
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        Assert.Equal(1, provider.Loads);

        cache.InvalidateTables(["t_units"]);
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        Assert.Equal(2, provider.Loads);
    }

    [Fact]
    public async Task WithoutTablesNothingIsCached()
    {
        var (service, provider, _) = Create();
        provider.CachedTables = [];
        for (var i = 0; i < 3; i++) await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        Assert.Equal(3, provider.Loads);
    }

    [Fact]
    public async Task ScopeKeepsCopiesApart()
    {
        var (service, provider, _) = Create();
        provider.Scope = "price:1";
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        provider.Scope = "price:0";
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);
        Assert.Equal(2, provider.Loads);
    }

    [Fact]
    public async Task RightsAreCheckedBeforeAnythingIsReadOrCached()
    {
        var (service, provider, _) = Create();
        await service.SearchAsync("fake", new LookupQuery(), Caller(), default);   // cached by someone allowed
        provider.Allowed = false;
        await Assert.ThrowsAsync<ForbiddenException>(() => service.SearchAsync("fake", new LookupQuery(), Caller(), default));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetAsync("fake", ["A1"], Caller(), default));
        Assert.Equal(1, provider.Loads);
    }

    [Fact]
    public async Task ByCodesAndUnknownNames()
    {
        var (service, _, _) = Create();
        var items = await service.GetAsync("fake", ["B2", "C3", "NOPE"], Caller(), default);
        Assert.Equal(new[] { "B2", "C3" }, items.Select(x => x.Code).ToArray());   // inactive ones included
        await Assert.ThrowsAsync<NotFoundException>(() => service.SearchAsync("nope", new LookupQuery(), Caller(), default));
    }

    [Fact]
    public async Task ACatalogAndAProviderCannotShareAName()
    {
        var (service, _, _) = Create(new LookupDefinition("fake", db => db.Uoms.Select(x => new LookupRow()), ["erp_uom"]));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SearchAsync("fake", new LookupQuery(), Caller(), default));
    }

    [Fact]
    public void EveryProviderDeclaresANameAndParametersThatAreSafeToUseAsCacheKeys()
    {
        var providers = typeof(LookupProvider).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(LookupProvider).IsAssignableFrom(t)).ToList();
        Assert.NotEmpty(providers);
        foreach (var type in providers)
        {
            var provider = (LookupProvider)System.Runtime.CompilerServices.RuntimeHelpers.GetUninitializedObject(type);
            Assert.False(string.IsNullOrWhiteSpace(provider.Name), type.Name);
            Assert.All(provider.ParameterNames, n => Assert.Matches("^[A-Za-z][A-Za-z0-9]*$", n));
            Assert.Equal(provider.Name.Trim(), provider.Name);
        }
        Assert.Equal(providers.Count, providers.Select(t => ((LookupProvider)System.Runtime.CompilerServices.RuntimeHelpers
            .GetUninitializedObject(t)).Name.ToLowerInvariant()).Distinct().Count());
    }
}
