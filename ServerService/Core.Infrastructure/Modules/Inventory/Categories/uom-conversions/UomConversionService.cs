using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
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

/// <summary>Danh mục quy đổi đơn vị tính (see CatalogService). The list also shows the names of the two units.</summary>
public sealed class UomConversionService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<UomConversion, UomConversionDto, SaveUomConversionRequest>(db, batch, excel, audit), IUomConversionService
{
    private static readonly CatalogSpec Info = new("inv_uom_conversion_cat", "uomConversion", "field.uomConversionCode", 40,
        "DanhMucQuyDoiDonViTinh");

    private static readonly SortMap<UomConversion> SortColumns = SortMap<UomConversion>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("materialCode", x => x.MaterialCode)
        .Add("fromUomCode", x => x.FromUomCode).Add("toUomCode", x => x.ToUomCode).Add("factor", x => x.Factor)
        .Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<UomConversion> Sorts => SortColumns;

    /// <summary>The search also matches the names of the two units.</summary>
    protected override IQueryable<UomConversion> Search(IQueryable<UomConversion> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.MaterialCode, pattern)
            || SearchFunctions.Matches(x.MaterialName, pattern) || SearchFunctions.Matches(x.FromUomCode, pattern)
            || SearchFunctions.Matches(x.ToUomCode, pattern) || SearchFunctions.Matches(x.Note, pattern)
            || Db.Uoms.Any(u => (u.Code == x.FromUomCode || u.Code == x.ToUomCode) && SearchFunctions.Matches(u.Name, pattern)));

    /// <summary>Own filters: <c>?fromUomCode=KG</c> and <c>?toUomCode=G</c> (the model of a catalog filter; others are ignored).</summary>
    protected override IQueryable<UomConversion> ApplyFilters(IQueryable<UomConversion> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("fromUomCode", out var from)) rows = rows.Where(x => x.FromUomCode == from.ToUpper());
        if (filters.TryGetValue("toUomCode", out var to)) rows = rows.Where(x => x.ToUomCode == to.ToUpper());
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<UomConversion>> ExportColumns() =>
    [
        new("export.uomConversion.code", x => x.Code), new("export.uomConversion.materialCode", x => x.MaterialCode),
        new("export.uomConversion.materialName", x => x.MaterialName), new("export.uomConversion.fromUom", x => x.FromUomCode),
        new("export.uomConversion.toUom", x => x.ToUomCode), new("export.uomConversion.factor", x => x.Factor),
        new("export.uomConversion.note", x => x.Note), new("export.uomConversion.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveUomConversionRequest WithoutVersion(SaveUomConversionRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<UomConversionDto>> MapAsync(IReadOnlyList<UomConversion> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var unitCodes = rows.SelectMany(x => new[] { x.FromUomCode, x.ToUomCode }).Distinct().ToList();
        var names = await Db.Uoms.AsNoTracking().Where(x => unitCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new UomConversionDto(x.Code, x.MaterialCode, x.MaterialName,
            x.FromUomCode, names.GetValueOrDefault(x.FromUomCode) ?? x.FromUomCode,
            x.ToUomCode, names.GetValueOrDefault(x.ToUomCode) ?? x.ToUomCode,
            x.Factor, x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(UomConversion row, SaveUomConversionRequest request, CancellationToken ct)
    {
        var from = Guard.Code(request.FromUomCode, 20, "field.fromUom");
        var to = Guard.Code(request.ToUomCode, 20, "field.toUom");
        if (from == to) throw new BusinessRuleException("uomConversion.sameUnit");
        if (request.Factor < 0.00000001m || request.Factor >= 1_000_000_000_000m
            || decimal.Round(request.Factor, 8) != request.Factor)
            throw new BusinessRuleException("uomConversion.invalidFactor");
        if (!await Db.Uoms.AnyAsync(x => x.Code == from && x.IsActive, ct))
            throw new BusinessRuleException("uomConversion.unitUnavailable", from);
        if (!await Db.Uoms.AnyAsync(x => x.Code == to && x.IsActive, ct))
            throw new BusinessRuleException("uomConversion.unitUnavailable", to);

        var materialCode = Guard.Optional(request.MaterialCode, 50, "field.materialCode")?.ToUpperInvariant();
        if (await Db.UomConversions.AnyAsync(x => x.Code != row.Code && x.MaterialCode == materialCode
            && x.FromUomCode == from && x.ToUomCode == to, ct))
            throw new BusinessRuleException("uomConversion.pairExists");

        row.MaterialCode = materialCode;
        row.MaterialName = materialCode is null ? null : Guard.Optional(request.MaterialName, 200, "field.materialName");
        row.FromUomCode = from;
        row.ToUomCode = to;
        row.Factor = request.Factor;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
}
