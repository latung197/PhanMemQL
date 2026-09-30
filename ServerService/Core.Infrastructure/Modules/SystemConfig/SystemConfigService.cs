using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Infrastructure.Modules.SystemConfig;

public sealed class SystemConfigService(CoreContext db, ILogger<SystemConfigService> logger) : ISystemConfigService
{
    public async Task<IReadOnlyDictionary<string, JsonElement>> GetEffectiveAsync(string unitCode, CancellationToken ct)
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
            var setting = settings.FirstOrDefault(x => x.Key == key && x.Scope == unitScope)
                ?? settings.FirstOrDefault(x => x.Key == key);
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
        return result;
    }

    public async Task SaveAsync(int userId, string section, JsonElement value, string? unitCode, CancellationToken ct)
    {
        var name = SystemConfigSections.Validate(section, value);
        var scope = SystemSetting.GlobalScope;
        if (!string.IsNullOrWhiteSpace(unitCode))
        {
            if (!await db.CompanyUnits.AnyAsync(x => x.Code == unitCode, ct))
                throw new BusinessRuleException("Đơn vị cơ sở không tồn tại.");
            scope = SystemSetting.UnitScope(unitCode);
        }

        var key = SystemConfigSections.Keys[name];
        var setting = await db.SystemSettings.FirstOrDefaultAsync(x => x.Key == key && x.Scope == scope, ct);
        if (setting is null) db.SystemSettings.Add(setting = new SystemSetting { Key = key, Scope = scope });
        setting.Value = value.GetRawText();
        setting.IsPublic = true;
        setting.UpdatedAtUtc = DateTime.UtcNow;
        setting.UpdatedByUserId = userId;
        await db.SaveChangesAsync(ct);
    }
}
