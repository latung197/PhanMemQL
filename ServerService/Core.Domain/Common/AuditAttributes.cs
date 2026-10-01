namespace Core.Domain.Common;

// Change log declarations (sys_audit_log). Every entity says either [Audited] or [NotAudited]; the test
// EveryEntityDeclaresItsChangeLog fails otherwise, so a new table cannot be forgotten.
// Audited entities are logged automatically when CoreContext saves them (insert, update, delete), comparing each
// column before and after. Changes made with raw SQL or ExecuteUpdate / ExecuteDelete bypass that and must be
// logged by hand with IAuditLog.

/// <summary>
/// Changes of this entity are logged automatically under <see cref="Function"/> (the function whose screen manages
/// it) as object <see cref="ObjectType"/>. Field names are the camelCase property names unless renamed with
/// <see cref="AuditFieldAttribute"/>; audit columns (createtime, updateid...) are never logged.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class AuditedAttribute(string function, string objectType) : Attribute
{
    public string Function { get; } = function;
    public string ObjectType { get; } = objectType;

    /// <summary>Readable name of a record, e.g. "{FullName} (@{UserName})"; property names in braces.</summary>
    public string? Label { get; init; }

    /// <summary>
    /// Soft delete flag: setting this property to 0 / false is logged as DELETE (with the record's values) rather
    /// than as an update of the flag.
    /// </summary>
    public string? SoftDelete { get; init; }
}

/// <summary>Not logged automatically; the reason says where its changes are logged instead, or why they are not.</summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class NotAuditedAttribute(string reason) : Attribute
{
    public string Reason { get; } = reason;
}

/// <summary>The property is never logged (secrets, personal preferences, copies of other columns, technical values).</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class AuditIgnoreAttribute : Attribute;

/// <summary>Logs the property under another field name (e.g. legacy column names: MaDvcs → "defaultUnit").</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class AuditFieldAttribute(string name) : Attribute
{
    public string Name { get; } = name;
}

/// <summary>The property holds a JSON object: each changed value inside it is logged as its own field ("a.b").</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class AuditJsonAttribute : Attribute;

/// <summary>
/// Rows of this entity are a list on a parent record (e.g. the units of a user): adding or removing rows is logged
/// on the parent as one field, the list of <see cref="ValueProperty"/> before and after. The service must load every
/// row of the parent before changing them (the list is computed from the tracked rows).
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class AuditedChildAttribute(Type parent, string parentKeyProperty, string field, string valueProperty) : Attribute
{
    public Type Parent { get; } = parent;
    public string ParentKeyProperty { get; } = parentKeyProperty;
    public string Field { get; } = field;
    public string ValueProperty { get; } = valueProperty;
}
