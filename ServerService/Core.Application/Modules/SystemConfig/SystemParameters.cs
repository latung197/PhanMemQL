using System.Text.Json;
using Core.Application.Common.Exceptions;

namespace Core.Application.Modules.SystemConfig;

public static class CostingMethods
{
    /// <summary>Bình quân gia quyền cuối tháng.</summary>
    public const string MonthlyAverage = "MONTHLY_AVG";
    /// <summary>Bình quân di động tức thời.</summary>
    public const string InstantAverage = "INSTANT_AVG";
    /// <summary>Nhập trước xuất trước.</summary>
    public const string Fifo = "FIFO";
    /// <summary>Đích danh (theo lô).</summary>
    public const string Specific = "SPECIFIC";

    public static readonly string[] All = [MonthlyAverage, InstantAverage, Fifo, Specific];
}

/// <summary>
/// Operating parameters of one company unit, as voucher services use them. Company-wide values come from
/// the "systemDefaults" section; "unitDefaults" of the unit overrides the unit-level ones (default
/// warehouse, negative stock). Anything not set falls back to the defaults below.
/// </summary>
public sealed record SystemParameters(
    string CostingMethod,
    string DefaultCurrency,
    decimal DefaultVatRate,
    bool RequireApprovalBeforePosting,
    string? DefaultWarehouse,
    bool AllowNegativeStock)
{
    public static readonly decimal[] VatRates = [0m, 5m, 8m, 10m];

    public static SystemParameters Default { get; } =
        new(CostingMethods.MonthlyAverage, "VND", 10m, true, null, false);

    /// <summary>Reads the effective parameters from the sections of one unit (ISystemConfigService.GetEffectiveAsync).</summary>
    public static SystemParameters From(IReadOnlyDictionary<string, JsonElement> sections)
    {
        var p = Default;
        if (sections.TryGetValue("systemDefaults", out var d) && d.ValueKind == JsonValueKind.Object)
            p = p with
            {
                CostingMethod = Text(d, "costingMethod") is { } m && CostingMethods.All.Contains(m) ? m : p.CostingMethod,
                DefaultCurrency = Text(d, "defaultCurrency") ?? p.DefaultCurrency,
                DefaultVatRate = Number(d, "defaultVatRate") is { } v && VatRates.Contains(v) ? v : p.DefaultVatRate,
                RequireApprovalBeforePosting = Flag(d, "requireApprovalBeforePosting") ?? p.RequireApprovalBeforePosting,
                DefaultWarehouse = Text(d, "defaultWarehouse") ?? p.DefaultWarehouse,
                AllowNegativeStock = Flag(d, "allowNegativeStock") ?? p.AllowNegativeStock
            };
        if (sections.TryGetValue("unitDefaults", out var u) && u.ValueKind == JsonValueKind.Object)
            p = p with
            {
                DefaultWarehouse = Text(u, "defaultWarehouse") ?? p.DefaultWarehouse,
                AllowNegativeStock = Flag(u, "allowNegativeStock") ?? p.AllowNegativeStock
            };
        return p;
    }

    /// <summary>Checks the values of a "systemDefaults" or "unitDefaults" section (not the references).</summary>
    public static void ValidateSection(string section, JsonElement value)
    {
        if (section == "systemDefaults")
        {
            if (Text(value, "costingMethod") is not { } method || !CostingMethods.All.Contains(method))
                throw new BusinessRuleException("Phương pháp tính giá xuất kho không hợp lệ.");
            if (Text(value, "defaultCurrency") is null)
                throw new BusinessRuleException("Vui lòng chọn đồng tiền hạch toán mặc định.");
            if (value.TryGetProperty("defaultVatRate", out _) && (Number(value, "defaultVatRate") is not { } vat || !VatRates.Contains(vat)))
                throw new BusinessRuleException("Thuế suất GTGT mặc định chỉ được là 0, 5, 8 hoặc 10%.");
        }
        EnsureFlagOrNull(value, "allowNegativeStock");
        EnsureFlagOrNull(value, "requireApprovalBeforePosting");
        if (Text(value, "defaultWarehouse") is { Length: > 20 })
            throw new BusinessRuleException("Mã kho mặc định không được vượt quá 20 ký tự.");
    }

    private static void EnsureFlagOrNull(JsonElement value, string name)
    {
        if (value.TryGetProperty(name, out var p) && p.ValueKind is not (JsonValueKind.True or JsonValueKind.False or JsonValueKind.Null))
            throw new BusinessRuleException("Dữ liệu cài đặt không đúng định dạng.");
    }

    private static string? Text(JsonElement e, string name) =>
        e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String && p.GetString()?.Trim() is { Length: > 0 } s ? s : null;

    private static decimal? Number(JsonElement e, string name) =>
        e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetDecimal(out var n) ? n : null;

    private static bool? Flag(JsonElement e, string name) =>
        e.TryGetProperty(name, out var p) ? p.ValueKind switch { JsonValueKind.True => true, JsonValueKind.False => false, _ => null } : null;
}

/// <summary>Typed parameters for services (e.g. a goods issue checks AllowNegativeStock of its unit).</summary>
public interface ISystemParameters
{
    Task<SystemParameters> GetAsync(string unitCode, CancellationToken ct);
}
