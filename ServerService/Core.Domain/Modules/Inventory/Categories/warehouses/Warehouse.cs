using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Inventory;

[Audited("inv_warehouse_cat", "warehouse", Label = "{Code} - {Name}")]
[Table("erp_warehouse")]
public class Warehouse : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [References<WarehouseType>(Optional = true)]
    [Column("warehouse_type_code"), MaxLength(20)] public string? WarehouseTypeCode { get; set; }
    [Column("address"), MaxLength(300)] public string? Address { get; set; }
    [Column("manager"), MaxLength(100)] public string? Manager { get; set; }
    [Column("capacity"), MaxLength(100)] public string? Capacity { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

/// <summary>
/// A company unit that may use a warehouse. A warehouse without rows here is shared: every unit may use it. The rows
/// are logged on the warehouse as the field "units".
/// </summary>
[AuditedChild(typeof(Warehouse), nameof(WarehouseCode), "units", nameof(UnitCode))]
[Table("erp_warehouse_unit")]
public class WarehouseUnit : ErpEntity
{
    [References<Warehouse>(BlocksDelete = false)]
    [Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
}
