using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

[Table("sys_role")]
public class SysRole : AuditableEntity
{
    /// <summary>Role code that grants full access regardless of the permission matrix.</summary>
    public const string AdminCode = "ADMIN";

    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("role_id")]
    public int RoleId { get; set; }

    [Required, Column("role_code"), StringLength(50)] public string RoleCode { get; set; } = string.Empty;
    [Required, Column("role_name"), StringLength(100)] public string RoleName { get; set; } = string.Empty;
    [Column("description")] public string? Description { get; set; }
    [Column("validflg")] public short ValidFlg { get; set; } = 1;

    public List<SysRoleCommand> Permissions { get; set; } = [];

    [NotMapped] public bool IsAdmin => RoleCode == AdminCode;
}
