using Core.Application.Common.Exceptions;
using Core.Application.Common.Validation;
using Core.Application.Modules.Currencies;
using Core.Domain.Modules.Currencies;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Currencies;

public sealed class CurrencyService(CoreContext db) : ICurrencyService
{
    public async Task<IReadOnlyList<CurrencyDto>> GetAllAsync(CancellationToken ct) =>
        (await db.Currencies.AsNoTracking().OrderByDescending(x => x.IsBase).ThenBy(x => x.SortOrder).ThenBy(x => x.Code)
            .ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<CurrencyDto> CreateAsync(SaveCurrencyRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 10, "Mã ngoại tệ");
        if (await db.Currencies.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException($"Mã ngoại tệ {code} đã tồn tại.");
        var currency = new Currency
        {
            Code = code,
            SortOrder = (await db.Currencies.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
        };
        Apply(currency, request);
        db.Currencies.Add(currency);
        await ApplyBaseAsync(currency, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(currency);
    }

    public async Task<CurrencyDto> UpdateAsync(string code, SaveCurrencyRequest request, CancellationToken ct)
    {
        var currency = await FindAsync(code, ct);
        if (currency.IsBase && !request.IsBase)
            throw new BusinessRuleException("Hãy chọn đồng tiền hạch toán khác thay vì bỏ chọn đồng tiền hiện tại.");
        Apply(currency, request);
        await ApplyBaseAsync(currency, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(currency);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var currency = await FindAsync(code, ct);
        if (currency.IsBase) throw new BusinessRuleException("Không thể xóa đồng tiền hạch toán.");
        if (await db.ExchangeRates.AnyAsync(x => x.CurrencyCode == currency.Code, ct))
            throw new BusinessRuleException($"Ngoại tệ {currency.Code} đã có tỷ giá. Hãy đặt ngừng sử dụng thay vì xóa.");
        db.Currencies.Remove(currency);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Currency> FindAsync(string code, CancellationToken ct) =>
        await db.Currencies.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("Ngoại tệ không tồn tại.");

    private static void Apply(Currency currency, SaveCurrencyRequest request)
    {
        if (request.DecimalPlaces is < 0 or > 6) throw new BusinessRuleException("Số chữ số thập phân phải từ 0 đến 6.");
        currency.Name = Guard.Required(request.Name, 100, "tên ngoại tệ");
        currency.Symbol = Guard.Optional(request.Symbol, 10, "Ký hiệu") ?? string.Empty;
        currency.DecimalPlaces = (short)request.DecimalPlaces;
        currency.IsBase = request.IsBase;
        currency.IsActive = request.IsActive || request.IsBase;
    }

    /// <summary>Only one base currency: choosing a new one clears the old one.</summary>
    private async Task ApplyBaseAsync(Currency currency, CancellationToken ct)
    {
        if (!currency.IsBase) return;
        await foreach (var other in db.Currencies.Where(x => x.IsBase && x.Code != currency.Code).AsAsyncEnumerable().WithCancellation(ct))
            other.IsBase = false;
    }

    private static CurrencyDto ToDto(Currency x) => new(x.Code, x.Name, x.Symbol, x.DecimalPlaces, x.IsBase, x.IsActive);
}
