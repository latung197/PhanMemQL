using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

/// <summary>One line of the "Đơn vị quy đổi" grid: 1 <paramref name="UomCode"/> = <paramref name="Factor"/> base units of the material.</summary>
public sealed record MaterialUomDto(string UomCode, string? UomName, decimal Factor, string? Note, bool IsActive);

/// <summary>A conversion typed on the material form (see <see cref="MaterialUomDto"/>).</summary>
public sealed record SaveMaterialUom(string UomCode, decimal Factor, string? Note = null, bool IsActive = true);

/// <param name="UomName">Name of the base unit in the caller's language, for display.</param>
public sealed record MaterialDto(string Code, string Name, string? CustomerMaterialCode, string? PartNo,
    string? MaterialTypeCode, string? MaterialTypeName, string? MaterialGroupCode, string? MaterialGroupName,
    string UomCode, string? UomName, string? VatTaxRateCode, string? ImportTaxRateCode,
    bool IsStockItem, bool TrackLot, bool HasExpiry, int? ShelfLifeDays, bool TrackLocation, bool IsCycleCounted,
    string CostingMethod, decimal? MinStock, decimal? MaxStock, decimal? Length, decimal? Width, decimal? Height,
    decimal? Weight, decimal? Volume, string? Note, bool IsActive, RecordStampDto Stamp, uint Version,
    IReadOnlyList<MaterialUomDto>? Conversions = null);

/// <summary>
/// Tracking flags: a material that is not a stock item cannot be tracked by lot or location; an expiry date needs lot
/// tracking. <c>CostingMethod</c> is AVERAGE or FIFO.
/// </summary>
public sealed record SaveMaterialRequest(string Code, string Name, string UomCode, string? CustomerMaterialCode = null,
    string? PartNo = null, string? MaterialTypeCode = null, string? MaterialGroupCode = null, string? VatTaxRateCode = null,
    string? ImportTaxRateCode = null, bool IsStockItem = true, bool TrackLot = false, bool HasExpiry = false,
    int? ShelfLifeDays = null, bool TrackLocation = false, bool IsCycleCounted = false, string CostingMethod = "AVERAGE",
    decimal? MinStock = null, decimal? MaxStock = null, decimal? Length = null, decimal? Width = null, decimal? Height = null,
    decimal? Weight = null, decimal? Volume = null, string? Note = null, bool IsActive = true, uint? Version = null,
    /// <summary>The conversions of the material (units other than the base unit). Null = keep what is saved (Excel import, older clients).</summary>
    IReadOnlyList<SaveMaterialUom>? Conversions = null) : ICatalogRequest;

/// <summary>Materials on ICatalogService (list with the filters <c>typeCode</c>, <c>groupCode</c>, <c>tracking=lot|location|expiry</c>, export, create, update, delete, import).</summary>
public interface IMaterialService : ICatalogService<MaterialDto, SaveMaterialRequest>;
