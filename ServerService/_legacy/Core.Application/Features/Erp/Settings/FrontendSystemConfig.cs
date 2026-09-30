using System.Text.Json;

namespace Core.Application.Features.Erp.Settings;

public sealed record SaveFrontendConfigRequest(JsonElement Value, string Scope = "GLOBAL");

public interface IFrontendSystemConfigService
{
    Task<IReadOnlyDictionary<string, JsonElement>> GetEffectiveAsync(string unitCode,
        CancellationToken ct);
    Task SaveAsync(int userId, string section, SaveFrontendConfigRequest request,
        CancellationToken ct);
}

/// <summary>Sections stored as JSON in erp_setting; names match frontend system settings.</summary>
public static class FrontendSystemConfig
{
    public static readonly IReadOnlyDictionary<string, string> Keys =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = "FRONTEND_SYSTEM_DEFAULTS",
            ["fiscalConfig"] = "FRONTEND_FISCAL_CONFIG",
            ["currencies"] = "FRONTEND_CURRENCIES",
            ["exchangeRates"] = "FRONTEND_EXCHANGE_RATES",
            ["companyProfile"] = "FRONTEND_COMPANY_PROFILE"
        };

    public static void Validate(string section, JsonElement value)
    {
        if (!Keys.ContainsKey(section)) throw new ArgumentException("Nhóm cài đặt không hợp lệ.");
        var expectsArray = section.Equals("currencies", StringComparison.OrdinalIgnoreCase)
            || section.Equals("exchangeRates", StringComparison.OrdinalIgnoreCase);
        if (value.ValueKind != (expectsArray ? JsonValueKind.Array : JsonValueKind.Object))
            throw new ArgumentException("Dữ liệu cài đặt không đúng định dạng.");

        var required = section.ToLowerInvariant() switch
        {
            "systemdefaults" => new[] { "defaultWarehouse", "costingMethod", "defaultCurrency", "autoNumbering" },
            "fiscalconfig" => new[] { "fiscalYear", "startDate", "lockDate", "months" },
            "companyprofile" => new[] { "companyName", "taxCode", "address" },
            _ => Array.Empty<string>()
        };
        if (required.Any(field => !value.TryGetProperty(field, out _)))
            throw new ArgumentException("Thiếu trường bắt buộc của cài đặt.");
        if (expectsArray && value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.Object))
            throw new ArgumentException("Danh sách cài đặt không hợp lệ.");
        if (JsonSerializer.SerializeToUtf8Bytes(value).Length > 10000)
            throw new ArgumentException("Dữ liệu cài đặt vượt quá 10 KB.");
    }
}
