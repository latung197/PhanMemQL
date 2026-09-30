using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.Users;

/// <summary>
/// Exception to the role matrix for one user and one function: the row replaces the role rights of that
/// function only. Functions without a row follow the roles.
/// </summary>
[Table("sys_user_command")]
public class SysUserCommand : CommandPermission
{
    [Column("user_id")] public int UserId { get; set; }
}
