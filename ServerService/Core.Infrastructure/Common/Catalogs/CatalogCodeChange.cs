using System.ComponentModel.DataAnnotations;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.References;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Catalogs;

/// <summary>
/// Đổi mã / gộp mã: rewrites every column of other tables that holds a code of a catalog, using the declared references
/// (<see cref="TableReferences"/>; the database has no foreign keys, so this is the complete list). Table and column names come from
/// the model only; the codes are parameters. The cache is kept in step by the CacheInvalidationInterceptor (it scans every command).
/// </summary>
public static class CatalogCodeChange
{
    /// <summary>How many rows of each referencing table hold <paramref name="code"/> (exact, including translations).</summary>
    public static async Task<IReadOnlyList<(string Table, long Count)>> CountsAsync(CoreContext db, string table, string code, CancellationToken ct)
    {
        var counts = new List<(string, long)>();
        foreach (var reference in db.References().PointingTo(table))
        {
            var sql = string.Concat("SELECT count(*)::bigint AS \"Value\" FROM \"", reference.Table, "\" WHERE \"", reference.Column, "\" = {0}");
            counts.Add((reference.Table, await db.Database.SqlQueryRaw<long>(sql, code).SingleAsync(ct)));
        }
        return counts;
    }

    /// <summary>
    /// Points every column that held <paramref name="from"/> at <paramref name="to"/> and returns the rows changed. A merge deletes the
    /// translation rows of the merged code instead (the target keeps its own; moving them would break the unique key of the language).
    /// </summary>
    public static async Task<long> RewriteAsync(CoreContext db, string table, string from, string to, bool merge, CancellationToken ct)
    {
        long total = 0;
        foreach (var reference in db.References().PointingTo(table))
        {
            var sql = merge && !reference.BlocksDelete
                ? string.Concat("DELETE FROM \"", reference.Table, "\" WHERE \"", reference.Column, "\" = {0}")
                : string.Concat("UPDATE \"", reference.Table, "\" SET \"", reference.Column, "\" = {1} WHERE \"", reference.Column, "\" = {0}");
            total += await db.Database.ExecuteSqlRawAsync(sql, [from, to], ct);
        }
        return total;
    }

    /// <summary>Adds a sentence to the record's Note (when it has one), cut to the column length.</summary>
    public static void AppendNote(object row, string text)
    {
        var property = row.GetType().GetProperty("Note");
        if (property is null || property.PropertyType != typeof(string)) return;
        var current = (property.GetValue(row) as string)?.Trim();
        var joined = string.IsNullOrEmpty(current) ? text : $"{current} {text}";
        var max = property.GetCustomAttributes(typeof(MaxLengthAttribute), true).OfType<MaxLengthAttribute>().FirstOrDefault()?.Length ?? int.MaxValue;
        property.SetValue(row, joined.Length <= max ? joined : joined[^max..]);
    }
}
