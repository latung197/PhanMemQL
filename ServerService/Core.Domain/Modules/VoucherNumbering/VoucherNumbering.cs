using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.VoucherNumbering;

/// <summary>
/// How numbers of one voucher type are built, e.g. PNK with pattern "{PREFIX}-{YYYY}{MM}-{SEQ}" gives
/// PNK-202609-0001. Rows are created at startup from VoucherCatalog; users edit prefix, pattern and digits.
/// </summary>
[Audited("sys_default_config", "voucherNumbering", Label = "{VoucherType} - {Name}")]
[Table("sys_voucher_numbering")]
public class VoucherNumberingRule
{
    [Key, Column("voucher_type"), MaxLength(20)] public string VoucherType { get; set; } = string.Empty;
    [AuditField("function"), Required, Column("menuid0"), MaxLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Required, Column("prefix"), MaxLength(20)] public string Prefix { get; set; } = string.Empty;
    [Required, Column("pattern"), MaxLength(100)] public string Pattern { get; set; } = string.Empty;
    [Column("digits")] public short Digits { get; set; } = 4;
    [AuditIgnore, Column("updated_at_utc")] public DateTime? UpdatedAtUtc { get; set; }
    [AuditIgnore, Column("updated_by_user_id")] public int? UpdatedByUserId { get; set; }
}

/// <summary>
/// Last number issued for a voucher type in a unit and period (e.g. "202609" when the pattern restarts
/// every month). Incremented atomically by SQL, never through EF.
/// </summary>
[NotAudited("Counter of the last voucher number, changed by every saved voucher.")]
[Table("sys_voucher_sequence")]
public class VoucherSequence
{
    [Required, Column("voucher_type"), MaxLength(20)] public string VoucherType { get; set; } = string.Empty;
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Required, Column("period_key"), MaxLength(8)] public string PeriodKey { get; set; } = string.Empty;
    [Column("last_number")] public int LastNumber { get; set; }
}
