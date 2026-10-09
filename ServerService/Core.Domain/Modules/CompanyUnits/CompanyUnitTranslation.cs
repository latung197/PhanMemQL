using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Languages;

namespace Core.Domain.Modules.CompanyUnits;

[Audited("inv_company_unit_cat", "companyUnitTranslation", Label = "{UnitCode} - {LanguageCode}")]
[Table("sys_company_unit_translation")]
public sealed class CompanyUnitTranslation : ErpEntity
{
    [References<CompanyUnit>(BlocksDelete = false)]
    [Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [References<Language>(BlocksDelete = false)]
    [Column("language_code"), MaxLength(10)] public string LanguageCode { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(150)] public string Name { get; set; } = string.Empty;
}
