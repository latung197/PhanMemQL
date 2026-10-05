using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using Core.Application.Common.Paging;
using Core.Domain.Common;
using Core.Infrastructure.Common.Export;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using MiniExcelLibs;
using Xunit;

namespace Core.Tests.Common;

public sealed class PagingTests
{
    private sealed class Row : ErpEntity
    {
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public int Order { get; set; }
    }

    private static readonly SortMap<Row> Sorts = SortMap<Row>.By(x => x.Code, "order").Add("order", x => x.Order)
        .Add("name", x => x.Name).AddRecordStamps();

    private static readonly Row[] Rows =
    [
        new() { Code = "C", Name = "b", Order = 2 }, new() { Code = "A", Name = "b", Order = 1 }, new() { Code = "B", Name = "a", Order = 2 }
    ];

    [Fact]
    public void PageSizeIsClampedAndPageStartsAtOne()
    {
        Assert.Equal((1, PagingLimits.DefaultPageSize), PagingLimits.Normalize(new CatalogListQuery(0, 0)));
        Assert.Equal((3, PagingLimits.MaxPageSize), PagingLimits.Normalize(new CatalogListQuery(3, 100_000)));
        Assert.Equal((2, 50), PagingLimits.Normalize(new CatalogListQuery(2, 50)));
    }

    [Fact]
    public void DefaultOrderThenTieBreakerKeepsPagesStable()
    {
        var codes = Sorts.Apply(Rows.AsQueryable(), null, null).Select(x => x.Code).ToArray();
        Assert.Equal(new[] { "A", "B", "C" }, codes);
    }

    [Fact]
    public void SortsByNamedColumnInRequestedDirectionWithTieBreaker()
    {
        Assert.Equal(new[] { "C", "A", "B" }, Sorts.Apply(Rows.AsQueryable(), "NAME", "desc").Select(x => x.Code).ToArray());
        Assert.Equal(new[] { "B", "A", "C" }, Sorts.Apply(Rows.AsQueryable(), "name", "asc").Select(x => x.Code).ToArray());
    }

    [Fact]
    public void UnknownSortColumnIsRefused()
    {
        Assert.Throws<BusinessRuleException>(() => Sorts.Apply(Rows.AsQueryable(), "password_hash", "asc"));
        Assert.Throws<BusinessRuleException>(() => Sorts.Apply(Rows.AsQueryable(), "name; drop table x", "asc"));
    }

    [Fact]
    public void RecordStampColumnsOnlyForBusinessEntities()
    {
        Assert.NotNull(Sorts.Apply(Rows.AsQueryable(), "createdAt", "desc"));
        Assert.Throws<InvalidOperationException>(() => SortMap<string>.By(x => x, "x").AddRecordStamps());
    }

    [Fact]
    public void LikePatternTakesWildcardsLiterally()
    {
        var back = new string((char)92, 1);
        Assert.Equal("%50" + back + "%" + back + "_x%", PagingExtensions.ContainsPattern(" 50%_x "));
    }

    [Fact]
    public void ACatalogsOwnFiltersAreTheQueryParametersTheFrameworkDoesNotRead()
    {
        var query = new CatalogListQuery(2, 50, "name", "desc", "kg", "active").WithFilters(
        [
            KeyValuePair.Create("page", "9"), KeyValuePair.Create("Search", "x"), KeyValuePair.Create("fromUomCode", " KG "),
            KeyValuePair.Create("toUomCode", ""), KeyValuePair.Create("filters", "junk")
        ]);
        var filter = Assert.Single(query.Filters!);
        Assert.Equal(("fromUomCode", "KG"), (filter.Key, filter.Value));
        Assert.Equal((2, 50, "kg", "active"), (query.Page, query.PageSize, query.Search, query.Status));   // the rest is kept
        Assert.Equal("KG", query.Filters!["FROMUOMCODE"]);   // names compare in any case
    }

    [Theory]
    [InlineData("Thùng", "thung")]
    [InlineData("Mililít", "mililit")]
    [InlineData("Đường kính", "duong kinh")]
    [InlineData("đồng", "dong")]
    [InlineData("TRẦN THỊ HỒNG ÂN", "tran thi hong an")]
    [InlineData("Nguyễn Văn Ệ ữ ố", "nguyen van e u o")]
    [InlineData("KG-01 (abc)", "kg-01 (abc)")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void FoldIgnoresAccentsAndCase(string? text, string expected) => Assert.Equal(expected, SearchFunctions.Fold(text));

    [Fact]
    public void MatchesIsTranslatedToTheSqlSearchFunction()
    {
        using var context = new CoreContext(new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<CoreContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);
        var sql = context.Uoms.Where(x => SearchFunctions.Matches(x.Name, "%a%")).ToQueryString();
        Assert.Contains("sys_search_match(", sql);
        Assert.Throws<NotSupportedException>(() => SearchFunctions.Matches("a", "%a%"));   // not callable outside a query
    }

    [Fact]
    public void PagedResultMapKeepsTheCounts()
    {
        var page = new PagedResult<int>([1, 2], 10, 2, 2).Map(x => x * 10);
        Assert.Equal([10, 20], page.Items);
        Assert.Equal((10, 2, 2), (page.Total, page.Page, page.PageSize));
    }

    [Fact]
    public void ExcelExporterWritesHeadersAndTypedValues()
    {
        Messages.CurrentLanguage = "vi";
        var bytes = new ExcelExporter().Write("export.uom.sheet",
        [
            new ExportColumn<Row>("export.uom.code", x => x.Code), new ExportColumn<Row>("export.uom.name", x => x.Name),
            new ExportColumn<Row>("export.uom.isActive", x => (decimal)x.Order)
        ], Rows);
        using var stream = new MemoryStream(bytes);
        var table = MiniExcel.Query(stream, useHeaderRow: true).Cast<IDictionary<string, object>>().ToList();
        Assert.Equal(3, table.Count);
        Assert.Contains(Messages.T("export.uom.code"), table[0].Keys);
        Assert.Equal("C", table[0][Messages.T("export.uom.code")]);
    }
}
