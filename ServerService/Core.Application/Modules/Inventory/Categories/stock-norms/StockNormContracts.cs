using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record StockNormDto(string Code, string MaterialCode, string? MaterialName, string? UomCode, string WarehouseCode, string? WarehouseName,
    decimal? MinQuantity, decimal? MaxQuantity, decimal? SafetyQuantity, decimal? ReorderPoint, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version);

/// <summary>
/// The stock norm of a material in a warehouse. Its catalog code is derived (<c>VT001@KHO1</c>): the material and the warehouse of a
/// saved norm do not change. Empty = not declared; the minimum cannot be above the maximum.
/// </summary>
public sealed record SaveStockNormRequest(string MaterialCode, string WarehouseCode, decimal? MinQuantity = null, decimal? MaxQuantity = null,
    decimal? SafetyQuantity = null, decimal? ReorderPoint = null, string? Note = null, bool IsActive = true,
    uint? Version = null) : ICatalogRequest
{
    public string Code => StockNormKey.Of(MaterialCode, WarehouseCode);
}

/// <summary>The catalog code of a stock norm: "VT001@KHO1".</summary>
public static class StockNormKey
{
    public static string Of(string? materialCode, string? warehouseCode) =>
        $"{(materialCode ?? string.Empty).Trim().ToUpperInvariant()}@{(warehouseCode ?? string.Empty).Trim().ToUpperInvariant()}";
}

/// <summary>Stock norms on ICatalogService (list with the filters <c>materialCode</c> and <c>warehouseCode</c>, export, create, update, delete, import).</summary>
public interface IStockNormService : ICatalogService<StockNormDto, SaveStockNormRequest>;
