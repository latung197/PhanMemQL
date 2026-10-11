using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>Vị trí lưu kho (kệ, tầng, ô) of one warehouse. Its code is unique across the system, e.g. KHO1-A-01.</summary>
[Audited("inv_location_cat", "location", Label = "{Code} - {Name}")]
[Table("erp_location")]
public class StorageLocation : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(30)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [Column("zone"), MaxLength(50)] public string? Zone { get; set; }
    [Column("rack"), MaxLength(50)] public string? Rack { get; set; }
    [Column("shelf"), MaxLength(50)] public string? Shelf { get; set; }
    [Column("capacity", TypeName = "numeric(18,4)")] public decimal? Capacity { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
