using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Languages;

/// <summary>
/// A language users may work in (Settings › Ngôn ngữ). Exactly one is the default: users without their own
/// choice see it, and it is the fallback when a text or a translated value is missing.
/// </summary>
[Audited("sys_languages", "language", Label = "{Code} - {Name}")]
[Table("sys_language")]
public class Language
{
    public const string Vietnamese = "vi";

    [Key, Column("code"), MaxLength(10)] public string Code { get; set; } = string.Empty;
    /// <summary>Name in the default language, e.g. "Tiếng Anh".</summary>
    [Required, Column("name"), MaxLength(50)] public string Name { get; set; } = string.Empty;
    /// <summary>Name in the language itself, e.g. "English" (shown in the language picker).</summary>
    [Required, Column("native_name"), MaxLength(50)] public string NativeName { get; set; } = string.Empty;
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("is_default")] public bool IsDefault { get; set; }
    [Column("sort_order")] public int SortOrder { get; set; }
}
