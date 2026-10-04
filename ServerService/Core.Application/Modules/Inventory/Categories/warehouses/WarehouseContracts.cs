using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record WarehouseDto(string Code, string Name, string? WarehouseTypeCode, string? WarehouseTypeName, string? Address, string? Manager,
    string? Capacity, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveWarehouseRequest(string Code, string Name, string? Address, string? Manager,
    string? Capacity, bool IsActive = true, uint? Version = null, string? WarehouseTypeCode = null);

public interface IWarehouseService
{
    Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken ct);
    Task<WarehouseDto> CreateAsync(SaveWarehouseRequest request, CancellationToken ct);
    Task<WarehouseDto> UpdateAsync(string code, SaveWarehouseRequest request, CancellationToken ct);
    Task DeleteAsync(string code, CancellationToken ct);
    Task<ImportResult> ImportAsync(ImportRequest<SaveWarehouseRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
