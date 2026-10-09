using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.References;

/// <summary>Rows of one table that use a catalog code.</summary>
public sealed record TableUsage(string Table, long Count);

/// <summary>
/// What the declared references (<see cref="TableReferences"/>) are used for: refusing to delete a catalog row that
/// other tables still point to, and checking on save that a code exists. Catalog services get both from
/// CatalogService; other services call them directly. Identifiers come from the model only, values are parameters.
/// </summary>
public static class ReferenceChecks
{
    /// <summary>Counted up to this many rows per table; more than enough to say "in use".</summary>
    private const int CountLimit = 1000;

    public static TableReferences References(this CoreContext db) => TableReferences.Of(db.Model);

    /// <summary>Tables whose rows still hold <paramref name="code"/> of the catalog <typeparamref name="TEntity"/>, with how many.</summary>
    public static async Task<IReadOnlyList<TableUsage>> UsagesAsync<TEntity>(this CoreContext db, string code, CancellationToken ct)
        where TEntity : class
    {
        var table = db.Model.FindEntityType(typeof(TEntity))?.GetTableName()
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name} is not an entity of the model.");
        var usages = new List<TableUsage>();
        foreach (var reference in db.References().PointingTo(table).Where(x => x.BlocksDelete))
        {
            var count = await db.Database.SqlQueryRaw<long>(CountSql(reference.Table, reference.Column, CountLimit), code).SingleAsync(ct);
            if (count > 0) usages.Add(new TableUsage(reference.Table, count));
        }
        return usages.GroupBy(x => x.Table).Select(g => new TableUsage(g.Key, g.Sum(x => x.Count))).ToList();
    }

    /// <summary>Throws "record.inUse" naming the tables when other data uses the record; call before deleting it.</summary>
    public static async Task EnsureNotInUseAsync<TEntity>(this CoreContext db, string code, string name, CancellationToken ct)
        where TEntity : class
    {
        var usages = await db.UsagesAsync<TEntity>(code, ct);
        if (usages.Count > 0)
            throw new BusinessRuleException("record.inUse", name, string.Join(", ", usages.Select(x => $"{TableLabel(x.Table)} ({x.Count})")));
    }

    /// <summary>
    /// Throws "ref.notFound" when a reference column of the tracked <paramref name="entity"/> holds a code that does not
    /// exist: new rows check every column, changed rows only the columns that changed (an old bad value can be saved untouched).
    /// </summary>
    public static async Task EnsureReferencesExistAsync(this CoreContext db, object entity, CancellationToken ct)
    {
        var entry = db.Entry(entity);
        foreach (var reference in db.References().OfEntity(entity.GetType()))
        {
            var property = entry.Property(reference.PropertyName);
            if (property.CurrentValue is not string value || value.Length == 0) continue;
            if (entry.State != EntityState.Added && Equals(property.OriginalValue, property.CurrentValue)) continue;
            var found = await db.Database.SqlQueryRaw<long>(CountSql(reference.RefTable, reference.RefColumn, 1), value).SingleAsync(ct);
            if (found == 0)
                throw new BusinessRuleException("ref.notFound", Messages.Find(Messages.CurrentLanguage, $"dbfield.{reference.Column}") ?? reference.Column,
                    value, TableLabel(reference.RefTable));
        }
    }

    /// <summary>
    /// Counts rows holding the parameter {0} in a column, up to <paramref name="limit"/>. The identifiers come from
    /// <see cref="TableReferences"/> (model names that passed its identifier check), never from a request; the value is a parameter.
    /// </summary>
    private static string CountSql(string table, string column, int limit) =>
        string.Concat("SELECT count(*)::bigint AS \"Value\" FROM (SELECT 1 FROM \"", table, "\" WHERE \"", column, "\" = {0} LIMIT ",
            limit.ToString(System.Globalization.CultureInfo.InvariantCulture), ") AS counted");

    /// <summary>Readable name of a table: message <c>table.{name}</c>, else the table name.</summary>
    public static string TableLabel(string table) => Messages.Find(Messages.CurrentLanguage, $"table.{table}") ?? table;
}
