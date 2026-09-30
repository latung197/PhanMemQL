using System.Text.Json;
using Core.Application.Common.Exceptions;

namespace Core.Application.Modules.SystemConfig;

public interface ISystemConfigService
{
    /// <summary>Stored sections for the unit (unit values override global ones). Missing sections are omitted.</summary>
    Task<IReadOnlyDictionary<string, JsonElement>> GetEffectiveAsync(string unitCode, CancellationToken ct);

    /// <summary>Saves a section globally, or only for <paramref name="unitCode"/> when given.</summary>
    Task SaveAsync(int userId, string section, JsonElement value, string? unitCode, CancellationToken ct);
}

/// <summary>
/// Sections of Frontend src/services/systemSettingsService.ts, each stored as one JSON setting.
/// </summary>
public static class SystemConfigSections
{
    public const int MaxBytes = 200_000;

    public static IReadOnlyDictionary<string, string> Keys { get; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = "FRONTEND_SYSTEM_DEFAULTS",
            ["fiscalConfig"] = "FRONTEND_FISCAL_CONFIG",
            ["currencies"] = "FRONTEND_CURRENCIES",
            ["exchangeRates"] = "FRONTEND_EXCHANGE_RATES",
            ["companyProfile"] = "FRONTEND_COMPANY_PROFILE"
        };

    /// <summary>Frontend function (SubMenuKey) whose "createEdit" right allows saving the section.</summary>
    public static IReadOnlyDictionary<string, string> Functions { get; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = "sys_default_config",
            ["fiscalConfig"] = "sys_fiscal_year",
            ["currencies"] = "sys_currencies",
            ["exchangeRates"] = "sys_exchange_rates",
            ["companyProfile"] = "settings_main"
        };

    private static readonly IReadOnlyDictionary<string, string[]> RequiredFields =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = ["defaultWarehouse", "costingMethod", "defaultCurrency", "autoNumbering"],
            ["fiscalConfig"] = ["fiscalYear", "startDate", "lockDate", "months"],
            ["companyProfile"] = ["companyName", "taxCode", "address"]
        };

    /// <summary>Returns the canonical section name (as the frontend spells it).</summary>
    public static string Validate(string section, JsonElement value)
    {
        var name = Keys.Keys.FirstOrDefault(k => k.Equals(section, StringComparison.OrdinalIgnoreCase))
            ?? throw new BusinessRuleException("Nhóm cài đặt không hợp lệ.");
        var expectsArray = name is "currencies" or "exchangeRates";
        if (value.ValueKind != (expectsArray ? JsonValueKind.Array : JsonValueKind.Object))
            throw new BusinessRuleException("Dữ liệu cài đặt không đúng định dạng.");
        if (expectsArray && value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.Object))
            throw new BusinessRuleException("Danh sách cài đặt không hợp lệ.");
        if (RequiredFields.TryGetValue(name, out var fields)
            && fields.Any(field => !value.TryGetProperty(field, out _)))
            throw new BusinessRuleException("Thiếu trường bắt buộc của cài đặt.");
        if (JsonSerializer.SerializeToUtf8Bytes(value).Length > MaxBytes)
            throw new BusinessRuleException("Dữ liệu cài đặt quá lớn.");
        return name;
    }
}
