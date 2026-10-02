using System.Globalization;
using System.Text.Json;
using Core.Application.Common.Auditing;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Common;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Core.Infrastructure.Common.Auditing;

/// <summary>
/// Deletes change-log rows older than the retention set on Settings › Nhật ký thay đổi (setting section auditLog,
/// retentionMonths; 0 = keep forever). Runs a minute after start and then twice a day, in small batches so the table
/// is never locked for long, and leaves one PURGE row saying how many rows went and up to which date (PURGE rows
/// themselves are kept, so the history of deletions stays).
/// </summary>
public sealed class AuditLogCleanupService(IServiceScopeFactory scopes, ILogger<AuditLogCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(12);
    private const int BatchSize = 5000;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Dọn nhật ký thay đổi cũ thất bại; sẽ thử lại lần sau.");
            }
            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Number of rows deleted (0 when retention is off or nothing is old enough).</summary>
    public async Task<int> CleanupAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CoreContext>();
        var key = SystemConfigSections.Keys[AuditLogRetention.Section];
        var json = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == key && x.Scope == SystemSetting.GlobalScope).Select(x => x.Value).FirstOrDefaultAsync(ct);
        var months = AuditLogRetention.MonthsOf(json);
        if (months == 0) return 0;

        // log_time is local time without time zone, like the other sys_* tables; whole days are kept.
        var cutoff = DateTime.Now.Date.AddMonths(-months);
        var removed = 0;
        while (!ct.IsCancellationRequested)
        {
            // LINQ, not raw SQL: EF knows log_time has no time zone and sends the cutoff as such.
            var oldest = db.AuditLogs.Where(x => x.LogTime < cutoff && x.Action != AuditActions.Purge)
                .OrderBy(x => x.Id).Select(x => x.Id).Take(BatchSize);
            var batch = await db.AuditLogs.Where(x => oldest.Contains(x.Id)).ExecuteDeleteAsync(ct);
            removed += batch;
            if (batch < BatchSize) break;
        }
        if (removed == 0) return 0;

        db.AuditLogs.Add(new AuditLog
        {
            LogTime = DateTime.Now,
            FunctionCode = "sys_audit_log",
            ObjectType = "auditLog",
            ObjectId = "retention",
            Action = AuditActions.Purge,
            Changes = JsonSerializer.Serialize(new[]
            {
                new AuditChange("purgedRows", null, removed.ToString(CultureInfo.InvariantCulture)),
                new AuditChange("purgedBefore", null, cutoff.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                new AuditChange("retentionMonths", null, months.ToString(CultureInfo.InvariantCulture))
            }, AuditTrail.Json),
            ActorUsername = "system"
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Đã xóa {Count} dòng nhật ký thay đổi trước {Cutoff:yyyy-MM-dd} (giữ {Months} tháng).",
            removed, cutoff, months);
        return removed;
    }
}
