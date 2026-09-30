namespace Core.Application.Features.Erp.Settings;

public static class SettingResolver
{
    public static IReadOnlyList<SettingDto> Resolve(IEnumerable<SettingDto> settings,
        string unitCode, string? plantCode)
    {
        var scopes = string.IsNullOrWhiteSpace(plantCode)
            ? new[] { "GLOBAL", $"U:{unitCode}" }
            : new[] { "GLOBAL", $"U:{unitCode}", $"P:{plantCode}" };
        return settings.Where(x => scopes.Contains(x.Scope, StringComparer.Ordinal))
            .GroupBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(x => Array.IndexOf(scopes, x.Scope)).First())
            .OrderBy(x => x.Key).ToList();
    }
}
