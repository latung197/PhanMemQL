using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Fiscal;

/// <summary>
/// Lock state of one accounting month of one company unit. Only months that were ever locked have a row;
/// a missing row means "open".
/// </summary>
[Audited("sys_fiscal_year", "fiscalPeriod", Label = "{UnitCode} {Month}/{Year}")]
[Table("sys_fiscal_period")]
public class FiscalPeriod
{
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("year")] public int Year { get; set; }
    [Column("month")] public int Month { get; set; }
    [Column("is_locked")] public bool IsLocked { get; set; }
    [AuditIgnore, Column("locked_by_user_id")] public int? LockedByUserId { get; set; }
    [AuditIgnore, Column("locked_at_utc")] public DateTime? LockedAtUtc { get; set; }
}
