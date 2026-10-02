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
/// auditLog section: rows of sys_audit_log older than retentionMonths are deleted automatically (0 = kept forever).
/// </summary>
public static class AuditLogRetention
{
    public const string Section = "auditLog";
    public const int MaxMonths = 120;

    public static void Validate(JsonElement value)
    {
        if (!value.TryGetProperty("retentionMonths", out var months) || months.ValueKind != JsonValueKind.Number
            || !months.TryGetInt32(out var n) || n < 0 || n > MaxMonths)
            throw new BusinessRuleException("auditLog.invalidRetention", MaxMonths);
    }

    /// <summary>Months to keep from a stored section (0 when not set or not readable).</summary>
    public static int MonthsOf(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return 0;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("retentionMonths", out var m) && m.TryGetInt32(out var n)
                ? Math.Clamp(n, 0, MaxMonths) : 0;
        }
        catch (JsonException) { return 0; }
    }
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
            ["unitDefaults"] = "FRONTEND_UNIT_DEFAULTS",
            ["auditLog"] = "AUDIT_LOG_SETTINGS"
        };

    /// <summary>Frontend function (SubMenuKey) whose "edit" right allows saving the section.</summary>
    public static IReadOnlyDictionary<string, string> Functions { get; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = "sys_default_config",
            ["fiscalConfig"] = "sys_fiscal_year",
            ["companyProfile"] = "settings_main",
            ["numberFormat"] = "sys_default_config",
            ["unitDefaults"] = "sys_default_config",
            ["auditLog"] = "sys_audit_log"
        };

    private static readonly IReadOnlyDictionary<string, string[]> RequiredFields =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["systemDefaults"] = ["costingMethod"],
            ["fiscalConfig"] = ["fiscalYear", "startDate"],
            ["companyProfile"] = ["companyName", "taxCode", "address"],
            ["numberFormat"] = ["thousandSeparator", "decimalSeparator"],
            ["auditLog"] = ["retentionMonths"]
        };

    /// <summary>Returns the canonical section name (as the frontend spells it).</summary>
    public static string Validate(string section, JsonElement value)
    {
        var name = Keys.Keys.FirstOrDefault(k => k.Equals(section, StringComparison.OrdinalIgnoreCase))
            ?? throw new BusinessRuleException("settings.invalidSection");
        if (value.ValueKind != JsonValueKind.Object)
            throw new BusinessRuleException("settings.invalidFormat");
        if (RequiredFields.TryGetValue(name, out var fields)
            && fields.Any(field => !value.TryGetProperty(field, out _)))
            throw new BusinessRuleException("settings.missingField");
        if (JsonSerializer.SerializeToUtf8Bytes(value).Length > MaxBytes)
            throw new BusinessRuleException("settings.tooLarge");
        if (name is "systemDefaults" or "unitDefaults") SystemParameters.ValidateSection(name, value);
        if (name == "numberFormat") ValidateNumberFormat(value);
        if (name == AuditLogRetention.Section) AuditLogRetention.Validate(value);
        return name;
    }

    /// <summary>
    /// systemDefaults.defaultCurrency (đồng tiền hạch toán) is the base currency of the currency catalog
    /// (sys_currency.is_base), the one exchange rates are quoted against. It is not stored in the section: saving
    /// drops it and reading fills it in, so the two can never disagree.
    /// </summary>
    public const string BaseCurrencyField = "defaultCurrency";

    /// <summary>Copy of a JSON object with one string field set (or removed when <paramref name="value"/> is null).</summary>
    public static JsonElement WithField(JsonElement section, string name, string? value)
    {
        var node = System.Text.Json.Nodes.JsonNode.Parse(section.GetRawText())!.AsObject();
        if (value is null) node.Remove(name);
        else node[name] = value;
        using var document = JsonDocument.Parse(node.ToJsonString());
        return document.RootElement.Clone();
    }

    private static readonly string[] ThousandSeparators = [",", ".", " ", ""];
    private static readonly string[] DecimalSeparators = [".", ","];
    private static readonly string[] DecimalFields =
        ["amountDecimals", "foreignAmountDecimals", "exchangeRateDecimals", "quantityDecimals", "unitPriceDecimals", "percentDecimals"];

    /// <summary>
    /// The number format is applied to every screen of every user, so a bad value would break them all:
    /// known separators that differ, a known symbol position, 0–6 decimals.
    /// </summary>
    private static void ValidateNumberFormat(JsonElement value)
    {
        static string? Text(JsonElement e, string name) =>
            e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

        var thousand = Text(value, "thousandSeparator");
        var decimalSeparator = Text(value, "decimalSeparator");
        if (thousand is null || !ThousandSeparators.Contains(thousand))
            throw new BusinessRuleException("settings.thousandSeparator");
        if (decimalSeparator is null || !DecimalSeparators.Contains(decimalSeparator))
            throw new BusinessRuleException("settings.decimalSeparator");
        if (thousand == decimalSeparator)
            throw new BusinessRuleException("settings.separatorsDiffer");
        if (value.TryGetProperty("currencyPosition", out _) && Text(value, "currencyPosition") is not ("prefix" or "suffix"))
            throw new BusinessRuleException("settings.currencyPosition");
        if (Text(value, "currencySymbol") is { Length: > 10 })
            throw new BusinessRuleException("settings.currencySymbolLength");
        foreach (var field in DecimalFields)
            if (value.TryGetProperty(field, out var p)
                && (p.ValueKind != JsonValueKind.Number || !p.TryGetInt32(out var digits) || digits is < 0 or > 6))
                throw new BusinessRuleException("settings.decimals");
    }

    /// <summary>
    /// Sections that only exist per company unit (saved with ?unitCode=). The others are company-wide only: a unit
    /// copy of them would silently override the company value for that unit, so it is neither saved nor read.
    /// </summary>
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
