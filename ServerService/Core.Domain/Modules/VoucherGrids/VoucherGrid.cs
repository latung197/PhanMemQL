using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.VoucherGrids;

/// <summary>
/// A detail grid of a voucher (one tab of one voucher: PNK_ITEMS, PNK_BOM...), shared by the whole system. The table keeps how the grid
/// is shown (order, headers, widths, visibility, how many columns are pinned on the left); what the columns are (field, type, lookups,
/// required) is declared in the frontend code and copied here by the seeder, so a column can be reordered or hidden but never invented.
/// </summary>
[Audited("sys_voucher_grid", "voucherGrid", Label = "{Code}")]
[Table("sys_voucher_grid")]
public class VoucherGrid : ErpEntity
{
    [Key, Column("code"), MaxLength(40)] public string Code { get; set; } = string.Empty;

    /// <summary>Voucher type of VoucherCatalog (PNK, PXK, DMH...).</summary>
    [NotReference("mã loại chứng từ khai báo trong VoucherCatalog")]
    [Required, Column("voucher_type"), MaxLength(20)] public string VoucherType { get; set; } = string.Empty;

    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Column("name_en"), MaxLength(200)] public string? NameEn { get; set; }

    /// <summary>The tab of the voucher form this grid is: items, materials...</summary>
    [Required, Column("tab_key"), MaxLength(20)] public string TabKey { get; set; } = "items";
    [Column("tab_order")] public int TabOrder { get; set; } = 1;
    [Column("allow_add_row")] public bool AllowAddRow { get; set; } = true;
    [Column("allow_delete_row")] public bool AllowDeleteRow { get; set; } = true;

    /// <summary>How many of the visible columns, counted from the left, stay in place when the grid scrolls sideways (0 = none).</summary>
    [Column("pin_count")] public int PinCount { get; set; }
}

[NotAudited("VoucherGridService attaches the change of the columns to the audit entry of the grid.")]
[Table("sys_voucher_grid_column")]
public class VoucherGridColumn : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }

    [References<VoucherGrid>]
    [Required, Column("voucher_grid_code"), MaxLength(40)] public string VoucherGridCode { get; set; } = string.Empty;

    /// <summary>The field of the line the column shows (sku, quantity, unitPrice...); declared in the frontend code, never edited.</summary>
    [Required, Column("field"), MaxLength(60)] public string Field { get; set; } = string.Empty;

    [Required, Column("header"), MaxLength(200)] public string Header { get; set; } = string.Empty;
    [Column("header_en"), MaxLength(200)] public string? HeaderEn { get; set; }

    /// <summary>text, number, quantity, currency, percentage, select, lookup, uom, date, checkbox or readonly (copied from the code).</summary>
    [Required, Column("col_type"), MaxLength(20)] public string ColType { get; set; } = "text";

    [Column("width")] public int? Width { get; set; }
    [Column("min_width")] public int? MinWidth { get; set; }
    [Required, Column("align"), MaxLength(10)] public string Align { get; set; } = "left";

    /// <summary>Decimal places of a numeric column.</summary>
    [Column("decimals")] public int? Decimals { get; set; }

    /// <summary>A required column cannot be hidden (the voucher could not be saved without it).</summary>
    [Column("is_required")] public bool IsRequired { get; set; }
    [Column("is_read_only")] public bool IsReadOnly { get; set; }
    [Column("is_visible")] public bool IsVisible { get; set; } = true;
    [Column("summary"), MaxLength(10)] public string? Summary { get; set; }
    [Column("summary_format"), MaxLength(10)] public string? SummaryFormat { get; set; }
    [Column("sort_order")] public int SortOrder { get; set; }
}
