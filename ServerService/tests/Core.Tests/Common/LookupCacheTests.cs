using System.Text.RegularExpressions;
using Core.Application.Common.Lookups;
using Core.Application.Common.Localization;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Core.Tests.Common;

public sealed class LookupCacheTests
{
    private static readonly IReadOnlyList<LookupItem> Rows =
    [
        new("KG", "Kilogram", true, new Dictionary<string, object?>()),
        new("G", "Gam", true, new Dictionary<string, object?>()),
        new("KGF", "Kilogram lực", false, new Dictionary<string, object?>()),
        new("THUNG", "Thùng", true, new Dictionary<string, object?>()),
        new("50%", "Nửa trăm", true, new Dictionary<string, object?>())
    ];

    private static string[] Codes(LookupQuery query) => LookupSearch.Run(Rows, query).Items.Select(x => x.Code).ToArray();

    [Fact]
    public void WithoutTextEveryActiveRowByCode() =>
        Assert.Equal(new[] { "50%", "G", "KG", "THUNG" }, Codes(new LookupQuery()));

    [Fact]
    public void InactiveRowsOnlyWhenAsked() =>
        Assert.Equal(new[] { "50%", "G", "KG", "KGF", "THUNG" }, Codes(new LookupQuery(IncludeInactive: true)));

    [Fact]
    public void ExactCodeFirstThenCodesStartingWithTheTextThenTheRest() =>
        Assert.Equal(new[] { "KG", "KGF" }, Codes(new LookupQuery("kg", IncludeInactive: true)));

    [Fact]
    public void SearchesNamesInAnyCaseAndTakesWildcardsLiterally()
    {
        Assert.Equal(new[] { "THUNG" }, Codes(new LookupQuery("thùng")));
        Assert.Equal(new[] { "50%" }, Codes(new LookupQuery("%")));
        Assert.Empty(Codes(new LookupQuery("_")));
    }

    [Fact]
    public void FindsTextTypedWithoutAccents()
    {
        Assert.Equal(new[] { "50%" }, Codes(new LookupQuery("nua tram")));    // name "Nửa trăm"
        Assert.Equal(new[] { "THUNG" }, Codes(new LookupQuery("THUNG")));
        Assert.Equal(new[] { "THUNG" }, Codes(new LookupQuery("thung")));
        Assert.Equal(new[] { "KG" }, Codes(new LookupQuery("kg")));               // exact code before KGF (inactive anyway)
    }

    [Fact]
    public void PagesAndCountsTheMatches()
    {
        var (items, total) = LookupSearch.Run(Rows, new LookupQuery(Page: 2, PageSize: 2));
        Assert.Equal(4, total);
        Assert.Equal(new[] { "KG", "THUNG" }, items.Select(x => x.Code).ToArray());
        // A page size above the limit is cut to it (here fewer rows than the limit exist, so all four come back).
        Assert.Equal(4, LookupSearch.Run(Rows, new LookupQuery(PageSize: 100000)).Items.Count);
    }

    /// <summary>
    /// A cached lookup is dropped only when a table named in <see cref="LookupDefinition.Tables"/> is written, so the list
    /// must name every table the projection reads (the translations of a name included).
    /// </summary>
    [Fact]
    public void EveryLookupNamesEveryTableItReads()
    {
        using var context = new CoreContext(new DbContextOptionsBuilder<CoreContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);
        Messages.CurrentLanguage = "vi";
        foreach (var lookup in LookupCatalogs.All)
        {
            Assert.NotEmpty(lookup.Tables);
            var sql = lookup.Rows(context).ToQueryString();
            var read = Regex.Matches(sql, @"(?:FROM|JOIN)\s+""?([a-z_]+)""?", RegexOptions.IgnoreCase)
                .Select(m => m.Groups[1].Value).Where(t => t.StartsWith("erp_") || t.StartsWith("sys_")).ToHashSet();
            Assert.NotEmpty(read);
            Assert.True(read.IsSubsetOf(lookup.Tables), $"Lookup '{lookup.Name}' reads {string.Join(", ", read)} but lists {string.Join(", ", lookup.Tables)}.");
        }
    }

    [Fact]
    public void LookupNamesAreUnique() =>
        Assert.Equal(LookupCatalogs.All.Count, LookupCatalogs.All.Select(x => x.Name.ToLowerInvariant()).Distinct().Count());
}
