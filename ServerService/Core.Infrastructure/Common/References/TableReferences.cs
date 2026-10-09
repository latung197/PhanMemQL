using System.Collections.Concurrent;
using System.Reflection;
using System.Text.RegularExpressions;
using Core.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Core.Infrastructure.Common.References;

/// <summary>One column that holds the code of a catalog row. TableKind: catalog, translation, system (sys_*) or document.</summary>
public sealed record TableReference(string Table, string Column, string PropertyName, Type EntityType,
    string RefTable, string RefColumn, bool BlocksDelete, bool Optional, string TableKind);

/// <summary>
/// The declared references between tables, read once from the [References] attributes of the entities in the EF
/// model. The database has no foreign keys, so this is the only place that knows which table uses which catalog.
/// Table and column names come from the model only (never from a request), checked against <see cref="Identifier"/>.
/// </summary>
public sealed partial class TableReferences
{
    private static readonly ConcurrentDictionary<IModel, TableReferences> Cache = new();

    [GeneratedRegex("^[a-z][a-z0-9_]*$")] private static partial Regex Identifier();

    private readonly ILookup<string, TableReference> _byTarget;
    private readonly ILookup<Type, TableReference> _byEntity;

    private TableReferences(IReadOnlyList<TableReference> all)
    {
        All = all;
        _byTarget = all.ToLookup(x => x.RefTable, StringComparer.Ordinal);
        _byEntity = all.ToLookup(x => x.EntityType);
    }

    public IReadOnlyList<TableReference> All { get; }

    public static TableReferences Of(IModel model) => Cache.GetOrAdd(model, Build);

    /// <summary>The columns of other tables that hold a code of <paramref name="table"/>.</summary>
    public IEnumerable<TableReference> PointingTo(string table) => _byTarget[table];

    /// <summary>The reference columns of one entity (to check its codes on save).</summary>
    public IEnumerable<TableReference> OfEntity(Type entity) => _byEntity[entity];

    private static TableReferences Build(IModel model)
    {
        var targets = new HashSet<string>(StringComparer.Ordinal);
        var found = new List<(IEntityType Entity, IProperty Property, ReferencesAttribute Attribute, IEntityType Target)>();
        foreach (var entity in model.GetEntityTypes())
            foreach (var property in entity.GetProperties())
            {
                var attribute = property.PropertyInfo?.GetCustomAttribute<ReferencesAttribute>();
                if (attribute is null) continue;
                var target = model.FindEntityType(attribute.Target)
                    ?? throw new InvalidOperationException($"{entity.ClrType.Name}.{property.Name}: {attribute.Target.Name} is not an entity of the model.");
                targets.Add(target.GetTableName()!);
                found.Add((entity, property, attribute, target));
            }

        var list = new List<TableReference>();
        foreach (var (entity, property, attribute, target) in found)
        {
            var key = target.FindPrimaryKey();
            if (key is null || key.Properties.Count != 1)
                throw new InvalidOperationException($"{target.ClrType.Name} must have a single-column key to be referenced.");
            var table = entity.GetTableName()!;
            var column = property.GetColumnName();
            var refTable = target.GetTableName()!;
            var refColumn = key.Properties[0].GetColumnName();
            foreach (var name in new[] { table, column, refTable, refColumn })
                if (!Identifier().IsMatch(name)) throw new InvalidOperationException($"Unsafe identifier \"{name}\" in {entity.ClrType.Name}.");
            var kind = table.EndsWith("_translation", StringComparison.Ordinal) ? "translation"
                : targets.Contains(table) || typeof(ICatalogRecord).IsAssignableFrom(entity.ClrType) ? "catalog"
                : table.StartsWith("sys_", StringComparison.Ordinal) ? "system" : "document";
            list.Add(new TableReference(table, column, property.Name, entity.ClrType, refTable, refColumn,
                attribute.BlocksDelete, attribute.Optional, kind));
        }
        return new TableReferences(list.OrderBy(x => x.Table, StringComparer.Ordinal).ThenBy(x => x.Column, StringComparer.Ordinal).ToList());
    }
}
