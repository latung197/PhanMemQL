using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.CompanyUnits;

/// <summary>Đơn vị cơ sở (ma_dvcs). Matches Frontend CompanyUnit.</summary>
[Table("sys_company_unit")]
public class CompanyUnit
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(150)] public string Name { get; set; } = string.Empty;
    [Column("short_name"), MaxLength(100)] public string? ShortName { get; set; }
    [Column("address"), MaxLength(300)] public string? Address { get; set; }
    [Column("phone"), MaxLength(30)] public string? Phone { get; set; }
    [Column("email"), MaxLength(150)] public string? Email { get; set; }
    [Column("tax_code"), MaxLength(30)] public string? TaxCode { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("is_default")] public bool IsDefault { get; set; }
    [Column("sort_order")] public int SortOrder { get; set; }
}
