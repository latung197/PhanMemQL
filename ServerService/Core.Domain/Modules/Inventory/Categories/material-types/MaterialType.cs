using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>Loại vật tư (nguyên vật liệu, bán thành phẩm, thành phẩm...). Materials point to it with <c>material_type_code</c>.</summary>
[Audited("inv_material_type_cat", "materialType", Label = "{Code} - {Name}")]
[Table("erp_material_type")]
public class MaterialType : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    /// <summary>Free text that classes types together ("Vật tư sản xuất"); shown as a column and a filter.</summary>
    [Column("group_name"), MaxLength(100)] public string? GroupName { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
