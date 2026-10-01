using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

[NotAudited("Logged as PERMISSIONS on the role (RoleService).")]
[Table("sys_role_command")]
public class SysRoleCommand : CommandPermission
{
    [Column("role_id")] public int RoleId { get; set; }
}
