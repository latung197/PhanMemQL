using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Sales.Categories.Customers;
using Core.Domain.Modules.TaxRates;

namespace Core.Domain.Modules.Sales.Documents.SalesOrders;

/// <summary>
/// Đơn bán hàng: the order of a customer. It goes through approval like any voucher but never posts to a ledger; goods issues
/// (inv_issue) pull the lines of an approved order and issue them (part by part, until the order is delivered in full), and
/// sales invoices bill them later. The price of a line is typed or taken from the price list that fits the customer.
/// </summary>
[Audited("sales_orders", "salesOrder", Label = "{Code}")]
[Table("erp_sales_order")]
public class SalesOrder : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    /// <summary>The day the goods are to be delivered (not before the voucher date).</summary>
    [Column("delivery_date")] public DateOnly? DeliveryDate { get; set; }
    /// <summary>The warehouse the goods are issued from: the goods issue that delivers the order uses the same one.</summary>
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    /// <summary>Kind of sale (domestic, export...).</summary>
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [References<Customer>]
    [Required, Column("customer_code"), MaxLength(20)] public string CustomerCode { get; set; } = string.Empty;
    /// <summary>The customer name when the order was saved.</summary>
    [Column("customer_name"), MaxLength(200)] public string? CustomerName { get; set; }
    [Column("delivery_address"), MaxLength(300)] public string? DeliveryAddress { get; set; }
    [Column("payment_terms"), MaxLength(200)] public string? PaymentTerms { get; set; }
    [References<Core.Domain.Modules.Purchasing.Categories.PaymentTerms.PaymentTerm>(Optional = true)]
    [Column("payment_term_code"), MaxLength(20)] public string? PaymentTermCode { get; set; }
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
    /// <summary>The tax of the whole order (optional); its percent is copied so a later change of the catalog does not move old orders.</summary>
    [References<TaxRate>(Optional = true)]
    [Column("tax_rate_code"), MaxLength(20)] public string? TaxRateCode { get; set; }
    [Column("tax_rate", TypeName = "numeric(7,4)")] public decimal TaxRate { get; set; }
    /// <summary>Total of the lines before tax, in the order currency.</summary>
    [Column("sub_total", TypeName = "numeric(18,2)")] public decimal SubTotal { get; set; }
    [Column("tax_amount", TypeName = "numeric(18,2)")] public decimal TaxAmount { get; set; }
    /// <summary>Sub total plus tax, in the base currency (what the approval levels by amount look at).</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [References<Core.Domain.Modules.Purchasing.Categories.Projects.Project>(Optional = true)]
    [Column("project_code"), MaxLength(20)] public string? ProjectCode { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<SalesOrderLine> Lines { get; set; } = [];
}

[NotAudited("SalesOrderService attaches line changes to the parent order audit entry.")]
[Table("erp_sales_order_line")]
public class SalesOrderLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("order_id")] public long OrderId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit the goods are sold in; the goods issue that delivers the line uses the same unit.</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Selling price before tax, in the order currency.</summary>
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}
