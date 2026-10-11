using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Banners;

/// <summary>A line under the header that every signed-in user of the targeted units sees while it is in force.</summary>
[Audited("sys_banners", "banner", Label = "{Code} - {Message}")]
[Table("sys_banner")]
public class Banner : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(30)] public string Code { get; set; } = string.Empty;
    [Required, Column("message"), MaxLength(500)] public string Message { get; set; } = string.Empty;
    /// <summary>English text, used when the user's language is English; empty = show the default text.</summary>
    [Column("message_en"), MaxLength(500)] public string? MessageEn { get; set; }
    /// <summary>INFO, WARNING or URGENT (cannot be closed by the user); see <see cref="BannerLevels"/>.</summary>
    [Required, Column("level"), MaxLength(8)] public string Level { get; set; } = BannerLevels.Info;
    /// <summary>UTC; empty = already shown.</summary>
    [Column("start_at")] public DateTime? StartAt { get; set; }
    /// <summary>UTC; empty = until switched off.</summary>
    [Column("end_at")] public DateTime? EndAt { get; set; }
    /// <summary>Company unit codes separated by commas (upper case); empty = every unit. Not a table reference: a unit that is
    /// removed later simply stops matching.</summary>
    [Column("unit_codes"), MaxLength(500)] public string UnitCodes { get; set; } = string.Empty;
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class BannerLevels
{
    public const string Info = "INFO";
    public const string Warning = "WARNING";
    public const string Urgent = "URGENT";
    public static readonly IReadOnlyList<string> All = [Info, Warning, Urgent];
}
