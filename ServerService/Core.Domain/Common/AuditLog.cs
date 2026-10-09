using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Common;

/// <summary>
/// One change made through the API, shared by every function (table sys_audit_log). Written automatically by
/// AuditTrail or by hand with IAuditLog, in the transaction of the change; never changed afterwards.
/// </summary>
[NotAudited("The change log itself.")]
[Table("sys_audit_log")]
public class AuditLog
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("id")] public long Id { get; set; }
    [Column("log_time", TypeName = "timestamp without time zone")] public DateTime LogTime { get; set; }
    [NotReference("mã chức năng (FunctionCatalog), không phải danh mục")]
    [Required, Column("function_code"), MaxLength(64)] public string FunctionCode { get; set; } = string.Empty;
    [Required, Column("object_type"), MaxLength(50)] public string ObjectType { get; set; } = string.Empty;
    [Required, Column("object_id"), MaxLength(64)] public string ObjectId { get; set; } = string.Empty;
    [Column("object_label"), MaxLength(300)] public string? ObjectLabel { get; set; }
    [Required, Column("action"), MaxLength(30)] public string Action { get; set; } = string.Empty;
    /// <summary>JSON array of { field, before, after }.</summary>
    [Required, Column("changes", TypeName = "jsonb")] public string Changes { get; set; } = "[]";
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Column("actor_id")] public int? ActorId { get; set; }
    [Column("actor_username"), MaxLength(50)] public string? ActorUsername { get; set; }
    [Column("actor_name"), MaxLength(100)] public string? ActorName { get; set; }
    [NotReference("nhật ký giữ mã đơn vị lúc ghi, không chặn xóa đơn vị")]
    [Column("unit_code"), MaxLength(20)] public string? UnitCode { get; set; }
    [Column("ip_address"), MaxLength(64)] public string? IpAddress { get; set; }
}
