using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Common;

/// <summary>
/// Base of every business table (erp_*): who created / last changed the row and when. CoreContext fills the four
/// columns when saving (callers never set them); the test BusinessTablesHaveRecordStamps fails for an erp_* entity
/// without them. Times are UTC (timestamptz). The full history of changes is in sys_audit_log.
/// SQL of a new table: created_at timestamptz NOT NULL DEFAULT now(), created_by integer, updated_at timestamptz,
/// updated_by integer.
/// </summary>
public abstract class ErpEntity : IVersioned
{
    /// <summary>Row version (xmin) against lost updates; see IVersioned.</summary>
    public uint Version { get; set; }

    [Column("created_at", TypeName = "timestamp with time zone")] public DateTime CreatedAt { get; set; }
    /// <summary>sys_users.user_id; null for rows created by scripts.</summary>
    [Column("created_by")] public int? CreatedBy { get; set; }
    /// <summary>Null until the row is changed for the first time.</summary>
    [Column("updated_at", TypeName = "timestamp with time zone")] public DateTime? UpdatedAt { get; set; }
    [Column("updated_by")] public int? UpdatedBy { get; set; }
}
