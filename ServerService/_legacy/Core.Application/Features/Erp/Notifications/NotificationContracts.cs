namespace Core.Application.Features.Erp.Notifications;

public sealed record NotificationDto(long Id, string Title, string Body, DateTime CreatedAtUtc,
    DateTime? ExpiresAtUtc, bool IsRead, string Type, string? LinkModule);
public sealed record PublishNotificationRequest(string Title, string Body, string? UnitCode,
    string? PlantCode, int? RecipientUserId, DateTime? ExpiresAtUtc,
    string Type = "info", string? LinkModule = null);

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetInboxAsync(int userId, string unitCode, string? plantCode,
        bool unreadOnly, CancellationToken ct);
    Task<long> PublishAsync(int publisherUserId, PublishNotificationRequest request, CancellationToken ct);
    Task<bool> MarkReadAsync(int userId, string unitCode, string? plantCode, long notificationId, CancellationToken ct);
    Task<int> MarkAllReadAsync(int userId, string unitCode, string? plantCode, CancellationToken ct);
}
