using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

[Audited("inv_warehouse_type_cat", "warehouseTypeTranslation", Label = "{WarehouseTypeCode} - {LanguageCode}")]
[Table("erp_warehouse_type_translation")]
public sealed class WarehouseTypeTranslation : ErpEntity
{
    [Column("warehouse_type_code"), MaxLength(20)] public string WarehouseTypeCode { get; set; } = string.Empty;
    [Column("language_code"), MaxLength(10)] public string LanguageCode { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
}
