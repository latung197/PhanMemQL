namespace Core.Application.Common.Lookups;

/// <summary>
/// One record offered by a lookup (ô chọn mã + F2): code, name and extra columns by name. Extra values keep their type
/// (text, number, true / false, date) and travel as JSON, so a form can fill several fields from the chosen record.
/// </summary>
public sealed record LookupItem(string Code, string Name, bool IsActive, IReadOnlyDictionary<string, object?> Extra);

public sealed record LookupPage(IReadOnlyList<LookupItem> Items, int Total);

/// <summary>Q searches code and name (part of the text, any case); inactive records are left out unless asked.</summary>
public sealed record LookupQuery(string? Q = null, int Page = 1, int PageSize = 20, bool IncludeInactive = false);

/// <summary>
/// Who asks, and the extra query parameters of the request (e.g. <c>?warehouse=KHO1&amp;date=2026-10-05</c>), which a
/// custom lookup (LookupProvider) may use. Parameters a lookup does not declare are ignored.
/// </summary>
public sealed record LookupCaller(int UserId, string UnitCode, IReadOnlyDictionary<string, string> Params);

/// <summary>
/// Lookups of every catalog through one API (GET /api/lookups/{name}): a catalog is registered once
/// (<c>LookupCatalogs</c> for a plain catalog, a <c>LookupProvider</c> class for a custom one) and every screen can pick
/// from it. Search on the server, paged, so it works for catalogs of any size.
/// </summary>
public interface ILookupService
{
    IReadOnlyCollection<string> Names { get; }
    Task<LookupPage> SearchAsync(string name, LookupQuery query, LookupCaller caller, CancellationToken ct);

    /// <summary>The records of these codes (to show the name next to a stored code), inactive ones included.</summary>
    Task<IReadOnlyList<LookupItem>> GetAsync(string name, IReadOnlyCollection<string> codes, LookupCaller caller, CancellationToken ct);
}

public static class LookupLimits
{
    public const int MaxPageSize = 100;
    public const int MaxCodes = 500;
}
