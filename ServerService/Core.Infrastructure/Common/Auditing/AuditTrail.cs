using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Core.Application.Common.Auditing;
using Core.Application.Common.Security;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Common;
using Core.Domain.Modules.SystemConfig;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Core.Infrastructure.Common.Auditing;

/// <summary>
/// The change log of one request (scoped): who is acting (user, unit, address) and the automatic log of CoreContext.
/// On SaveChanges, CoreContext calls <see cref="Collect"/> before saving (values before the change) and
/// <see cref="WriteAsync"/> after it (generated ids, values after), both in the same transaction.
/// See Core.Domain/Common/AuditAttributes.cs for what is logged.
/// </summary>
public sealed partial class AuditTrail(ICurrentUser currentUser, IHttpContextAccessor http)
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Record stamps (sys_* legacy columns, ErpEntity columns): the log's own information, never fields.</summary>
    private static readonly HashSet<string> AuditColumns =
    [
        nameof(IAuditable.CreateTime), nameof(IAuditable.CreateId), nameof(IAuditable.UpdateTime), nameof(IAuditable.UpdateId),
        nameof(AuditableEntity.Status),
        nameof(ErpEntity.CreatedAt), nameof(ErpEntity.CreatedBy), nameof(ErpEntity.UpdatedAt), nameof(ErpEntity.UpdatedBy)
    ];

    private static readonly ConcurrentDictionary<Type, TypeInfo?> Types = new();

    private (string? Username, string? Name)? _actor;
    private readonly Dictionary<object, List<AuditChange>> _attached = new(ReferenceEqualityComparer.Instance);
    /// <summary>CREATE entries of this request: later saves of the same new record (its child rows...) merge into them.</summary>
    private readonly Dictionary<(string Type, string Id), AuditLog> _created = [];

    /// <summary>Only changes of a signed-in user are logged (not the seeder or background jobs).</summary>
    public bool Enabled => currentUser.IsAuthenticated;

    public void Attach(object entity, IEnumerable<AuditChange> changes)
    {
        if (!_attached.TryGetValue(entity, out var list)) _attached[entity] = list = [];
        list.AddRange(changes);
    }

    /// <summary>A log row for the signed-in user.</summary>
    public async Task<AuditLog> NewLogAsync(DbContext db, string function, string objectType, string objectId,
        string? label, string action, IReadOnlyList<AuditChange> changes, string? note, CancellationToken ct)
    {
        int? actorId = currentUser.IsAuthenticated ? currentUser.UserId : null;
        _actor ??= actorId is null ? (null, null) : await db.Set<Domain.Modules.Users.SysUser>().AsNoTracking()
            .Where(x => x.UserId == actorId).Select(x => new ValueTuple<string?, string?>(x.UserName, x.FullName))
            .FirstOrDefaultAsync(ct);
        return new AuditLog
        {
            LogTime = DateTime.Now,
            FunctionCode = function,
            ObjectType = objectType,
            ObjectId = Cut(objectId, 64)!,
            ObjectLabel = Cut(label, 300),
            Action = action,
            Changes = JsonSerializer.Serialize(changes, Json),
            Note = Cut(note, 1000),
            ActorId = actorId,
            ActorUsername = _actor.Value.Username,
            ActorName = _actor.Value.Name,
            UnitCode = actorId is null ? null : Cut(currentUser.UnitCode, 20),
            IpAddress = Cut(http.HttpContext?.Connection.RemoteIpAddress?.ToString(), 64)
        };
    }

    // ------------------------------------------------------------------ automatic log

    /// <summary>A record to log after the save.</summary>
    internal sealed class Pending
    {
        public required EntityEntry Entry { get; init; }
        public required TypeInfo Info { get; init; }
        public required string Action { get; init; }
        /// <summary>Changes known before the save (updates, deletes); inserts are read after it.</summary>
        public List<AuditChange> Changes { get; } = [];
        /// <summary>Values of a deleted record (gone from the tracker after the save).</summary>
        public Dictionary<string, object?>? Original { get; init; }
    }

    /// <summary>Rows added to / removed from a list on a parent record (AuditedChild).</summary>
    internal sealed record ChildChange(TypeInfo Parent, object ParentKey, string Field, List<string> Before, List<string> After);

    internal sealed record Batch(List<Pending> Records, List<ChildChange> Children)
    {
        public bool IsEmpty => Records.Count == 0 && Children.Count == 0;
    }

    /// <summary>Reads what is about to change. Call before saving.</summary>
    internal Batch Collect(ChangeTracker tracker)
    {
        tracker.DetectChanges();
        var records = new List<Pending>();
        var children = new List<ChildChange>();
        var entries = tracker.Entries().ToList();

        foreach (var entry in entries)
        {
            var info = InfoOf(entry.Metadata);
            if (info?.Audited is null) continue;
            var attached = _attached.ContainsKey(entry.Entity);
            switch (entry.State)
            {
                case EntityState.Added:
                    records.Add(new Pending { Entry = entry, Info = info, Action = AuditActions.Create });
                    break;
                case EntityState.Deleted:
                    records.Add(Deleted(entry, info, AuditActions.Delete));
                    break;
                case EntityState.Modified when info.SoftDelete is { } flag && IsSoftDeleted(entry.Property(flag.Name)):
                    records.Add(Deleted(entry, info, AuditActions.Delete));
                    break;
                case EntityState.Modified:
                    var pending = new Pending { Entry = entry, Info = info, Action = AuditActions.Update };
                    foreach (var property in info.Fields)
                    {
                        var p = entry.Property(property.Name);
                        if (p.IsModified) AddField(pending.Changes, property, p.OriginalValue, p.CurrentValue);
                    }
                    if (pending.Changes.Count > 0 || attached) records.Add(pending);
                    break;
                case EntityState.Unchanged when attached:
                    records.Add(new Pending { Entry = entry, Info = info, Action = AuditActions.Update });
                    break;
            }
        }

        // Child rows: one list field per parent, from every tracked row of that parent.
        foreach (var group in entries.Where(e => InfoOf(e.Metadata)?.Child is not null)
                     .GroupBy(e => (Info: InfoOf(e.Metadata)!, Key: e.Property(InfoOf(e.Metadata)!.Child!.ParentKeyProperty).CurrentValue)))
        {
            if (!group.Any(e => e.State is EntityState.Added or EntityState.Deleted)) continue;
            var child = group.Key.Info.Child!;
            var parent = tracker.Context.Model.FindEntityType(child.Parent) is { } parentType ? InfoOf(parentType) : null;
            if (parent?.Audited is null || group.Key.Key is null) continue;
            string? Value(EntityEntry e) => AuditDiff.Format(e.Property(child.ValueProperty).CurrentValue);
            var before = group.Where(e => e.State is EntityState.Unchanged or EntityState.Modified or EntityState.Deleted)
                .Select(Value).OfType<string>().Order(StringComparer.Ordinal).ToList();
            var after = group.Where(e => e.State is EntityState.Unchanged or EntityState.Modified or EntityState.Added)
                .Select(Value).OfType<string>().Order(StringComparer.Ordinal).ToList();
            if (!before.SequenceEqual(after)) children.Add(new ChildChange(parent, group.Key.Key, child.Field, before, after));
        }
        return new Batch(records, children);
    }

    /// <summary>Adds the log rows of a saved batch to the context (the caller saves them in the same transaction).</summary>
    internal async Task WriteAsync(DbContext db, Batch batch, CancellationToken ct)
    {
        var logs = new List<(Pending? Record, TypeInfo Info, string Id, string? Label, string Action, List<AuditChange> Changes, object? Entity)>();
        foreach (var record in batch.Records)
        {
            var values = record.Original ?? Current(record.Entry);
            if (record.Action == AuditActions.Create && record.Original is null)
                foreach (var property in record.Info.Fields.Where(p => !p.Generated))
                    AddField(record.Changes, property, null, values.GetValueOrDefault(property.Name));
            if (_attached.Remove(record.Entry.Entity, out var extra)) record.Changes.AddRange(extra);
            logs.Add((record, record.Info, IdOf(record.Info, values), LabelOf(record.Info, values), record.Action, record.Changes,
                record.Entry.Entity));
        }

        foreach (var child in batch.Children)
        {
            var change = new AuditChange(child.Field, AuditDiff.Format(child.Before), AuditDiff.Format(child.After));
            var keyName = child.Parent.Keys.Single();
            var parentEntry = db.ChangeTracker.Entries()
                .FirstOrDefault(e => e.Metadata.ClrType == child.Parent.Type && Equals(e.Property(keyName).CurrentValue, child.ParentKey));
            var existing = logs.FindIndex(l => l.Info == child.Parent && l.Entity is not null && ReferenceEquals(l.Entity, parentEntry?.Entity));
            if (existing >= 0) logs[existing].Changes.Add(change);
            else
            {
                var values = parentEntry is null ? null : Current(parentEntry);
                logs.Add((null, child.Parent, values is null ? AuditDiff.Format(child.ParentKey)! : IdOf(child.Parent, values),
                    values is null ? null : LabelOf(child.Parent, values), AuditActions.Update, [change], parentEntry?.Entity));
            }
        }

        foreach (var log in logs)
        {
            var function = FunctionOf(log.Info, log.Entity);
            var type = log.Info.Audited!.ObjectType;
            if (log.Action == AuditActions.Update && _created.TryGetValue((type, log.Id), out var created))
            {
                Merge(created, log.Changes);
                continue;
            }
            if (log.Action == AuditActions.Update && log.Changes.Count == 0) continue;
            var row = await NewLogAsync(db, function, type, log.Id, log.Label, log.Action, log.Changes, null, ct);
            db.Add(row);
            if (log.Action == AuditActions.Create) _created[(type, log.Id)] = row;
        }
    }

    /// <summary>Later changes of a record created in this request become part of its CREATE entry.</summary>
    private static void Merge(AuditLog created, IEnumerable<AuditChange> changes)
    {
        var list = JsonSerializer.Deserialize<List<AuditChange>>(created.Changes, Json) ?? [];
        foreach (var change in changes)
        {
            var at = list.FindIndex(c => c.Field == change.Field);
            var merged = new AuditChange(change.Field, null, change.After);
            if (at >= 0) list[at] = merged; else list.Add(merged);
        }
        created.Changes = JsonSerializer.Serialize(list.Where(c => c.After is not null).ToList(), Json);
    }

    private static Pending Deleted(EntityEntry entry, TypeInfo info, string action)
    {
        var original = info.All.ToDictionary(p => p.Name, p => entry.Property(p.Name).OriginalValue);
        var pending = new Pending { Entry = entry, Info = info, Action = action, Original = original };
        // A generated id is the object id already, not a field.
        foreach (var property in info.Fields.Where(p => !p.Generated)) AddField(pending.Changes, property, original[property.Name], null);
        return pending;
    }

    private static bool IsSoftDeleted(PropertyEntry flag) =>
        flag.IsModified && IsActiveValue(flag.OriginalValue) && !IsActiveValue(flag.CurrentValue);

    private static bool IsActiveValue(object? value) => value switch
    {
        null => false,
        bool b => b,
        string s => s is not ("" or "0"),
        IConvertible c => c.ToDecimal(null) != 0,
        _ => true
    };

    private static void AddField(List<AuditChange> changes, FieldInfo property, object? before, object? after)
    {
        if (property.Json)
        {
            var b = FlattenJson(before as string);
            var a = FlattenJson(after as string);
            foreach (var key in b.Keys.Union(a.Keys).Order(StringComparer.Ordinal))
            {
                var (vb, va) = (b.GetValueOrDefault(key), a.GetValueOrDefault(key));
                if (vb != va) changes.Add(new AuditChange(key, vb, va));
            }
            return;
        }
        var (fb, fa) = (AuditDiff.Format(before), AuditDiff.Format(after));
        if (fb != fa) changes.Add(new AuditChange(property.Field, fb, fa));
    }

    /// <summary>{"a":{"b":1},"c":[1,2]} → a.b = "1", c = "[1,2]".</summary>
    private static Dictionary<string, string?> FlattenJson(string? json)
    {
        var result = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(json)) return result;
        try
        {
            using var doc = JsonDocument.Parse(json);
            void Walk(JsonElement e, string path)
            {
                if (e.ValueKind == JsonValueKind.Object && e.EnumerateObject().Any())
                    foreach (var p in e.EnumerateObject()) Walk(p.Value, path.Length == 0 ? p.Name : $"{path}.{p.Name}");
                else
                    result[path.Length == 0 ? "value" : path] = e.ValueKind switch
                    {
                        JsonValueKind.Null or JsonValueKind.Undefined => null,
                        JsonValueKind.String => e.GetString() is { Length: > 0 } s ? s : null,
                        JsonValueKind.True => "true",
                        JsonValueKind.False => "false",
                        _ => e.GetRawText()
                    };
            }
            Walk(doc.RootElement, "");
        }
        catch (JsonException)
        {
            result["value"] = json;
        }
        return result;
    }

    private static Dictionary<string, object?> Current(EntityEntry entry) =>
        InfoOf(entry.Metadata)!.All.ToDictionary(p => p.Name, p => entry.Property(p.Name).CurrentValue);

    private static string IdOf(TypeInfo info, IReadOnlyDictionary<string, object?> values) =>
        string.Join(':', info.Keys.Select(k => AuditDiff.Format(values.GetValueOrDefault(k)) ?? ""));

    private static string? LabelOf(TypeInfo info, IReadOnlyDictionary<string, object?> values) =>
        info.Audited!.Label is not { } template ? null
            : Placeholder().Replace(template, m => AuditDiff.Format(values.GetValueOrDefault(m.Groups[1].Value)) ?? "");

    /// <summary>The function of a record: the entity's own, or per record where one table serves several screens.</summary>
    private static string FunctionOf(TypeInfo info, object? entity) => entity switch
    {
        SystemSetting s => SystemConfigSections.Keys.FirstOrDefault(k => k.Value == s.Key) is { Key: { } section }
            && SystemConfigSections.Functions.TryGetValue(section, out var function) ? function : info.Audited!.Function,
        _ => info.Audited!.Function
    };

    private static string? Cut(string? value, int max) =>
        string.IsNullOrEmpty(value) ? null : value.Length <= max ? value : value[..max];

    [GeneratedRegex(@"\{(\w+)\}")]
    private static partial Regex Placeholder();

    // ------------------------------------------------------------------ metadata

    internal sealed record FieldInfo(string Name, string Field, bool Json, bool Generated);

    internal sealed class TypeInfo
    {
        public required Type Type { get; init; }
        public AuditedAttribute? Audited { get; init; }
        public AuditedChildAttribute? Child { get; init; }
        /// <summary>Logged properties.</summary>
        public required List<FieldInfo> Fields { get; init; }
        /// <summary>Every mapped property (for ids and labels).</summary>
        public required List<FieldInfo> All { get; init; }
        /// <summary>Primary key properties.</summary>
        public required List<string> Keys { get; init; }
        public FieldInfo? SoftDelete { get; init; }
    }

    /// <summary>What is logged for an entity type, from its attributes and the EF model (null when it is not logged).</summary>
    internal static TypeInfo? InfoOf(IEntityType entityType) => Types.GetOrAdd(entityType.ClrType, t =>
    {
        var audited = t.GetCustomAttribute<AuditedAttribute>();
        var child = t.GetCustomAttribute<AuditedChildAttribute>();
        if (audited is null && child is null) return null;
        var properties = entityType.GetProperties().Where(p => !p.IsShadowProperty() && p.PropertyInfo is not null).ToList();
        FieldInfo Info(IProperty p) => new(p.Name, p.PropertyInfo!.GetCustomAttribute<AuditFieldAttribute>()?.Name ?? CamelCase(p.Name),
            p.PropertyInfo!.GetCustomAttribute<AuditJsonAttribute>() is not null,
            p.IsPrimaryKey() && p.ValueGenerated != ValueGenerated.Never);
        var all = properties.Select(Info).ToList();
        return new TypeInfo
        {
            Type = t,
            Audited = audited,
            Child = child,
            All = all,
            Keys = entityType.FindPrimaryKey()?.Properties.Select(p => p.Name).ToList() ?? [],
            Fields = properties.Where(p => p.PropertyInfo!.GetCustomAttribute<AuditIgnoreAttribute>() is null && !AuditColumns.Contains(p.Name))
                .Select(Info).ToList(),
            SoftDelete = audited?.SoftDelete is { } flag ? all.Single(p => p.Name == flag) : null
        };
    });

    private static string CamelCase(string name) => name.Length == 0 ? name : char.ToLowerInvariant(name[0]) + name[1..];
}
