namespace Core.Domain.Common;

// Which column points to which catalog. There are no foreign keys in the database, so these declarations are
// what the framework knows about: a catalog cannot be deleted while a table still uses its code, a save checks
// that the code exists, and Settings shows the whole map in sys_table_ref. Every column named *_code must say
// [References<T>] or [NotReference(reason)]; the test EveryCodeColumnSaysWhatItPointsTo fails otherwise.
// Guide: docs/tham-chieu-danh-muc.md.

/// <summary>Base of <see cref="ReferencesAttribute{T}"/>, so the registry can read the target without knowing T.</summary>
[AttributeUsage(AttributeTargets.Property, Inherited = false)]
public abstract class ReferencesAttribute : Attribute
{
    /// <summary>The entity whose <c>code</c> the column holds.</summary>
    public abstract Type Target { get; }

    /// <summary>
    /// True when rows of this table keep the catalog row in use: deleting it is refused and the message names the table.
    /// Set false for child rows the catalog's own service deletes with it (translations).
    /// </summary>
    public bool BlocksDelete { get; init; } = true;

    /// <summary>The column may be empty; a value is still checked on save.</summary>
    public bool Optional { get; init; }
}

/// <summary>The column holds the code of a record of <typeparamref name="T"/> (column name: <c>{table without erp_}_code</c>, with an optional role prefix).</summary>
[AttributeUsage(AttributeTargets.Property, Inherited = false)]
public sealed class ReferencesAttribute<T> : ReferencesAttribute
{
    public override Type Target => typeof(T);
}

/// <summary>A *_code column that is not a reference to a catalog (a tax code, a function code, the entity's own code...); say why.</summary>
[AttributeUsage(AttributeTargets.Property, Inherited = false)]
public sealed class NotReferenceAttribute(string reason) : Attribute
{
    public string Reason { get; } = reason;
}
