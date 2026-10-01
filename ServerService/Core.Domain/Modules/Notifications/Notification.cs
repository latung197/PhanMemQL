using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Notifications;

/// <summary>
/// System notification. A null UnitCode or RecipientUserId means "everyone" for that dimension.
/// </summary>
[NotAudited("The notification is itself the record of who sent what, when and to whom.")]
[Table("sys_notification")]
public class Notification
{
    public static readonly string[] Types = ["info", "warning", "success", "danger"];

    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("title"), MaxLength(200)] public string Title { get; set; } = string.Empty;
    [Required, Column("body")] public string Body { get; set; } = string.Empty;
    [Required, Column("type"), MaxLength(20)] public string Type { get; set; } = "info";
    [Column("link_module"), MaxLength(64)] public string? LinkModule { get; set; }
    /// <summary>Function code (SubMenuKey) of the linked document, e.g. inv_receipt.</summary>
    [Column("link_function"), MaxLength(64)] public string? LinkFunction { get; set; }
    [Column("link_document_id"), MaxLength(64)] public string? LinkDocumentId { get; set; }
    [Column("unit_code"), MaxLength(20)] public string? UnitCode { get; set; }
    [Column("recipient_user_id")] public int? RecipientUserId { get; set; }
    [Column("created_at_utc")] public DateTime CreatedAtUtc { get; set; }
    [Column("expires_at_utc")] public DateTime? ExpiresAtUtc { get; set; }
    [Column("created_by_user_id")] public int CreatedByUserId { get; set; }
}
