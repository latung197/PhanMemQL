using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Languages;

/// <summary>UserCount = accounts (not deleted) that chose this language themselves.</summary>
public sealed record LanguageDto(string Code, string Name, string NativeName, bool IsActive, bool IsDefault, int UserCount,
    RecordStampDto Stamp, uint Version);

public sealed record SaveLanguageRequest(string Code, string Name, string NativeName, bool IsActive = true, bool IsDefault = false,
    uint? Version = null) : ICatalogRequest;

/// <summary>What the language picker needs (login screen and header), without the counts.</summary>
public sealed record LanguageOptionDto(string Code, string NativeName, bool IsDefault);

/// <summary>
/// The catalog of languages. Everything of a catalog (paged list, export, create, update, delete, import) comes from
/// ICatalogService; the code is a lower-case language tag ("vi", "zh-cn"). Choosing a new default clears the old one;
/// the default language cannot be deleted, nor one that accounts use.
/// </summary>
public interface ILanguageService : ICatalogService<LanguageDto, SaveLanguageRequest>
{
    /// <summary>Active languages, default first.</summary>
    Task<IReadOnlyList<LanguageOptionDto>> GetActiveAsync(CancellationToken ct);

    /// <summary>Code of the default language ("vi" when none is set).</summary>
    Task<string> GetDefaultCodeAsync(CancellationToken ct);
}
