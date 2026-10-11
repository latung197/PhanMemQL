using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory.Categories.suppliers;

namespace Core.Domain.Modules.Inventory;

/// <summary>
/// Lô và hạn sử dụng of a material that is tracked by lot. A lot is keyed by material + lot number, written as its code
/// "VT001@LOT-2610" (<see cref="Code"/>, unique); the code is the primary key, so stock rows point to a lot by it. The quantity left comes from the stock ledger.
/// </summary>
[Audited("inv_lot_cat", "lot", Label = "{Code}")]
[Table("erp_lot")]
public class Lot : ErpEntity, ICatalogRecord
{

    [Key, Column("code"), MaxLength(81)] public string Code { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("lot_no"), MaxLength(30)] public string LotNo { get; set; } = string.Empty;
    [Column("mfg_date")] public DateOnly? MfgDate { get; set; }
    [Column("exp_date")] public DateOnly? ExpDate { get; set; }
    [References<Supplier>(Optional = true)]
    [Column("supplier_code"), MaxLength(20)] public string? SupplierCode { get; set; }
    /// <summary>PASSED, INSPECT (waiting for inspection) or BLOCKED.</summary>
    [Required, Column("quality_status"), MaxLength(10)] public string QualityStatus { get; set; } = LotQuality.Passed;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class LotQuality
{
    public const string Passed = "PASSED";
    public const string Inspect = "INSPECT";
    public const string Blocked = "BLOCKED";
    public static readonly string[] All = [Passed, Inspect, Blocked];
}
