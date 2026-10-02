using Core.Application.Common.Exceptions;
using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Infrastructure.Common.Lookups;

/// <summary>A catalog's records as a lookup sees them: code, name, active flag and up to three extra columns.</summary>
public sealed class LookupRow
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string? Extra1 { get; set; }
    public string? Extra2 { get; set; }
    public string? Extra3 { get; set; }
}

/// <summary>
/// One registered lookup. <paramref name="Rows"/> projects the catalog to LookupRow (translated to SQL);
/// <paramref name="ExtraNames"/> names Extra1..3 in the result ("symbol", "taxCode"...).
/// </summary>
public sealed record LookupDefinition(string Name, Func<CoreContext, IQueryable<LookupRow>> Rows, params string[] ExtraNames);

public static class LookupRegistration
{
    /// <summary>Registers a catalog for GET /api/lookups/{name}.</summary>
    public static IServiceCollection AddLookup(this IServiceCollection services, LookupDefinition definition) =>
        services.AddSingleton(definition);
}

public sealed class LookupService(CoreContext db, IEnumerable<LookupDefinition> definitions) : ILookupService
{
    private readonly Dictionary<string, LookupDefinition> _definitions =
        definitions.ToDictionary(d => d.Name, StringComparer.OrdinalIgnoreCase);

    public IReadOnlyCollection<string> Names => _definitions.Keys;

    public async Task<LookupPage> SearchAsync(string name, LookupQuery query, CancellationToken ct)
    {
        var definition = Find(name);
        var rows = definition.Rows(db).AsNoTracking();
        if (!query.IncludeInactive) rows = rows.Where(x => x.IsActive);
        var text = query.Q?.Trim() ?? string.Empty;
        if (text.Length > 0)
        {
            var pattern = $"%{Escape(text)}%";
            rows = rows.Where(x => EF.Functions.ILike(x.Code, pattern, "\\") || EF.Functions.ILike(x.Name, pattern, "\\"));
        }
        var total = await rows.CountAsync(ct);
        var upper = text.ToUpperInvariant();
        var starts = $"{Escape(text)}%";
        // Exact code first, then codes starting with the text, then the rest by code.
        var ordered = text.Length == 0 ? rows.OrderBy(x => x.Code)
            : rows.OrderBy(x => x.Code.ToUpper() == upper ? 0 : EF.Functions.ILike(x.Code, starts, "\\") ? 1 : 2).ThenBy(x => x.Code);
        var size = Math.Clamp(query.PageSize, 1, LookupLimits.MaxPageSize);
        var page = Math.Max(1, query.Page);
        var items = await ordered.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new LookupPage(items.Select(x => ToItem(definition, x)).ToList(), total);
    }

    public async Task<IReadOnlyList<LookupItem>> GetAsync(string name, IReadOnlyCollection<string> codes, CancellationToken ct)
    {
        var definition = Find(name);
        var list = codes.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().Take(LookupLimits.MaxCodes).ToList();
        if (list.Count == 0) return [];
        var rows = await definition.Rows(db).AsNoTracking().Where(x => list.Contains(x.Code)).ToListAsync(ct);
        return rows.Select(x => ToItem(definition, x)).ToList();
    }

    private LookupDefinition Find(string name) =>
        _definitions.TryGetValue(name, out var definition) ? definition : throw new NotFoundException("lookup.notFound", name);

    private static LookupItem ToItem(LookupDefinition definition, LookupRow row)
    {
        var values = new[] { row.Extra1, row.Extra2, row.Extra3 };
        var extra = definition.ExtraNames.Select((n, i) => (n, v: i < values.Length ? values[i] : null))
            .ToDictionary(x => x.n, x => x.v);
        return new LookupItem(row.Code, row.Name, row.IsActive, extra);
    }

    private static string Escape(string text) => text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
