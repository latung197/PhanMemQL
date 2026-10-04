using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

[Audited("inv_warehouse_cat", "warehouse", Label = "{Code} - {Name}")]
[Table("erp_warehouse")]
public class Warehouse : ErpEntity
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("warehouse_type_code"), MaxLength(20)] public string? WarehouseTypeCode { get; set; }
    [Column("address"), MaxLength(300)] public string? Address { get; set; }
    [Column("manager"), MaxLength(100)] public string? Manager { get; set; }
    [Column("capacity"), MaxLength(100)] public string? Capacity { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
