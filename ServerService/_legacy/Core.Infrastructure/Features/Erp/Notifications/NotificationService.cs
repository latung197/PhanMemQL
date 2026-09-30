using Core.Application.Features.Erp.Notifications;
using Core.Domain.Entity.Erp;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Features.Erp.Notifications;

public sealed class NotificationService(CoreContext db) : INotificationService
{
    public async Task<IReadOnlyList<NotificationDto>> GetInboxAsync(int userId, string unitCode,
        string? plantCode, bool unreadOnly, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var query = db.ErpNotifications.AsNoTracking().Where(x =>
            (x.UnitCode == null || x.UnitCode == unitCode)
            && (x.PlantCode == null || x.PlantCode == plantCode)
            && (x.RecipientUserId == null || x.RecipientUserId == userId)
            && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now));
        if (unreadOnly)
            query = query.Where(x => !db.ErpNotificationReads.Any(r =>
                r.NotificationId == x.Id && r.UserId == userId));
        return await query.OrderByDescending(x => x.CreatedAtUtc).Take(100)
            .Select(x => new NotificationDto(x.Id, x.Title, x.Body, x.CreatedAtUtc,
                x.ExpiresAtUtc, db.ErpNotificationReads.Any(r => r.NotificationId == x.Id
                    && r.UserId == userId), x.Type, x.LinkModule)).ToListAsync(ct);
    }

    public async Task<long> PublishAsync(int publisherUserId, PublishNotificationRequest request,
        CancellationToken ct)
    {
        var expiresAtUtc = request.ExpiresAtUtc?.ToUniversalTime();
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200
            || string.IsNullOrWhiteSpace(request.Body) || request.Body.Length > 10000
            || expiresAtUtc <= DateTime.UtcNow
            || !new[] { "info", "warning", "success", "danger" }.Contains(request.Type)
            || (request.LinkModule is not null && !Core.Application.Security.FrontendPermissionCatalog.Functions.ContainsKey(request.LinkModule)))
            throw new ArgumentException("Thông báo không hợp lệ.");
        if (request.PlantCode is not null)
        {
            var plant = await db.ErpPlants.AsNoTracking().FirstOrDefaultAsync(x => x.Code == request.PlantCode, ct)
                ?? throw new ArgumentException("Nhà máy không tồn tại.");
            if (request.UnitCode != plant.UnitCode)
                throw new ArgumentException("Nhà máy không thuộc đơn vị đã chọn.");
        }
        else if (request.UnitCode is not null
            && !await db.ErpUnits.AnyAsync(x => x.Code == request.UnitCode, ct))
            throw new ArgumentException("Đơn vị không tồn tại.");
        if (request.RecipientUserId is int recipient)
        {
            if (!await db.SysUser.AnyAsync(x => x.UserId == recipient && x.ValidFlg == 1, ct))
                throw new ArgumentException("Người nhận không tồn tại.");
            if (request.PlantCode is not null && !await db.ErpUserPlants.AnyAsync(x =>
                    x.UserId == recipient && x.PlantCode == request.PlantCode, ct))
                throw new ArgumentException("Người nhận chưa được gán nhà máy.");
            if (request.PlantCode is null && request.UnitCode is not null
                && !await db.ErpUserPlants.AnyAsync(x => x.UserId == recipient
                    && x.Plant.UnitCode == request.UnitCode, ct))
                throw new ArgumentException("Người nhận chưa được gán đơn vị.");
        }
        var entity = new ErpNotification
        {
            Title = request.Title.Trim(), Body = request.Body.Trim(),
            Type = request.Type, LinkModule = request.LinkModule,
            UnitCode = request.UnitCode, PlantCode = request.PlantCode,
            RecipientUserId = request.RecipientUserId,
            CreatedAtUtc = DateTime.UtcNow, ExpiresAtUtc = expiresAtUtc,
            CreatedByUserId = publisherUserId
        };
        db.ErpNotifications.Add(entity);
        await db.SaveChangesAsync(ct);
        return entity.Id;
    }

    public async Task<bool> MarkReadAsync(int userId, string unitCode, string? plantCode,
        long notificationId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var exists = await db.ErpNotifications.AnyAsync(x => x.Id == notificationId
            && (x.UnitCode == null || x.UnitCode == unitCode)
            && (x.PlantCode == null || x.PlantCode == plantCode)
            && (x.RecipientUserId == null || x.RecipientUserId == userId)
            && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now), ct);
        if (!exists) return false;
        if (!await db.ErpNotificationReads.AnyAsync(x => x.NotificationId == notificationId
            && x.UserId == userId, ct))
        {
            db.ErpNotificationReads.Add(new ErpNotificationRead
            {
                NotificationId = notificationId, UserId = userId, ReadAtUtc = now
            });
            await db.SaveChangesAsync(ct);
        }
        return true;
    }

    public async Task<int> MarkAllReadAsync(int userId, string unitCode, string? plantCode,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var unreadIds = await db.ErpNotifications.AsNoTracking()
            .Where(x => (x.UnitCode == null || x.UnitCode == unitCode)
                && (x.PlantCode == null || x.PlantCode == plantCode)
                && (x.RecipientUserId == null || x.RecipientUserId == userId)
                && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now)
                && !db.ErpNotificationReads.Any(r => r.NotificationId == x.Id && r.UserId == userId))
            .Select(x => x.Id).ToListAsync(ct);
        db.ErpNotificationReads.AddRange(unreadIds.Select(id => new ErpNotificationRead
        {
            NotificationId = id, UserId = userId, ReadAtUtc = now
        }));
        await db.SaveChangesAsync(ct);
        return unreadIds.Count;
    }
}
