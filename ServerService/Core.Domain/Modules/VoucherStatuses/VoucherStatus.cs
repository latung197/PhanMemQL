using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.VoucherStatuses;

/// <summary>
/// What a company unit changed about one status of one voucher type: its name (default name + optional English one) and whether it
/// is in use. Only changed statuses have a row; the statuses themselves are declared in code (VoucherStatusCatalog), so a unit can
/// rename or switch off a status but never add one. The same status of the same voucher type may differ between units.
/// </summary>
[Audited("sys_voucher_status", "voucherStatus", Label = "{UnitCode} {VoucherType} {StatusCode}")]
[Table("sys_voucher_status")]
public class VoucherStatus : ErpEntity
{
    [Key, Column("id")] public long Id { get; set; }

    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;

    /// <summary>Voucher type code of VoucherCatalog (PNK, PXK, YCX...).</summary>
    [NotReference("mã loại chứng từ khai báo trong VoucherCatalog")]
    [Required, Column("voucher_type"), MaxLength(20)] public string VoucherType { get; set; } = string.Empty;

    /// <summary>Draft, Pending, Approved, Posted or Cancelled (the enum DocumentStatus).</summary>
    [NotReference("trạng thái khai báo trong code (DocumentStatus)")]
    [Required, Column("status_code"), MaxLength(20)] public string StatusCode { get; set; } = string.Empty;

    /// <summary>Empty = the default name.</summary>
    [Column("name"), MaxLength(100)] public string? Name { get; set; }

    /// <summary>English name, used when the user's language is English; empty = the default name.</summary>
    [Column("name_en"), MaxLength(100)] public string? NameEn { get; set; }

    [Column("is_enabled")] public bool IsEnabled { get; set; } = true;
}
