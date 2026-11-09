using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>
/// Định mức tồn kho of one material in one warehouse. Keyed by material + warehouse, written as its code "VT001@KHO1" (unique, the
/// primary key). Quantities are in the base unit of the material. The stock report reads the minimum / maximum from here and falls
/// back to the ones declared on the material.
/// </summary>
[Audited("inv_stock_norm_cat", "stockNorm", Label = "{Code}")]
[Table("erp_stock_norm")]
public class StockNorm : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(71)] public string Code { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [Column("min_quantity", TypeName = "numeric(18,4)")] public decimal? MinQuantity { get; set; }
    [Column("max_quantity", TypeName = "numeric(18,4)")] public decimal? MaxQuantity { get; set; }
    [Column("safety_quantity", TypeName = "numeric(18,4)")] public decimal? SafetyQuantity { get; set; }
    [Column("reorder_point", TypeName = "numeric(18,4)")] public decimal? ReorderPoint { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
