using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

/// <param name="UnitCodes">Company units that may use the warehouse; empty = shared, every unit may use it.</param>
public sealed record WarehouseDto(string Code, string Name, string? WarehouseTypeCode, string? WarehouseTypeName, string? Address, string? Manager,
    string? Capacity, bool IsActive, RecordStampDto Stamp, uint Version, IReadOnlyList<string> UnitCodes);

/// <param name="UnitCodes">Unit codes separated by comma or semicolon (also the form of an Excel cell); null keeps the units
/// the warehouse has, an empty text makes the warehouse shared.</param>
public sealed record SaveWarehouseRequest(string Code, string Name, string? Address, string? Manager,
    string? Capacity, bool IsActive = true, uint? Version = null, string? WarehouseTypeCode = null,
    string? UnitCodes = null) : ICatalogRequest;

/// <summary>Everything a catalog service offers (list, export, create, update, delete, import) comes from ICatalogService.</summary>
public interface IWarehouseService : ICatalogService<WarehouseDto, SaveWarehouseRequest>;
