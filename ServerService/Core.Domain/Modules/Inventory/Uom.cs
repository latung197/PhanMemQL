using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>Đơn vị tính. Materials, unit conversions and voucher lines link to it by code.</summary>
[Audited("inv_uom_cat", "uom", Label = "{Code} - {Name}")]
[Table("erp_uom")]
public class Uom : ErpEntity
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    /// <summary>Printed after quantities (cái, kg, m).</summary>
    [Required, Column("symbol"), MaxLength(20)] public string Symbol { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
