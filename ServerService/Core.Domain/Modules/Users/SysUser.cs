using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

[Table("sys_users", Schema = "public")]
public class SysUser : AuditableEntity
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("user_id")]
    public int UserId { get; set; }

    [Required, Column("user_name"), StringLength(100)] public string UserName { get; set; } = string.Empty;
    [Required, Column("password_hash"), StringLength(255)] public string PasswordHash { get; set; } = string.Empty;
    [Required, Column("full_name"), StringLength(100)] public string FullName { get; set; } = string.Empty;

    /// <summary>Default company unit (ma_dvcs) selected at login.</summary>
    [Column("ma_dvcs"), StringLength(20)] public string MaDvcs { get; set; } = string.Empty;

    [Column("email"), StringLength(150)] public string? Email { get; set; }
    [Column("phone"), StringLength(20)] public string? Phone { get; set; }
    [Column("department"), StringLength(100)] public string Department { get; set; } = string.Empty;
    [Column("avatar")] public string Avatar { get; set; } = string.Empty;
    [Column("theme_pref"), StringLength(10)] public string ThemePref { get; set; } = "light";
    [Column("notifications_enabled")] public bool NotificationsEnabled { get; set; } = true;

    /// <summary>Incremented to invalidate every issued token of the user.</summary>
    [Column("security_version")] public int SecurityVersion { get; set; } = 1;

    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("employee_code")] public string EmployeeCode { get; set; } = string.Empty;

    /// <summary>Legacy admin flag: a value containing "0" marks an administrator.</summary>
    [Column("auth_fl"), MaxLength(25)] public string AuthFl { get; set; } = string.Empty;

    [Column("enablefl")] public int EnableFl { get; set; } = 1;

    /// <summary>Soft-delete flag: 1 = row in use.</summary>
    [Column("validflg")] public int ValidFlg { get; set; } = 1;

    [Column("gender")] public bool Gender { get; set; }

    [NotMapped] public bool CanSignIn => ValidFlg == 1 && EnableFl == 1 && IsActive;
}
