using Core.Application.Common.Lookups;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Lookups;

/// <summary>
/// Pickers of every screen: code, name and a few extra columns of a catalog, searched on the server and paged, open to every
/// signed-in user (the full catalog needs the View right of its function). Plain catalogs are listed in <c>LookupCatalogs</c>;
/// custom ones are <c>LookupProvider</c> classes that may read more query parameters (e.g. <c>?warehouse=KHO1</c>) and check rights.
/// </summary>
[Route("api/lookups/{name}")]
public sealed class LookupsController(ILookupService lookups) : ApiControllerBase
{
    private static readonly HashSet<string> Known = new(StringComparer.OrdinalIgnoreCase)
        { "q", "page", "pageSize", "includeInactive", "codes" };

    /// <summary>The query parameters beyond paging and search, for lookups that declare them.</summary>
    private LookupCaller Caller() => new(CurrentUserId, CurrentUnitCode,
        Request.Query.Where(x => !Known.Contains(x.Key)).ToDictionary(x => x.Key, x => x.Value.ToString(), StringComparer.OrdinalIgnoreCase));

    [HttpGet]
    public Task<LookupPage> Search(string name, [FromQuery] LookupQuery query, CancellationToken ct) =>
        lookups.SearchAsync(name, query, Caller(), ct);

    [HttpGet("codes")]
    public Task<IReadOnlyList<LookupItem>> Get(string name, [FromQuery] string? codes, CancellationToken ct) =>
        lookups.GetAsync(name, (codes ?? string.Empty).Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries),
            Caller(), ct);
}
