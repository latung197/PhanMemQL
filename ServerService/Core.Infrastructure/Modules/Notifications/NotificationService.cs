using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Notifications;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Notifications;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Notifications;

public sealed class NotificationService(CoreContext db, IPermissionService permissions, INotificationStream stream,
    IUnitOfWork unitOfWork) : INotificationService
{
    private const int InboxSize = 100;

    public async Task<IReadOnlyList<NotificationDto>> GetInboxAsync(int userId, string unitCode, CancellationToken ct)
    {
        var items = await (await VisibleAsync(userId, unitCode, ct))
            .Select(x => new
            {
                Notification = x,
                Read = db.NotificationReads.FirstOrDefault(r => r.NotificationId == x.Id && r.UserId == userId),
                Sender = db.Users.Where(u => u.UserId == x.CreatedByUserId).Select(u => u.FullName).FirstOrDefault()
            })
            .Where(x => x.Read == null || x.Read.DismissedAtUtc == null)
            .OrderByDescending(x => x.Notification.CreatedAtUtc).Take(InboxSize)
            .ToListAsync(ct);
        return items.Select(x => ToDto(x.Notification, x.Read != null, x.Sender)).ToList();
    }

    public async Task MarkReadAsync(int userId, string unitCode, long notificationId, CancellationToken ct)
    {
        if (!await (await VisibleAsync(userId, unitCode, ct)).AnyAsync(x => x.Id == notificationId, ct))
            throw new NotFoundException("notification.notFound");
        if (await db.NotificationReads.AnyAsync(x => x.NotificationId == notificationId && x.UserId == userId, ct))
            return;
        db.NotificationReads.Add(new NotificationRead
        {
            NotificationId = notificationId, UserId = userId, ReadAtUtc = DateTime.UtcNow
        });
        await SaveIgnoringDuplicatesAsync(ct);
        stream.SyncUser(userId);
    }

    public async Task<int> MarkAllReadAsync(int userId, string unitCode, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var unreadIds = await (await VisibleAsync(userId, unitCode, ct))
            .Where(x => !db.NotificationReads.Any(r => r.NotificationId == x.Id && r.UserId == userId))
            .Select(x => x.Id).ToListAsync(ct);
        db.NotificationReads.AddRange(unreadIds.Select(id => new NotificationRead
        {
            NotificationId = id, UserId = userId, ReadAtUtc = now
        }));
        await SaveIgnoringDuplicatesAsync(ct);
        stream.SyncUser(userId);
        return unreadIds.Count;
    }

    public async Task DismissAsync(int userId, string unitCode, long notificationId, CancellationToken ct)
    {
        if (!await (await VisibleAsync(userId, unitCode, ct)).AnyAsync(x => x.Id == notificationId, ct))
            throw new NotFoundException("notification.notFound");
        var now = DateTime.UtcNow;
        var read = await db.NotificationReads.FirstOrDefaultAsync(x => x.NotificationId == notificationId && x.UserId == userId, ct);
        if (read is null)
            db.NotificationReads.Add(new NotificationRead
            {
                NotificationId = notificationId, UserId = userId, ReadAtUtc = now, DismissedAtUtc = now
            });
        else read.DismissedAtUtc ??= now;
        await SaveIgnoringDuplicatesAsync(ct);
        stream.SyncUser(userId);
    }

    public async Task<int> DismissAllAsync(int userId, string unitCode, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var ids = await (await VisibleAsync(userId, unitCode, ct)).Select(x => x.Id).ToListAsync(ct);
        var reads = await db.NotificationReads
            .Where(x => x.UserId == userId && ids.Contains(x.NotificationId)).ToListAsync(ct);
        var count = 0;
        foreach (var id in ids)
        {
            var read = reads.FirstOrDefault(x => x.NotificationId == id);
            if (read is null)
                db.NotificationReads.Add(read = new NotificationRead
                {
                    NotificationId = id, UserId = userId, ReadAtUtc = now
                });
            if (read.DismissedAtUtc is not null) continue;
            read.DismissedAtUtc = now;
            count++;
        }
        await SaveIgnoringDuplicatesAsync(ct);
        stream.SyncUser(userId);
        return count;
    }

    public async Task<NotificationDto> PublishAsync(int publisherUserId, PublishNotificationRequest request,
        CancellationToken ct)
    {
        var type = string.IsNullOrWhiteSpace(request.Type) ? "info" : request.Type.Trim();
        if (!Notification.Types.Contains(type)) throw new BusinessRuleException("notification.invalidType");
        var linkModule = Guard.Optional(request.LinkModule, 64, "field.linkModule");
        if (linkModule is not null && !FunctionCatalog.ModuleKeys.Contains(linkModule))
            throw new BusinessRuleException("notification.invalidModule");
        var linkFunction = Guard.Optional(request.LinkFunction, 64, "field.linkFunction");
        if (linkFunction is not null && !FunctionCatalog.IsFunction(linkFunction))
            throw new BusinessRuleException("notification.invalidFunction");
        var linkDocumentId = linkFunction is null ? null : Guard.Optional(request.LinkDocumentId, 64, "field.linkDocument");
        var expiresAt = request.ExpiresAt?.ToUniversalTime();
        if (expiresAt <= DateTime.UtcNow) throw new BusinessRuleException("notification.expiryInPast");

        var unitCode = Guard.Optional(request.UnitCode, 20, "field.unit");
        if (unitCode is not null && !await db.CompanyUnits.AnyAsync(x => x.Code == unitCode, ct))
            throw new BusinessRuleException("companyUnit.notFound");
        if (request.RecipientUserId is int recipient)
        {
            if (!await db.Users.NotDeleted().AnyAsync(x => x.UserId == recipient, ct))
                throw new BusinessRuleException("notification.recipientNotFound");
            if (unitCode is not null && !await permissions.IsAdminAsync(recipient, ct)
                && !await db.UserCompanyUnits.AnyAsync(x => x.UserId == recipient && x.UnitCode == unitCode, ct))
                throw new BusinessRuleException("notification.recipientNotInUnit");
        }

        var notification = new Notification
        {
            Title = Guard.Required(request.Title, 200, "field.title"),
            Body = Guard.Required(request.Message, 10_000, "field.content"),
            Type = type,
            LinkModule = linkModule,
            LinkFunction = linkFunction,
            LinkDocumentId = linkDocumentId,
            UnitCode = unitCode,
            RecipientUserId = request.RecipientUserId,
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = expiresAt,
            CreatedByUserId = publisherUserId
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);
        // Inside a caller's transaction (e.g. an approval step) the tabs reload only once the row is visible.
        unitOfWork.AfterCommit(() => stream.Publish(notification.UnitCode, notification.RecipientUserId));
        var sender = await db.Users.AsNoTracking().Where(u => u.UserId == publisherUserId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        return ToDto(notification, false, sender);
    }

    public async Task<NotificationSendScope> GetSendScopeAsync(int userId, string unitCode, CancellationToken ct)
    {
        var all = await permissions.IsAdminAsync(userId, ct) || await permissions.HasRightAsync(userId,
            SpecialRightCatalog.NotificationFunction, SpecialRightCatalog.SendNotificationAll, ct);
        var unit = all || await permissions.HasRightAsync(userId,
            SpecialRightCatalog.NotificationFunction, SpecialRightCatalog.SendNotification, ct);
        return new NotificationSendScope(unit, all, unitCode);
    }

    public async Task<NotificationDto> SendAsync(int senderUserId, string senderUnitCode,
        PublishNotificationRequest request, CancellationToken ct)
    {
        var scope = await GetSendScopeAsync(senderUserId, senderUnitCode, ct);
        if (!scope.CanSend) throw new ForbiddenException("notification.noSendRight");
        if (!scope.AllUnits)
        {
            // Unit-only senders always send inside the unit they are working in.
            if (!string.IsNullOrWhiteSpace(request.UnitCode) && request.UnitCode.Trim() != senderUnitCode)
                throw new ForbiddenException("notification.ownUnitOnly");
            request = request with { UnitCode = senderUnitCode };
        }
        return await PublishAsync(senderUserId, request, ct);
    }

    public async Task<IReadOnlyList<NotificationRecipientDto>> GetRecipientsAsync(int senderUserId, string senderUnitCode,
        string? unitCode, CancellationToken ct)
    {
        var scope = await GetSendScopeAsync(senderUserId, senderUnitCode, ct);
        if (!scope.CanSend) throw new ForbiddenException("notification.noSendRight");
        var target = scope.AllUnits ? Guard.Optional(unitCode, 20, "field.unit") : senderUnitCode;
        var users = db.Users.AsNoTracking().NotDeleted().Where(x => x.IsActive);
        if (target is not null)
            users = users.Where(x => db.UserCompanyUnits.Any(u => u.UserId == x.UserId && u.UnitCode == target));
        return await users.OrderBy(x => x.FullName)
            .Select(x => new NotificationRecipientDto(x.UserId, x.UserName, x.FullName, x.Department))
            .ToListAsync(ct);
    }

    /// <summary>
    /// Notifications addressed to the user in the unit, not expired. Broadcasts sent before the account
    /// was created are left out, so a new employee does not inherit months of old messages; messages
    /// addressed to the user personally are always shown.
    /// </summary>
    private async Task<IQueryable<Notification>> VisibleAsync(int userId, string unitCode, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        // createtime is local time in a "timestamp without time zone" column (CoreContext stamps DateTime.Now).
        var created = await db.Users.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.CreateTime).FirstOrDefaultAsync(ct);
        var since = created is DateTime local ? DateTime.SpecifyKind(local, DateTimeKind.Local).ToUniversalTime() : (DateTime?)null;
        return db.Notifications.AsNoTracking().Where(x =>
            (x.UnitCode == null || x.UnitCode == unitCode)
            && (x.RecipientUserId == null || x.RecipientUserId == userId)
            && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now)
            && (since == null || x.RecipientUserId == userId || x.CreatedAtUtc >= since));
    }

    /// <summary>Two tabs marking the same notification at once must not fail the second request.</summary>
    private async Task SaveIgnoringDuplicatesAsync(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { db.ChangeTracker.Clear(); }
    }

    private static NotificationDto ToDto(Notification x, bool read, string? sender) =>
        new(x.Id.ToString(), x.Title, x.Body, x.CreatedAtUtc, x.Type, read, x.LinkModule, sender,
            x.LinkFunction, x.LinkDocumentId);
}
