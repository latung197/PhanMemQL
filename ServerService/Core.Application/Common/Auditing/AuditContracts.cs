using Core.Domain.Modules.Users;

namespace Core.Application.Common.Auditing;

// Change log shared by every function (sys_audit_log), read on its own screen Settings › Nhật ký thay đổi (function
// sys_audit_log, GET /api/audit-logs), never on the screens of the functions.
//
// Automatic: CoreContext logs every insert / update / delete of an entity marked [Audited] (Core.Domain/Common/
// AuditAttributes.cs) when a signed-in user saves it, in the same transaction. A new function only marks its entities.
// By hand, for what EF cannot see or what needs a business meaning:
// - IAuditLog.Attach(entity, changes): extra fields on the automatic entry of that entity (e.g. names for ids);
// - IAuditLog.RecordAsync(entry): an entry of its own (PERMISSIONS, RESET_PASSWORD, APPROVE..., or a change made with
//   raw SQL / ExecuteUpdate), added before the caller's SaveChanges so it is saved with the change.

/// <summary>One changed field. Null = no value (created, removed or empty).</summary>
public sealed record AuditChange(string Field, string? Before, string? After);

/// <summary>
/// What a change was about. FunctionCode is the function whose screen made it; ObjectType + ObjectId identify the
/// record, ObjectLabel is its readable name at that time.
/// </summary>
public sealed record AuditEntry(string FunctionCode, string ObjectType, string ObjectId, string? ObjectLabel,
    string Action, IReadOnlyList<AuditChange> Changes, string? Note = null);

/// <summary>Usual actions; a function may add its own (UPPER_SNAKE_CASE, texts audit.action.* in the frontend).</summary>
public static class AuditActions
{
    public const string Create = "CREATE";
    public const string Update = "UPDATE";
    public const string Delete = "DELETE";
    /// <summary>Role, permission matrix or special rights of an account changed.</summary>
    public const string Permissions = "PERMISSIONS";
    public const string ResetPassword = "RESET_PASSWORD";
    /// <summary>
    /// Reset to exactly a role's rights: on the role (note = number of holders) and on each account whose rights
    /// changed (note = role name).
    /// </summary>
    public const string Sync = "SYNC";
    public const string ChangePassword = "CHANGE_PASSWORD";
    /// <summary>Old change-log rows deleted automatically (AuditLogCleanupService); by the system, no user.</summary>
    public const string Purge = "PURGE";
    public const string Submit = "SUBMIT";
    public const string Approve = "APPROVE";
    public const string Reject = "REJECT";
    public const string Withdraw = "WITHDRAW";
    /// <summary>Data downloaded as an Excel file (note = row count and the filter used).</summary>
    public const string Export = "EXPORT";
}

/// <summary>
/// Collects changed fields, skipping unchanged ones. Field names follow these conventions so the frontend can show
/// them without per-screen code:
/// <list type="bullet">
/// <item>plain field: camelCase name ("fullName", "isActive"); booleans are "true" / "false", lists comma-joined;</item>
/// <item><c>permission:{function}</c>: granted actions, e.g. "view,create,edit" (null = none);</item>
/// <item><c>right:{function}:{code}</c>: a special right, "true" granted / "false" not.</item>
/// </list>
/// </summary>
public sealed class AuditDiff
{
    private static readonly (string Key, Func<ActionPermissions, bool> Has)[] Actions =
    [
        ("view", a => a.View), ("create", a => a.Create), ("edit", a => a.Edit), ("delete", a => a.Delete),
        ("approve", a => a.Approve), ("print", a => a.Print), ("export", a => a.Export)
    ];

    private readonly List<AuditChange> _changes = [];

    public IReadOnlyList<AuditChange> Changes => _changes;
    public bool IsEmpty => _changes.Count == 0;

    /// <summary>Adds the field when the two values differ (empty strings count as no value).</summary>
    public AuditDiff Field(string field, object? before, object? after)
    {
        var (b, a) = (Format(before), Format(after));
        if (b != a) _changes.Add(new AuditChange(field, b, a));
        return this;
    }

    /// <summary>
    /// Every field of two snapshots (null = the record did not exist / no longer exists), e.g. a record's fields
    /// before and after an update. Fields keep the order of the snapshots.
    /// </summary>
    public AuditDiff Fields(IReadOnlyDictionary<string, object?>? before, IReadOnlyDictionary<string, object?>? after)
    {
        var keys = (before?.Keys ?? []).Concat(after?.Keys ?? []).Distinct(StringComparer.Ordinal);
        foreach (var key in keys) Field(key, before?.GetValueOrDefault(key), after?.GetValueOrDefault(key));
        return this;
    }

