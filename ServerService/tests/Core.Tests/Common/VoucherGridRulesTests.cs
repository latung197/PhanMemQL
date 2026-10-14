using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.VoucherGrids;
using Xunit;

namespace Core.Tests.Common;

/// <summary>The rules of the shared voucher grids (sys_voucher_grid) and the seed file the grids start from.</summary>
public sealed class VoucherGridRulesTests
{
    private static VoucherGridColumnDto Column(string field, string type = "text", bool locked = false) =>
        new(field, field, null, type, 100, 80, "left", null, locked, false, true, locked, null, null, 10);

    private static readonly IReadOnlyList<VoucherGridColumnDto> Current = [Column("sku", locked: true), Column("name"), Column("quantity", "quantity", true), Column("note")];

    private static SaveVoucherGridColumn Save(string field, bool visible = true, int? width = 120, int? decimals = null, string? header = null) =>
        new(field, header ?? field, null, width, null, decimals, visible);

    private static SaveVoucherGridRequest Request(int pin = 2, params SaveVoucherGridColumn[] columns) =>
        new(pin, columns.Length > 0 ? columns : [Save("sku"), Save("name"), Save("quantity"), Save("note")]);

    private static string KeyOf(Action action) => Assert.Throws<BusinessRuleException>(action).Key;

    [Fact]
    public void ReorderingRetitlingResizingAndPinningIsAllowed() =>
        VoucherGridRules.Validate(Request(2, Save("name"), Save("sku"), Save("note", false), Save("quantity", decimals: 2, header: "Số lượng")), Current);

    [Fact]
    public void EveryColumnMustBeThereExactlyOnce()
    {
        Assert.Equal("voucherGrid.columnsMismatch", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku"), Save("name")), Current)));
        Assert.Equal("voucherGrid.columnsMismatch", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku"), Save("sku"), Save("quantity"), Save("note")), Current)));
        Assert.Equal("voucherGrid.columnsMismatch", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku"), Save("name"), Save("quantity"), Save("other")), Current)));
    }

    [Fact]
    public void ARequiredColumnCannotBeHidden() =>
        Assert.Equal("voucherGrid.cannotHide", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku"), Save("name"), Save("quantity", false), Save("note")), Current)));

    [Fact]
    public void HeaderWidthAndDecimalsAreChecked()
    {
        Assert.Equal("voucherGrid.headerInvalid", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku", header: " "), Save("name"), Save("quantity"), Save("note")), Current)));
        Assert.Equal("voucherGrid.widthInvalid", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku", width: 10), Save("name"), Save("quantity"), Save("note")), Current)));
        Assert.Equal("voucherGrid.widthInvalid", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku", width: 801), Save("name"), Save("quantity"), Save("note")), Current)));
        Assert.Equal("voucherGrid.decimalsInvalid", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku"), Save("name", decimals: 2), Save("quantity"), Save("note")), Current)));
        Assert.Equal("voucherGrid.decimalsInvalid", KeyOf(() => VoucherGridRules.Validate(Request(0, Save("sku"), Save("name"), Save("quantity", decimals: 9), Save("note")), Current)));
    }

    [Fact]
    public void PinnedColumnsAreLimitedAndCannotExceedTheVisibleOnes()
    {
        Assert.Equal("voucherGrid.pinInvalid", KeyOf(() => VoucherGridRules.Validate(Request(-1), Current)));
        Assert.Equal("voucherGrid.pinInvalid", KeyOf(() => VoucherGridRules.Validate(Request(VoucherGridRules.MaxPinned + 1), Current)));
        // four columns, two hidden: at most two may be pinned
        Assert.Equal("voucherGrid.pinInvalid", KeyOf(() => VoucherGridRules.Validate(Request(3, Save("sku"), Save("name", false), Save("quantity"), Save("note", false)), Current)));
        VoucherGridRules.Validate(Request(2, Save("sku"), Save("name", false), Save("quantity"), Save("note", false)), Current);
    }

    /// <summary>The file the seeder reads: every grid has its columns, the fields of a grid are unique and each tab is named once per voucher.</summary>
    [Fact]
    public void TheSeedFileIsConsistent()
    {
        var dir = AppContext.BaseDirectory;
        while (dir is not null && !File.Exists(Path.Combine(dir, "Core", "SeedData", "voucher-grids.json"))) dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(dir!, "Core", "SeedData", "voucher-grids.json")));
        var grids = document.RootElement.EnumerateArray().ToList();
        Assert.NotEmpty(grids);
        Assert.Equal(grids.Count, grids.Select(g => g.GetProperty("code").GetString()).Distinct().Count());
        Assert.Equal(grids.Count, grids.Select(g => (g.GetProperty("voucherType").GetString(), g.GetProperty("tabKey").GetString())).Distinct().Count());
        foreach (var grid in grids)
        {
            var columns = grid.GetProperty("columns").EnumerateArray().ToList();
            Assert.NotEmpty(columns);
            Assert.Equal(columns.Count, columns.Select(c => c.GetProperty("field").GetString()).Distinct().Count());
            Assert.All(columns, c => Assert.False(string.IsNullOrWhiteSpace(c.GetProperty("header").GetString())));
        }
    }
}
