using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.LoginNotices;

/// <summary>A notice shown beside the login form (welcome, maintenance window, rule). Read without signing in, so keep it free of internal data.</summary>
[Audited("sys_login_notices", "loginNotice", Label = "{Code} - {Title}")]
[Table("sys_login_notice")]
public class LoginNotice : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(30)] public string Code { get; set; } = string.Empty;
    [Required, Column("title"), MaxLength(200)] public string Title { get; set; } = string.Empty;
    [Column("content"), MaxLength(2000)] public string Content { get; set; } = string.Empty;
    /// <summary>English text, used when the visitor's language is English; empty = show the default text.</summary>
    [Column("title_en"), MaxLength(200)] public string? TitleEn { get; set; }
    [Column("content_en"), MaxLength(2000)] public string? ContentEn { get; set; }
    /// <summary>INFO, WELCOME, MAINTENANCE, RULE or BACKGROUND (picture only); see <see cref="LoginNoticeKinds"/>.</summary>
    [Required, Column("kind"), MaxLength(12)] public string Kind { get; set; } = LoginNoticeKinds.Info;
    /// <summary>Shown from this day (inclusive); empty = already.</summary>
    [Column("start_date")] public DateOnly? StartDate { get; set; }
    /// <summary>Shown until this day (inclusive); empty = no end.</summary>
    [Column("end_date")] public DateOnly? EndDate { get; set; }
    /// <summary>A pinned notice keeps the big slot of the login screen; the others take turns in the small one.</summary>
    [Column("pinned")] public bool Pinned { get; set; }
    /// <summary>The picture (sys_login_image); empty = text only.</summary>
    [References<LoginImage>(Optional = true, BlocksDelete = false), Column("login_image_code"), MaxLength(40)]
    public string? LoginImageCode { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class LoginNoticeKinds
{
    public const string Info = "INFO";
    public const string Welcome = "WELCOME";
    public const string Maintenance = "MAINTENANCE";
    public const string Rule = "RULE";
    /// <summary>No text: its picture is the background of the login screen.</summary>
    public const string Background = "BACKGROUND";
    public static readonly IReadOnlyList<string> All = [Info, Welcome, Maintenance, Rule, Background];
}
