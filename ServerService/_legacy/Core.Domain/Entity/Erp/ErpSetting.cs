using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Entity.Erp;

[Table("erp_setting")]
public sealed class ErpSetting
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, MaxLength(100)] public string Key { get; set; } = string.Empty;
    [Required] public string Value { get; set; } = string.Empty;
    [Required, MaxLength(50)] public string Scope { get; set; } = "GLOBAL";
    public bool IsPublic { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public int UpdatedByUserId { get; set; }
}
