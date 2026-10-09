using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Modules.Currencies;
using Core.Domain.Common;
using Core.Domain.Modules.Currencies;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Currencies;

/// <summary>
/// Tỷ giá: a catalog on CatalogService. A rate is keyed by currency + day, written as its code "USD@2026-10-08"
/// (<see cref="ExchangeRateKey"/>); the currency and the day of a saved rate do not change.
/// </summary>
public sealed class ExchangeRateService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<ExchangeRate, ExchangeRateDto, SaveExchangeRateRequest>(db, batch, excel, audit), IExchangeRateService
{
    private static readonly CatalogSpec Info = new("sys_exchange_rates", "exchangeRate", "field.currencyCode", 24, "DanhMucTyGia");

    // Newest day first by default; the code ends in the day, so it is also a stable tie-breaker.
    private static readonly SortMap<ExchangeRate> SortColumns = SortMap<ExchangeRate>.By(x => x.Code, "date", defaultDescending: true)
        .Add("date", x => x.RateDate).Add("currencyCode", x => x.CurrencyCode).Add("buyRate", x => x.BuyRate)
        .Add("sellRate", x => x.SellRate).Add("accountingRate", x => x.AccountingRate).Add("isActive", x => x.IsActive)
        .Add("code", x => x.Code).Add("order", x => x.SortOrder).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<ExchangeRate> Sorts => SortColumns;

    protected override IQueryable<ExchangeRate> Search(IQueryable<ExchangeRate> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.CurrencyCode, pattern));

    /// <summary>Filters: <c>currency=USD</c> and the days <c>from</c> / <c>to</c> (yyyy-MM-dd).</summary>
    protected override IQueryable<ExchangeRate> ApplyFilters(IQueryable<ExchangeRate> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("currency", out var currency) && !string.IsNullOrWhiteSpace(currency))
        {
            var code = currency.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.CurrencyCode == code);
        }
        if (filters.TryGetValue("from", out var from) && DateOnly.TryParse(from, out var fromDay)) rows = rows.Where(x => x.RateDate >= fromDay);
        if (filters.TryGetValue("to", out var to) && DateOnly.TryParse(to, out var toDay)) rows = rows.Where(x => x.RateDate <= toDay);
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<ExchangeRate>> ExportColumns() =>
    [
        new("export.exchangeRate.currencyCode", x => x.CurrencyCode), new("export.exchangeRate.date", x => x.RateDate.ToString("yyyy-MM-dd")),
        new("export.exchangeRate.buyRate", x => x.BuyRate), new("export.exchangeRate.sellRate", x => x.SellRate),
        new("export.exchangeRate.accountingRate", x => x.AccountingRate), new("export.exchangeRate.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveExchangeRateRequest WithoutVersion(SaveExchangeRateRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<ExchangeRateDto>> MapAsync(IReadOnlyList<ExchangeRate> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<ExchangeRateDto>>(rows.Select(x => new ExchangeRateDto(x.Code, x.CurrencyCode, x.RateDate,
            x.BuyRate, x.SellRate, x.AccountingRate, x.IsActive, stamp(x), x.Version)).ToList());

    public async Task<IReadOnlyList<ExchangeRateDto>> GetAllAsync(CancellationToken ct)
    {
        var rows = await Db.ExchangeRates.AsNoTracking().OrderByDescending(x => x.RateDate).ThenBy(x => x.CurrencyCode).ToListAsync(ct);
        return await MapAsync(rows, await RecordStamps.ForAsync(Db, rows, ct), ct);
    }

    public async Task<decimal> GetRateAsync(string currencyCode, DateOnly date, CancellationToken ct)
    {
        var currency = await Db.Currencies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == currencyCode, ct)
            ?? throw new BusinessRuleException("currency.notFoundCode", currencyCode);
        if (currency.IsBase) return 1;
        var rate = await Db.ExchangeRates.AsNoTracking()
            .Where(x => x.CurrencyCode == currencyCode && x.IsActive && x.RateDate <= date)
            .OrderByDescending(x => x.RateDate).Select(x => (decimal?)x.AccountingRate).FirstOrDefaultAsync(ct);
        return rate ?? throw new BusinessRuleException("exchangeRate.missing", currencyCode, date.ToString("dd/MM/yyyy"));
    }

    protected override async Task ApplyAsync(ExchangeRate rate, SaveExchangeRateRequest request, CancellationToken ct)
    {
        if (request.Date == default) throw new BusinessRuleException("exchangeRate.dateRequired");
        if (rate.CurrencyCode.Length > 0 && rate.Code != request.Code) throw new BusinessRuleException("exchangeRate.keyChanged");
        var code = request.Code[..request.Code.IndexOf('@')];
        var currency = await Db.Currencies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code, ct)
            ?? throw new BusinessRuleException("currency.notFound");
        if (currency.IsBase) throw new BusinessRuleException("exchangeRate.baseCurrency");
        if (request.AccountingRate <= 0) throw new BusinessRuleException("exchangeRate.accountingPositive");
        if (request.BuyRate < 0 || request.SellRate < 0) throw new BusinessRuleException("exchangeRate.notNegative");

        rate.CurrencyCode = code;
        rate.RateDate = request.Date;
        rate.BuyRate = request.BuyRate;
        rate.SellRate = request.SellRate;
        rate.AccountingRate = request.AccountingRate;
        rate.IsActive = request.IsActive;
    }
}
