using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>Role assigned to a user. The frontend assigns one role per user.</summary>
[NotAudited("Logged as PERMISSIONS on the user: the role field (UserAccessAudit).")]
[Table("sys_user_role")]
public class SysUserRole : AuditableEntity
{
    [Column("user_id")] public int UserId { get; set; }
    [Column("role_id")] public int RoleId { get; set; }
    public SysRole Role { get; set; } = null!;
}
