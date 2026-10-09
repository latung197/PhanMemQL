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
/// Danh mục kho on the shared CatalogService. Besides its fields a warehouse has a type (a lookup) and the company
/// units that may use it (several; none = shared by every unit), kept in erp_warehouse_unit.
/// </summary>
public sealed class WarehouseService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Warehouse, WarehouseDto, SaveWarehouseRequest>(db, batch, excel, audit), IWarehouseService
{
    private static readonly CatalogSpec Info = new("inv_warehouse_cat", "warehouse", "field.warehouseCode", 20, "DanhMucKho");

    /// <summary>"warehouseTypeName" sorts by the type code.</summary>
    private static readonly SortMap<Warehouse> SortColumns = SortMap<Warehouse>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name)
        .Add("warehouseTypeName", x => x.WarehouseTypeCode).Add("address", x => x.Address).Add("manager", x => x.Manager)
        .Add("capacity", x => x.Capacity).Add("isActive", x => x.IsActive).AddRecordStamps();

    /// <summary>Units of the warehouses being exported, read once by <see cref="BeforeExportAsync"/>.</summary>
    private Dictionary<string, string> _exportUnits = [];

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Warehouse> Sorts => SortColumns;

    protected override IQueryable<Warehouse> Search(IQueryable<Warehouse> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.WarehouseTypeCode, pattern) || SearchFunctions.Matches(x.Address, pattern)
            || SearchFunctions.Matches(x.Manager, pattern) || SearchFunctions.Matches(x.Capacity, pattern)
            || Db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code && SearchFunctions.Matches(u.UnitCode, pattern)));

    /// <summary>Filters <c>warehouseTypeCode=KHO-NL</c> and <c>unitCode=DVCS01</c> (warehouses that unit may use, shared ones included).</summary>
    protected override IQueryable<Warehouse> ApplyFilters(IQueryable<Warehouse> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("warehouseTypeCode", out var type)) rows = rows.Where(x => x.WarehouseTypeCode == type);
        if (filters.TryGetValue("unitCode", out var unit))
            rows = rows.Where(x => !Db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code)
                || Db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code && u.UnitCode == unit));
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Warehouse>> ExportColumns() =>
    [
        new("export.warehouse.code", x => x.Code), new("export.warehouse.name", x => x.Name),
        new("export.warehouse.unitCodes", x => _exportUnits.GetValueOrDefault(x.Code, string.Empty)),
        new("export.warehouse.typeCode", x => x.WarehouseTypeCode), new("export.warehouse.address", x => x.Address),
        new("export.warehouse.manager", x => x.Manager), new("export.warehouse.capacity", x => x.Capacity),
        new("export.warehouse.isActive", x => YesNo(x.IsActive))
    ];

    protected override async Task BeforeExportAsync(IReadOnlyList<Warehouse> rows, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var units = await Db.WarehouseUnits.AsNoTracking().Where(x => codes.Contains(x.WarehouseCode)).ToListAsync(ct);
        _exportUnits = units.GroupBy(x => x.WarehouseCode)
            .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(x => x.UnitCode).Order(StringComparer.Ordinal)));
    }

    protected override SaveWarehouseRequest WithoutVersion(SaveWarehouseRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<WarehouseDto>> MapAsync(IReadOnlyList<Warehouse> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var units = await Db.WarehouseUnits.AsNoTracking().Where(x => codes.Contains(x.WarehouseCode)).ToListAsync(ct);
        var unitsByWarehouse = units.GroupBy(x => x.WarehouseCode)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.UnitCode).Order(StringComparer.Ordinal).ToList());
        var typeNames = await LoadTypeNamesAsync(rows.Select(x => x.WarehouseTypeCode).OfType<string>().Distinct().ToList(), ct);
        return rows.Select(x => new WarehouseDto(x.Code, x.Name, x.WarehouseTypeCode,
            typeNames.GetValueOrDefault(x.WarehouseTypeCode ?? ""), x.Address, x.Manager, x.Capacity, x.IsActive, stamp(x), x.Version,
            unitsByWarehouse.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    protected override async Task ApplyAsync(Warehouse row, SaveWarehouseRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.warehouseName");
        if (await Db.Warehouses.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("warehouse.nameExists", name);
        row.Name = name;
        if (request.WarehouseTypeCode is not null)
        {
            var typeCode = request.WarehouseTypeCode.Trim().ToUpperInvariant();
            if (typeCode.Length > 20) throw new BusinessRuleException("warehouseType.notFound");
            if (typeCode.Length > 0)
            {
                var type = await Db.WarehouseTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Code == typeCode, ct)
                    ?? throw new BusinessRuleException("warehouseType.notFound");
                if (!type.IsActive && row.WarehouseTypeCode != typeCode)
                    throw new BusinessRuleException("warehouseType.inactive");
            }
            row.WarehouseTypeCode = typeCode.Length == 0 ? null : typeCode;
        }
        row.Address = Guard.Optional(request.Address, 300, "field.address");
        row.Manager = Guard.Optional(request.Manager, 100, "field.manager");
        row.Capacity = Guard.Optional(request.Capacity, 100, "field.capacity");
        row.IsActive = request.IsActive;
    }

    protected override async Task AfterApplyAsync(Warehouse row, SaveWarehouseRequest request, bool isNew, CancellationToken ct)
    {
        // Null = an older client or an Excel file without the column: keep the units the warehouse has.
        if (request.UnitCodes is null) return;
        var wanted = request.UnitCodes.Split([',', ';', ' ', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim().ToUpperInvariant()).Distinct(StringComparer.Ordinal).ToList();

        var existing = await Db.WarehouseUnits.Where(x => x.WarehouseCode == row.Code).ToListAsync(ct);
        var added = wanted.Where(code => existing.All(x => x.UnitCode != code)).ToList();
        if (added.Count > 0)
        {
            // A unit that is not there yet must exist and be active; units already on the warehouse stay even if stopped.
            var units = await Db.CompanyUnits.AsNoTracking().Where(x => added.Contains(x.Code)).ToListAsync(ct);
            var bad = added.Where(code => units.All(x => x.Code != code || !x.IsActive)).ToList();
            if (bad.Count > 0) throw new BusinessRuleException("warehouse.unitInvalid", string.Join(", ", bad));
        }
        var removed = existing.Where(x => !wanted.Contains(x.UnitCode)).ToList();
        Db.WarehouseUnits.RemoveRange(removed);
        foreach (var code in added) Db.WarehouseUnits.Add(new WarehouseUnit { WarehouseCode = row.Code, UnitCode = code });
        // A units-only edit must advance the warehouse version so concurrent forms cannot overwrite it.
        if (!isNew && (added.Count > 0 || removed.Count > 0)) Db.Entry(row).Property(x => x.Name).IsModified = true;
    }

    protected override async Task BeforeDeleteAsync(Warehouse row, CancellationToken ct)
    {
        // Receipts (and later stock and other vouchers) are checked from their [References<Warehouse>] columns.
        Db.WarehouseUnits.RemoveRange(await Db.WarehouseUnits.Where(x => x.WarehouseCode == row.Code).ToListAsync(ct));
    }

    private async Task<Dictionary<string, string>> LoadTypeNamesAsync(IReadOnlyList<string> codes, CancellationToken ct)
    {
        if (codes.Count == 0) return [];
        var types = await Db.WarehouseTypes.AsNoTracking().Where(x => codes.Contains(x.Code)).ToListAsync(ct);
        var translations = await Db.WarehouseTypeTranslations.AsNoTracking().Where(x => codes.Contains(x.WarehouseTypeCode)).ToListAsync(ct);
        var language = Messages.CurrentLanguage;
        var baseLanguage = language.Split('-')[0];
        return types.ToDictionary(x => x.Code, x =>
            translations.FirstOrDefault(t => t.WarehouseTypeCode == x.Code && t.LanguageCode == language)?.Name
            ?? translations.FirstOrDefault(t => t.WarehouseTypeCode == x.Code && t.LanguageCode == baseLanguage)?.Name
            ?? x.Name);
    }
}

/// <summary>Which warehouses a company unit may use.</summary>
public static class WarehouseQueries
{
    /// <summary>Active warehouses the unit may use: those that list the unit, and shared ones (no unit listed).</summary>
    public static IQueryable<Warehouse> UsableBy(this CoreContext db, string unitCode) =>
        db.Warehouses.Where(x => x.IsActive && (!db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code)
            || db.WarehouseUnits.Any(u => u.WarehouseCode == x.Code && u.UnitCode == unitCode)));
}
