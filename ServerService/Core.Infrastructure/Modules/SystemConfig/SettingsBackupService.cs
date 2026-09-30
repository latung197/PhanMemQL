using System.Text.Json;
using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Departments;
using Core.Application.Modules.SystemConfig;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.SystemConfig;

/// <summary>
/// Backup / restore of the global settings. Restore goes through the module services, so the same
/// checks apply as when editing by hand, and runs in one transaction: it applies fully or not at all.
/// </summary>
public sealed class SettingsBackupService(CoreContext db, IUnitOfWork unitOfWork, ISystemConfigService config,
    ICurrencyService currencies, IExchangeRateService rates, IDepartmentService departments,
    IVoucherNumberService numbering) : ISettingsBackupService
{
    public const int CurrentVersion = 4;

    public async Task<SettingsBackup> ExportAsync(CancellationToken ct)
    {
        var keys = SystemConfigSections.Keys.ToDictionary(x => x.Value, x => x.Key);
        var settings = await db.SystemSettings.AsNoTracking().Where(x => keys.Keys.Contains(x.Key)).ToListAsync(ct);
        var sections = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        var unitSections = new Dictionary<string, IReadOnlyDictionary<string, JsonElement>>(StringComparer.Ordinal);
        foreach (var setting in settings)
        {
            using var document = JsonDocument.Parse(setting.Value);
            var value = document.RootElement.Clone();
            if (setting.Scope == SystemSetting.GlobalScope) sections[keys[setting.Key]] = value;
            else if (setting.Scope.StartsWith("U:", StringComparison.Ordinal))
            {
                var unit = setting.Scope[2..];
                if (!unitSections.TryGetValue(unit, out var own)) unitSections[unit] = own = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
                ((Dictionary<string, JsonElement>)own)[keys[setting.Key]] = value;
            }
        }

        return new SettingsBackup(CurrentVersion, DateTime.UtcNow, sections,
            (await currencies.GetAllAsync(ct)).Select(x => new SaveCurrencyRequest(x.Code, x.Name, x.Symbol, x.DecimalPlaces, x.IsBase, x.IsActive)).ToList(),
            (await rates.GetAllAsync(null, ct)).Select(x => new SaveExchangeRateRequest(x.CurrencyCode, x.Date, x.BuyRate, x.SellRate, x.AccountingRate)).ToList(),
            (await departments.GetAllAsync(ct)).Select(x => new SaveDepartmentRequest(x.Code, x.Name, x.Note, x.IsActive)).ToList(),
            await db.VoucherNumberingRules.AsNoTracking().OrderBy(x => x.VoucherType)
                .Select(x => new VoucherNumberingBackup(x.VoucherType, x.Prefix, x.Pattern, x.Digits)).ToListAsync(ct),
            unitSections);
    }

    public async Task RestoreAsync(int userId, string unitCode, SettingsBackup backup, CancellationToken ct)
    {
        if (backup is null || backup.Version is < 3 or > CurrentVersion)
            throw new BusinessRuleException("File sao lưu không đúng định dạng hoặc được tạo từ phiên bản khác.");

        await unitOfWork.ExecuteAsync(async token =>
        {
            // Currencies first: rates and the systemDefaults section refer to them.
            // The base currency first, so the rates of the other currencies validate against it.
            var existingCurrencies = (await currencies.GetAllAsync(token)).Select(x => x.Code).ToHashSet();
            foreach (var item in (backup.Currencies ?? []).OrderByDescending(x => x.IsBase))
                if (existingCurrencies.Contains(item.Code.Trim().ToUpperInvariant())) await currencies.UpdateAsync(item.Code.Trim().ToUpperInvariant(), item, token);
                else await currencies.CreateAsync(item, token);

            var existingRates = await rates.GetAllAsync(null, token);
            foreach (var item in backup.ExchangeRates ?? [])
                if (existingRates.FirstOrDefault(x => x.CurrencyCode == item.CurrencyCode && x.Date == item.Date) is { } found)
                    await rates.UpdateAsync(userId, long.Parse(found.Id), item, token);
                else await rates.CreateAsync(userId, item, token);

            foreach (var (section, value) in backup.Sections ?? new Dictionary<string, JsonElement>())
                await config.SaveAsync(userId, section, value, null, token);

            // Units that no longer exist are skipped.
            var units = await db.CompanyUnits.AsNoTracking().Select(x => x.Code).ToListAsync(token);
            foreach (var (unit, own) in (backup.UnitSections ?? new Dictionary<string, IReadOnlyDictionary<string, JsonElement>>())
                         .Where(x => units.Contains(x.Key)))
                foreach (var (section, value) in own)
                    await config.SaveAsync(userId, section, value, unit, token);

            var existingDepartments = (await departments.GetAllAsync(token)).Select(x => x.Code).ToHashSet();
            foreach (var item in backup.Departments ?? [])
                if (existingDepartments.Contains(item.Code.Trim().ToUpperInvariant())) await departments.UpdateAsync(item.Code.Trim().ToUpperInvariant(), item, token);
                else await departments.CreateAsync(item, token);

            // Voucher types that no longer exist in VoucherCatalog are skipped.
            foreach (var item in (backup.Numbering ?? []).Where(x => VoucherCatalog.FindByType(x.VoucherType) is not null))
                await numbering.UpdateAsync(userId, item.VoucherType, new SaveVoucherNumberingRequest(item.Prefix, item.Pattern, item.Digits), unitCode, token);
        }, ct);
    }
}
