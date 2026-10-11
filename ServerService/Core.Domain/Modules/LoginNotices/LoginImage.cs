using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.LoginNotices;

/// <summary>A picture of a login screen notice, kept in the database. Never listed: it is read by its code (unguessable) and the
/// code changes with every upload, so the browser may cache it for good.</summary>
[NotAudited("binary picture; the notice that uses it is audited")]
[Table("sys_login_image")]
public class LoginImage : ErpEntity
{
    [Key, Column("code"), MaxLength(40)] public string Code { get; set; } = string.Empty;
    [Required, Column("content_type"), MaxLength(30)] public string ContentType { get; set; } = string.Empty;
    [Column("size_bytes")] public int SizeBytes { get; set; }
    [Column("data")] public byte[] Data { get; set; } = [];
}
