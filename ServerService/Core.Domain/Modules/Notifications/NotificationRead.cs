using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.Notifications;

/// <summary>Per-user read state. A dismissed notification is also read and is hidden from the inbox.</summary>
[Table("sys_notification_read")]
public class NotificationRead
{
    [Column("notification_id")] public long NotificationId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("read_at_utc")] public DateTime ReadAtUtc { get; set; }
    [Column("dismissed_at_utc")] public DateTime? DismissedAtUtc { get; set; }
}
