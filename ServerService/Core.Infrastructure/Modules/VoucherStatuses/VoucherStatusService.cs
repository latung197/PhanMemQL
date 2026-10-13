using Core.Application.Common.Caching;
using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Application.Common.Validation;
using Core.Application.Modules.SystemConfig;
using Core.Application.Modules.VoucherStatuses;
using Core.Domain.Modules.VoucherStatuses;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.VoucherStatuses;

/// <summary>
/// The statuses of the vouchers of a company unit: the code declares them (VoucherStatusCatalog), the table sys_voucher_status keeps
/// what the unit changed (name, English name, switched off). A status with no row has its default name and is in use. The rows of
/// a unit are cached and dropped when the table is written.
/// </summary>
public sealed class VoucherStatusService(CoreContext db, IAppCache cache, ISystemParameters parameters) : IVoucherStatusService
{
    private static string KeyOf(string unitCode) => $"voucherStatus:{unitCode}";

    private async Task<IReadOnlyDictionary<(string Type, string Status), VoucherStatus>> RowsAsync(string unitCode, CancellationToken ct) =>
        await db.CachedAsync(cache, KeyOf(unitCode), ["sys_voucher_status"], async token =>
            (IReadOnlyDictionary<(string Type, string Status), VoucherStatus>)(await db.VoucherStatuses.AsNoTracking()
                .Where(x => x.UnitCode == unitCode).ToListAsync(token)).ToDictionary(x => (x.VoucherType, x.StatusCode)), ct);

    private static string DisplayName(VoucherStatus? row, DocumentStatus status)
    {
        var name = Messages.CurrentLanguage == "en" && !string.IsNullOrWhiteSpace(row?.NameEn) ? row!.NameEn : row?.Name;
        return string.IsNullOrWhiteSpace(name) ? VoucherStatusCatalog.DefaultName(status) : name!;
    }

    private static VoucherStatusDto ToDto(string unitCode, VoucherDefinition voucher, DocumentStatus status, VoucherStatus? row) =>
        new(unitCode, voucher.VoucherType, VoucherCatalog.DisplayName(voucher.VoucherType, voucher.Name), voucher.Function, status.ToString(),
            row?.Name, row?.NameEn, VoucherStatusCatalog.DefaultName(status), DisplayName(row, status),
            row?.IsEnabled ?? true, VoucherStatusCatalog.CanDisable(status),
            VoucherStatusCatalog.StatusesOf(voucher.Function).ToList().IndexOf(status), row?.Version ?? 0);

    public async Task<IReadOnlyList<VoucherStatusDto>> GetAllAsync(string unitCode, CancellationToken ct)
    {
        var rows = await RowsAsync(unitCode, ct);
        return VoucherCatalog.All.SelectMany(voucher => VoucherStatusCatalog.StatusesOf(voucher.Function)
            .Select(status => ToDto(unitCode, voucher, status, rows.GetValueOrDefault((voucher.VoucherType, status.ToString()))))).ToList();
    }

    public async Task<VoucherStatusDto> UpdateAsync(int userId, string unitCode, string voucherType, string status,
        SaveVoucherStatusRequest request, CancellationToken ct)
    {
        var voucher = VoucherCatalog.FindByType(voucherType) ?? throw new NotFoundException("voucherStatus.notFound");
        if (!Enum.TryParse<DocumentStatus>(status, out var parsed) || !VoucherStatusCatalog.StatusesOf(voucher.Function).Contains(parsed))
            throw new NotFoundException("voucherStatus.notFound");
        var name = Guard.Optional(request.Name, 100, "field.statusName");
        var nameEn = Guard.Optional(request.NameEn, 100, "field.statusNameEn");
        if (!request.IsEnabled)
        {
            if (!VoucherStatusCatalog.CanDisable(parsed))
                throw new BusinessRuleException("voucherStatus.cannotDisable", VoucherStatusCatalog.DefaultName(parsed));
            // Switching the approval step off lets a voucher skip approval: not while the unit requires approval before posting.
            if (parsed == DocumentStatus.Pending && (await parameters.GetAsync(unitCode, ct)).RequireApprovalBeforePosting)
                throw new BusinessRuleException("voucherStatus.requireApproval", VoucherStatusCatalog.DefaultName(parsed), unitCode);
        }

        var row = await db.VoucherStatuses.FirstOrDefaultAsync(x => x.UnitCode == unitCode && x.VoucherType == voucher.VoucherType
            && x.StatusCode == parsed.ToString(), ct);
        if (row is null)
        {
            // Nothing changed from the defaults: no row needed.
            if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(nameEn) && request.IsEnabled)
                return ToDto(unitCode, voucher, parsed, null);
            db.VoucherStatuses.Add(row = new VoucherStatus { UnitCode = unitCode, VoucherType = voucher.VoucherType, StatusCode = parsed.ToString() });
        }
        else db.ExpectVersion(row, request.Version);
        row.Name = name;
        row.NameEn = nameEn;
        row.IsEnabled = request.IsEnabled;
        await db.SaveChangesAsync(ct);
        return ToDto(unitCode, voucher, parsed, row);
    }

    public async Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, VoucherStatusNameDto>>> GetNamesAsync(string unitCode,
        CancellationToken ct)
    {
        var rows = await RowsAsync(unitCode, ct);
        return VoucherCatalog.All.ToDictionary(voucher => voucher.VoucherType,
            voucher => (IReadOnlyDictionary<string, VoucherStatusNameDto>)VoucherStatusCatalog.StatusesOf(voucher.Function)
                .ToDictionary(status => status.ToString(), status =>
                {
                    var row = rows.GetValueOrDefault((voucher.VoucherType, status.ToString()));
                    return new VoucherStatusNameDto(DisplayName(row, status), row?.IsEnabled ?? true);
                }));
    }

    public async Task<bool> IsEnabledAsync(string unitCode, string function, DocumentStatus status, CancellationToken ct)
    {
        if (status == DocumentStatus.Draft) return true;
        var voucher = VoucherCatalog.FindByFunction(function);
        if (voucher is null) return true;
        var row = (await RowsAsync(unitCode, ct)).GetValueOrDefault((voucher.VoucherType, status.ToString()));
        return row?.IsEnabled ?? true;
    }

    public async Task EnsureEnabledAsync(string unitCode, string function, DocumentStatus status, CancellationToken ct)
    {
        if (await IsEnabledAsync(unitCode, function, status, ct)) return;
        var voucher = VoucherCatalog.FindByFunction(function);
        var row = voucher is null ? null : (await RowsAsync(unitCode, ct)).GetValueOrDefault((voucher.VoucherType, status.ToString()));
        throw new BusinessRuleException("voucherStatus.disabled", DisplayName(row, status), unitCode);
    }
}
