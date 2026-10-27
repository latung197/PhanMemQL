using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Inventory;

namespace Core.Domain.Modules.Inventory.Documents.StockCounts;

/// <summary>
/// Phiếu kiểm kê: the book stock of one warehouse at a date against what was counted. Posting writes the differences to the
/// stock ledger (surplus comes in, shortage goes out, both at the moving average of the warehouse).
/// </summary>
[Audited("inv_audit_count", "stockCount", Label = "{Code}")]
[Table("erp_stock_count")]
public class StockCount : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    /// <summary>The counting date: the book stock is the stock of the ledger up to and including this day.</summary>
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    /// <summary>Who counted (the counting board).</summary>
    [Column("counter_name"), MaxLength(200)] public string? CounterName { get; set; }
    [Column("reason"), MaxLength(300)] public string? Reason { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    /// <summary>Value of what was found in surplus (positive) in the base currency.</summary>
    [Column("surplus_value", TypeName = "numeric(18,2)")] public decimal SurplusValue { get; set; }
    /// <summary>Value of what is short (positive number) in the base currency.</summary>
    [Column("shortage_value", TypeName = "numeric(18,2)")] public decimal ShortageValue { get; set; }
    /// <summary>Surplus + shortage: the size of the difference, used to pick the approval levels.</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<StockCountLine> Lines { get; set; } = [];
}

[NotAudited("StockCountService attaches line changes to the parent count audit entry.")]
[Table("erp_stock_count_line")]
public class StockCountLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("count_id")] public long CountId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>Always the base unit of the material: stock is kept and counted in it.</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    /// <summary>Lot number: needed for a material tracked by lot, empty for any other.</summary>
    [Column("lot_number"), MaxLength(64)] public string? LotNumber { get; set; }
    /// <summary>Storage location: needed for a material tracked by location, empty for any other.</summary>
    [Column("position"), MaxLength(100)] public string? Position { get; set; }
    /// <summary>Stock of the ledger at the counting date, worked out by the server (never typed).</summary>
    [Column("book_quantity", TypeName = "numeric(18,4)")] public decimal BookQuantity { get; set; }
    [Column("counted_quantity", TypeName = "numeric(18,4)")] public decimal CountedQuantity { get; set; }
    /// <summary>Counted minus book: positive = surplus, negative = shortage.</summary>
    [Column("diff_quantity", TypeName = "numeric(18,4)")] public decimal DiffQuantity { get; set; }
    /// <summary>Moving average cost of the material in the warehouse at the counting date (base currency, per base unit).</summary>
    [Column("unit_cost", TypeName = "numeric(18,4)")] public decimal UnitCost { get; set; }
    /// <summary>Difference × cost: positive for a surplus, negative for a shortage.</summary>
    [Column("diff_value", TypeName = "numeric(18,2)")] public decimal DiffValue { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}
