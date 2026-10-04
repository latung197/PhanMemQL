using Core.Infrastructure.Common.Caching;
using Core.Application.Common.Caching;
using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.SystemConfig;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Infrastructure.Modules.SystemConfig;

public sealed class SystemConfigService(CoreContext db, IAppCache cache, ILogger<SystemConfigService> logger) : ISystemConfigService
{
    /// <summary>Read at sign-in and by voucher checks; cached per unit until a setting, function flag or base currency changes.</summary>
    public Task<IReadOnlyDictionary<string, JsonElement>> GetEffectiveAsync(string unitCode, CancellationToken ct) =>
        db.CachedAsync(cache, $"settings:{unitCode}", ["sys_setting", "sys_currency", "sys_command"], token => LoadEffectiveAsync(unitCode, token), ct);

    private async Task<IReadOnlyDictionary<string, JsonElement>> LoadEffectiveAsync(string unitCode, CancellationToken ct)
    {
        var unitScope = SystemSetting.UnitScope(unitCode);
        var keys = SystemConfigSections.Keys.Values.ToList();
        var settings = await db.SystemSettings.AsNoTracking()
            .Where(x => keys.Contains(x.Key) && x.IsPublic
                && (x.Scope == SystemSetting.GlobalScope || x.Scope == unitScope))
            .ToListAsync(ct);

        var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var (section, key) in SystemConfigSections.Keys)
        {
            // Unit-only sections come from the unit, the others from the company (never a unit copy of them).
            var scope = SystemConfigSections.IsUnitOnly(section) ? unitScope : SystemSetting.GlobalScope;
            var setting = settings.FirstOrDefault(x => x.Key == key && x.Scope == scope);
            if (setting is null) continue;
            try
            {
                using var document = JsonDocument.Parse(setting.Value);
                result[section] = document.RootElement.Clone();
            }
            catch (JsonException ex)
            {
                // A broken value must not hide the other sections; the frontend falls back to defaults.
                logger.LogWarning(ex, "Setting {Key} ({Scope}) is not valid JSON", setting.Key, setting.Scope);
            }
        }

        // The accounting currency is the base currency of the currency catalog, never a stored copy.
        var baseCurrency = await db.Currencies.AsNoTracking().Where(x => x.IsBase).Select(x => x.Code).FirstOrDefaultAsync(ct);
        if (baseCurrency is not null)
        {
            using var empty = JsonDocument.Parse("{}");
            result["systemDefaults"] = SystemConfigSections.WithField(
                result.TryGetValue("systemDefaults", out var defaults) ? defaults : empty.RootElement,
                SystemConfigSections.BaseCurrencyField, baseCurrency);
        }
        // Module visibility is stored in sys_setting. Function visibility comes from the existing
        // sys_command.hide_yn column, which is the source of truth for every function.
        var hiddenModules = result.TryGetValue("menuVisibility", out var menu)
            && menu.TryGetProperty("hiddenModules", out var modules) && modules.ValueKind == JsonValueKind.Array
                ? modules.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String)
                    .Select(x => x.GetString()!).Where(x => x is not ("overview" or "settings")).ToArray()
                : [];
        var hiddenFunctions = await db.Commands.AsNoTracking()
            .Where(x => x.HideYn == 1 && x.MenuId0 != "overview_main" && x.MenuId0 != "sys_menu"
                && FunctionCatalog.Functions.Keys.Contains(x.MenuId0))
            .Select(x => x.MenuId0).ToArrayAsync(ct);
        result["menuVisibility"] = JsonSerializer.SerializeToElement(new { hiddenModules, hiddenFunctions });
        return result;
    }

    public async Task SaveAsync(int userId, string section, JsonElement value, string? unitCode, CancellationToken ct)
    {
        var name = SystemConfigSections.Validate(section, value);
        var scope = SystemSetting.GlobalScope;
        if (!string.IsNullOrWhiteSpace(unitCode))
        {
            if (!SystemConfigSections.IsUnitOnly(name))
                throw new BusinessRuleException("settings.companyWideOnly");
            if (!await db.CompanyUnits.AnyAsync(x => x.Code == unitCode, ct))
                throw new BusinessRuleException("companyUnit.notFound");
            scope = SystemSetting.UnitScope(unitCode);
        }
        else if (SystemConfigSections.IsUnitOnly(name))
            throw new BusinessRuleException("settings.unitRequired");

        // The accounting currency is chosen in the currency catalog (Tiền hạch toán); a copy here could disagree with it.
        if (name == "systemDefaults") value = SystemConfigSections.WithField(value, SystemConfigSections.BaseCurrencyField, null);

        var key = SystemConfigSections.Keys[name];
        var setting = await db.SystemSettings.FirstOrDefaultAsync(x => x.Key == key && x.Scope == scope, ct);
        if (setting is null) db.SystemSettings.Add(setting = new SystemSetting { Key = key, Scope = scope });
        if (name == "menuVisibility")
        {
            var hiddenFunctions = value.GetProperty("hiddenFunctions").EnumerateArray()
                .Select(x => x.GetString()!).ToHashSet(StringComparer.Ordinal);
            var commands = await db.Commands.Where(x => FunctionCatalog.Functions.Keys.Contains(x.MenuId0)).ToListAsync(ct);
            foreach (var command in commands) command.HideYn = hiddenFunctions.Contains(command.MenuId0) ? (short)1 : (short)0;
            setting.Value = JsonSerializer.Serialize(new
            {
                hiddenModules = value.GetProperty("hiddenModules").EnumerateArray().Select(x => x.GetString()).ToArray()
            });
        }
        else setting.Value = value.GetRawText();
        setting.IsPublic = true;
        setting.UpdatedAtUtc = DateTime.UtcNow;
        setting.UpdatedByUserId = userId;
        await db.SaveChangesAsync(ct);
    }
}
