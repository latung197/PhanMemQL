using Core.Infrastructure.Common.Paging;
using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Application.Common.Lookups;
using Core.Application.Modules.Users;
using Core.Infrastructure.Common.Caching;
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
/// One registered lookup of a plain catalog. <paramref name="Rows"/> projects the catalog to LookupRow (translated to SQL);
/// <paramref name="Tables"/> are the tables <paramref name="Rows"/> reads: the cached copy of the lookup is dropped as
/// soon as one of them is written (list every table the projection touches, translations included);
/// <paramref name="ExtraNames"/> names Extra1..3 in the result ("symbol", "taxCode"...). For more than that (several
/// tables, typed columns, parameters, rights) write a <see cref="LookupProvider"/>.
/// </summary>
public sealed record LookupDefinition(string Name, Func<CoreContext, IQueryable<LookupRow>> Rows,
    IReadOnlyCollection<string> Tables, params string[] ExtraNames);

public static class LookupRegistration
{
    /// <summary>Registers a catalog for GET /api/lookups/{name}.</summary>
    public static IServiceCollection AddLookup(this IServiceCollection services, LookupDefinition definition) =>
        services.AddSingleton(definition);
}

/// <summary>
/// Lookups are read on every voucher line, so they are kept in memory (<see cref="IAppCache"/>): one cached list per
/// lookup and language (and, for a custom lookup, per parameters and scope), searched and paged in memory, dropped when
/// any table of the lookup is written (a save in the catalog screen, an import, a delete...). A plain catalog with more
/// than <see cref="MaxCachedRows"/> rows is not cached and is searched in the database.
/// </summary>
public sealed class LookupService(CoreContext db, IAppCache cache, IPermissionService permissions,
    IEnumerable<LookupDefinition> definitions, IEnumerable<LookupProvider> providers) : ILookupService
{
    public const int MaxCachedRows = 5000;

    /// <summary>The cached records of one plain lookup; Items is null when the catalog is too big to cache.</summary>
    private sealed record LookupSet(IReadOnlyList<LookupItem>? Items);

    private readonly Dictionary<string, LookupDefinition> _definitions =
        definitions.ToDictionary(d => d.Name, StringComparer.OrdinalIgnoreCase);

    private readonly Dictionary<string, LookupProvider> _providers = providers.ToDictionary(p => p.Name, StringComparer.OrdinalIgnoreCase);

    public IReadOnlyCollection<string> Names => _definitions.Keys.Concat(_providers.Keys).ToList();

    private void EnsureNamesAreUnique()
    {
        var clash = _providers.Keys.FirstOrDefault(_definitions.ContainsKey);
        if (clash is not null) throw new InvalidOperationException($"Lookup '{clash}' is registered both as a catalog and as a provider.");
    }

    public async Task<LookupPage> SearchAsync(string name, LookupQuery query, LookupCaller caller, CancellationToken ct)
    {
        EnsureNamesAreUnique();
        var access = await CheckAccessAsync(name, caller, ct);
        if (_providers.TryGetValue(name, out var provider))
        {
            var (found, count) = LookupSearch.Run(await access.ApplyAsync(await ProviderItemsAsync(provider, caller, ct), ct), query);
            return new LookupPage(found, count);
        }

        var definition = Find(name);
        var set = await LoadSetAsync(definition, ct);
        if (set.Items is not null)
        {
            var (found, count) = LookupSearch.Run(await access.ApplyAsync(set.Items, ct), query);
            return new LookupPage(found, count);
        }
        var page = await SearchInDatabaseAsync(definition, query, ct);
        return page with { Items = await access.ApplyAsync(page.Items, ct) };
    }

    public async Task<IReadOnlyList<LookupItem>> GetAsync(string name, IReadOnlyCollection<string> codes, LookupCaller caller, CancellationToken ct)
    {
        EnsureNamesAreUnique();
        var access = await CheckAccessAsync(name, caller, ct);
        var list = codes.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().Take(LookupLimits.MaxCodes).ToList();
        if (_providers.TryGetValue(name, out var provider))
            return list.Count == 0 ? [] : (await access.ApplyAsync(await ProviderItemsAsync(provider, caller, ct), ct)).Where(x => list.Contains(x.Code)).ToList();

        var definition = Find(name);
        if (list.Count == 0) return [];
        var set = await LoadSetAsync(definition, ct);
        if (set.Items is not null) return (await access.ApplyAsync(set.Items, ct)).Where(x => list.Contains(x.Code)).ToList();
        var rows = await definition.Rows(db).AsNoTracking().Where(x => list.Contains(x.Code)).ToListAsync(ct);
        return await access.ApplyAsync(rows.Select(x => ToItem(definition, x)).ToList(), ct);
    }

    // ---- Rights ------------------------------------------------------------------------------------------------------

    /// <summary>What a caller may take from a lookup: the sensitive columns and, for company units, the units they may work in.</summary>
    private sealed class LookupAccess(LookupAccessRule? rule, bool sensitive, bool allUnits, int userId, IPermissionService permissions)
    {
        public async Task<IReadOnlyList<LookupItem>> ApplyAsync(IReadOnlyList<LookupItem> items, CancellationToken ct)
        {
            if (rule is null) return items;
            if (rule.UnitScoped && !allUnits)
            {
                var kept = new List<LookupItem>();
                foreach (var item in items)
                    if (await permissions.HasUnitAccessAsync(userId, item.Code, ct)) kept.Add(item);
                items = kept;
            }
            if (sensitive || rule.SensitiveExtras.Count == 0) return items;
            return items.Select(item => item.Extra.Keys.Any(rule.SensitiveExtras.Contains)
                ? item with { Extra = item.Extra.ToDictionary(x => x.Key, x => rule.SensitiveExtras.Contains(x.Key) ? null : x.Value) }
                : item).ToList();
        }
    }

    /// <summary>
    /// A lookup is not open to every signed-in user: it answers an administrator, a user who may View the catalog behind it, or one
    /// who may View a function that picks from it (see <see cref="LookupAccessCatalog"/>). Anyone else gets 403, so a user with no
    /// business with the suppliers cannot read them (tax code, phone) through the picker. A lookup without a rule is refused too.
    /// </summary>
    private async Task<LookupAccess> CheckAccessAsync(string name, LookupCaller caller, CancellationToken ct)
    {
        if (!_providers.ContainsKey(name) && !_definitions.ContainsKey(name)) throw new NotFoundException("lookup.notFound", name);
        var rule = LookupAccessCatalog.Find(name);
        var matrix = await permissions.GetEffectiveAsync(caller.UserId, ct);
        bool Can(string function) => matrix.TryGetValue(function, out var rights) && rights.View;
        var admin = await permissions.IsAdminAsync(caller.UserId, ct);
        var owner = admin || (rule?.Owner is { } own && Can(own));
        if (!owner && (rule is null || !(rule.Open || rule.Consumers.Any(Can)))) throw new ForbiddenException("permission.denied");
        return new LookupAccess(rule, owner || (rule?.SensitiveFor.Any(Can) ?? false), owner, caller.UserId, permissions);
    }

    // ---- Custom lookups (LookupProvider) ---------------------------------------------------------------------------

    /// <summary>
    /// The records of a custom lookup for this request: rights checked first, then the cached copy for the same language,
    /// declared parameters and scope, or a fresh load when the provider names no tables.
    /// </summary>
    private async Task<IReadOnlyList<LookupItem>> ProviderItemsAsync(LookupProvider provider, LookupCaller caller, CancellationToken ct)
    {
        // Only the parameters the lookup declares, so a request cannot fill the cache with endless variations.
        var declared = provider.ParameterNames.Where(caller.Params.ContainsKey).ToDictionary(n => n, n => caller.Params[n]);
        var context = new LookupContext(caller.UserId, caller.UnitCode, declared, permissions);
        await provider.AuthorizeAsync(context, ct);
        if (provider.Tables.Count == 0) return await provider.LoadAsync(context, ct);

        var scope = await provider.CacheScopeAsync(context, ct);
        var parameters = string.Join("&", provider.ParameterNames.Select(n => $"{n}={context.Param(n)}"));
        return await db.CachedAsync(cache, $"lookup:{provider.Name}:{Messages.CurrentLanguage}:{scope}:{parameters}", provider.Tables,
            token => provider.LoadAsync(context, token), ct);
    }

    // ---- Plain catalog lookups (LookupDefinition) ------------------------------------------------------------------

    /// <summary>Per language, since a lookup may show translated names.</summary>
    private Task<LookupSet> LoadSetAsync(LookupDefinition definition, CancellationToken ct) =>
        db.CachedAsync(cache, $"lookup:{definition.Name}:{Messages.CurrentLanguage}", definition.Tables, async token =>
        {
            var rows = await definition.Rows(db).AsNoTracking().OrderBy(x => x.Code).Take(MaxCachedRows + 1).ToListAsync(token);
            return new LookupSet(rows.Count > MaxCachedRows ? null : rows.Select(x => ToItem(definition, x)).ToList());
        }, ct);

    private async Task<LookupPage> SearchInDatabaseAsync(LookupDefinition definition, LookupQuery query, CancellationToken ct)
    {
        var rows = definition.Rows(db).AsNoTracking();
        if (!query.IncludeInactive) rows = rows.Where(x => x.IsActive);
        var text = query.Q?.Trim() ?? string.Empty;
        if (text.Length > 0)
        {
            var pattern = $"%{Escape(text)}%";
            rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern));
        }
        var total = await rows.CountAsync(ct);
        var upper = text.ToUpperInvariant();
        var starts = $"{Escape(text)}%";
        // Exact code first, then codes starting with the text, then the rest by code.
        var ordered = text.Length == 0 ? rows.OrderBy(x => x.Code)
            : rows.OrderBy(x => x.Code.ToUpper() == upper ? 0 : SearchFunctions.Matches(x.Code, starts) ? 1 : 2).ThenBy(x => x.Code);
        var size = Math.Clamp(query.PageSize, 1, LookupLimits.MaxPageSize);
        var page = Math.Max(1, query.Page);
        var items = await ordered.Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new LookupPage(items.Select(x => ToItem(definition, x)).ToList(), total);
    }

    private LookupDefinition Find(string name) =>
        _definitions.TryGetValue(name, out var definition) ? definition : throw new NotFoundException("lookup.notFound", name);

    private static LookupItem ToItem(LookupDefinition definition, LookupRow row)
    {
        var values = new[] { row.Extra1, row.Extra2, row.Extra3 };
        var extra = definition.ExtraNames.Select((n, i) => (n, v: i < values.Length ? values[i] : null))
            .ToDictionary(x => x.n, x => (object?)x.v);
        return new LookupItem(row.Code, row.Name, row.IsActive, extra);
    }

    private static string Escape(string text) => text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
