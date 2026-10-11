using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Inventory;

// The stock ledger tables are written with SQL by the stock ledger service (one transaction with the voucher), never
// through EF; these entities exist to read them and to declare their references, so a material, lot, location or
// warehouse that has stock history cannot be deleted (sys_table_ref).

/// <summary>
/// Sổ kho: one row per voucher line posted, signed quantity (+ in, - out) in the base unit of the material. Append-only:
/// unposting writes a reversal row (<see cref="ReversalOfId"/>) instead of deleting; posting again raises <see cref="PostingSeq"/>.
/// </summary>
[NotAudited("The ledger is the audit trail of stock itself; every row is written by the posting of a voucher.")]
[Table("erp_stock_movement")]
public class StockMovement : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [NotReference("mã chức năng của phiếu nguồn")]
    [Required, Column("source_function"), MaxLength(64)] public string SourceFunction { get; set; } = string.Empty;
    [Column("source_id")] public long SourceId { get; set; }
    [Column("source_line_id")] public long SourceLineId { get; set; }
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [References<Lot>(Optional = true)]
    [Column("lot_code"), MaxLength(81)] public string? LotCode { get; set; }
    [References<StorageLocation>(Optional = true)]
    [Column("location_code"), MaxLength(30)] public string? LocationCode { get; set; }
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    /// <summary>Signed quantity in the base unit of the material.</summary>
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Signed value in the base currency.</summary>
    [Column("value", TypeName = "numeric(18,2)")] public decimal Value { get; set; }
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
    [References<Uom>(Optional = true)]
    [Column("line_uom_code"), MaxLength(20)] public string? LineUomCode { get; set; }
    [Column("line_quantity", TypeName = "numeric(18,4)")] public decimal? LineQuantity { get; set; }
    [Column("posting_seq")] public int PostingSeq { get; set; } = 1;
    [NotReference("id của dòng sổ bị đảo")]
    [Column("reversal_of_id")] public long? ReversalOfId { get; set; }
}

/// <summary>Tồn theo (đơn vị, kho, vật tư): quantity and value. Always the sum of the ledger rows of that key.</summary>
[NotAudited("Derived from the stock ledger; every change is a ledger row.")]
[Table("erp_stock_balance")]
public class StockBalance : ErpEntity
{
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    [Column("value", TypeName = "numeric(18,2)")] public decimal Value { get; set; }
}

/// <summary>Tồn theo lô, only for materials tracked by lot.</summary>
[NotAudited("Derived from the stock ledger; every change is a ledger row.")]
[Table("erp_stock_lot_balance")]
public class StockLotBalance : ErpEntity
{
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [References<Lot>]
    [Required, Column("lot_code"), MaxLength(81)] public string LotCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
}

/// <summary>Tồn theo vị trí, only for materials tracked by location; the lot is empty when the material has no lots.</summary>
[NotAudited("Derived from the stock ledger; every change is a ledger row.")]
[Table("erp_stock_location_balance")]
public class StockLocationBalance : ErpEntity
{
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [References<Lot>(Optional = true)]
    [Required, Column("lot_code"), MaxLength(81)] public string LotCode { get; set; } = string.Empty;
    [References<StorageLocation>]
    [Required, Column("location_code"), MaxLength(30)] public string LocationCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
}
