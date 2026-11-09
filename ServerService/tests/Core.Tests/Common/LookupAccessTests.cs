using Core.Application.Common.Exceptions;
using Core.Application.Common.Lookups;
using Core.Application.Common.Permissions;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Core.Tests.Common;

/// <summary>Who may use the lookups: the owner of the catalog, the functions that pick from it, nobody else.</summary>
public sealed class LookupAccessTests
{
    /// <summary>A lookup with a fixed name that answers the same records to everybody; the service decides what the caller gets.</summary>
    private sealed class NamedProvider(string name) : LookupProvider
    {
        public override string Name => name;
        public override Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<LookupItem>>(
            [
                new("DVCS01", "Unit 1", true, new Dictionary<string, object?> { ["taxCode"] = "0101", ["phone"] = "090", ["symbol"] = "x" }),
                new("DVCS02", "Unit 2", true, new Dictionary<string, object?> { ["taxCode"] = "0202", ["phone"] = "091", ["symbol"] = "y" })
            ]);
    }

    private static CoreContext Context() => new(new DbContextOptionsBuilder<CoreContext>()
        .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);

    private static LookupService Service(string lookup, FakePermissions permissions) =>
        new(Context(), new MemoryAppCache(new MemoryCache(new MemoryCacheOptions())), permissions, [], [new NamedProvider(lookup)]);

    private static readonly LookupCaller Caller = new(7, "DVCS01", new Dictionary<string, string>());

    // ---- The catalog of rules ---------------------------------------------------------------------------------------

    private static IEnumerable<string> RegisteredNames()
    {
        using var context = Context();
        var providers = typeof(LookupProvider).Assembly.GetTypes()
            .Where(t => !t.IsAbstract && typeof(LookupProvider).IsAssignableFrom(t))
            .Select(t => ((LookupProvider)Activator.CreateInstance(t, context)!).Name);
        return LookupCatalogs.All.Select(x => x.Name).Concat(providers);
    }

