using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Currencies;

/// <summary>Currency (ngoại tệ). Exactly one currency is the base (hạch toán) currency.</summary>
[Audited("sys_currencies", "currency", Label = "{Code} - {Name}")]
[Table("sys_currency")]
public class Currency : IVersioned
{
    /// <summary>Row version (xmin) against lost updates; see IVersioned.</summary>
    public uint Version { get; set; }

    [Key, Column("code"), MaxLength(10)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("symbol"), MaxLength(10)] public string Symbol { get; set; } = string.Empty;
    [Column("decimal_places")] public short DecimalPlaces { get; set; } = 2;
    [Column("is_base")] public bool IsBase { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

/// <summary>Rates of one currency on one day, against the base currency.</summary>
[Audited("sys_exchange_rates", "exchangeRate", Label = "{CurrencyCode} {RateDate}")]
[Table("sys_exchange_rate")]
public class ExchangeRate : IVersioned
{
    /// <summary>Row version (xmin) against lost updates; see IVersioned.</summary>
    public uint Version { get; set; }

    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = string.Empty;
    [Column("rate_date")] public DateOnly RateDate { get; set; }
    [Column("buy_rate", TypeName = "numeric(18,6)")] public decimal BuyRate { get; set; }
    [Column("sell_rate", TypeName = "numeric(18,6)")] public decimal SellRate { get; set; }
    /// <summary>Rate used for bookkeeping (tỷ giá hạch toán).</summary>
    [Column("accounting_rate", TypeName = "numeric(18,6)")] public decimal AccountingRate { get; set; }
    [AuditIgnore, Column("updated_at_utc")] public DateTime UpdatedAtUtc { get; set; }
    [AuditIgnore, Column("updated_by_user_id")] public int UpdatedByUserId { get; set; }
}
