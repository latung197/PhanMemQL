using Core.Application.Common.Exceptions;
using Core.Application.Modules.Currencies;
using Core.Domain.Modules.Currencies;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Currencies;

public sealed class ExchangeRateService(CoreContext db) : IExchangeRateService
{
    public async Task<IReadOnlyList<ExchangeRateDto>> GetAllAsync(string? currencyCode, CancellationToken ct)
    {
        var query = db.ExchangeRates.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(currencyCode)) query = query.Where(x => x.CurrencyCode == currencyCode);
        var rates = await query.OrderByDescending(x => x.RateDate).ThenBy(x => x.CurrencyCode).ToListAsync(ct);
        var names = await UserNamesAsync(rates.Select(x => x.UpdatedByUserId), ct);
        return rates.Select(x => ToDto(x, names)).ToList();
    }

    public async Task<ExchangeRateDto> CreateAsync(int userId, SaveExchangeRateRequest request, CancellationToken ct)
    {
        var rate = new ExchangeRate();
        await ApplyAsync(rate, userId, request, ct);
        db.ExchangeRates.Add(rate);
        await db.SaveChangesAsync(ct);
        return ToDto(rate, await UserNamesAsync([userId], ct));
    }

    public async Task<ExchangeRateDto> UpdateAsync(int userId, long id, SaveExchangeRateRequest request, CancellationToken ct)
    {
        var rate = await db.ExchangeRates.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("exchangeRate.notFound");
        db.ExpectVersion(rate, request.Version);
        await ApplyAsync(rate, userId, request, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(rate, await UserNamesAsync([userId], ct));
    }

    public async Task DeleteAsync(long id, CancellationToken ct)
    {
        var rate = await db.ExchangeRates.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("exchangeRate.notFound");
        db.ExchangeRates.Remove(rate);
        await db.SaveChangesAsync(ct);
    }

    public async Task<decimal> GetRateAsync(string currencyCode, DateOnly date, CancellationToken ct)
    {
        var currency = await db.Currencies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == currencyCode, ct)
            ?? throw new BusinessRuleException("currency.notFoundCode", currencyCode);
        if (currency.IsBase) return 1;
        var rate = await db.ExchangeRates.AsNoTracking()
            .Where(x => x.CurrencyCode == currencyCode && x.RateDate <= date)
            .OrderByDescending(x => x.RateDate).Select(x => (decimal?)x.AccountingRate).FirstOrDefaultAsync(ct);
        return rate ?? throw new BusinessRuleException("exchangeRate.missing", currencyCode, date.ToString("dd/MM/yyyy"));
    }

    private async Task ApplyAsync(ExchangeRate rate, int userId, SaveExchangeRateRequest request, CancellationToken ct)
    {
        var code = request.CurrencyCode?.Trim().ToUpperInvariant() ?? string.Empty;
        var currency = await db.Currencies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code, ct)
            ?? throw new BusinessRuleException("currency.notFound");
        if (currency.IsBase) throw new BusinessRuleException("exchangeRate.baseCurrency");
        if (request.AccountingRate <= 0) throw new BusinessRuleException("exchangeRate.accountingPositive");
        if (request.BuyRate < 0 || request.SellRate < 0) throw new BusinessRuleException("exchangeRate.notNegative");
        if (await db.ExchangeRates.AnyAsync(x => x.Id != rate.Id && x.CurrencyCode == code && x.RateDate == request.Date, ct))
            throw new BusinessRuleException("exchangeRate.dayExists", request.Date.ToString("dd/MM/yyyy"), code);

        rate.CurrencyCode = code;
        rate.RateDate = request.Date;
        rate.BuyRate = request.BuyRate;
        rate.SellRate = request.SellRate;
        rate.AccountingRate = request.AccountingRate;
        rate.UpdatedAtUtc = DateTime.UtcNow;
        rate.UpdatedByUserId = userId;
    }

    private async Task<Dictionary<int, string>> UserNamesAsync(IEnumerable<int> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        return await db.Users.AsNoTracking().Where(x => list.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
    }

    private static ExchangeRateDto ToDto(ExchangeRate x, IReadOnlyDictionary<int, string> names) =>
        new(x.Id.ToString(), x.CurrencyCode, x.RateDate, x.BuyRate, x.SellRate, x.AccountingRate,
            names.GetValueOrDefault(x.UpdatedByUserId), x.UpdatedAtUtc, x.Version);
}
