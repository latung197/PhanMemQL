namespace Core.Application.Modules.Notifications;

/// <summary>
/// Same shape as Frontend SystemNotification; Time is the creation time (UTC), Sender the full name of
/// who sent it. LinkFunction / LinkDocumentId point to one document (e.g. inv_receipt + PNK-0001).
/// </summary>
public sealed record NotificationDto(string Id, string Title, string Message, DateTime Time,
    string Type, bool Read, string? LinkModule, string? Sender, string? LinkFunction, string? LinkDocumentId);

/// <summary>Null UnitCode / RecipientUserId sends to every unit / every user.</summary>
public sealed record PublishNotificationRequest(string Title, string Message, string? Type,
    string? LinkModule, string? UnitCode, int? RecipientUserId, DateTime? ExpiresAt,
    string? LinkFunction = null, string? LinkDocumentId = null);

public static class NotificationStreamEvents
{
    /// <summary>A notification for the subscriber was published.</summary>
    public const string Notification = "notification";
    /// <summary>The subscriber's read / hidden state changed in another tab.</summary>
    public const string Sync = "sync";
}

/// <summary>An open realtime connection; dispose it when the connection closes.</summary>
public sealed class NotificationSubscription(System.Threading.Channels.ChannelReader<string> events, Action onDispose) : IDisposable
{
    public System.Threading.Channels.ChannelReader<string> Events { get; } = events;
    public void Dispose() => onDispose();
}

/// <summary>Pushes "your inbox changed" signals to open browser tabs (GET /api/notifications/stream).</summary>
public interface INotificationStream
{
    NotificationSubscription Subscribe(int userId, string unitCode);
    /// <summary>Signals every tab that can see a notification sent to this unit / recipient (null = all).</summary>
    void Publish(string? unitCode, int? recipientUserId);
    /// <summary>Signals the user's other tabs to reload their inbox (read / hidden state changed).</summary>
    void SyncUser(int userId);
}

/// <summary>Who may send notifications and where (drives the send form).</summary>
public sealed record NotificationSendScope(bool CanSend, bool AllUnits, string UnitCode);

public sealed record NotificationRecipientDto(int Id, string UserName, string FullName, string Department);

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetInboxAsync(int userId, string unitCode, CancellationToken ct);
    Task MarkReadAsync(int userId, string unitCode, long notificationId, CancellationToken ct);
    Task<int> MarkAllReadAsync(int userId, string unitCode, CancellationToken ct);

    /// <summary>Hides every visible notification from this user's inbox.</summary>
    Task<int> DismissAllAsync(int userId, string unitCode, CancellationToken ct);

    /// <summary>Hides one notification from this user's inbox.</summary>
    Task DismissAsync(int userId, string unitCode, long notificationId, CancellationToken ct);

    /// <summary>System notification (approvals, ...): no sender rights are checked.</summary>
    Task<NotificationDto> PublishAsync(int publisherUserId, PublishNotificationRequest request, CancellationToken ct);

    /// <summary>
    /// Notification written by a user. Administrators and holders of SEND_NOTIFICATION_ALL may send to any
    /// unit; holders of SEND_NOTIFICATION only to the unit they are signed in to.
    /// </summary>
    Task<NotificationDto> SendAsync(int senderUserId, string senderUnitCode, PublishNotificationRequest request, CancellationToken ct);

    Task<NotificationSendScope> GetSendScopeAsync(int userId, string unitCode, CancellationToken ct);

    /// <summary>Active users of the unit the sender may address (for the "Gửi tới" list).</summary>
    Task<IReadOnlyList<NotificationRecipientDto>> GetRecipientsAsync(int senderUserId, string senderUnitCode, string? unitCode, CancellationToken ct);
}
