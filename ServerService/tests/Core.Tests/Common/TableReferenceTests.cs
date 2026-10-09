using System.Text.RegularExpressions;
using Core.Application.Common.Localization;
using Core.Domain.Common;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.References;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// The declared references between tables ([References] / [NotReference], docs/tham-chieu-danh-muc.md): a new *_code
/// column cannot be forgotten, every reference points to a catalog code and is indexed, and the tables are named in messages.
/// </summary>
public sealed class TableReferenceTests
{
    private static CoreContext CreateContext() => new(new DbContextOptionsBuilder<CoreContext>()
        .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);

    /// <summary>Columns called *_code whose name does not repeat the target table (the company unit is "unit" everywhere).</summary>
    private static readonly HashSet<string> LegacyNames = new(StringComparer.Ordinal) { "unit_code" };

    [Fact]
    public void EveryCodeColumnSaysWhatItPointsTo()
    {
        using var db = CreateContext();
        var missing = db.Model.GetEntityTypes()
            .SelectMany(e => e.GetProperties().Where(p => p.GetColumnName().EndsWith("_code", StringComparison.Ordinal)
                    && p.PropertyInfo is { } info
                    && info.GetCustomAttributes(typeof(ReferencesAttribute), false).Length == 0
                    && info.GetCustomAttributes(typeof(NotReferenceAttribute), false).Length == 0)
                .Select(p => $"{e.GetTableName()}.{p.GetColumnName()}"))
            .ToList();
        Assert.True(missing.Count == 0,
            "A *_code column must say [References<TheCatalog>] or [NotReference(\"reason\")]: " + string.Join(", ", missing));
    }

    [Fact]
    public void EveryReferenceTargetsTheCodeOfAnotherTable()
    {
        using var db = CreateContext();
        var references = db.References().All;
        Assert.NotEmpty(references);
        Assert.All(references, r =>
        {
            Assert.Equal("code", r.RefColumn);
            Assert.NotEqual(r.Table, r.RefTable);
        });
    }

    [Fact]
    public void ColumnNamesEndWithTheNameOfTheirTargetTable()
    {
        using var db = CreateContext();
        var wrong = db.References().All
            .Where(r => !LegacyNames.Contains(r.Column))
            .Where(r => !r.Column.EndsWith(Regex.Replace(r.RefTable, "^(sys|erp)_", "") + "_code", StringComparison.Ordinal))
            .Select(r => $"{r.Table}.{r.Column} -> {r.RefTable}")
            .ToList();
        Assert.True(wrong.Count == 0, "Name a reference column <target table without erp_/sys_>_code (a role prefix is fine: from_uom_code): "
            + string.Join(", ", wrong));
    }

    [Fact]
    public void TheDeclaredMapIsWhatTheCatalogsRelyOn()
    {
        using var db = CreateContext();
        var references = db.References();
        Assert.Contains(references.PointingTo("erp_uom"), r => r is { Table: "erp_uom_conversion", Column: "from_uom_code", BlocksDelete: true });
        Assert.Contains(references.PointingTo("erp_uom"), r => r is { Table: "erp_uom_conversion", Column: "to_uom_code", BlocksDelete: true });
        // Translations are deleted with their catalog row, so they never keep it in use.
        Assert.Contains(references.PointingTo("erp_uom"), r => r is { Table: "erp_uom_translation", BlocksDelete: false });
        Assert.Contains(references.PointingTo("erp_warehouse"), r => r is { Table: "erp_goods_receipt", Column: "warehouse_code" });
        Assert.Contains(references.PointingTo("erp_warehouse_type"), r => r is { Table: "erp_warehouse", Optional: true });
    }

    [Fact]
    public void TablesThatKeepARowInUseHaveAMessageLabel()
    {
        using var db = CreateContext();
        var tables = db.References().All.Where(r => r.BlocksDelete).Select(r => r.Table).Distinct();
        var missing = tables.Where(t => Messages.Find("vi", $"table.{t}") is null || Messages.Find("en", $"table.{t}") is null).ToList();
        Assert.True(missing.Count == 0, "Add table.<name> to Messages.vi.json and Messages.en.json: " + string.Join(", ", missing));
    }

    [Fact]
    public void EveryReferenceColumnIsIndexed()
    {
        using var db = CreateContext();
        var scripts = SqlText();
        // Only columns that keep a row in use are looked up when deleting (owned child rows go with their parent).
        var unindexed = db.References().All.Where(r => r.BlocksDelete)
            .Where(r => !IsIndexed(scripts, r.Table, r.Column))
            .Select(r => $"{r.Table}.{r.Column}")
            .ToList();
        Assert.True(unindexed.Count == 0,
            "Deleting a catalog row looks the code up in these columns, so each needs an index (sql/postgresql/24-table-ref.sql): "
            + string.Join(", ", unindexed));
    }

    // ---- SQL script reading ------------------------------------------------------------------------------------------

    private static string SqlText()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, "sql", "postgresql");
            if (Directory.Exists(path))
                return string.Join("\n", Directory.GetFiles(path, "*.sql").OrderBy(x => x).Select(File.ReadAllText));
        }
        throw new DirectoryNotFoundException("sql/postgresql not found above " + AppContext.BaseDirectory);
    }

    /// <summary>The column starts an index (or the primary key / a unique constraint) of the table in the scripts.</summary>
    private static bool IsIndexed(string scripts, string table, string column)
    {
        var name = Regex.Escape(table);
        // CREATE [UNIQUE] INDEX ... ON table [USING x] (column, ...)
        foreach (Match m in Regex.Matches(scripts, $@"ON\s+(?:public\.)?{name}\s*(?:USING\s+\w+\s*)?\(\s*([^)]*)\)", RegexOptions.IgnoreCase))
            if (FirstColumn(m.Groups[1].Value) == column) return true;
        // CREATE TABLE table ( ... PRIMARY KEY (column, ...) | UNIQUE (column, ...) | column ... PRIMARY KEY ... );
        foreach (Match m in Regex.Matches(scripts, $@"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?{name}\s*\((.*?)\n\s*\)\s*;", RegexOptions.IgnoreCase | RegexOptions.Singleline))
        {
            var body = m.Groups[1].Value;
            foreach (Match key in Regex.Matches(body, @"(?:PRIMARY\s+KEY|UNIQUE)\s*\(\s*([^)]*)\)", RegexOptions.IgnoreCase))
                if (FirstColumn(key.Groups[1].Value) == column) return true;
            if (Regex.IsMatch(body, $@"^\s*{Regex.Escape(column)}\s+[^,\n]*(?:PRIMARY\s+KEY|UNIQUE)", RegexOptions.IgnoreCase | RegexOptions.Multiline)) return true;
        }
        return false;
    }

    private static string FirstColumn(string list)
    {
        var first = list.Split(',')[0].Trim().Trim('"');
        var match = Regex.Match(first, @"^(?:lower\(|coalesce\(|upper\()?\s*""?(\w+)""?");
        return match.Success ? match.Groups[1].Value : first;
    }
}
