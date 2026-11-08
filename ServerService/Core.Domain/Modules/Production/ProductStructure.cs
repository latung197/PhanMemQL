using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory;

namespace Core.Domain.Modules.Production;

/// <summary>
/// Cấu trúc sản phẩm (BOM): the material norms of one product (a finished good or a semi-finished one). There is one structure per
/// product, so the key is the material code (copied to both <c>code</c> and <c>material_code</c>); its components are in erp_product_structure_line. A component that has a structure of its
/// own makes a tree (finished good → semi-finished goods → raw materials).
/// </summary>
[Audited("prod_structure_cat", "productStructure", Label = "{Code}")]
[Table("erp_product_structure")]
public class ProductStructure : ErpEntity
{
    /// <summary>The material code of the product (the framework needs a table to be keyed by "code"; <see cref="MaterialCode"/> keeps the reference to the material).</summary>
    [Key, Column("code"), MaxLength(50)] public string Code { get; set; } = string.Empty;
    [References<Material>]
    [Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
}

/// <summary>
/// A component of a product: how much of the material (in <c>UomCode</c>) one unit of the product takes, the operation that consumes it
/// and the scrap allowance. <c>LineNo</c> is its place (1, 2, 3...). Logged on the structure as the field "components" (by the service).
/// </summary>
[NotAudited("the lines are rows edited in place; the service logs them on the structure as one field, components")]
[Table("erp_product_structure_line")]
public class ProductStructureLine : ErpEntity
{
    /// <summary>The material code of the product the structure belongs to (the code of erp_product_structure).</summary>
    [References<ProductStructure>(BlocksDelete = false)]
    [Column("product_structure_code"), MaxLength(50)] public string ProductStructureCode { get; set; } = string.Empty;
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Column("component_material_code"), MaxLength(50)] public string ComponentMaterialCode { get; set; } = string.Empty;
    [References<Uom>]
    [Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
    [References<ProductionOperation>(Optional = true)]
    [Column("production_operation_code"), MaxLength(20)] public string? ProductionOperationCode { get; set; }
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Scrap allowance in percent (hao hụt %), 0 to under 100.</summary>
    [Column("scrap_percent", TypeName = "numeric(9,4)")] public decimal ScrapPercent { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}
