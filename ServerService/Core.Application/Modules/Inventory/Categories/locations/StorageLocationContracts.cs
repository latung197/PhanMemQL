using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record StorageLocationDto(string Code, string Name, string WarehouseCode, string? WarehouseName, string? Zone,
    string? Rack, string? Shelf, decimal? Capacity, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveStorageLocationRequest(string Code, string Name, string WarehouseCode, string? Zone = null,
    string? Rack = null, string? Shelf = null, decimal? Capacity = null, string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

/// <summary>Storage locations on ICatalogService (list with the filters <c>warehouseCode</c> and <c>zone</c>, export, create, update, delete, import).</summary>
public interface IStorageLocationService : ICatalogService<StorageLocationDto, SaveStorageLocationRequest>;
