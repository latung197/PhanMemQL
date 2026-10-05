using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>
/// Function catalog row. Permission rows reference it; the codes are the frontend SubMenuKey values.
/// Other legacy columns of sys_command keep their database defaults.
/// </summary>
[NotAudited("Function catalog, written by the seeder from FunctionCatalog.")]
[Table("sys_command")]
public class SysCommand
{
    [Key, Column("menuid0"), StringLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Column("menuid"), StringLength(64)] public string MenuId { get; set; } = string.Empty;
    [Column("text"), StringLength(100)] public string Text { get; set; } = string.Empty;
    [Column("text2"), StringLength(100)] public string Text2 { get; set; } = string.Empty;
    [Column("type"), StringLength(3)] public string Type { get; set; } = "M";
    [Column("hide_yn")] public short HideYn { get; set; }
    [Column("menu_kind"), MaxLength(16)] public string? MenuKind { get; set; }
    [Column("menu_key"), MaxLength(64)] public string? MenuKey { get; set; }
    [Column("menu_parent_id"), MaxLength(64)] public string? MenuParentId { get; set; }
    [Column("menu_icon"), MaxLength(64)] public string MenuIcon { get; set; } = string.Empty;
    [Column("menu_icon_color"), MaxLength(64)] public string? MenuIconColor { get; set; }
    [Column("menu_badge_type"), MaxLength(32)] public string? MenuBadgeType { get; set; }
    [Column("menu_direct_function_code"), MaxLength(64)] public string? MenuDirectFunctionCode { get; set; }
    [Column("menu_order_no")] public int MenuOrderNo { get; set; }
    [Column("menu_is_active")] public bool MenuIsActive { get; set; } = true;
}
