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
/// Danh mục định mức tồn kho on the shared CatalogService. Keyed by material + warehouse ("VT001@KHO1", <see cref="StockNormKey"/>); both
/// are fixed once saved. Only active stock items can get a norm.
/// </summary>
public sealed class StockNormService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<StockNorm, StockNormDto, SaveStockNormRequest>(db, batch, excel, audit), IStockNormService
{
    private static readonly CatalogSpec Info = new("inv_stock_norm_cat", "stockNorm", "field.stockNormCode", 71, "DinhMucTonKho");

    private static readonly SortMap<StockNorm> SortColumns = SortMap<StockNorm>.By(x => x.Code, "code")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("materialCode", x => x.MaterialCode).Add("warehouseCode", x => x.WarehouseCode)
        .Add("minQuantity", x => x.MinQuantity).Add("maxQuantity", x => x.MaxQuantity).Add("safetyQuantity", x => x.SafetyQuantity)
        .Add("reorderPoint", x => x.ReorderPoint).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<StockNorm> Sorts => SortColumns;

    protected override IQueryable<StockNorm> Search(IQueryable<StockNorm> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.MaterialCode, pattern)
            || SearchFunctions.Matches(x.WarehouseCode, pattern)
            || Db.Materials.Any(m => m.Code == x.MaterialCode && SearchFunctions.Matches(m.Name, pattern))
            || Db.Warehouses.Any(w => w.Code == x.WarehouseCode && SearchFunctions.Matches(w.Name, pattern)));

    /// <summary>Filters <c>materialCode</c> and <c>warehouseCode</c>.</summary>
    protected override IQueryable<StockNorm> ApplyFilters(IQueryable<StockNorm> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("materialCode", out var material) && !string.IsNullOrWhiteSpace(material)) rows = rows.Where(x => x.MaterialCode == material);
        if (filters.TryGetValue("warehouseCode", out var warehouse) && !string.IsNullOrWhiteSpace(warehouse)) rows = rows.Where(x => x.WarehouseCode == warehouse);
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<StockNorm>> ExportColumns() =>
    [
        new("export.stockNorm.materialCode", x => x.MaterialCode), new("export.stockNorm.warehouseCode", x => x.WarehouseCode),
        new("export.stockNorm.minQuantity", x => x.MinQuantity), new("export.stockNorm.maxQuantity", x => x.MaxQuantity),
        new("export.stockNorm.safetyQuantity", x => x.SafetyQuantity), new("export.stockNorm.reorderPoint", x => x.ReorderPoint),
        new("export.stockNorm.note", x => x.Note), new("export.stockNorm.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveStockNormRequest WithoutVersion(SaveStockNormRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<StockNormDto>> MapAsync(IReadOnlyList<StockNorm> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var materialCodes = rows.Select(x => x.MaterialCode).Distinct().ToList();
        var warehouseCodes = rows.Select(x => x.WarehouseCode).Distinct().ToList();
        var materials = await Db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => new { x.Name, x.UomCode }, ct);
        var warehouses = await Db.Warehouses.AsNoTracking().Where(x => warehouseCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new StockNormDto(x.Code, x.MaterialCode, materials.GetValueOrDefault(x.MaterialCode)?.Name, materials.GetValueOrDefault(x.MaterialCode)?.UomCode,
            x.WarehouseCode, warehouses.GetValueOrDefault(x.WarehouseCode), x.MinQuantity, x.MaxQuantity, x.SafetyQuantity, x.ReorderPoint,
            x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(StockNorm row, SaveStockNormRequest request, CancellationToken ct)
    {
        var materialCode = Guard.Code(request.MaterialCode, 50, "field.materialCode");
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        var isNew = row.MaterialCode.Length == 0;
        if (!isNew && row.Code != request.Code) throw new BusinessRuleException("stockNorm.keyChanged");

        if (isNew)
        {
            var material = await Db.Materials.AsNoTracking().FirstOrDefaultAsync(x => x.Code == materialCode, ct)
                ?? throw new BusinessRuleException("material.notFound");
            if (!material.IsActive) throw new BusinessRuleException("stockNorm.materialInactive", materialCode);
            if (!material.IsStockItem) throw new BusinessRuleException("stockNorm.notStockItem", materialCode);
            if (!await Db.Warehouses.AsNoTracking().AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
                throw new BusinessRuleException("stockNorm.warehouseInvalid", warehouseCode);
        }

        var min = NotNegative(request.MinQuantity, "field.minQuantity");
        var max = NotNegative(request.MaxQuantity, "field.maxQuantity");
        var safety = NotNegative(request.SafetyQuantity, "field.safetyQuantity");
        var reorder = NotNegative(request.ReorderPoint, "field.reorderPoint");
        if (min is { } lo && max is { } hi && hi < lo) throw new BusinessRuleException("stockNorm.range");
        if (reorder is { } rp && max is { } top && rp > top) throw new BusinessRuleException("stockNorm.reorderOverMax");

        row.MaterialCode = materialCode;
        row.WarehouseCode = warehouseCode;
        row.MinQuantity = min;
        row.MaxQuantity = max;
        row.SafetyQuantity = safety;
        row.ReorderPoint = reorder;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    private static decimal? NotNegative(decimal? value, string label) =>
        value is < 0 ? throw new BusinessRuleException("validation.notNegative", new Text(label)) : value;
}
