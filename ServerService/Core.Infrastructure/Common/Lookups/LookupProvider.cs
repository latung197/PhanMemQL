using Core.Application.Common.Lookups;
using Core.Application.Modules.Users;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Infrastructure.Common.Lookups;

/// <summary>What a custom lookup knows about the request: who asks, the parameters it declared, and the rights service.</summary>
public sealed record LookupContext(int UserId, string UnitCode, IReadOnlyDictionary<string, string> Params, IPermissionService Permissions)
{
    /// <summary>The value of a declared parameter, trimmed; null when it was not sent or is empty.</summary>
    public string? Param(string name) => Params.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value) ? value.Trim() : null;
}

/// <summary>
/// A lookup written by hand, for what a plain catalog lookup (<see cref="LookupDefinition"/>: one table, code + name + three
/// text columns) cannot do: join several tables, compute values, return typed extra columns, depend on parameters such as
/// the warehouse or the date, or hide data from users without a right. It answers on the same API
/// (<c>GET /api/lookups/{Name}?q=&amp;page=&amp;pageSize=&amp;{parameters}</c>), so screens use it like any other lookup.
/// <para>
/// Write <see cref="LoadAsync"/> to return every record the caller may pick (for the given parameters); the framework
/// searches (code / name, any case), orders, pages and caches them. Register with
/// <c>services.AddLookupProvider&lt;MyLookup&gt;()</c>. Model: <c>UomFullLookup</c>. Guide: docs/them-danh-muc.md Part 4.3.
/// </para>
/// </summary>
public abstract class LookupProvider
{
    /// <summary>Name in the URL and in <c>CatalogLookup lookup="..."</c>.</summary>
    public abstract string Name { get; }

    /// <summary>
    /// The tables <see cref="LoadAsync"/> reads. While this is not empty the result is cached in memory (per language,
    /// parameters and <see cref="CacheScopeAsync"/>) and dropped as soon as one of these tables is written. Leave it empty
    /// for data that must be read fresh every time (stock, balances, prices valid today): it is then never cached.
    /// </summary>
    public virtual IReadOnlyCollection<string> Tables => [];

    /// <summary>The query parameters this lookup understands. Others are ignored and never part of the cache key.</summary>
    public virtual IReadOnlyCollection<string> ParameterNames => [];

    /// <summary>Called before every search: throw <c>ForbiddenException</c> when the caller may not use this lookup (see <c>context.Permissions</c>).</summary>
    public virtual Task AuthorizeAsync(LookupContext context, CancellationToken ct) => Task.CompletedTask;

    /// <summary>
    /// Separates cached copies when what the caller sees depends on them, e.g. <c>"price:1"</c> when columns with prices are
    /// only filled for users who may see prices. Without it everyone shares one copy.
    /// </summary>
    public virtual Task<string> CacheScopeAsync(LookupContext context, CancellationToken ct) => Task.FromResult(string.Empty);

    /// <summary>
    /// Every record the caller may pick for these parameters, with their extra columns (typed values). Read data with EF or
    /// parameterised SQL, in a few queries for the whole list rather than one per record.
    /// </summary>
    public abstract Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct);
}

public static class LookupProviderRegistration
{
    /// <summary>Registers a custom lookup for GET /api/lookups/{name}.</summary>
    public static IServiceCollection AddLookupProvider<T>(this IServiceCollection services) where T : LookupProvider =>
        services.AddScoped<LookupProvider, T>();
}
