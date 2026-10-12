using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Inventory.Categories.suppliers;

namespace Core.Domain.Modules.Inventory.Documents.GoodsReceipts;

[Audited("inv_receipt", "goodsReceipt", Label = "{Code}")]
[Table("erp_goods_receipt")]
public class GoodsReceipt : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
    [References<Supplier>(Optional = true)]
    [Column("supplier_code"), MaxLength(20)] public string? SupplierCode { get; set; }
    /// <summary>The supplier name when the receipt was saved; free text when no supplier of the catalog is chosen.</summary>
    [Column("supplier_name"), MaxLength(200)] public string? SupplierName { get; set; }
    [Column("deliverer_name"), MaxLength(200)] public string? DelivererName { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<GoodsReceiptLine> Lines { get; set; } = [];
}

[NotAudited("GoodsReceiptService attaches line changes to the parent receipt audit entry.")]
[Table("erp_goods_receipt_line")]
public class GoodsReceiptLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("receipt_id")] public long ReceiptId { get; set; }
    [Required, Column("kind"), MaxLength(20)] public string Kind { get; set; } = "ITEM";
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    /// <summary>The material name when the line was saved (what the printed voucher shows even if the catalog is renamed).</summary>
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit of the line: the base unit of the material or one it converts from (<c>erp_uom_conversion</c>).</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("lot_number"), MaxLength(64)] public string? LotNumber { get; set; }
    [Column("position"), MaxLength(100)] public string? Position { get; set; }
}
