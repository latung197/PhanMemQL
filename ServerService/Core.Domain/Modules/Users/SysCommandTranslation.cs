using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>Menu label in one language; a new language adds rows, never schema columns.</summary>
[NotAudited("Navigation translation, not business data.")]
[Table("sys_command_translation")]
public sealed class SysCommandTranslation
{
    [Column("menuid0"), MaxLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Column("language_code"), MaxLength(10)] public string LanguageCode { get; set; } = string.Empty;
    [Required, Column("title"), MaxLength(200)] public string Title { get; set; } = string.Empty;
}
