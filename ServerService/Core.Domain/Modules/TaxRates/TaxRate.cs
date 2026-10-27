using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Accounts;

namespace Core.Domain.Modules.TaxRates;

/// <summary>Mã thuế (VAT, thuế nhập khẩu...). Materials and vouchers point to it with a <c>tax_rate_code</c> column.</summary>
[Audited("sys_tax_rates", "taxRate", Label = "{Code} - {Name}")]
[Table("sys_tax_rate")]
public class TaxRate : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    /// <summary>VAT (giá trị gia tăng), IMPORT (nhập khẩu) or OTHER; see <see cref="TaxTypes"/>.</summary>
    [Required, Column("tax_type"), MaxLength(10)] public string TaxType { get; set; } = TaxTypes.Vat;
    /// <summary>Percent, 0 to 100.</summary>
    [Column("rate", TypeName = "numeric(7,4)")] public decimal Rate { get; set; }
    /// <summary>Not subject to tax at all (different from a taxed rate of 0%).</summary>
    [Column("is_exempt")] public bool IsExempt { get; set; }
    /// <summary>The account the tax of purchases goes to (e.g. 1331 input VAT); a leaf account.</summary>
    [References<Account>(Optional = true)]
    [Column("input_account_code"), MaxLength(20)] public string? InputAccountCode { get; set; }
    /// <summary>The account the tax of sales goes to (e.g. 33311 output VAT, 3333 import duties); a leaf account.</summary>
    [References<Account>(Optional = true)]
    [Column("output_account_code"), MaxLength(20)] public string? OutputAccountCode { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class TaxTypes
{
    public const string Vat = "VAT";
    public const string Import = "IMPORT";
    public const string Other = "OTHER";
    public static readonly IReadOnlyList<string> All = [Vat, Import, Other];
}
