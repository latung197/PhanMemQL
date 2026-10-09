using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

[Audited("sys_users", "role", Label = "{RoleName} [{RoleCode}]", SoftDelete = nameof(ValidFlg))]
[Table("sys_role")]
public class SysRole : AuditableEntity, IVersioned
{
    /// <summary>Row version (xmin) against lost updates; see IVersioned.</summary>
    public uint Version { get; set; }

    /// <summary>Role code that grants full access regardless of the permission matrix.</summary>
    public const string AdminCode = "ADMIN";

    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("role_id")]
    public int RoleId { get; set; }

    [NotReference("mã của chính vai trò")]

    [AuditField("code"), Required, Column("role_code"), StringLength(50)] public string RoleCode { get; set; } = string.Empty;
    [AuditField("name"), Required, Column("role_name"), StringLength(100)] public string RoleName { get; set; } = string.Empty;
    [Column("description")] public string? Description { get; set; }
    [AuditIgnore, Column("validflg")] public short ValidFlg { get; set; } = 1;

    public List<SysRoleCommand> Permissions { get; set; } = [];

    [NotMapped] public bool IsAdmin => RoleCode == AdminCode;
}
