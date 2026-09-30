using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Entity.Erp;

[Table("erp_notification")]
public sealed class ErpNotification
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    [Required] public string Body { get; set; } = string.Empty;
    [Required, MaxLength(20)] public string Type { get; set; } = "info";
    [MaxLength(64)] public string? LinkModule { get; set; }
    [MaxLength(20)] public string? UnitCode { get; set; }
    [MaxLength(20)] public string? PlantCode { get; set; }
    public int? RecipientUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public int CreatedByUserId { get; set; }
}
