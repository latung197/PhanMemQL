using Core.Application.Common.Catalogs;

namespace Core.Application.Modules.CompanyUnits;

public static class CompanyUnitStatus
{
    public const string Active = "Hoạt động";
    public const string Paused = "Tạm dừng";
}

/// <summary>Same shape as Frontend CompanyUnit; Id equals Code.</summary>
public sealed record CompanyUnitTranslationDto(string LanguageCode, string Name);
public sealed record CompanyUnitDto(string Id, string Code, string Name, string? ShortName,
    string? Address, string? Phone, string? Email, string? TaxCode, string Status, bool IsDefault, uint Version,
    string? LocalizedName = null, IReadOnlyList<CompanyUnitTranslationDto>? Translations = null, bool IsActive = true);

public sealed record SaveCompanyUnitRequest(string Code, string Name, string? ShortName,
    string? Address, string? Phone, string? Email, string? TaxCode, string? Status, bool IsDefault, uint? Version = null,
    IReadOnlyList<CompanyUnitTranslationDto>? Translations = null);

public interface ICompanyUnitService
{
    Task<IReadOnlyList<CompanyUnitDto>> GetAllAsync(bool activeOnly, CancellationToken ct);
    Task<CompanyUnitDto> CreateAsync(SaveCompanyUnitRequest request, CancellationToken ct);
    Task<CompanyUnitDto> UpdateAsync(string code, SaveCompanyUnitRequest request, CancellationToken ct);
    Task DeleteAsync(string code, CancellationToken ct);
    Task<ImportResult> ImportAsync(ImportRequest<SaveCompanyUnitRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
