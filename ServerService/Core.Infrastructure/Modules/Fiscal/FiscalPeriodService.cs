using Core.Application.Common.Exceptions;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Modules.Fiscal;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Fiscal;

public sealed class FiscalPeriodService(CoreContext db, ISystemConfigService settings) : IFiscalPeriodService
{
    public async Task<IReadOnlyList<FiscalMonthDto>> GetYearAsync(string unitCode, int year, CancellationToken ct)
    {
        EnsureYear(year);
        var rows = await db.FiscalPeriods.AsNoTracking().Where(x => x.UnitCode == unitCode && x.Year == year).ToListAsync(ct);
        var ids = rows.Where(x => x.LockedByUserId.HasValue).Select(x => x.LockedByUserId!.Value).Distinct().ToList();
        var names = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId)).ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        return Enumerable.Range(1, 12).Select(month =>
        {
            var row = rows.FirstOrDefault(x => x.Month == month);
            return row is { IsLocked: true }
                ? new FiscalMonthDto(year, month, true, row.LockedByUserId is int id ? names.GetValueOrDefault(id) : null, row.LockedAtUtc)
                : new FiscalMonthDto(year, month, false, null, null);
        }).ToList();
    }

    public async Task<IReadOnlyList<FiscalMonthDto>> SetLockAsync(int userId, string unitCode, int year,
        SetFiscalLockRequest request, CancellationToken ct)
    {
        EnsureYear(year);
        var months = (request.Months ?? []).Distinct().ToList();
        if (months.Count == 0 || months.Any(m => m is < 1 or > 12)) throw new BusinessRuleException("Tháng không hợp lệ.");

        var rows = await db.FiscalPeriods.Where(x => x.UnitCode == unitCode && x.Year == year && months.Contains(x.Month)).ToListAsync(ct);
        foreach (var month in months)
        {
            var row = rows.FirstOrDefault(x => x.Month == month);
            if (row is null)
            {
                if (!request.IsLocked) continue;
                db.FiscalPeriods.Add(row = new FiscalPeriod { UnitCode = unitCode, Year = year, Month = month });
            }
            if (row.IsLocked == request.IsLocked) continue;
            row.IsLocked = request.IsLocked;
            // The last person who locked or unlocked the month.
            row.LockedByUserId = userId;
            row.LockedAtUtc = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        return await GetYearAsync(unitCode, year, ct);
    }

    public async Task<DateLockCheck> CheckDateAsync(string unitCode, DateOnly date, CancellationToken ct)
    {
        var start = SystemConfigSections.StartDate(await settings.GetEffectiveAsync(unitCode, ct));
        if (start is DateOnly s && date < s)
            return new DateLockCheck(true, $"Ngày {date:dd/MM/yyyy} trước ngày bắt đầu nhập liệu {s:dd/MM/yyyy}.");
        if (await db.FiscalPeriods.AnyAsync(x => x.UnitCode == unitCode && x.Year == date.Year && x.Month == date.Month && x.IsLocked, ct))
            return new DateLockCheck(true, $"Kỳ tháng {date.Month:00}/{date.Year} của đơn vị {unitCode} đã khóa sổ.");
        return new DateLockCheck(false, null);
    }

    public async Task EnsureDateOpenAsync(string unitCode, DateOnly date, CancellationToken ct)
    {
        var check = await CheckDateAsync(unitCode, date, ct);
        if (check.Locked) throw new BusinessRuleException(check.Reason!);
    }

    private static void EnsureYear(int year)
    {
        if (year is < 2000 or > 2100) throw new BusinessRuleException("Năm không hợp lệ.");
    }
}
