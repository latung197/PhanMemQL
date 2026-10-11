using Core.Application.Modules.Inventory.Stock;
using Core.Infrastructure.Common.Persistence.Sql;
using Xunit;

namespace Core.Tests.Common;

public sealed class StockLedgerTests
{
    [Theory]
    [InlineData(10, 1, 10)]
    [InlineData(5, 12, 60)]          // 5 boxes of 12
    [InlineData(3, 0.001, 0.003)]    // 3 g in kg
    [InlineData(1, 0.33333, 0.3333)] // rounded to 4 decimals
    public void ToBaseQuantityMultipliesByTheFactor(double quantity, double factor, double expected) =>
        Assert.Equal((decimal)expected, StockMath.ToBaseQuantity((decimal)quantity, (decimal)factor));

    [Fact]
    public void OutValueIsTheMovingAverage()
    {
        // 100 units worth 1,000: 40 leave at 10 each.
        Assert.Equal(400m, StockMath.OutValue(40, 100, 1000));
        // Rounded to the cent.
        Assert.Equal(333.33m, StockMath.OutValue(1, 3, 1000));
    }

    [Fact]
    public void TakingAllTheStockTakesAllTheValue()
    {
        // No rounding remainder stays behind: 3 x 333.33 would leave 0.01.
        Assert.Equal(1000m, StockMath.OutValue(3, 3, 1000));
        // More than there is (negative stock allowed): the whole value goes, the rest carries none.
        Assert.Equal(1000m, StockMath.OutValue(5, 3, 1000));
    }

    [Theory]
    [InlineData(5, 0, 0)]      // empty stock
    [InlineData(5, -2, 100)]   // negative stock
    [InlineData(0, 10, 100)]   // nothing leaves
    public void EmptyOrNegativeStockCarriesNoValue(double outQuantity, double onHand, double onHandValue) =>
        Assert.Equal(0m, StockMath.OutValue((decimal)outQuantity, (decimal)onHand, (decimal)onHandValue));

    [Theory]
    [InlineData("Verify")]
    [InlineData("RebuildBalances")]
    [InlineData("BalancesWarehouse")]
    [InlineData("BalancesLot")]
    [InlineData("BalancesLocation")]
    [InlineData("Movements")]
    public void TheStockScriptsAreEmbedded(string name)
    {
        var sql = SqlScripts.Get("Inventory.Stock", name);
        Assert.Contains("erp_stock", sql);
    }
}
