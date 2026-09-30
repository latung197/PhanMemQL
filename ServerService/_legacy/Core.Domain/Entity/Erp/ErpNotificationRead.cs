using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Entity.Erp;

[Table("erp_notification_read")]
public sealed class ErpNotificationRead
{
    public long NotificationId { get; set; }
    public int UserId { get; set; }
    public DateTime ReadAtUtc { get; set; }
}