    [Fact]
    public void EveryLookupHasAnAccessRuleAndEveryRuleHasALookup()
    {
        var names = RegisteredNames().ToHashSet(StringComparer.OrdinalIgnoreCase);
        var rules = LookupAccessCatalog.All.Select(x => x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        Assert.Empty(names.Except(rules).Select(x => $"lookup '{x}' has no rule in LookupAccessCatalog"));
        Assert.Empty(rules.Except(names).Select(x => $"rule '{x}' has no lookup"));
        Assert.Equal(LookupAccessCatalog.All.Count, rules.Count);
    }

    [Fact]
    public void RulesNameRealFunctionsAndAnOwnerOrAreOpen()
    {
        foreach (var rule in LookupAccessCatalog.All)
        {
            if (rule.Owner is { } owner) Assert.True(FunctionCatalog.IsFunction(owner), $"{rule.Name}: owner {owner}");
            else Assert.True(rule.Open, $"{rule.Name} has no owner and is not open");
            foreach (var consumer in rule.Consumers.Concat(rule.SensitiveFor))
                Assert.True(FunctionCatalog.IsFunction(consumer), $"{rule.Name}: {consumer}");
            Assert.False(rule.Open && rule.Consumers.Count > 0, $"{rule.Name}: an open lookup needs no consumers");
            Assert.True(rule.SensitiveExtras.Count == 0 || rule.Owner is not null, $"{rule.Name}: sensitive columns need an owner");
        }
    }

    [Fact]
    public void OnlyTheBaseDataIsOpen() =>
        Assert.Equal(new[] { "companyUnits", "currencies", "departments" },
            LookupAccessCatalog.All.Where(x => x.Open).Select(x => x.Name).OrderBy(x => x).ToArray());

    // ---- What a caller gets -----------------------------------------------------------------------------------------

    [Fact]
    public async Task AUserWithNoRightsIsRefused()
    {
        var service = Service("suppliers", new FakePermissions(views: ["hr_list"]));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.SearchAsync("suppliers", new LookupQuery(), Caller, default));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetAsync("suppliers", ["DVCS01"], Caller, default));
    }

    [Fact]
    public async Task TheOwnerOfTheCatalogSeesEverything()
    {
        var page = await Service("suppliers", new FakePermissions(views: ["inv_supplier_cat"]))
            .SearchAsync("suppliers", new LookupQuery(), Caller, default);
        Assert.Equal(2, page.Total);
        Assert.Equal("0101", page.Items[0].Extra["taxCode"]);
        Assert.Equal("090", page.Items[0].Extra["phone"]);
    }

    [Fact]
    public async Task AVoucherThatPicksFromTheCatalogMayUseItAndSeesTheColumnsItNeeds()
    {
        var page = await Service("suppliers", new FakePermissions(views: ["pur_order"])).SearchAsync("suppliers", new LookupQuery(), Caller, default);
        Assert.Equal("0101", page.Items[0].Extra["taxCode"]);
    }

    [Fact]
    public async Task AnotherPickerGetsTheNamesButNotTheSensitiveColumns()
    {
        var service = Service("suppliers", new FakePermissions(views: ["inv_lot_cat"]));
        var page = await service.SearchAsync("suppliers", new LookupQuery(), Caller, default);
        Assert.Equal(2, page.Total);
        Assert.Equal("Unit 1", page.Items[0].Name);
        Assert.Null(page.Items[0].Extra["taxCode"]);
        Assert.Null(page.Items[0].Extra["phone"]);
        var byCode = await service.GetAsync("suppliers", ["DVCS02"], Caller, default);
        Assert.Null(Assert.Single(byCode).Extra["taxCode"]);
        // A second call must not have changed the cached records for everybody else.
        var owner = await Service("suppliers", new FakePermissions(views: ["inv_supplier_cat"])).SearchAsync("suppliers", new LookupQuery(), Caller, default);
        Assert.Equal("0101", owner.Items[0].Extra["taxCode"]);
    }

    [Fact]
    public async Task AnAdministratorMayUseEveryLookup()
    {
        var page = await Service("materials", new FakePermissions(admin: true)).SearchAsync("materials", new LookupQuery(), Caller, default);
        Assert.Equal(2, page.Total);
    }

    [Fact]
    public async Task ABaseDataLookupIsOpenToEverySignedInUser()
    {
        var page = await Service("currencies", new FakePermissions()).SearchAsync("currencies", new LookupQuery(), Caller, default);
        Assert.Equal(2, page.Total);
    }

    [Fact]
    public async Task CompanyUnitsAreCutToTheUnitsTheUserMayWorkIn()
    {
        var page = await Service("companyUnits", new FakePermissions(units: ["DVCS01"])).SearchAsync("companyUnits", new LookupQuery(), Caller, default);
        Assert.Equal("DVCS01", Assert.Single(page.Items).Code);
        var owner = await Service("companyUnits", new FakePermissions(views: ["inv_company_unit_cat"], units: ["DVCS01"]))
            .SearchAsync("companyUnits", new LookupQuery(), Caller, default);
        Assert.Equal(2, owner.Total);
        var byCode = await Service("companyUnits", new FakePermissions(units: ["DVCS01"])).GetAsync("companyUnits", ["DVCS01", "DVCS02"], Caller, default);
        Assert.Equal("DVCS01", Assert.Single(byCode).Code);
    }

    [Fact]
    public async Task ALookupWithoutARuleIsRefusedToEveryoneButAdministrators()
    {
        var user = Service("fake", new FakePermissions(views: ["inv_receipt"]));
        await Assert.ThrowsAsync<ForbiddenException>(() => user.SearchAsync("fake", new LookupQuery(), Caller, default));
        Assert.Equal(2, (await Service("fake", new FakePermissions(admin: true)).SearchAsync("fake", new LookupQuery(), Caller, default)).Total);
    }

    [Fact]
    public async Task AnUnknownLookupIsNotFound() =>
        await Assert.ThrowsAsync<NotFoundException>(() => Service("fake", new FakePermissions(admin: true)).SearchAsync("nothing", new LookupQuery(), Caller, default));
}
