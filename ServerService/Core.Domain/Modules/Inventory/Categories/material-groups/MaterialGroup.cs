using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

[Audited("inv_material_group_cat", "materialGroup", Label = "{Code} - {Name}")]
[Table("erp_material_group")]
public class MaterialGroup : ErpEntity
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
