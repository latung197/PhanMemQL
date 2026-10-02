using System.Text.Json;
using Core.Application.Common.Auditing;
using Core.Application.Modules.SystemConfig;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.AuditLogs;

/// <summary>
/// Settings › Nhật ký thay đổi (function sys_audit_log): the change log of every function (sys_audit_log), newest
/// first, e.g. ?functionCode=sys_users&amp;objectType=user&amp;actor=admin&amp;from=2026-10-01&amp;to=2026-10-31.
/// </summary>
[Route("api/audit-logs")]
public sealed class AuditLogsController(IAuditLog auditLog, ISystemConfigService config) : ApiControllerBase
{
    private const string Function = "sys_audit_log";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<AuditPage> Get([FromQuery] AuditQuery query, CancellationToken ct) => auditLog.QueryAsync(query, ct);

    /// <summary>Functions, object types and actions present in the log, for the filters of the screen.</summary>
    [HttpGet("filters"), RequirePermission(Function, PermissionAction.View)]
    public Task<AuditFilters> Filters(CancellationToken ct) => auditLog.GetFiltersAsync(ct);

    /// <summary>How long the log is kept: { retentionMonths } (0 = forever); rows older are deleted automatically.</summary>
    [HttpGet("settings"), RequirePermission(Function, PermissionAction.View)]
    public async Task<AuditLogSettings> GetSettings(CancellationToken ct)
    {
        var sections = await config.GetEffectiveAsync(CurrentUnitCode, ct);
        return new AuditLogSettings(sections.TryGetValue(AuditLogRetention.Section, out var value)
            ? AuditLogRetention.MonthsOf(value.GetRawText()) : 0);
    }

    [HttpPut("settings"), RequirePermission(Function, PermissionAction.Edit)]
    public async Task<AuditLogSettings> SaveSettings([FromBody] AuditLogSettings settings, CancellationToken ct)
    {
        await config.SaveAsync(CurrentUserId, AuditLogRetention.Section, JsonSerializer.SerializeToElement(settings,
            new JsonSerializerOptions(JsonSerializerDefaults.Web)), null, ct);
        return settings;
    }
}

public sealed record AuditLogSettings(int RetentionMonths);
