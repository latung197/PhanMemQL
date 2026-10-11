using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.TaxRates;

namespace Core.Domain.Modules.Inventory;

/// <summary>
/// Vật tư / sản phẩm: what the warehouse stores. Besides identity and classification it carries the flags that tell the
/// stock ledger how to follow it (by lot, by location, with an expiry date, counted periodically) and its costing method.
/// </summary>
[Audited("inv_material_cat", "material", Label = "{Code} - {Name}")]
[Table("erp_material")]
public class Material : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(50)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [NotReference("mã vật tư do khách hàng đặt, không phải mã của một danh mục")]
    [Column("customer_material_code"), MaxLength(50)] public string? CustomerMaterialCode { get; set; }
    [Column("part_no"), MaxLength(50)] public string? PartNo { get; set; }
    [References<MaterialType>(Optional = true)]
    [Column("material_type_code"), MaxLength(20)] public string? MaterialTypeCode { get; set; }
    [References<MaterialGroup>(Optional = true)]
    [Column("material_group_code"), MaxLength(20)] public string? MaterialGroupCode { get; set; }
    /// <summary>Base unit of measure: stock is kept in it; other units convert through the unit conversion catalog.</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
    [References<TaxRate>(Optional = true)]
    [Column("vat_tax_rate_code"), MaxLength(20)] public string? VatTaxRateCode { get; set; }
    [References<TaxRate>(Optional = true)]
    [Column("import_tax_rate_code"), MaxLength(20)] public string? ImportTaxRateCode { get; set; }
    /// <summary>False for a service or an expense item: no stock is kept, so none of the tracking flags apply.</summary>
    [Column("is_stock_item")] public bool IsStockItem { get; set; } = true;
    [Column("track_lot")] public bool TrackLot { get; set; }
    /// <summary>The expiry date belongs to the lot, so this needs <see cref="TrackLot"/>.</summary>
    [Column("has_expiry")] public bool HasExpiry { get; set; }
    [Column("shelf_life_days")] public int? ShelfLifeDays { get; set; }
    [Column("track_location")] public bool TrackLocation { get; set; }
    [Column("is_cycle_counted")] public bool IsCycleCounted { get; set; }
    /// <summary>AVERAGE (bình quân tháng) or FIFO.</summary>
    [Required, Column("costing_method"), MaxLength(10)] public string CostingMethod { get; set; } = MaterialCosting.Average;
    [Column("min_stock", TypeName = "numeric(18,4)")] public decimal? MinStock { get; set; }
    [Column("max_stock", TypeName = "numeric(18,4)")] public decimal? MaxStock { get; set; }
    [Column("length", TypeName = "numeric(18,4)")] public decimal? Length { get; set; }
    [Column("width", TypeName = "numeric(18,4)")] public decimal? Width { get; set; }
    [Column("height", TypeName = "numeric(18,4)")] public decimal? Height { get; set; }
    [Column("weight", TypeName = "numeric(18,4)")] public decimal? Weight { get; set; }
    [Column("volume", TypeName = "numeric(18,4)")] public decimal? Volume { get; set; }
    [Column("note"), MaxLength(500)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class MaterialCosting
{
    public const string Average = "AVERAGE";
    public const string Fifo = "FIFO";
}
