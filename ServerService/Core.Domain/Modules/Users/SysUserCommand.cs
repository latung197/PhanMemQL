using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>
/// Exception to the role matrix for one user and one function: the row replaces the role rights of that
/// function only. Functions without a row follow the roles.
/// </summary>
[NotAudited("Logged as PERMISSIONS on the user: the rights gained or lost (UserAccessAudit).")]
[Table("sys_user_command")]
public class SysUserCommand : CommandPermission
{
    [Column("user_id")] public int UserId { get; set; }
}
