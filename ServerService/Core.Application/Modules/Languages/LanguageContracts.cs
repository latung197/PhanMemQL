namespace Core.Application.Modules.Languages;

/// <summary>UserCount = accounts (not deleted) that chose this language themselves.</summary>
public sealed record LanguageDto(string Code, string Name, string NativeName, bool IsActive, bool IsDefault, int UserCount);

public sealed record SaveLanguageRequest(string Code, string Name, string NativeName, bool IsActive = true, bool IsDefault = false);

/// <summary>What the language picker needs (login screen and header), without the counts.</summary>
public sealed record LanguageOptionDto(string Code, string NativeName, bool IsDefault);

public interface ILanguageService
{
    Task<IReadOnlyList<LanguageDto>> GetAllAsync(CancellationToken ct);

    /// <summary>Active languages, default first.</summary>
    Task<IReadOnlyList<LanguageOptionDto>> GetActiveAsync(CancellationToken ct);

    Task<LanguageDto> CreateAsync(SaveLanguageRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed. Choosing a new default clears the old one.</summary>
    Task<LanguageDto> UpdateAsync(string code, SaveLanguageRequest request, CancellationToken ct);

    /// <summary>Refused for the default language and while accounts use it (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);

    /// <summary>Code of the default language ("vi" when none is set).</summary>
    Task<string> GetDefaultCodeAsync(CancellationToken ct);
}
