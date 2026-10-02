namespace Core.Application.Common.Lookups;

/// <summary>One record offered by a lookup (ô chọn mã + F2): code, name and a few extra columns by name.</summary>
public sealed record LookupItem(string Code, string Name, bool IsActive, IReadOnlyDictionary<string, string?> Extra);

public sealed record LookupPage(IReadOnlyList<LookupItem> Items, int Total);

/// <summary>Q searches code and name (part of the text, any case); inactive records are left out unless asked.</summary>
public sealed record LookupQuery(string? Q = null, int Page = 1, int PageSize = 20, bool IncludeInactive = false);

/// <summary>
/// Lookups of every catalog through one API (GET /api/lookups/{name}): a catalog is registered once
/// (AddLookup in DependencyInjection) and every screen can pick from it. Search on the server, paged, so it works
/// for catalogs of any size.
/// </summary>
public interface ILookupService
{
    IReadOnlyCollection<string> Names { get; }
    Task<LookupPage> SearchAsync(string name, LookupQuery query, CancellationToken ct);

    /// <summary>The records of these codes (to show the name next to a stored code), inactive ones included.</summary>
    Task<IReadOnlyList<LookupItem>> GetAsync(string name, IReadOnlyCollection<string> codes, CancellationToken ct);
}

public static class LookupLimits
{
    public const int MaxPageSize = 100;
    public const int MaxCodes = 500;
}
