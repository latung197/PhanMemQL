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

/// <summary>
/// Danh mục lô và hạn sử dụng on the shared CatalogService. A lot is keyed by material + lot number, written as its code
/// "VT001@LOT-2610" (<see cref="LotKey"/>); the material and the number of a saved lot do not change. Only a material tracked
/// by lot can get lots, and one with an expiry date needs it on every lot.
/// </summary>
public sealed class LotService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Lot, LotDto, SaveLotRequest>(db, batch, excel, audit), ILotService
{
    private static readonly CatalogSpec Info = new("inv_lot_cat", "lot", "field.lotCode", 81, "DanhMucLo");

    private static readonly SortMap<Lot> SortColumns = SortMap<Lot>.By(x => x.Code, "code")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("materialCode", x => x.MaterialCode).Add("lotNo", x => x.LotNo)
        .Add("mfgDate", x => x.MfgDate).Add("expDate", x => x.ExpDate).Add("supplierName", x => x.SupplierCode)
        .Add("qualityStatus", x => x.QualityStatus).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Lot> Sorts => SortColumns;

    protected override IQueryable<Lot> Search(IQueryable<Lot> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.LotNo, pattern)
            || SearchFunctions.Matches(x.MaterialCode, pattern) || SearchFunctions.Matches(x.SupplierCode, pattern)
            || Db.Materials.Any(m => m.Code == x.MaterialCode && SearchFunctions.Matches(m.Name, pattern)));

    /// <summary>Filters <c>materialCode</c>, <c>quality=PASSED|INSPECT|BLOCKED</c> and <c>expiry=near|expired</c> (as of today).</summary>
    protected override IQueryable<Lot> ApplyFilters(IQueryable<Lot> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("materialCode", out var material) && !string.IsNullOrWhiteSpace(material)) rows = rows.Where(x => x.MaterialCode == material);
        if (filters.TryGetValue("quality", out var quality) && !string.IsNullOrWhiteSpace(quality)) rows = rows.Where(x => x.QualityStatus == quality);
        if (filters.TryGetValue("expiry", out var expiry))
        {
            var today = Today();
            var limit = today.AddDays(LotRules.NearExpiryDays);
            rows = expiry switch
            {
                "expired" => rows.Where(x => x.ExpDate != null && x.ExpDate < today),
                "near" => rows.Where(x => x.ExpDate != null && x.ExpDate >= today && x.ExpDate <= limit),
                _ => rows
            };
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Lot>> ExportColumns() =>
    [
        new("export.lot.materialCode", x => x.MaterialCode), new("export.lot.lotNo", x => x.LotNo),
        new("export.lot.mfgDate", x => x.MfgDate?.ToString("yyyy-MM-dd")), new("export.lot.expDate", x => x.ExpDate?.ToString("yyyy-MM-dd")),
        new("export.lot.supplierCode", x => x.SupplierCode), new("export.lot.qualityStatus", x => x.QualityStatus),
        new("export.lot.note", x => x.Note), new("export.lot.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveLotRequest WithoutVersion(SaveLotRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<LotDto>> MapAsync(IReadOnlyList<Lot> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var materialCodes = rows.Select(x => x.MaterialCode).Distinct().ToList();
        var supplierCodes = rows.Select(x => x.SupplierCode).OfType<string>().Distinct().ToList();
        var materials = await Db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var suppliers = await Db.Suppliers.AsNoTracking().Where(x => supplierCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var today = Today();
        return rows.Select(x => new LotDto(x.Code, x.MaterialCode, materials.GetValueOrDefault(x.MaterialCode), x.LotNo, x.MfgDate, x.ExpDate,
            x.SupplierCode, suppliers.GetValueOrDefault(x.SupplierCode ?? ""), x.QualityStatus, ExpiryState(x.ExpDate, today), x.Note,
            x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(Lot row, SaveLotRequest request, CancellationToken ct)
    {
        var materialCode = Guard.Code(request.MaterialCode, 50, "field.materialCode");
        var lotNo = Guard.Code(request.LotNo, 30, "field.lotNo");
        var isNew = row.MaterialCode.Length == 0;
        if (!isNew && row.Code != request.Code) throw new BusinessRuleException("lot.keyChanged");

        var material = await Db.Materials.AsNoTracking().FirstOrDefaultAsync(x => x.Code == materialCode, ct)
            ?? throw new BusinessRuleException("material.notFound");
        if (isNew)
        {
            if (!material.TrackLot) throw new BusinessRuleException("lot.materialNotTracked", materialCode);
            if (!material.IsActive) throw new BusinessRuleException("lot.materialInactive", materialCode);
        }
        if (material.HasExpiry && request.ExpDate is null) throw new BusinessRuleException("lot.expiryRequired", materialCode);
        if (request.MfgDate is { } mfg && request.ExpDate is { } exp && exp < mfg) throw new BusinessRuleException("lot.dateOrder");

        var quality = (request.QualityStatus ?? string.Empty).Trim().ToUpperInvariant();
        if (!LotQuality.All.Contains(quality)) throw new BusinessRuleException("lot.qualityInvalid");

        row.MaterialCode = materialCode;
        row.LotNo = lotNo;
        row.MfgDate = request.MfgDate;
        row.ExpDate = request.ExpDate;
        row.SupplierCode = string.IsNullOrWhiteSpace(request.SupplierCode) ? null : Guard.Code(request.SupplierCode, 20, "field.supplierCode");
        row.QualityStatus = quality;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>none / ok / near / expired as of <paramref name="today"/>.</summary>
    public static string ExpiryState(DateOnly? expDate, DateOnly today) =>
        expDate is not { } exp ? "none" : exp < today ? "expired" : exp <= today.AddDays(LotRules.NearExpiryDays) ? "near" : "ok";
}
