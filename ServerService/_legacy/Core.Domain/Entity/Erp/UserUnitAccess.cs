using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Entity.Erp;

[Table("erp_user_unit")]
public sealed class UserUnitAccess
{
    public int UserId { get; set; }
    [Required, MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    public OrganizationUnit Unit { get; set; } = null!;
}
