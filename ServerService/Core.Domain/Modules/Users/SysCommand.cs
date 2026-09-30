using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.Users;

/// <summary>
/// Function catalog row. Permission rows reference it; the codes are the frontend SubMenuKey values.
/// Other legacy columns of sys_command keep their database defaults.
/// </summary>
[Table("sys_command")]
public class SysCommand
{
    [Key, Column("menuid0"), StringLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Column("menuid"), StringLength(64)] public string MenuId { get; set; } = string.Empty;
    [Column("text"), StringLength(100)] public string Text { get; set; } = string.Empty;
    [Column("type"), StringLength(3)] public string Type { get; set; } = "M";
}
