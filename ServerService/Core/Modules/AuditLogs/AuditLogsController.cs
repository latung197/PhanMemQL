using Core.Application.Common.Auditing;
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
public sealed class AuditLogsController(IAuditLog auditLog) : ApiControllerBase
{
    private const string Function = "sys_audit_log";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<AuditPage> Get([FromQuery] AuditQuery query, CancellationToken ct) => auditLog.QueryAsync(query, ct);

    /// <summary>Functions, object types and actions present in the log, for the filters of the screen.</summary>
    [HttpGet("filters"), RequirePermission(Function, PermissionAction.View)]
    public Task<AuditFilters> Filters(CancellationToken ct) => auditLog.GetFiltersAsync(ct);
}
