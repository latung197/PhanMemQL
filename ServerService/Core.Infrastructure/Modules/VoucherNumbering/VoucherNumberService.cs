using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.VoucherNumbering;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Persistence.Sql;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.VoucherNumbering;

/// <summary>
/// Number series of the vouchers. The rules (prefix, pattern) are edited with EF; the counters are
/// only changed by Sql/NextNumber.sql so that concurrent saves stay unique.
/// </summary>
public sealed class VoucherNumberService(CoreContext db, ISqlExecutor sql) : IVoucherNumberService
{
    public async Task<IReadOnlyList<VoucherNumberingDto>> GetAllAsync(string unitCode, CancellationToken ct)
    {
        var rules = await db.VoucherNumberingRules.AsNoTracking().ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.Now);
        var result = new List<VoucherNumberingDto>();
        // Catalog order, so the settings screen lists vouchers module by module.
        foreach (var voucher in VoucherCatalog.All)
            if (rules.FirstOrDefault(x => x.VoucherType == voucher.VoucherType) is { } rule)
                result.Add(ToDto(rule, await PreviewAsync(rule, unitCode, today, ct)));
        return result;
    }

    public async Task<VoucherNumberingDto> UpdateAsync(int userId, string voucherType, SaveVoucherNumberingRequest request,
        string unitCode, CancellationToken ct)
    {
        var rule = await FindAsync(voucherType, ct);
        var prefix = Guard.Required(request.Prefix, 20, "tiền tố").ToUpperInvariant();
        var pattern = Guard.Required(request.Pattern, 100, "mẫu số chứng từ");
        VoucherNumberFormat.Validate(pattern, prefix, request.Digits);
        rule.Prefix = prefix;
        rule.Pattern = pattern;
        rule.Digits = (short)request.Digits;
        rule.UpdatedAtUtc = DateTime.UtcNow;
        rule.UpdatedByUserId = userId;
        await db.SaveChangesAsync(ct);
        return ToDto(rule, await PreviewAsync(rule, unitCode, DateOnly.FromDateTime(DateTime.Now), ct));
    }

    public async Task<string> PreviewAsync(string voucherType, string unitCode, DateOnly date, CancellationToken ct) =>
        await PreviewAsync(await FindAsync(voucherType, ct), unitCode, date, ct);

    public async Task<string> NextAsync(string voucherType, string unitCode, DateOnly date, CancellationToken ct)
    {
        var rule = await FindAsync(voucherType, ct);
        var number = await sql.ExecuteScalarAsync<int>(SqlScripts.Get("VoucherNumbering", "NextNumber"), new
        {
            voucherType = rule.VoucherType,
            unitCode,
            periodKey = VoucherNumberFormat.PeriodKey(rule.Pattern, date)
        }, ct);
        return VoucherNumberFormat.Format(rule.Pattern, rule.Prefix, rule.Digits, unitCode, date, number);
    }

    private async Task<string> PreviewAsync(VoucherNumberingRule rule, string unitCode, DateOnly date, CancellationToken ct)
    {
        var period = VoucherNumberFormat.PeriodKey(rule.Pattern, date);
        var last = await db.VoucherSequences.AsNoTracking()
            .Where(x => x.VoucherType == rule.VoucherType && x.UnitCode == unitCode && x.PeriodKey == period)
            .Select(x => (int?)x.LastNumber).FirstOrDefaultAsync(ct) ?? 0;
        return VoucherNumberFormat.Format(rule.Pattern, rule.Prefix, rule.Digits, unitCode, date, last + 1);
    }

    private async Task<VoucherNumberingRule> FindAsync(string voucherType, CancellationToken ct)
    {
        var code = voucherType?.Trim().ToUpperInvariant() ?? string.Empty;
        return await db.VoucherNumberingRules.FirstOrDefaultAsync(x => x.VoucherType == code, ct)
            ?? throw new NotFoundException($"Loại chứng từ {code} không tồn tại.");
    }

    private static VoucherNumberingDto ToDto(VoucherNumberingRule x, string next) =>
        new(x.VoucherType, x.MenuId0, x.Name, x.Prefix, x.Pattern, x.Digits, next);
}
