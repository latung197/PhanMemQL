using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Inventory.Categories.suppliers;
using Core.Domain.Modules.TaxRates;

namespace Core.Domain.Modules.Purchasing.Documents.PurchaseInvoices;

/// <summary>
/// Hóa đơn mua hàng: the invoice of a supplier, the ground of what is owed to it (công nợ phải trả). It goes through approval like any
/// voucher but never posts to the stock ledger. Its lines carry out lines of goods receipts and / or purchase orders (matching what was
/// ordered, received and invoiced); nothing is stored on the sources, the invoiced quantity is computed from the invoices.
/// </summary>
[Audited("pur_invoice", "purchaseInvoice", Label = "{Code}")]
[Table("erp_purchase_invoice")]
public class PurchaseInvoice : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    /// <summary>The day the invoice is booked (the month lock looks at it).</summary>
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    /// <summary>Kind of invoice (goods, service...).</summary>
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [References<Supplier>]
    [Required, Column("supplier_code"), MaxLength(20)] public string SupplierCode { get; set; } = string.Empty;
    /// <summary>The supplier name when the invoice was saved.</summary>
    [Column("supplier_name"), MaxLength(200)] public string? SupplierName { get; set; }
    /// <summary>Number printed on the supplier's invoice; with the series and the supplier it is unique among invoices that are not cancelled.</summary>
    [Required, Column("invoice_no"), MaxLength(50)] public string InvoiceNo { get; set; } = string.Empty;
    [Column("invoice_series"), MaxLength(30)] public string? InvoiceSeries { get; set; }
    /// <summary>Date printed on the supplier's invoice (not after the booking date).</summary>
    [Column("invoice_date")] public DateOnly InvoiceDate { get; set; }
    /// <summary>The day payment is due: invoice date plus the days of the payment term, or typed by hand.</summary>
    [Column("due_date")] public DateOnly DueDate { get; set; }
    [Column("payment_terms"), MaxLength(200)] public string? PaymentTerms { get; set; }
    [References<Core.Domain.Modules.Purchasing.Categories.PaymentTerms.PaymentTerm>(Optional = true)]
    [Column("payment_term_code"), MaxLength(20)] public string? PaymentTermCode { get; set; }
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
    /// <summary>The tax of the whole invoice (optional); its percent is copied so a later change of the catalog does not move old invoices.</summary>
    [References<TaxRate>(Optional = true)]
    [Column("tax_rate_code"), MaxLength(20)] public string? TaxRateCode { get; set; }
    [Column("tax_rate", TypeName = "numeric(7,4)")] public decimal TaxRate { get; set; }
    /// <summary>Total of the lines before tax, in the invoice's currency.</summary>
    [Column("sub_total", TypeName = "numeric(18,2)")] public decimal SubTotal { get; set; }
    [Column("tax_amount", TypeName = "numeric(18,2)")] public decimal TaxAmount { get; set; }
    /// <summary>Sub total plus tax, in the base currency: what is owed to the supplier (and what the approval levels by amount look at).</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    /// <summary>The purchase orders the lines follow, comma separated and derived from the lines.</summary>
    [NotReference("trỏ tới số đơn mua hàng (khóa của nó là id); PurchaseOrderService không cho hủy đơn còn hóa đơn chưa hủy")]
    [Column("purchase_order_code"), MaxLength(500)] public string? PurchaseOrderCode { get; set; }
    /// <summary>The goods receipts the lines follow, comma separated and derived from the lines.</summary>
    [NotReference("trỏ tới số phiếu nhập kho (khóa của nó là id); GoodsReceiptService không cho hủy, bỏ ghi sổ, sửa hay xóa phiếu còn hóa đơn chưa hủy")]
    [Column("goods_receipt_code"), MaxLength(500)] public string? GoodsReceiptCode { get; set; }
    [References<Core.Domain.Modules.Purchasing.Categories.Projects.Project>(Optional = true)]
    [Column("project_code"), MaxLength(20)] public string? ProjectCode { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<PurchaseInvoiceLine> Lines { get; set; } = [];
}

[NotAudited("PurchaseInvoiceService attaches line changes to the parent invoice audit entry.")]
[Table("erp_purchase_invoice_line")]
public class PurchaseInvoiceLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("invoice_id")] public long InvoiceId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Price on the invoice before tax, in the invoice's currency (the invoice is the truth: it may differ from the order).</summary>
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    /// <summary>The purchase order line this invoice line bills; empty for a line without an order.</summary>
    [Column("purchase_order_line_id")] public long? PurchaseOrderLineId { get; set; }
    /// <summary>The goods receipt line this invoice line bills; empty for a line without a receipt (billed before the goods arrive).</summary>
    [Column("goods_receipt_line_id")] public long? GoodsReceiptLineId { get; set; }
}
