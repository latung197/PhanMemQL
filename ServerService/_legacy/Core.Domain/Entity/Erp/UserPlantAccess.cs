using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Entity.Erp;

[Table("erp_user_plant")]
public sealed class UserPlantAccess
{
    public int UserId { get; set; }
    [MaxLength(20)] public string PlantCode { get; set; } = string.Empty;
    public Plant Plant { get; set; } = null!;
}
