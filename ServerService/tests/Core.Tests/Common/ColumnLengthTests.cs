using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.References;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// The same kind of value has the same length everywhere (shared domains ud_code20, ud_code50 ... of sql/postgresql/00-helpers.sql,
/// moved onto by script 65): a column that points to a catalog is exactly as long as the code it points to, so a code that fits the
/// catalog always fits the voucher line, and a column never promises room the catalog does not have.
/// </summary>
public sealed class ColumnLengthTests
{
    private static CoreContext CreateContext() => new(new DbContextOptionsBuilder<CoreContext>()
        .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);

    [Fact]
    public void AReferenceColumnIsAsLongAsTheCodeItPointsTo()
    {
        using var db = CreateContext();
        var lengths = db.Model.GetEntityTypes()
            .Where(e => e.GetTableName() is not null)
            .ToDictionary(e => e.GetTableName()!, e => e, StringComparer.Ordinal);

        var wrong = new List<string>();
        var compared = 0;
        foreach (var r in db.References().All)
        {
            if (!lengths.TryGetValue(r.Table, out var from) || !lengths.TryGetValue(r.RefTable, out var to)) continue;
            var column = from.GetProperties().FirstOrDefault(p => p.GetColumnName() == r.Column)?.GetMaxLength();
            var target = to.GetProperties().FirstOrDefault(p => p.GetColumnName() == r.RefColumn)?.GetMaxLength();
            if (column is null || target is null) continue;
            compared++;
            if (column == target) continue;
            wrong.Add($"{r.Table}.{r.Column} ({column}) -> {r.RefTable}.{r.RefColumn} ({target})");
        }

        Assert.True(compared > 100, $"Only {compared} reference columns were compared: the test lost its input");
        Assert.True(wrong.Count == 0,
            "Give a reference column the length of the code it points to (use the matching ud_code<N> domain in the SQL script): "
            + string.Join("; ", wrong));
    }

    [Fact]
    public void TheLotNumberIsAsLongInTheCatalogAsOnEveryLine()
    {
        using var db = CreateContext();
        var lot = db.Model.GetEntityTypes().Single(e => e.GetTableName() == "erp_lot")
            .GetProperties().Single(p => p.GetColumnName() == "lot_no").GetMaxLength();
        var lines = db.Model.GetEntityTypes()
            .SelectMany(e => e.GetProperties().Where(p => p.GetColumnName() == "lot_number")
                .Select(p => (Table: e.GetTableName(), Length: p.GetMaxLength())))
            .Where(x => x.Length != lot)
            .Select(x => $"{x.Table} ({x.Length})")
            .ToList();
        Assert.True(lines.Count == 0, $"lot_number is {lot} long (erp_lot.lot_no) on every line, not on: " + string.Join(", ", lines));
    }
}
