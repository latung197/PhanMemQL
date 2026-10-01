using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Currencies;
using Core.Domain.Modules.Currencies;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Currencies;

public sealed class CurrencyService(CoreContext db, IUnitOfWork unitOfWork, IAuditLog auditLog) : ICurrencyService
{
    public async Task<IReadOnlyList<CurrencyDto>> GetAllAsync(CancellationToken ct) =>
        (await db.Currencies.AsNoTracking().OrderByDescending(x => x.IsBase).ThenBy(x => x.SortOrder).ThenBy(x => x.Code)
            .ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<CurrencyDto> CreateAsync(SaveCurrencyRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 10, "field.currencyCode");
        if (await db.Currencies.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("currency.codeExists", code);
        var currency = new Currency
        {
            Code = code,
            SortOrder = (await db.Currencies.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
        };
        Apply(currency, request);
        db.Currencies.Add(currency);
        await SaveAsync(currency, ct);
        return ToDto(currency);
    }

    public async Task<CurrencyDto> UpdateAsync(string code, SaveCurrencyRequest request, CancellationToken ct)
    {
        var currency = await FindAsync(code, ct);
        if (currency.IsBase && !request.IsBase)
            throw new BusinessRuleException("currency.keepBase");
        Apply(currency, request);
        await SaveAsync(currency, ct);
        return ToDto(currency);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var currency = await FindAsync(code, ct);
        if (currency.IsBase) throw new BusinessRuleException("currency.deleteBase");
        if (await db.ExchangeRates.AnyAsync(x => x.CurrencyCode == currency.Code, ct))
            throw new BusinessRuleException("currency.hasRates", currency.Code);
        db.Currencies.Remove(currency);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Currency> FindAsync(string code, CancellationToken ct) =>
        await db.Currencies.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("currency.notFound");

    private static void Apply(Currency currency, SaveCurrencyRequest request)
    {
        if (request.DecimalPlaces is < 0 or > 6) throw new BusinessRuleException("currency.decimalPlaces");
        currency.Name = Guard.Required(request.Name, 100, "field.currencyName");
        currency.Symbol = Guard.Optional(request.Symbol, 10, "field.symbol") ?? string.Empty;
        currency.DecimalPlaces = (short)request.DecimalPlaces;
        currency.IsBase = request.IsBase;
        currency.IsActive = request.IsActive || request.IsBase;
    }

    /// <summary>
    /// Only one base currency (unique index ux_sys_currency_base): choosing a new one clears the old one first, in the
    /// same transaction. EF would otherwise write the new base before clearing the old one and break the index.
    /// </summary>
    private Task SaveAsync(Currency currency, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        if (currency.IsBase)
        {
            var old = db.Currencies.Where(x => x.IsBase && x.Code != currency.Code);
            // ExecuteUpdate bypasses the automatic log: the old base currency is logged by hand.
            foreach (var x in await old.AsNoTracking().ToListAsync(token))
                await auditLog.RecordAsync(new AuditEntry("sys_currencies", "currency", x.Code, $"{x.Code} - {x.Name}",
                    AuditActions.Update, [new AuditChange("isBase", "true", "false")]), token);
            await old.ExecuteUpdateAsync(s => s.SetProperty(x => x.IsBase, false), token);
        }
        await db.SaveChangesAsync(token);
    }, ct);

    private static CurrencyDto ToDto(Currency x) => new(x.Code, x.Name, x.Symbol, x.DecimalPlaces, x.IsBase, x.IsActive);
}
