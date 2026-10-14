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
/// Danh mục vật tư on the shared CatalogService. Besides identity it checks the tracking flags the stock ledger relies on:
/// only a stock item can be tracked, an expiry date belongs to a lot, and the costing method is one of the known two.
/// Its type, group, base unit and tax codes are checked from their [References] attributes (and block deleting them).
/// </summary>
public sealed class MaterialService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Material, MaterialDto, SaveMaterialRequest>(db, batch, excel, audit), IMaterialService
{
    private static readonly CatalogSpec Info = new("inv_material_cat", "material", "field.materialCode", 50, "DanhMucVatTu");

    private static readonly SortMap<Material> SortColumns = SortMap<Material>.By(x => x.Code, "code")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name)
        .Add("customerMaterialCode", x => x.CustomerMaterialCode).Add("partNo", x => x.PartNo)
        .Add("materialTypeName", x => x.MaterialTypeCode).Add("materialGroupName", x => x.MaterialGroupCode)
        .Add("uomCode", x => x.UomCode).Add("costingMethod", x => x.CostingMethod)
        .Add("trackLot", x => x.TrackLot).Add("trackLocation", x => x.TrackLocation).Add("hasExpiry", x => x.HasExpiry)
        .Add("minStock", x => x.MinStock).Add("maxStock", x => x.MaxStock).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Material> Sorts => SortColumns;

    protected override IQueryable<Material> Search(IQueryable<Material> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.CustomerMaterialCode, pattern) || SearchFunctions.Matches(x.PartNo, pattern)
            || SearchFunctions.Matches(x.MaterialTypeCode, pattern) || SearchFunctions.Matches(x.MaterialGroupCode, pattern)
            || SearchFunctions.Matches(x.UomCode, pattern));

    /// <summary>Filters <c>typeCode</c>, <c>groupCode</c>, <c>uomCode</c> and <c>tracking=lot|location|expiry|none</c>.</summary>
    protected override IQueryable<Material> ApplyFilters(IQueryable<Material> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("typeCode", out var type) && !string.IsNullOrWhiteSpace(type)) rows = rows.Where(x => x.MaterialTypeCode == type);
        if (filters.TryGetValue("groupCode", out var group) && !string.IsNullOrWhiteSpace(group)) rows = rows.Where(x => x.MaterialGroupCode == group);
        if (filters.TryGetValue("uomCode", out var uom) && !string.IsNullOrWhiteSpace(uom)) rows = rows.Where(x => x.UomCode == uom);
        if (filters.TryGetValue("tracking", out var tracking))
            rows = tracking switch
            {
                "lot" => rows.Where(x => x.TrackLot),
                "location" => rows.Where(x => x.TrackLocation),
                "expiry" => rows.Where(x => x.HasExpiry),
                "none" => rows.Where(x => !x.TrackLot && !x.TrackLocation && !x.HasExpiry),
                _ => rows
            };
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Material>> ExportColumns() =>
    [
        new("export.material.code", x => x.Code), new("export.material.name", x => x.Name),
        new("export.material.customerMaterialCode", x => x.CustomerMaterialCode), new("export.material.partNo", x => x.PartNo),
        new("export.material.uomCode", x => x.UomCode), new("export.material.typeCode", x => x.MaterialTypeCode),
        new("export.material.groupCode", x => x.MaterialGroupCode), new("export.material.vatTaxRateCode", x => x.VatTaxRateCode),
        new("export.material.importTaxRateCode", x => x.ImportTaxRateCode), new("export.material.isStockItem", x => YesNo(x.IsStockItem)),
        new("export.material.trackLot", x => YesNo(x.TrackLot)), new("export.material.hasExpiry", x => YesNo(x.HasExpiry)),
        new("export.material.shelfLifeDays", x => x.ShelfLifeDays), new("export.material.trackLocation", x => YesNo(x.TrackLocation)),
        new("export.material.isCycleCounted", x => YesNo(x.IsCycleCounted)), new("export.material.costingMethod", x => x.CostingMethod),
        new("export.material.minStock", x => x.MinStock), new("export.material.maxStock", x => x.MaxStock),
        new("export.material.length", x => x.Length), new("export.material.width", x => x.Width),
        new("export.material.height", x => x.Height), new("export.material.weight", x => x.Weight),
        new("export.material.volume", x => x.Volume), new("export.material.note", x => x.Note),
        new("export.material.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveMaterialRequest WithoutVersion(SaveMaterialRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<MaterialDto>> MapAsync(IReadOnlyList<Material> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var typeCodes = rows.Select(x => x.MaterialTypeCode).OfType<string>().Distinct().ToList();
        var groupCodes = rows.Select(x => x.MaterialGroupCode).OfType<string>().Distinct().ToList();
        var uomCodes = rows.Select(x => x.UomCode).Distinct().ToList();
        var types = await Db.MaterialTypes.AsNoTracking().Where(x => typeCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var groups = await Db.MaterialGroups.AsNoTracking().Where(x => groupCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var materialCodes = rows.Select(x => x.Code).ToList();
        var saved = await Db.UomConversions.AsNoTracking().Where(x => x.MaterialCode != null && materialCodes.Contains(x.MaterialCode)).ToListAsync(ct);
        uomCodes.AddRange(saved.SelectMany(x => new[] { x.FromUomCode, x.ToUomCode }));
        var uoms = await Db.Uoms.AsNoTracking().Where(x => uomCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var conversions = rows.ToDictionary(x => x.Code, x => (IReadOnlyList<MaterialUomDto>)saved.Where(c => c.MaterialCode == x.Code)
            .Select(c => Shape(x.UomCode, c)).OfType<MaterialUomDto>().OrderBy(c => c.UomCode, StringComparer.Ordinal).ToList());
        // The grid shows every row of the material as "1 unit = factor base units": a row written the other way round is inverted.
        MaterialUomDto? Shape(string baseUom, UomConversion c) =>
            c.ToUomCode == baseUom && c.FromUomCode != baseUom ? new(c.FromUomCode, uoms.GetValueOrDefault(c.FromUomCode), c.Factor, c.Note, c.IsActive)
            : c.FromUomCode == baseUom && c.ToUomCode != baseUom ? new(c.ToUomCode, uoms.GetValueOrDefault(c.ToUomCode), decimal.Round(1m / c.Factor, 8), c.Note, c.IsActive)
            : null;
        return rows.Select(x => new MaterialDto(x.Code, x.Name, x.CustomerMaterialCode, x.PartNo,
            x.MaterialTypeCode, types.GetValueOrDefault(x.MaterialTypeCode ?? ""), x.MaterialGroupCode, groups.GetValueOrDefault(x.MaterialGroupCode ?? ""),
            x.UomCode, uoms.GetValueOrDefault(x.UomCode), x.VatTaxRateCode, x.ImportTaxRateCode,
            x.IsStockItem, x.TrackLot, x.HasExpiry, x.ShelfLifeDays, x.TrackLocation, x.IsCycleCounted,
            x.CostingMethod, x.MinStock, x.MaxStock, x.Length, x.Width, x.Height, x.Weight, x.Volume,
            x.Note, x.IsActive, stamp(x), x.Version, conversions.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    protected override Task ApplyAsync(Material row, SaveMaterialRequest request, CancellationToken ct)
    {
        row.Name = Guard.Required(request.Name, 200, "field.materialName");
        row.CustomerMaterialCode = Guard.Optional(request.CustomerMaterialCode, 50, "field.customerMaterialCode");
        row.PartNo = Guard.Optional(request.PartNo, 50, "field.partNo");
        row.MaterialTypeCode = Reference(request.MaterialTypeCode, 20, "field.materialTypeCode");
        row.MaterialGroupCode = Reference(request.MaterialGroupCode, 20, "field.materialGroupCode");
        row.UomCode = Guard.Code(request.UomCode, 20, "field.uomCode");
        row.VatTaxRateCode = Reference(request.VatTaxRateCode, 20, "field.vatTaxRateCode");
        row.ImportTaxRateCode = Reference(request.ImportTaxRateCode, 20, "field.importTaxRateCode");

        // Tracking: a service / expense item keeps no stock, and an expiry date lives on the lot.
        if (!request.IsStockItem && (request.TrackLot || request.TrackLocation || request.HasExpiry || request.IsCycleCounted))
            throw new BusinessRuleException("material.trackNeedsStock");
        if (request.HasExpiry && !request.TrackLot) throw new BusinessRuleException("material.expiryNeedsLot");
        if (request.ShelfLifeDays is not null && !request.HasExpiry) throw new BusinessRuleException("material.shelfLifeNeedsExpiry");
        if (request.ShelfLifeDays is <= 0) throw new BusinessRuleException("material.shelfLifePositive");
        row.IsStockItem = request.IsStockItem;
        row.TrackLot = request.TrackLot;
        row.HasExpiry = request.HasExpiry;
        row.ShelfLifeDays = request.ShelfLifeDays;
        row.TrackLocation = request.TrackLocation;
        row.IsCycleCounted = request.IsCycleCounted;

        var costing = (request.CostingMethod ?? string.Empty).Trim().ToUpperInvariant();
        if (costing is not (MaterialCosting.Average or MaterialCosting.Fifo)) throw new BusinessRuleException("material.costingInvalid");
        row.CostingMethod = costing;

        row.MinStock = NotNegative(request.MinStock, "field.minStock");
        row.MaxStock = NotNegative(request.MaxStock, "field.maxStock");
        if (row.MinStock is { } min && row.MaxStock is { } max && max < min) throw new BusinessRuleException("material.stockRange");
        row.Length = NotNegative(request.Length, "field.length");
        row.Width = NotNegative(request.Width, "field.width");
        row.Height = NotNegative(request.Height, "field.height");
        row.Weight = NotNegative(request.Weight, "field.weight");
        row.Volume = NotNegative(request.Volume, "field.volume");
        row.Note = Guard.Optional(request.Note, 500, "field.note");
        row.IsActive = request.IsActive;
        return Task.CompletedTask;
    }

    /// <summary>
    /// The conversions grid of the form: rows of <c>erp_uom_conversion</c> that carry this material, written as "1 unit = factor base
    /// units" (code <c>MATERIAL@UNIT</c>). Saved in the same transaction; rows not in the grid are deleted, a row written the other
    /// way round is turned around. Null = keep the saved ones. A change of the base unit needs the grid again, because the saved
    /// factors are in the old unit.
    /// </summary>
    protected override async Task AfterApplyAsync(Material row, SaveMaterialRequest request, bool isNew, CancellationToken ct)
    {
        var existing = isNew ? [] : await Db.UomConversions.Where(x => x.MaterialCode == row.Code).ToListAsync(ct);
        if (request.Conversions is null)
        {
            if (existing.Any(x => x.FromUomCode != row.UomCode && x.ToUomCode != row.UomCode)) throw new BusinessRuleException("material.uomChangeNeedsConversions");
            return;
        }
        var wanted = new Dictionary<string, SaveMaterialUom>(StringComparer.Ordinal);
        foreach (var item in request.Conversions)
        {
            var uom = Guard.Code(item.UomCode, 20, "field.uomCode");
            if (uom == row.UomCode) throw new BusinessRuleException("material.conversionSameAsBase", uom);
            if (item.Factor < 0.00000001m || item.Factor >= 1_000_000_000_000m || decimal.Round(item.Factor, 8) != item.Factor)
                throw new BusinessRuleException("uomConversion.invalidFactor");
            if (!wanted.TryAdd(uom, item with { UomCode = uom })) throw new BusinessRuleException("material.conversionDuplicate", uom);
        }
        string OtherUnit(UomConversion c) => c.FromUomCode == row.UomCode ? c.ToUomCode : c.FromUomCode;
        var kept = existing.Where(c => c.FromUomCode == row.UomCode || c.ToUomCode == row.UomCode).Select(OtherUnit).ToHashSet(StringComparer.Ordinal);
        var added = wanted.Keys.Where(uom => !kept.Contains(uom)).ToList();
        foreach (var uom in added)
            if (!await Db.Uoms.AnyAsync(x => x.Code == uom && x.IsActive, ct)) throw new BusinessRuleException("uomConversion.unitUnavailable", uom);

        var changed = false;
        var order = 0;
        foreach (var c in existing.ToList())
        {
            var touchesBase = c.FromUomCode == row.UomCode || c.ToUomCode == row.UomCode;
            if (!touchesBase || !wanted.TryGetValue(OtherUnit(c), out var item)) { Db.UomConversions.Remove(c); changed = true; continue; }
            if (c.FromUomCode != item.UomCode || c.ToUomCode != row.UomCode || c.Factor != item.Factor || c.Note != item.Note?.Trim() || c.IsActive != item.IsActive) changed = true;
            c.FromUomCode = item.UomCode;
            c.ToUomCode = row.UomCode;
            c.Factor = item.Factor;
            c.Note = Guard.Optional(item.Note, 300, "field.note");
            c.IsActive = item.IsActive;
            c.MaterialName = row.Name;
            c.SortOrder = order++;
            wanted.Remove(item.UomCode);
        }
        foreach (var item in wanted.Values)
        {
            Db.UomConversions.Add(new UomConversion
            {
                Code = $"{row.Code}@{item.UomCode}", MaterialCode = row.Code, MaterialName = row.Name, FromUomCode = item.UomCode,
                ToUomCode = row.UomCode, Factor = item.Factor, Note = Guard.Optional(item.Note, 300, "field.note"),
                IsActive = item.IsActive, SortOrder = order++
            });
            changed = true;
        }
        // A conversions-only edit must advance the material version so concurrent forms cannot overwrite it.
        if (!isNew && changed) Db.Entry(row).Property(x => x.Name).IsModified = true;
    }

    protected override async Task BeforeDeleteAsync(Material row, CancellationToken ct) =>
        Db.UomConversions.RemoveRange(await Db.UomConversions.Where(x => x.MaterialCode == row.Code).ToListAsync(ct));

    /// <summary>An optional code of another catalog: empty = none; the code must exist (checked on save from [References]).</summary>
    private static string? Reference(string? code, int length, string label) =>
        string.IsNullOrWhiteSpace(code) ? null : Guard.Code(code, length, label);

    private static decimal? NotNegative(decimal? value, string label) =>
        value is < 0 ? throw new BusinessRuleException("validation.notNegative", new Text(label)) : value;
    // Lots are checked from their [References<Material>] column, so a material with lots cannot be deleted.
}
