using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>
/// One sign-in attempt or sign-out (Settings › Người dùng &amp; phân quyền › Bảo mật đăng nhập): who, when, from where and the result
/// (SUCCESS, WRONG_PASSWORD, UNKNOWN_USER, UNIT_DENIED, BLOCKED, LOGOUT, IDLE_TIMEOUT). The wrong passwords of a user name since its last
/// success also decide whether it has to wait before trying again. Rows are purged with the change log retention.
/// </summary>
[NotAudited("The login history is itself a log.")]
[Table("sys_login_history")]
public class LoginHistory
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("id")] public long Id { get; set; }
    [Column("log_time")] public DateTime LogTime { get; set; }
    /// <summary>The user name as typed (lower case), also when no such account exists.</summary>
    [Required, Column("user_name"), MaxLength(100)] public string UserName { get; set; } = string.Empty;
    [Column("user_id")] public int? UserId { get; set; }
    [NotReference("the unit chosen at sign-in, kept as it was")]
    [Column("unit_code"), MaxLength(20)] public string? UnitCode { get; set; }
    [Column("ip_address"), MaxLength(64)] public string? IpAddress { get; set; }
    [Column("user_agent"), MaxLength(300)] public string? UserAgent { get; set; }
    [Required, Column("result"), MaxLength(30)] public string Result { get; set; } = string.Empty;
}

/// <summary>The earlier password hashes of an account, so a new password cannot repeat one of the last few.</summary>
[NotAudited("Password hashes are never shown in the change log.")]
[Table("sys_password_history")]
public class PasswordHistory
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("id")] public long Id { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Required, Column("password_hash"), MaxLength(255)] public string PasswordHash { get; set; } = string.Empty;
    [Column("created_at")] public DateTime CreatedAt { get; set; }
}
