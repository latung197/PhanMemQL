using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Modules.VoucherNumbering;
using Xunit;

namespace Core.Tests.Modules.VoucherNumbering;

public sealed class VoucherNumberFormatTests
{
    private static readonly DateOnly Date = new(2026, 9, 5);

    [Fact]
    public void SeriesTellsVoucherTypesApart()
    {
        // Same prefix and pattern on two voucher types: identical numbers.
        Assert.Equal(VoucherNumberFormat.Series(VoucherCatalog.DefaultPattern, "PXK"), VoucherNumberFormat.Series(VoucherCatalog.DefaultPattern, "PXK"));
        // A pattern without {PREFIX} that spells the same text clashes too.
        Assert.Equal(VoucherNumberFormat.Series("PXK-{YYYY}{MM}-{SEQ}", "XX"), VoucherNumberFormat.Series(VoucherCatalog.DefaultPattern, "PXK"));
        Assert.NotEqual(VoucherNumberFormat.Series(VoucherCatalog.DefaultPattern, "PXK"), VoucherNumberFormat.Series(VoucherCatalog.DefaultPattern, "PXDC"));
    }

    [Fact]
    public void FormatsEveryToken()
    {
        Assert.Equal("PNK-202609-0007", VoucherNumberFormat.Format(VoucherCatalog.DefaultPattern, "PNK", 4, "DVCS01", Date, 7));
        Assert.Equal("DVCS01/PT/26/05/12", VoucherNumberFormat.Format("{DVCS}/{PREFIX}/{YY}/{DD}/{SEQ}", "PT", 2, "DVCS01", Date, 12));
    }

    [Theory]
    [InlineData("{PREFIX}{YYYY}{MM}{DD}{SEQ}", "20260905")]
    [InlineData("{PREFIX}-{MM}-{SEQ}", "202609")]
    [InlineData("{PREFIX}-{YY}-{SEQ}", "2026")]
    [InlineData("{PREFIX}-{SEQ}", "ALL")]
    public void SequenceRestartsWithTheDatePartOfThePattern(string pattern, string periodKey) =>
        Assert.Equal(periodKey, VoucherNumberFormat.PeriodKey(pattern, Date));

    [Theory]
    [InlineData("{PREFIX}-{YYYY}", "PNK", 4)]          // no {SEQ}
    [InlineData("{PREFIX}-{WEEK}-{SEQ}", "PNK", 4)]    // unknown token
    [InlineData("{PREFIX}-{SEQ}", "PNK", 0)]           // digits out of range
    [InlineData("{PREFIX}-{SEQ}", "P NK", 4)]          // space in prefix
    public void RejectsInvalidRules(string pattern, string prefix, int digits) =>
        Assert.Throws<BusinessRuleException>(() => VoucherNumberFormat.Validate(pattern, prefix, digits));

    [Fact]
    public void CatalogVouchersAreKnownFunctionsWithUniqueTypes()
    {
        Assert.All(VoucherCatalog.All, v => Assert.True(FunctionCatalog.IsFunction(v.Function), v.Function));
        Assert.Equal(VoucherCatalog.All.Count, VoucherCatalog.All.Select(v => v.VoucherType).Distinct().Count());
        Assert.Equal(VoucherCatalog.All.Count, VoucherCatalog.All.Select(v => v.Function).Distinct().Count());
    }

    [Fact]
    public void EveryVoucherHasTheVoucherSpecialRights() =>
        Assert.All(VoucherCatalog.All, v => Assert.Contains(SpecialRightCatalog.Key(v.Function, SpecialRightCatalog.Post), SpecialRightCatalog.Keys));
}
