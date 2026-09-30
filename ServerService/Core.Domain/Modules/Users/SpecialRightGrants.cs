using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>Special right granted to a role (row present = granted).</summary>
[Table("sys_role_right")]
public class SysRoleRight : AuditableEntity
{
    [Column("role_id")] public int RoleId { get; set; }
    [Column("menuid0"), MaxLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Column("right_code"), MaxLength(50)] public string RightCode { get; set; } = string.Empty;
}

/// <summary>
/// Exception to the role's special rights for one user: IsGranted = true adds the right, false takes it
/// away. Rights without a row follow the roles.
/// </summary>
[Table("sys_user_right")]
public class SysUserRight : AuditableEntity
{
    [Column("user_id")] public int UserId { get; set; }
    [Column("menuid0"), MaxLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Column("right_code"), MaxLength(50)] public string RightCode { get; set; } = string.Empty;
    [Column("is_granted")] public bool IsGranted { get; set; } = true;
}
