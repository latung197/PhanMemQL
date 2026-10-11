using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>
/// Tra cứu vật tư (<c>GET /api/lookups/materials</c>): code, name and the typed extras a voucher line needs (base unit,
/// stock and tracking flags, costing method). Parameter <c>tracking=lot|location|expiry</c> keeps only the materials with
/// that flag, e.g. the material picker of the lot catalog.
/// </summary>
public sealed class MaterialsLookup(CoreContext db) : LookupProvider
{
    public override string Name => "materials";
    public override IReadOnlyCollection<string> Tables => ["erp_material", "erp_uom"];
    public override IReadOnlyCollection<string> ParameterNames => ["tracking"];

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var rows = db.Materials.AsNoTracking();
        rows = context.Param("tracking") switch
        {
            "lot" => rows.Where(x => x.TrackLot),
            "location" => rows.Where(x => x.TrackLocation),
            "expiry" => rows.Where(x => x.HasExpiry),
            _ => rows
        };
        var list = await rows.OrderBy(x => x.Code).ToListAsync(ct);
        var uomCodes = list.Select(x => x.UomCode).Distinct().ToList();
        var uoms = await db.Uoms.AsNoTracking().Where(x => uomCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return list.Select(x => new LookupItem(x.Code, x.Name, x.IsActive, new Dictionary<string, object?>
        {
            ["uomCode"] = x.UomCode,
            ["uomName"] = uoms.GetValueOrDefault(x.UomCode),
            ["materialTypeCode"] = x.MaterialTypeCode,
            ["isStockItem"] = x.IsStockItem,
            ["trackLot"] = x.TrackLot,
            ["hasExpiry"] = x.HasExpiry,
            ["shelfLifeDays"] = x.ShelfLifeDays,
            ["trackLocation"] = x.TrackLocation,
            ["costingMethod"] = x.CostingMethod
        })).ToList();
    }
}

/// <summary>
/// Tra cứu vị trí lưu kho (<c>GET /api/lookups/locations</c>). Parameter <c>warehouse=KHO1</c> keeps only the locations of
/// that warehouse (a voucher line picks a location of the warehouse of the voucher).
/// </summary>
public sealed class LocationsLookup(CoreContext db) : LookupProvider
{
    public override string Name => "locations";
    public override IReadOnlyCollection<string> Tables => ["erp_location"];
    public override IReadOnlyCollection<string> ParameterNames => ["warehouse"];

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var rows = db.StorageLocations.AsNoTracking();
        if (context.Param("warehouse")?.ToUpperInvariant() is { } warehouse) rows = rows.Where(x => x.WarehouseCode == warehouse);
        var list = await rows.OrderBy(x => x.WarehouseCode).ThenBy(x => x.Code).ToListAsync(ct);
        return list.Select(x => new LookupItem(x.Code, x.Name, x.IsActive, new Dictionary<string, object?>
        {
            ["warehouseCode"] = x.WarehouseCode,
            ["zone"] = x.Zone,
            ["rack"] = x.Rack,
            ["shelf"] = x.Shelf,
            ["capacity"] = x.Capacity
        })).ToList();
    }
}

/// <summary>
/// Tra cứu lô (<c>GET /api/lookups/lots</c>): the code is "VT001@LOT-2610", the name is the lot number. Parameter
/// <c>material=VT001</c> keeps only the lots of that material; each comes with its dates and quality status so
/// the screen can refuse an expired or blocked one.
/// </summary>
public sealed class LotsLookup(CoreContext db) : LookupProvider
{
    public override string Name => "lots";
    public override IReadOnlyCollection<string> Tables => ["erp_lot"];
    public override IReadOnlyCollection<string> ParameterNames => ["material"];

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var rows = db.Lots.AsNoTracking();
        if (context.Param("material")?.ToUpperInvariant() is { } material) rows = rows.Where(x => x.MaterialCode == material);
        var list = await rows.OrderBy(x => x.ExpDate == null).ThenBy(x => x.ExpDate).ThenBy(x => x.Code).ToListAsync(ct);
        return list.Select(x => new LookupItem(x.Code, x.LotNo, x.IsActive, new Dictionary<string, object?>
        {
            ["materialCode"] = x.MaterialCode,
            ["mfgDate"] = x.MfgDate?.ToString("yyyy-MM-dd"),
            ["expDate"] = x.ExpDate?.ToString("yyyy-MM-dd"),
            ["qualityStatus"] = x.QualityStatus
        })).ToList();
    }
}
