using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Sales.Categories.CustomerGroups;

/// <summary>Nhóm khách hàng (đại lý, bán lẻ, dự án...). A customer points to it with <c>customer_group_code</c>; a price list may apply to one group.</summary>
[Audited("sales_customer_group_cat", "customerGroup", Label = "{Code} - {Name}")]
[Table("erp_customer_group")]
public class CustomerGroup : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
