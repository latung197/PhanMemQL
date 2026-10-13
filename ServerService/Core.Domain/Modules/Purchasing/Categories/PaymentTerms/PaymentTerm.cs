using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Purchasing.Categories.PaymentTerms;

/// <summary>Điều khoản thanh toán (thanh toán ngay, công nợ 30 ngày...). Purchase orders point to it with <c>payment_term_code</c>.</summary>
[Audited("pur_payment_term_cat", "paymentTerm", Label = "{Code} - {Name}")]
[Table("erp_payment_term")]
public class PaymentTerm : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    /// <summary>Days to pay after the invoice (0 = at once).</summary>
    [Column("days")] public int Days { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
