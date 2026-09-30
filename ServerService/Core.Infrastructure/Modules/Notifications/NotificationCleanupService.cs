using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Core.Infrastructure.Modules.Notifications;

/// <summary>
/// Removes old notifications twice a day: everything older than Notifications:RetentionDays
/// (default 180) and anything that expired more than 30 days ago, together with its read states.
/// </summary>
public sealed class NotificationCleanupService(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<NotificationCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(12);
    private const int ExpiredGraceDays = 30;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the API start (and the seeder finish) first.
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
                logger.LogWarning(ex, "Dọn thông báo cũ thất bại; sẽ thử lại lần sau.");
            }
            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    public async Task<int> CleanupAsync(CancellationToken ct)
    {
        var retentionDays = Math.Max(7, configuration.GetValue("Notifications:RetentionDays", 180));
        var now = DateTime.UtcNow;
        var createdBefore = now.AddDays(-retentionDays);
        var expiredBefore = now.AddDays(-ExpiredGraceDays);

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CoreContext>();
        var old = db.Notifications.Where(x => x.CreatedAtUtc < createdBefore
            || (x.ExpiresAtUtc != null && x.ExpiresAtUtc < expiredBefore));

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.NotificationReads.Where(r => old.Any(n => n.Id == r.NotificationId)).ExecuteDeleteAsync(ct);
        var removed = await old.ExecuteDeleteAsync(ct);
        // Read states whose notification no longer exists (no foreign keys).
        await db.NotificationReads.Where(r => !db.Notifications.Any(n => n.Id == r.NotificationId)).ExecuteDeleteAsync(ct);
        await tx.CommitAsync(ct);

        if (removed > 0) logger.LogInformation("Đã dọn {Count} thông báo cũ (giữ {Days} ngày).", removed, retentionDays);
        return removed;
    }
}
