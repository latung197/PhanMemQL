using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Departments;
using Core.Application.Modules.VoucherNumbering;

namespace Core.Application.Modules.SystemConfig;

public interface ISystemConfigService
{
    /// <summary>Stored sections for the unit (unit values override global ones). Missing sections are omitted.</summary>
    Task<IReadOnlyDictionary<string, JsonElement>> GetEffectiveAsync(string unitCode, CancellationToken ct);

    /// <summary>Saves a section globally, or only for <paramref name="unitCode"/> when given.</summary>
    Task SaveAsync(int userId, string section, JsonElement value, string? unitCode, CancellationToken ct);
}

/// <summary>
/// Settings kept as one JSON value each (Frontend src/services/systemSettingsService.ts). Settings that
/// other data refers to (currencies, rates, departments, locks, numbering) have their own tables.
/// </summary>
public static class SystemConfigSections
{
    public const int MaxBytes = 200_000;

    public static IReadOnlyDictionary<string, string> Keys { get; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = "FRONTEND_SYSTEM_DEFAULTS",
            ["fiscalConfig"] = "FRONTEND_FISCAL_CONFIG",
            ["companyProfile"] = "FRONTEND_COMPANY_PROFILE",
            ["numberFormat"] = "FRONTEND_NUMBER_FORMAT",
            ["unitDefaults"] = "FRONTEND_UNIT_DEFAULTS"
        };

    /// <summary>Frontend function (SubMenuKey) whose "createEdit" right allows saving the section.</summary>
    public static IReadOnlyDictionary<string, string> Functions { get; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = "sys_default_config",
            ["fiscalConfig"] = "sys_fiscal_year",
            ["companyProfile"] = "settings_main",
            ["numberFormat"] = "sys_default_config",
            ["unitDefaults"] = "sys_default_config"
        };

    private static readonly IReadOnlyDictionary<string, string[]> RequiredFields =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = ["costingMethod", "defaultCurrency"],
            ["fiscalConfig"] = ["fiscalYear", "startDate"],
            ["companyProfile"] = ["companyName", "taxCode", "address"],
            ["numberFormat"] = ["thousandSeparator", "decimalSeparator"]
        };

    /// <summary>Returns the canonical section name (as the frontend spells it).</summary>
    public static string Validate(string section, JsonElement value)
    {
        var name = Keys.Keys.FirstOrDefault(k => k.Equals(section, StringComparison.OrdinalIgnoreCase))
            ?? throw new BusinessRuleException("Nhóm cài đặt không hợp lệ.");
        if (value.ValueKind != JsonValueKind.Object)
            throw new BusinessRuleException("Dữ liệu cài đặt không đúng định dạng.");
        if (RequiredFields.TryGetValue(name, out var fields)
            && fields.Any(field => !value.TryGetProperty(field, out _)))
            throw new BusinessRuleException("Thiếu trường bắt buộc của cài đặt.");
        if (JsonSerializer.SerializeToUtf8Bytes(value).Length > MaxBytes)
            throw new BusinessRuleException("Dữ liệu cài đặt quá lớn.");
        if (name is "systemDefaults" or "unitDefaults") SystemParameters.ValidateSection(name, value);
        return name;
    }

    /// <summary>Sections that only exist per company unit (saved with ?unitCode=).</summary>
    public static bool IsUnitOnly(string section) => section.Equals("unitDefaults", StringComparison.OrdinalIgnoreCase);

    /// <summary>fiscalConfig.startDate: vouchers dated before it are refused (null when not set).</summary>
    public static DateOnly? StartDate(IReadOnlyDictionary<string, JsonElement> sections) =>
        sections.TryGetValue("fiscalConfig", out var fiscal) && fiscal.TryGetProperty("startDate", out var start)
        && start.ValueKind == JsonValueKind.String && DateOnly.TryParse(start.GetString(), out var date) ? date : null;
}

/// <summary>Number series settings as stored in a backup.</summary>
public sealed record VoucherNumberingBackup(string VoucherType, string Prefix, string Pattern, int Digits);

/// <summary>
/// Settings › Sao lưu cấu hình: the global settings sections and the settings tables. Restoring adds or
/// updates records and never deletes, all in one transaction.
/// </summary>
public sealed record SettingsBackup(
    int Version,
    DateTime ExportedAt,
    IReadOnlyDictionary<string, JsonElement> Sections,
    IReadOnlyList<SaveCurrencyRequest> Currencies,
    IReadOnlyList<SaveExchangeRateRequest> ExchangeRates,
    IReadOnlyList<SaveDepartmentRequest> Departments,
    IReadOnlyList<VoucherNumberingBackup> Numbering,
    /// <summary>Per company unit sections (unit code → section → value), e.g. unitDefaults. Version 4+.</summary>
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, JsonElement>>? UnitSections = null);

public interface ISettingsBackupService
{
    Task<SettingsBackup> ExportAsync(CancellationToken ct);
    /// <param name="unitCode">Unit of the session (used for the number previews returned by the services).</param>
    Task RestoreAsync(int userId, string unitCode, SettingsBackup backup, CancellationToken ct);
}
