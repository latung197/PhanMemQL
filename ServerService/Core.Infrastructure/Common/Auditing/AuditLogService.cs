using System.Text.Json;
using Core.Application.Common.Auditing;
using Core.Domain.Common;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Auditing;

/// <summary>Entries written by hand and reading sys_audit_log. Automatic entries: AuditTrail, called by CoreContext.</summary>
public sealed class AuditLogService(CoreContext db, AuditTrail trail) : IAuditLog
{
    private const int MaxPageSize = 200;

    public async Task RecordAsync(AuditEntry entry, CancellationToken ct = default)
    {
        if (entry.Changes.Count == 0 && entry.Action is AuditActions.Update or AuditActions.Permissions) return;
        db.AuditLogs.Add(await trail.NewLogAsync(db, entry.FunctionCode, entry.ObjectType, entry.ObjectId, entry.ObjectLabel,
            entry.Action, entry.Changes, entry.Note, ct));
    }

    public void Attach(object entity, IReadOnlyList<AuditChange> changes)
    {
        if (changes.Count > 0) trail.Attach(entity, changes);
    }

    public async Task<AuditPage> QueryAsync(AuditQuery query, CancellationToken ct = default)
    {
        var rows = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.FunctionCode)) rows = rows.Where(x => x.FunctionCode == query.FunctionCode);
        if (!string.IsNullOrWhiteSpace(query.ObjectType)) rows = rows.Where(x => x.ObjectType == query.ObjectType);
        if (!string.IsNullOrWhiteSpace(query.ObjectId)) rows = rows.Where(x => x.ObjectId == query.ObjectId);
        if (!string.IsNullOrWhiteSpace(query.Action)) rows = rows.Where(x => x.Action == query.Action);
        if (Like(query.Actor) is { } actor)
            rows = rows.Where(x => EF.Functions.ILike(x.ActorUsername ?? "", actor) || EF.Functions.ILike(x.ActorName ?? "", actor));
        if (Like(query.Search) is { } search)
            rows = rows.Where(x => EF.Functions.ILike(x.ObjectLabel ?? "", search) || EF.Functions.ILike(x.ObjectId, search));
        if (query.From is DateTime from) rows = rows.Where(x => x.LogTime >= from.Date);
        if (query.To is DateTime to) rows = rows.Where(x => x.LogTime < to.Date.AddDays(1));

        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);
        var page = Math.Max(query.Page, 1);
        var total = await rows.CountAsync(ct);
        var items = await rows.OrderByDescending(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new AuditPage(items.Select(ToDto).ToList(), total, page, pageSize);
    }

    public async Task<AuditFilters> GetFiltersAsync(CancellationToken ct = default) => new(
        await db.AuditLogs.AsNoTracking().Select(x => x.FunctionCode).Distinct().OrderBy(x => x).ToListAsync(ct),
        await db.AuditLogs.AsNoTracking().Select(x => x.ObjectType).Distinct().OrderBy(x => x).ToListAsync(ct),
        await db.AuditLogs.AsNoTracking().Select(x => x.Action).Distinct().OrderBy(x => x).ToListAsync(ct));

    private static AuditLogDto ToDto(AuditLog x) => new(x.Id.ToString(), x.LogTime, x.FunctionCode, x.ObjectType,
        x.ObjectId, x.ObjectLabel, x.Action, JsonSerializer.Deserialize<List<AuditChange>>(x.Changes, AuditTrail.Json) ?? [],
        x.Note, x.ActorId?.ToString(), x.ActorUsername, x.ActorName, x.UnitCode, x.IpAddress);

    /// <summary>ILIKE pattern "%text%" with the wildcards of the text escaped; null for an empty filter.</summary>
    private static string? Like(string? text) => string.IsNullOrWhiteSpace(text) ? null
        : "%" + text.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
