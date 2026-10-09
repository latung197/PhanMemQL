using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Inventory;

[Audited("inv_uom_conversion_cat", "uomConversion", Label = "{Code}")]
[Table("erp_uom_conversion")]
public class UomConversion : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(40)] public string Code { get; set; } = string.Empty;
    [NotReference("vật tư còn là dữ liệu mẫu trong trình duyệt; thêm [References<Material>] khi vật tư có backend")]
    [Column("material_code"), MaxLength(50)] public string? MaterialCode { get; set; }
    [Column("material_name"), MaxLength(200)] public string? MaterialName { get; set; }
    [References<Uom>]
    [Required, Column("from_uom_code"), MaxLength(20)] public string FromUomCode { get; set; } = string.Empty;
    [References<Uom>]
    [Required, Column("to_uom_code"), MaxLength(20)] public string ToUomCode { get; set; } = string.Empty;
    [Column("factor", TypeName = "numeric(20,8)")] public decimal Factor { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
