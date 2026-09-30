namespace Core.Application.Modules.Fiscal;

public sealed record FiscalMonthDto(int Year, int Month, bool IsLocked, string? LockedBy, DateTime? LockedAt);

public sealed record SetFiscalLockRequest(IReadOnlyList<int> Months, bool IsLocked);

public sealed record DateLockCheck(bool Locked, string? Reason);

/// <summary>
/// Khóa sổ theo tháng, per company unit. A voucher date is closed when it is before the data entry start
/// date (setting fiscalConfig.startDate) or its month is locked for the unit.
/// </summary>
public interface IFiscalPeriodService
{
    /// <summary>The twelve months of the year with their lock state.</summary>
    Task<IReadOnlyList<FiscalMonthDto>> GetYearAsync(string unitCode, int year, CancellationToken ct);

    Task<IReadOnlyList<FiscalMonthDto>> SetLockAsync(int userId, string unitCode, int year, SetFiscalLockRequest request,
        CancellationToken ct);

    Task<DateLockCheck> CheckDateAsync(string unitCode, DateOnly date, CancellationToken ct);

    /// <summary>
    /// Voucher services call this before creating, changing or deleting a voucher of that date; it throws
    /// BusinessRuleException with the reason when the period is closed.
    /// </summary>
    Task EnsureDateOpenAsync(string unitCode, DateOnly date, CancellationToken ct);
}
