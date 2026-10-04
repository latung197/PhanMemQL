using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record UomTranslationDto(string LanguageCode, string Name);

public sealed record UomDto(string Code, string Name, string LocalizedName, string Symbol, string? Note,
    bool IsActive, RecordStampDto Stamp, uint Version, IReadOnlyList<UomTranslationDto> Translations);

public sealed record SaveUomRequest(string Code, string Name, string? Symbol, string? Note, bool IsActive = true,
    uint? Version = null, IReadOnlyList<UomTranslationDto>? Translations = null);

public interface IUomService
{
    Task<IReadOnlyList<UomDto>> GetAllAsync(CancellationToken ct);
    Task<UomDto> CreateAsync(SaveUomRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed.</summary>
    Task<UomDto> UpdateAsync(string code, SaveUomRequest request, CancellationToken ct);

    /// <summary>Refused while other data uses the unit (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);

    /// <summary>Nhập Excel: every row checked like the form, all saved or none (CatalogBatch).</summary>
    Task<ImportResult> ImportAsync(ImportRequest<SaveUomRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
