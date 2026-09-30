using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.Users;

[Table("sys_role_command")]
public class SysRoleCommand : CommandPermission
{
    [Column("role_id")] public int RoleId { get; set; }
}
