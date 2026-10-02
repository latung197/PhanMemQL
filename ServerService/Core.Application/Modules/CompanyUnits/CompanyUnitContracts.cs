namespace Core.Application.Modules.CompanyUnits;

public static class CompanyUnitStatus
{
    public const string Active = "Hoạt động";
    public const string Paused = "Tạm dừng";
}

/// <summary>Same shape as Frontend CompanyUnit; Id equals Code.</summary>
public sealed record CompanyUnitDto(string Id, string Code, string Name, string? ShortName,
    string? Address, string? Phone, string? Email, string? TaxCode, string Status, bool IsDefault, uint Version);

public sealed record SaveCompanyUnitRequest(string Code, string Name, string? ShortName,
    string? Address, string? Phone, string? Email, string? TaxCode, string? Status, bool IsDefault, uint? Version = null);

public interface ICompanyUnitService
{
    Task<IReadOnlyList<CompanyUnitDto>> GetAllAsync(bool activeOnly, CancellationToken ct);
    Task<CompanyUnitDto> CreateAsync(SaveCompanyUnitRequest request, CancellationToken ct);
    Task<CompanyUnitDto> UpdateAsync(string code, SaveCompanyUnitRequest request, CancellationToken ct);
    Task DeleteAsync(string code, CancellationToken ct);
}
