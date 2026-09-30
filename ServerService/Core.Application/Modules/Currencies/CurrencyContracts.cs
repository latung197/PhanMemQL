namespace Core.Application.Modules.Currencies;

public sealed record CurrencyDto(string Code, string Name, string Symbol, int DecimalPlaces, bool IsBase, bool IsActive);

public sealed record SaveCurrencyRequest(string Code, string Name, string? Symbol, int DecimalPlaces, bool IsBase,
    bool IsActive = true);

public interface ICurrencyService
{
    Task<IReadOnlyList<CurrencyDto>> GetAllAsync(CancellationToken ct);
    Task<CurrencyDto> CreateAsync(SaveCurrencyRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed; the request code is ignored.</summary>
    Task<CurrencyDto> UpdateAsync(string code, SaveCurrencyRequest request, CancellationToken ct);

    /// <summary>Refused for the base currency and for a currency that has exchange rates.</summary>
    Task DeleteAsync(string code, CancellationToken ct);
}

public sealed record ExchangeRateDto(string Id, string CurrencyCode, DateOnly Date, decimal BuyRate, decimal SellRate,
    decimal AccountingRate, string? UpdatedBy, DateTime UpdatedAt);

public sealed record SaveExchangeRateRequest(string CurrencyCode, DateOnly Date, decimal BuyRate, decimal SellRate,
    decimal AccountingRate);

public interface IExchangeRateService
{
    /// <summary>Newest first; optionally one currency only.</summary>
    Task<IReadOnlyList<ExchangeRateDto>> GetAllAsync(string? currencyCode, CancellationToken ct);
    Task<ExchangeRateDto> CreateAsync(int userId, SaveExchangeRateRequest request, CancellationToken ct);
    Task<ExchangeRateDto> UpdateAsync(int userId, long id, SaveExchangeRateRequest request, CancellationToken ct);
    Task DeleteAsync(long id, CancellationToken ct);

    /// <summary>
    /// Accounting rate of the latest day on or before <paramref name="date"/>; 1 for the base currency.
    /// Vouchers in a foreign currency use this. Throws when the currency has no rate yet.
    /// </summary>
    Task<decimal> GetRateAsync(string currencyCode, DateOnly date, CancellationToken ct);
}
