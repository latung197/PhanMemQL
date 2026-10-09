using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Currencies;

public sealed record CurrencyDto(string Code, string Name, string Symbol, int DecimalPlaces, bool IsBase, bool IsActive,
    RecordStampDto Stamp, uint Version);

public sealed record SaveCurrencyRequest(string Code, string Name, string? Symbol, int DecimalPlaces, bool IsBase,
    bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>
/// The catalog of currencies on ICatalogService (paged list, export, create, update, delete, import). One currency is the
/// base (accounting) currency: choosing another clears the old one; it cannot be unchecked, deleted or stopped. A currency
/// that has exchange rates or is used on vouchers cannot be deleted.
/// </summary>
public interface ICurrencyService : ICatalogService<CurrencyDto, SaveCurrencyRequest>
{
    /// <summary>Every currency, base first (the settings backup).</summary>
    Task<IReadOnlyList<CurrencyDto>> GetAllAsync(CancellationToken ct);
}

public sealed record ExchangeRateDto(string Code, string CurrencyCode, DateOnly Date, decimal BuyRate, decimal SellRate,
    decimal AccountingRate, bool IsActive, RecordStampDto Stamp, uint Version);

/// <summary>
/// A rate of one currency on one day. Its catalog code is derived (<c>USD@2026-10-08</c>): the currency and the day cannot
/// be changed on a saved rate, only the rates and the status; to move a rate to another day, delete it and add a new one.
/// </summary>
public sealed record SaveExchangeRateRequest(string CurrencyCode, DateOnly Date, decimal BuyRate, decimal SellRate,
    decimal AccountingRate, bool IsActive = true, uint? Version = null) : ICatalogRequest
{
    public string Code => ExchangeRateKey.Of(CurrencyCode, Date);
}

/// <summary>The catalog code of a rate: "USD@2026-10-08".</summary>
public static class ExchangeRateKey
{
    public static string Of(string? currencyCode, DateOnly date) =>
        $"{(currencyCode ?? string.Empty).Trim().ToUpperInvariant()}@{date:yyyy-MM-dd}";
}

/// <summary>
/// Exchange rates on ICatalogService (paged list with the filter <c>currency=USD</c>, export, create, update, delete, import).
/// Vouchers in a foreign currency read the rate of their day with <see cref="GetRateAsync"/>.
/// </summary>
public interface IExchangeRateService : ICatalogService<ExchangeRateDto, SaveExchangeRateRequest>
{
    /// <summary>Every rate, newest first (the settings backup).</summary>
    Task<IReadOnlyList<ExchangeRateDto>> GetAllAsync(CancellationToken ct);

    /// <summary>
    /// Accounting rate of the latest active day on or before <paramref name="date"/>; 1 for the base currency.
    /// Vouchers in a foreign currency use this. Throws when the currency has no rate yet.
    /// </summary>
    Task<decimal> GetRateAsync(string currencyCode, DateOnly date, CancellationToken ct);
}
