using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.SystemConfig;

/// <summary>
/// A JSON setting value. Scope is "GLOBAL" or "U:{unitCode}"; a unit value overrides the global one.
/// </summary>
[Audited("settings_main", "setting", Label = "{Key} ({Scope})")]
[Table("sys_setting")]
public class SystemSetting
{
    public const string GlobalScope = "GLOBAL";
    public static string UnitScope(string unitCode) => $"U:{unitCode}";

    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("key"), MaxLength(100)] public string Key { get; set; } = string.Empty;
    [AuditJson, Required, Column("value")] public string Value { get; set; } = string.Empty;
    [Required, Column("scope"), MaxLength(50)] public string Scope { get; set; } = GlobalScope;
    [Column("is_public")] public bool IsPublic { get; set; } = true;
    [AuditIgnore, Column("updated_at_utc")] public DateTime UpdatedAtUtc { get; set; }
    [AuditIgnore, Column("updated_by_user_id")] public int UpdatedByUserId { get; set; }
}
