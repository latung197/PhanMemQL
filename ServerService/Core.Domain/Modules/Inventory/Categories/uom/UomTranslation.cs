using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

/// <summary>Translated unit name. The name in erp_uom remains the Vietnamese fallback.</summary>
[Audited("inv_uom_cat", "uomTranslation", Label = "{UomCode} - {LanguageCode}")]
[Table("erp_uom_translation")]
public sealed class UomTranslation : ErpEntity
{
    [Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
    [Column("language_code"), MaxLength(10)] public string LanguageCode { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
}
