using Core.Application.Common.Permissions;

namespace Core.Application.Modules.VoucherStatuses;

/// <summary>One status of one voucher type in one company unit, as the status catalog screen shows it.</summary>
/// <param name="Name">Name this unit set (empty = default); <c>NameEn</c> the English one.</param>
/// <param name="DisplayName">The name in the language of the request: what the voucher screens show.</param>
public sealed record VoucherStatusDto(string UnitCode, string VoucherType, string VoucherName, string Function, string Status,
    string? Name, string? NameEn, string DefaultName, string DisplayName, bool IsEnabled, bool CanDisable, int Order, uint Version);

/// <summary>Version is 0 while the status still has no row (nothing changed from the defaults).</summary>
public sealed record SaveVoucherStatusRequest(string? Name, string? NameEn, bool IsEnabled, uint? Version = null);

/// <summary>Name and state of a status as voucher screens use them (GET /api/voucher-statuses/current).</summary>
public sealed record VoucherStatusNameDto(string Name, bool IsEnabled);

/// <summary>The statuses of the voucher types of one unit.</summary>
public interface IVoucherStatusService
{
    Task<IReadOnlyList<VoucherStatusDto>> GetAllAsync(string unitCode, CancellationToken ct);

    Task<VoucherStatusDto> UpdateAsync(int userId, string unitCode, string voucherType, string status, SaveVoucherStatusRequest request,
        CancellationToken ct);

    /// <summary>Names and states of every status of every voucher type of the unit: {voucherType: {status: ...}}.</summary>
    Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, VoucherStatusNameDto>>> GetNamesAsync(string unitCode, CancellationToken ct);

    /// <summary>Whether the unit uses the status for the voucher function (default: yes). Draft is always enabled.</summary>
    Task<bool> IsEnabledAsync(string unitCode, string function, DocumentStatus status, CancellationToken ct);

    /// <summary>Throws voucherStatus.disabled when the unit switched the status off.</summary>
    Task EnsureEnabledAsync(string unitCode, string function, DocumentStatus status, CancellationToken ct);
}
