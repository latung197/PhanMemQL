using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>
/// Tra cứu kho (<c>GET /api/lookups/warehouses</c>): only the warehouses the working company unit may use, the same rule as saving a voucher
/// (<see cref="WarehouseQueries.UsableBy"/>: the warehouses that list the unit, and the shared ones that list no unit). A user never picks a
/// warehouse of another unit, and the cached list is kept per unit. To work with the warehouses of another unit, switch unit.
/// </summary>
public sealed class WarehouseLookup(CoreContext db) : LookupProvider
{
    public override string Name => "warehouses";

    public override IReadOnlyCollection<string> Tables => ["erp_warehouse", "erp_warehouse_unit"];

    public override Task<string> CacheScopeAsync(LookupContext context, CancellationToken ct) => Task.FromResult(context.UnitCode);

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var unit = context.UnitCode;
        // Inactive warehouses are listed too (with IsActive false): the framework hides them unless the screen asks for them.
        var rows = await db.Warehouses.AsNoTracking()
            .Where(x => !db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code) || db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code && u.UnitCode == unit))
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        return rows.Select(x => new LookupItem(x.Code, x.Name, x.IsActive, new Dictionary<string, object?> { ["address"] = x.Address })).ToList();
    }
}
