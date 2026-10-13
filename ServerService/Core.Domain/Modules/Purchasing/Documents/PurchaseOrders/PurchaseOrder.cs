using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Inventory.Categories.suppliers;
using Core.Domain.Modules.TaxRates;

namespace Core.Domain.Modules.Purchasing.Documents.PurchaseOrders;

/// <summary>
/// Đơn mua hàng: the order sent to a supplier. It goes through approval like any voucher but never posts to a ledger; goods
/// receipts (inv_receipt) pull the lines of an approved order and receive them (part by part, until the order is received in full).
/// Its lines may carry out the lines of approved purchase requests.
/// </summary>
[Audited("pur_order", "purchaseOrder", Label = "{Code}")]
[Table("erp_purchase_order")]
public class PurchaseOrder : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    /// <summary>The day the supplier is to deliver (not before the voucher date).</summary>
    [Column("delivery_date")] public DateOnly? DeliveryDate { get; set; }
    /// <summary>The warehouse the goods are delivered to: the goods receipt that receives the order uses the same one.</summary>
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    /// <summary>Kind of order (domestic, import...).</summary>
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [References<Supplier>]
    [Required, Column("supplier_code"), MaxLength(20)] public string SupplierCode { get; set; } = string.Empty;
    /// <summary>The supplier name when the order was saved.</summary>
    [Column("supplier_name"), MaxLength(200)] public string? SupplierName { get; set; }
    [Column("payment_terms"), MaxLength(200)] public string? PaymentTerms { get; set; }
    /// <summary>The payment term of the catalog (optional); <see cref="PaymentTerms"/> keeps its name at save time, or free text.</summary>
    [References<Core.Domain.Modules.Purchasing.Categories.PaymentTerms.PaymentTerm>(Optional = true)]
    [Column("payment_term_code"), MaxLength(20)] public string? PaymentTermCode { get; set; }
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
    /// <summary>The tax of the whole order (optional); its percent is copied so a later change of the catalog does not move old orders.</summary>
    [References<TaxRate>(Optional = true)]
    [Column("tax_rate_code"), MaxLength(20)] public string? TaxRateCode { get; set; }
    [Column("tax_rate", TypeName = "numeric(7,4)")] public decimal TaxRate { get; set; }
    /// <summary>Total of the lines before tax, in the order's currency.</summary>
    [Column("sub_total", TypeName = "numeric(18,2)")] public decimal SubTotal { get; set; }
    [Column("tax_amount", TypeName = "numeric(18,2)")] public decimal TaxAmount { get; set; }
    /// <summary>Sub total plus tax, in the base currency (what the approval levels by amount look at).</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    /// <summary>The purchase requests the lines carry out, comma separated and derived from the lines.</summary>
    [NotReference("trỏ tới số phiếu yêu cầu mua hàng (khóa của nó là id); PurchaseRequestService không cho hủy phiếu yêu cầu còn đơn mua chưa hủy, và chỉ xóa được phiếu yêu cầu nháp")]
    [Column("purchase_request_code"), MaxLength(500)] public string? PurchaseRequestCode { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    /// <summary>The project this voucher belongs to (dự án), optional: costs are added up per project.</summary>
    [References<Core.Domain.Modules.Purchasing.Categories.Projects.Project>(Optional = true)]
    [Column("project_code"), MaxLength(20)] public string? ProjectCode { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<PurchaseOrderLine> Lines { get; set; } = [];
}

[NotAudited("PurchaseOrderService attaches line changes to the parent order audit entry.")]
[Table("erp_purchase_order_line")]
public class PurchaseOrderLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("order_id")] public long OrderId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    /// <summary>The material name when the line was saved.</summary>
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit the goods are bought in; the goods receipt that receives the line uses the same unit.</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Price before tax, in the order's currency.</summary>
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    /// <summary>The purchase request line this line orders; empty for a line bought without a request.</summary>
    [Column("purchase_request_line_id")] public long? PurchaseRequestLineId { get; set; }
    /// <summary>When the supplier is expected to deliver this line; a line saved without a date takes the delivery date of the order.</summary>
    [Column("delivery_date")] public DateOnly? DeliveryDate { get; set; }
}
