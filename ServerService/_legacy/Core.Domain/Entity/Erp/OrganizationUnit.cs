using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Entity.Erp;

[Table("erp_unit")]
public sealed class OrganizationUnit
{
    [Key, MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(150)] public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
