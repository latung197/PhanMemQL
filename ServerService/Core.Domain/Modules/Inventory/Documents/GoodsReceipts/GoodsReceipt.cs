using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory.Documents.GoodsReceipts;

[Audited("inv_receipt", "goodsReceipt", Label = "{Code}")]
[Table("erp_goods_receipt")]
public class GoodsReceipt : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
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
    [Required, Column("product_code"), MaxLength(64)] public string ProductCode { get; set; } = string.Empty;
    [Required, Column("product_name"), MaxLength(200)] public string ProductName { get; set; } = string.Empty;
    [Required, Column("unit"), MaxLength(30)] public string Unit { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("lot_number"), MaxLength(64)] public string? LotNumber { get; set; }
    [Column("position"), MaxLength(100)] public string? Position { get; set; }
}
