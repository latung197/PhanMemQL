using Core.Infrastructure.Common.Persistence.Sql;
using Xunit;

namespace Core.Tests.Common;

public sealed class SqlScriptsTests
{
    [Fact]
    public void LoadsEmbeddedModuleScript()
    {
        var sql = SqlScripts.Get(typeof(SqlScriptsTests).Assembly, "Sample", "Echo");
        Assert.Contains("@value", sql);
    }

    [Fact]
    public void MissingScriptExplainsExpectedPath()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            SqlScripts.Get(typeof(SqlScriptsTests).Assembly, "Sample", "Missing"));
        Assert.Contains("Modules/Sample/Sql/Missing.sql", error.Message);
    }

    [Fact]
    public void LoadsGoodsReceiptPostingScript()
    {
        var sql = SqlScripts.Get("Inventory.Documents.GoodsReceipts", "PostReceipt");
        Assert.Contains("erp_stock_movement", sql);
        Assert.Contains("@receiptId", sql);
    }
}
