using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Purchasing.Categories.PaymentTerms;
using Core.Domain.Modules.Sales.Categories.CustomerGroups;

namespace Core.Domain.Modules.Sales.Categories.Customers;

/// <summary>Khách hàng. Sales vouchers link to it by code; the group picks the price list and the payment term is the default of its orders.</summary>
[Audited("sales_customers", "customer", Label = "{Code} - {Name}")]
[Table("erp_customer")]
public class Customer : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [NotReference("mã số thuế, không phải mã danh mục")]
    [Column("tax_code"), MaxLength(30)] public string? TaxCode { get; set; }
    [Column("phone"), MaxLength(30)] public string? Phone { get; set; }
    [Column("email"), MaxLength(100)] public string? Email { get; set; }
    [Column("contact_name"), MaxLength(100)] public string? ContactName { get; set; }
    [Column("address"), MaxLength(300)] public string? Address { get; set; }
    /// <summary>The group of the customer (nhóm khách hàng), optional.</summary>
    [References<CustomerGroup>(Optional = true)]
    [Column("customer_group_code"), MaxLength(20)] public string? CustomerGroupCode { get; set; }
    /// <summary>The default payment term of the customer's orders (optional).</summary>
    [References<PaymentTerm>(Optional = true)]
    [Column("payment_term_code"), MaxLength(20)] public string? PaymentTermCode { get; set; }
    /// <summary>Credit limit (hạn mức công nợ) in the base currency; 0 = no limit.</summary>
    [Column("credit_limit", TypeName = "numeric(18,2)")] public decimal CreditLimit { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
