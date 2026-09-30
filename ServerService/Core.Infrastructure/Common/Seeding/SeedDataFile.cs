using System.Text.Json;
using System.Text.Json.Serialization;
using Core.Application.Modules.CompanyUnits;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Departments;
using Core.Domain.Modules.Users;

namespace Core.Infrastructure.Common.Seeding;

/// <summary>
/// Content of Core/SeedData/seed.json. The file is generated from the frontend mock data
/// (Frontend: npm run export-seed), so both sides start from the same records.
/// </summary>
public sealed class SeedDataFile
{
    public List<SaveCompanyUnitRequest> CompanyUnits { get; init; } = [];
    public List<SeedRole> Roles { get; init; } = [];
    public List<SeedUser> Users { get; init; } = [];
    public List<SeedNotification> Notifications { get; init; } = [];
    public Dictionary<string, JsonElement> SystemConfig { get; init; } = [];
    public List<SaveDepartmentRequest> Departments { get; init; } = [];
    public List<SaveCurrencyRequest> Currencies { get; init; } = [];
    public List<SaveExchangeRateRequest> ExchangeRates { get; init; } = [];
}

public sealed record SeedRole(string Id, string Code, string Name, string? Description,
    Dictionary<string, ActionPermissions>? Permissions);

public sealed record SeedUser(string Id, string Username, string FullName, string? Email, string? RoleId,
    string? Department, string? DepartmentCode, string? Phone, string? Avatar, string? ThemePref, bool NotificationsEnabled,
    bool IsSystemAdmin, Dictionary<string, ActionPermissions>? Permissions,
    [property: JsonPropertyName("ma_dvcs")] string? MaDvcs,
    [property: JsonPropertyName("ds_ma_dvcs")] List<string>? DsMaDvcs);

public sealed record SeedNotification(string Title, string Message, string? Type, string? LinkModule);
