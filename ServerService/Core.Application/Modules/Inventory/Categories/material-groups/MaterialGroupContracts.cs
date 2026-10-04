using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record MaterialGroupDto(string Code, string Name, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveMaterialGroupRequest(string Code, string Name, string? Note, bool IsActive = true, uint? Version = null);

public interface IMaterialGroupService
{
    Task<IReadOnlyList<MaterialGroupDto>> GetAllAsync(CancellationToken ct);
    Task<MaterialGroupDto> CreateAsync(SaveMaterialGroupRequest request, CancellationToken ct);
    Task<MaterialGroupDto> UpdateAsync(string code, SaveMaterialGroupRequest request, CancellationToken ct);
    Task DeleteAsync(string code, CancellationToken ct);
    Task<ImportResult> ImportAsync(ImportRequest<SaveMaterialGroupRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
