using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.Users;

/// <summary>The permission matrix of one user; it replaces the role matrix when present.</summary>
[Table("sys_user_command")]
public class SysUserCommand : CommandPermission
{
    [Column("user_id")] public int UserId { get; set; }
}
