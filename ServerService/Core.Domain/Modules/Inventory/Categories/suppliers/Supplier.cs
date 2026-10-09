using Core.Domain.Common;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text;

namespace Core.Domain.Modules.Inventory.Categories.suppliers
{
    /// <summary>Nhà cung cấp. Goods receipts link to it by code.</summary>
    [Audited("inv_supplier_cat", "supplier", Label = "{Code} - {Name}")]
    [Table("erp_supplier")]
    public class Supplier : ErpEntity   , ICatalogRecord
    {
        [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
        [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
        [NotReference("mã số thuế, không phải mã danh mục")]
        [Column("tax_code"), MaxLength(30)] public string? TaxCode { get; set; }
        [Column("phone"), MaxLength(30)] public string? Phone { get; set; }
        [Column("address"), MaxLength(300)] public string? Address { get; set; }
        [Column("note"), MaxLength(300)] public string? Note { get; set; }
        [Column("is_active")] public bool IsActive { get; set; } = true;
        [Column("sort_order")] public int SortOrder { get; set; }
    }

}
