using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Common;

/// <summary>Audit columns shared by the legacy sys_* tables. Values are stamped by CoreContext.</summary>
public interface IAuditable
{
    DateTime? CreateTime { get; set; }
    string? CreateId { get; set; }
    DateTime? UpdateTime { get; set; }
    string? UpdateId { get; set; }
}

public abstract class AuditableEntity : IAuditable
{
    // The sys_* tables store local time in "timestamp" (without time zone) columns.
    private const string LocalTimestamp = "timestamp without time zone";

    [Column("createtime", TypeName = LocalTimestamp)] public DateTime? CreateTime { get; set; }
    [Column("createid"), MaxLength(20)] public string? CreateId { get; set; }
    [Column("updatetime", TypeName = LocalTimestamp)] public DateTime? UpdateTime { get; set; }
    [Column("updateid"), MaxLength(20)] public string? UpdateId { get; set; }

    /// <summary>"1" = active row. Rows with any other value are ignored.</summary>
    [Column("status"), StringLength(1)] public string Status { get; set; } = "1";
}
