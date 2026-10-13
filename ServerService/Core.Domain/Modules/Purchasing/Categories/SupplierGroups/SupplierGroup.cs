using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Purchasing.Categories.SupplierGroups;

/// <summary>Nhóm nhà cung cấp (vật tư, thiết bị, dịch vụ...). A supplier points to it with <c>supplier_group_code</c>.</summary>
[Audited("pur_supplier_group_cat", "supplierGroup", Label = "{Code} - {Name}")]
[Table("erp_supplier_group")]
public class SupplierGroup : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
