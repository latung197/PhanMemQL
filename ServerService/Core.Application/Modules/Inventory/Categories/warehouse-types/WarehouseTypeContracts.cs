using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record WarehouseTypeTranslationDto(string LanguageCode, string Name);
public sealed record WarehouseTypeDto(string Code, string Name, string LocalizedName, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version, IReadOnlyList<WarehouseTypeTranslationDto> Translations);
public sealed record SaveWarehouseTypeRequest(string Code, string Name, string? Note, bool IsActive = true,
    uint? Version = null, IReadOnlyList<WarehouseTypeTranslationDto>? Translations = null);

public interface IWarehouseTypeService
{
    Task<IReadOnlyList<WarehouseTypeDto>> GetAllAsync(CancellationToken ct);
    Task<WarehouseTypeDto> CreateAsync(SaveWarehouseTypeRequest request, CancellationToken ct);
    Task<WarehouseTypeDto> UpdateAsync(string code, SaveWarehouseTypeRequest request, CancellationToken ct);
    Task DeleteAsync(string code, CancellationToken ct);
    Task<ImportResult> ImportAsync(ImportRequest<SaveWarehouseTypeRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
