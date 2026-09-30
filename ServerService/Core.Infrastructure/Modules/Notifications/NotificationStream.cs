using System.Collections.Concurrent;
using System.Threading.Channels;
using Core.Application.Modules.Notifications;

namespace Core.Infrastructure.Modules.Notifications;

/// <summary>
/// In-memory hub behind GET /api/notifications/stream. Each open browser tab is one subscriber; a
/// signal only says "your inbox changed", the tab then reloads it through the normal API, so no
/// notification content goes through here. Works for a single API instance; several instances would
/// need a shared bus (e.g. PostgreSQL LISTEN/NOTIFY or Redis) in front of this class.
/// </summary>
public sealed class NotificationStream : INotificationStream
{
    private sealed record Subscriber(int UserId, string UnitCode, Channel<string> Channel);

    private readonly ConcurrentDictionary<Guid, Subscriber> _subscribers = new();

    public NotificationSubscription Subscribe(int userId, string unitCode)
    {
        // Only the latest signals matter: a slow tab drops old ones instead of piling them up.
        var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(8)
        {
            FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true
        });
        var id = Guid.NewGuid();
        _subscribers[id] = new Subscriber(userId, unitCode, channel);
        return new NotificationSubscription(channel.Reader, () =>
        {
            if (_subscribers.TryRemove(id, out var removed)) removed.Channel.Writer.TryComplete();
        });
    }

    public void Publish(string? unitCode, int? recipientUserId)
    {
        foreach (var s in _subscribers.Values)
            if ((unitCode is null || unitCode == s.UnitCode) && (recipientUserId is null || recipientUserId == s.UserId))
                s.Channel.Writer.TryWrite(NotificationStreamEvents.Notification);
    }

    public void SyncUser(int userId)
    {
        foreach (var s in _subscribers.Values)
            if (s.UserId == userId) s.Channel.Writer.TryWrite(NotificationStreamEvents.Sync);
    }

    public int Count => _subscribers.Count;
}
