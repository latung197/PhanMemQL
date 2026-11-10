using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.{{PhanHe}};

/// <summary>{{tenVi}} ({{ma}}): danh mục trên khung CatalogService.</summary>
[Audited("{{ma}}", "{{ten}}", Label = "{Code} - {Name}")]
[Table("{{bang}}")]
public class {{Ten}} : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