    /// <summary>Granted actions per function; functions missing from a side count as no rights.</summary>
    public AuditDiff Matrix(IReadOnlyDictionary<string, ActionPermissions>? before,
        IReadOnlyDictionary<string, ActionPermissions>? after)
    {
        before ??= new Dictionary<string, ActionPermissions>();
        after ??= new Dictionary<string, ActionPermissions>();
        foreach (var code in before.Keys.Union(after.Keys).Order(StringComparer.Ordinal))
            Field($"permission:{code}", ActionList(before.GetValueOrDefault(code)), ActionList(after.GetValueOrDefault(code)));
        return this;
    }

    /// <summary>Special rights "{function}:{code}" granted before / after.</summary>
    public AuditDiff Rights(IEnumerable<string>? before, IEnumerable<string>? after)
    {
        var b = new HashSet<string>(before ?? [], StringComparer.Ordinal);
        var a = new HashSet<string>(after ?? [], StringComparer.Ordinal);
        foreach (var key in b.Union(a).Order(StringComparer.Ordinal))
            Field($"right:{key}", b.Contains(key), a.Contains(key));
        return this;
    }

    /// <summary>Granted actions as "view,create,edit"; null when none.</summary>
    public static string? ActionList(ActionPermissions? actions) =>
        actions is null ? null : string.Join(',', Actions.Where(x => x.Has(actions)).Select(x => x.Key)) is { Length: > 0 } s ? s : null;

    /// <summary>
    /// How a value is written in the log: booleans "true" / "false", dates "yyyy-MM-dd" (with " HH:mm:ss" when there
    /// is a time), numbers without trailing zeros, lists comma-joined; empty strings and lists are no value.
    /// </summary>
    public static string? Format(object? value) => value switch
    {
        null => null,
        bool b => b ? "true" : "false",
        string s => s.Length == 0 ? null : s,
        DateTime d => d.ToString(d.TimeOfDay == TimeSpan.Zero ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm:ss", Invariant),
        DateOnly d => d.ToString("yyyy-MM-dd", Invariant),
        decimal d => d.ToString("0.############", Invariant),
        double d => d.ToString("0.############", Invariant),
        float d => d.ToString("0.######", Invariant),
        IEnumerable<string> list => string.Join(", ", list) is { Length: > 0 } s ? s : null,
        IFormattable f => f.ToString(null, Invariant),
        _ => value.ToString()
    };

    private static readonly System.Globalization.CultureInfo Invariant = System.Globalization.CultureInfo.InvariantCulture;
}

public interface IAuditLog
{
    /// <summary>
    /// Adds an entry for the signed-in user (name, unit and address are filled in); it is saved by the caller's next
    /// SaveChanges. An UPDATE / PERMISSIONS entry without changes is skipped.
    /// </summary>
    Task RecordAsync(AuditEntry entry, CancellationToken ct = default);

    /// <summary>
    /// Adds fields to the automatic entry of a tracked entity in the next SaveChanges (an entry is written even when
    /// none of its own columns changed). For values the entity only holds as ids, e.g. the name of an approver.
    /// </summary>
    void Attach(object entity, IReadOnlyList<AuditChange> changes);

    Task<AuditPage> QueryAsync(AuditQuery query, CancellationToken ct = default);

    /// <summary>Functions, object types and actions present in the log (choices of the screen's filters).</summary>
    Task<AuditFilters> GetFiltersAsync(CancellationToken ct = default);
}

public sealed record AuditFilters(IReadOnlyList<string> Functions, IReadOnlyList<string> ObjectTypes, IReadOnlyList<string> Actions);

/// <summary>
/// Filters of GET /api/audit-logs, all optional. Actor matches the username or name, Search the object's label or id
/// (both case-insensitive, part of the text); From / To are days, To included.
/// </summary>
public sealed record AuditQuery(string? FunctionCode, string? ObjectType, string? ObjectId, string? Action,
    string? Actor, string? Search, DateTime? From, DateTime? To, int Page = 1, int PageSize = 50);

public sealed record AuditLogDto(string Id, DateTime Time, string FunctionCode, string ObjectType, string ObjectId,
    string? ObjectLabel, string Action, IReadOnlyList<AuditChange> Changes, string? Note, string? ActorId,
    string? ActorUsername, string? ActorName, string? UnitCode, string? IpAddress);

public sealed record AuditPage(IReadOnlyList<AuditLogDto> Items, int Total, int Page, int PageSize);
