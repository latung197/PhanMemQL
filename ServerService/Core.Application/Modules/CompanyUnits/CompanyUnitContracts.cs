using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

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
    string? LocalizedName = null, IReadOnlyList<CompanyUnitTranslationDto>? Translations = null, bool IsActive = true,
    RecordStampDto? Stamp = null);

public sealed record SaveCompanyUnitRequest(string Code, string Name, string? ShortName,
    string? Address, string? Phone, string? Email, string? TaxCode, string? Status, bool IsDefault, uint? Version = null,
    IReadOnlyList<CompanyUnitTranslationDto>? Translations = null) : ICatalogRequest;

/// <summary>
/// The catalog of company units on ICatalogService (paged list, export, create, update, delete, import). One unit is the
/// default; the last active unit cannot be paused or deleted; a unit that users, month locks, number series, rules or
/// vouchers use cannot be deleted. Signed-in users pick units with the lookup (GET /api/lookups/companyUnits).
/// </summary>
public interface ICompanyUnitService : ICatalogService<CompanyUnitDto, SaveCompanyUnitRequest>
{
    /// <summary>Every unit (or the active ones): the sign-in screen's list.</summary>
    Task<IReadOnlyList<CompanyUnitDto>> GetAllAsync(bool activeOnly, CancellationToken ct);
}
