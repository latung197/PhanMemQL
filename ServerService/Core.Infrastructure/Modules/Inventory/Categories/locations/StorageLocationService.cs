using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>
/// Danh mục vị trí lưu kho on the shared CatalogService. A location belongs to one warehouse that does not change once saved
/// (the stock kept in it is booked against that warehouse); its name is unique inside the warehouse.
/// </summary>
public sealed class StorageLocationService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<StorageLocation, StorageLocationDto, SaveStorageLocationRequest>(db, batch, excel, audit), IStorageLocationService
{
    private static readonly CatalogSpec Info = new("inv_location_cat", "location", "field.locationCode", 30, "DanhMucViTriLuuKho");

    private static readonly SortMap<StorageLocation> SortColumns = SortMap<StorageLocation>.By(x => x.Code, "code")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name)
        .Add("warehouseName", x => x.WarehouseCode).Add("zone", x => x.Zone).Add("rack", x => x.Rack).Add("shelf", x => x.Shelf)
        .Add("capacity", x => x.Capacity).Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<StorageLocation> Sorts => SortColumns;

    protected override IQueryable<StorageLocation> Search(IQueryable<StorageLocation> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.WarehouseCode, pattern) || SearchFunctions.Matches(x.Zone, pattern)
            || SearchFunctions.Matches(x.Rack, pattern) || SearchFunctions.Matches(x.Shelf, pattern));

    /// <summary>Filters <c>warehouseCode=KHO1</c> and <c>zone=Khu A</c> (exact, ignoring case).</summary>
    protected override IQueryable<StorageLocation> ApplyFilters(IQueryable<StorageLocation> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("warehouseCode", out var warehouse) && !string.IsNullOrWhiteSpace(warehouse)) rows = rows.Where(x => x.WarehouseCode == warehouse);
        if (filters.TryGetValue("zone", out var zone) && !string.IsNullOrWhiteSpace(zone))
        {
            var text = zone.Trim().ToLower();
            rows = rows.Where(x => x.Zone != null && x.Zone.ToLower() == text);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<StorageLocation>> ExportColumns() =>
    [
        new("export.location.code", x => x.Code), new("export.location.name", x => x.Name),
        new("export.location.warehouseCode", x => x.WarehouseCode), new("export.location.zone", x => x.Zone),
        new("export.location.rack", x => x.Rack), new("export.location.shelf", x => x.Shelf),
        new("export.location.capacity", x => x.Capacity), new("export.location.note", x => x.Note),
        new("export.location.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveStorageLocationRequest WithoutVersion(SaveStorageLocationRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<StorageLocationDto>> MapAsync(IReadOnlyList<StorageLocation> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.WarehouseCode).Distinct().ToList();
        var warehouses = await Db.Warehouses.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new StorageLocationDto(x.Code, x.Name, x.WarehouseCode, warehouses.GetValueOrDefault(x.WarehouseCode),
            x.Zone, x.Rack, x.Shelf, x.Capacity, x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(StorageLocation row, SaveStorageLocationRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.locationName");
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        var isNew = row.WarehouseCode.Length == 0;
        if (!isNew && row.WarehouseCode != warehouseCode) throw new BusinessRuleException("location.warehouseChanged");
        if (isNew)
        {
            var warehouse = await Db.Warehouses.AsNoTracking().FirstOrDefaultAsync(x => x.Code == warehouseCode, ct)
                ?? throw new BusinessRuleException("warehouse.notFound");
            if (!warehouse.IsActive) throw new BusinessRuleException("location.warehouseInactive");
        }
        if (await Db.StorageLocations.AnyAsync(x => x.Code != row.Code && x.WarehouseCode == warehouseCode && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("location.nameExists", name);

        row.Name = name;
        row.WarehouseCode = warehouseCode;
        row.Zone = Guard.Optional(request.Zone, 50, "field.zone");
        row.Rack = Guard.Optional(request.Rack, 50, "field.rack");
        row.Shelf = Guard.Optional(request.Shelf, 50, "field.shelf");
        row.Capacity = request.Capacity is < 0 ? throw new BusinessRuleException("validation.notNegative", new Text("field.capacity")) : request.Capacity;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
    // Stock balances will point to a location with [References<StorageLocation>], which then blocks deleting a used one.
}
