using Core.Application.Common.Exceptions;
using Core.Application.Modules.Inventory.Reports;
using Xunit;

namespace Core.Tests.Modules.Inventory;

public sealed class StockReportRulesTests
{
    private static readonly DateOnly Today = new(2026, 11, 3);

    [Fact]
    public void NoDatesMeansTheMonthSoFar() =>
        Assert.Equal((new DateOnly(2026, 11, 1), Today), StockReportRules.Period(null, null, Today));

    [Fact]
    public void OnlyFromMeansUntilTheEndOfThatMonth() =>
        Assert.Equal((new DateOnly(2027, 2, 10), new DateOnly(2027, 2, 28)), StockReportRules.Period(new DateOnly(2027, 2, 10), null, Today));

    [Fact]
    public void OnlyToMeansFromTheStartOfThatMonth() =>
        Assert.Equal((new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 15)), StockReportRules.Period(null, new DateOnly(2026, 9, 15), Today));

    [Fact]
    public void BothDatesAreKept() =>
        Assert.Equal((new DateOnly(2026, 1, 5), new DateOnly(2026, 3, 9)), StockReportRules.Period(new DateOnly(2026, 1, 5), new DateOnly(2026, 3, 9), Today));

    [Fact]
    public void AStartAfterTheEndIsRefused()
    {
        var error = Assert.Throws<BusinessRuleException>(() => StockReportRules.Period(new DateOnly(2026, 5, 2), new DateOnly(2026, 5, 1), Today));
        Assert.Equal("report.dateRange", error.Key);
    }

    [Theory]
    [InlineData(5.0, 10.0, 100.0, "below")]
    [InlineData(10.0, 10.0, 100.0, "ok")]
    [InlineData(100.0, 10.0, 100.0, "ok")]
    [InlineData(101.0, 10.0, 100.0, "over")]
    [InlineData(5.0, null, null, "none")]
    [InlineData(5.0, 0.0, 0.0, "none")]
    [InlineData(5.0, 10.0, null, "below")]
    [InlineData(500.0, 10.0, null, "ok")]
    [InlineData(500.0, null, 100.0, "over")]
    [InlineData(0.0, 10.0, 100.0, "below")]
    public void StockAgainstItsLimits(double quantity, double? min, double? max, string expected) =>
        Assert.Equal(expected, StockReportRules.Level((decimal)quantity, (decimal?)min, (decimal?)max));

    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("detail", false)]
    [InlineData(" Summary ", true)]
    public void ListingMode(string? mode, bool summary) => Assert.Equal(summary, StockReportRules.IsSummary(mode));

    [Fact]
    public void AnUnknownListingModeIsRefused() =>
        Assert.Equal("report.modeInvalid", Assert.Throws<BusinessRuleException>(() => StockReportRules.IsSummary("pivot")).Key);

    [Theory]
    [InlineData(0, 100, 0)]
    [InlineData(3, 10, 3.3333)]
    [InlineData(4, 1000, 250)]
    public void AverageCostIsValuePerUnit(double quantity, double value, double expected) =>
        Assert.Equal((decimal)expected, StockReportRules.AverageCost((decimal)quantity, (decimal)value));

    [Theory]
    [InlineData(2026, 2, "2026-02-01", "2026-02-28")]
    [InlineData(2028, 2, "2028-02-01", "2028-02-29")]
    [InlineData(2026, 12, "2026-12-01", "2026-12-31")]
    [InlineData(null, null, "2026-11-01", "2026-11-30")]
    [InlineData(2025, null, "2025-11-01", "2025-11-30")]
    public void MonthPeriodIsTheWholeMonth(int? year, int? month, string from, string to) =>
        Assert.Equal((DateOnly.Parse(from), DateOnly.Parse(to)), StockReportRules.MonthPeriod(year, month, new DateOnly(2026, 11, 9)));

    [Theory]
    [InlineData(2026, 0)]
    [InlineData(2026, 13)]
    [InlineData(1999, 5)]
    [InlineData(2101, 5)]
    public void AnImpossibleMonthIsRefused(int year, int month) =>
        Assert.Equal("report.monthInvalid", Assert.Throws<BusinessRuleException>(() => StockReportRules.MonthPeriod(year, month, new DateOnly(2026, 11, 9))).Key);
}
