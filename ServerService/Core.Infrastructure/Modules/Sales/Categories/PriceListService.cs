using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Sales.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.Sales.Categories.PriceLists;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Sales.Categories;

/// <summary>
/// Danh mục bảng giá bán: a catalog on the shared CatalogService (code, name, currency, customer group, valid from / to) whose
/// lines (price per material and unit, with quantity steps) are the grid of its form, saved in the same transaction like the unit
/// conversions of a material. <see cref="ResolveAsync"/> gives the price a sales order takes.
/// </summary>
public sealed class PriceListService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<PriceList, PriceListDto, SavePriceListRequest>(db, batch, excel, audit), IPriceListService
{
    private const int MaxLines = 5000;
    private static readonly CatalogSpec Info = new("sales_price_list_cat", "priceList", "field.priceListCode", 20, "DanhMucBangGiaBan");

    private static readonly SortMap<PriceList> SortColumns = SortMap<PriceList>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("currencyCode", x => x.CurrencyCode)
        .Add("customerGroupCode", x => x.CustomerGroupCode).Add("validFrom", x => x.ValidFrom).Add("validTo", x => x.ValidTo)
        .Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<PriceList> Sorts => SortColumns;

    protected override IQueryable<PriceList> Search(IQueryable<PriceList> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.Note, pattern)
            || Db.PriceListLines.Any(l => l.PriceListCode == x.Code && (SearchFunctions.Matches(l.MaterialCode, pattern))));

    /// <summary>Filters: <c>group=KH-DL</c> (customer group; <c>none</c> = the general price lists), <c>currency=USD</c> and <c>validOn=2026-10-20</c> (valid that day).</summary>
    protected override IQueryable<PriceList> ApplyFilters(IQueryable<PriceList> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("group", out var group) && !string.IsNullOrWhiteSpace(group))
        {
            var code = group.Trim().ToUpperInvariant();
            rows = code == "NONE" ? rows.Where(x => x.CustomerGroupCode == null) : rows.Where(x => x.CustomerGroupCode == code);
        }
        if (filters.TryGetValue("currency", out var currency) && !string.IsNullOrWhiteSpace(currency))
        {
            var code = currency.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.CurrencyCode == code);
        }
        if (filters.TryGetValue("validOn", out var validOn) && DateOnly.TryParse(validOn, out var day))
            rows = rows.Where(x => x.ValidFrom <= day && (x.ValidTo == null || x.ValidTo >= day));
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<PriceList>> ExportColumns() =>
    [
        new("export.priceList.code", x => x.Code), new("export.priceList.name", x => x.Name),
        new("export.priceList.currencyCode", x => x.CurrencyCode), new("export.priceList.customerGroupCode", x => x.CustomerGroupCode),
        new("export.priceList.validFrom", x => x.ValidFrom.ToString("yyyy-MM-dd")), new("export.priceList.validTo", x => x.ValidTo?.ToString("yyyy-MM-dd")),
        new("export.priceList.note", x => x.Note), new("export.priceList.isActive", x => YesNo(x.IsActive))
    ];

    protected override SavePriceListRequest WithoutVersion(SavePriceListRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<PriceListDto>> MapAsync(IReadOnlyList<PriceList> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var counts = await Db.PriceListLines.AsNoTracking().Where(x => codes.Contains(x.PriceListCode))
            .GroupBy(x => x.PriceListCode).Select(g => new { Code = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Code, x => x.Count, ct);
        var groupCodes = rows.Select(x => x.CustomerGroupCode).Where(x => x != null).Distinct().ToList();
        var groups = await Db.CustomerGroups.AsNoTracking().Where(x => groupCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new PriceListDto(x.Code, x.Name, x.CurrencyCode, x.CustomerGroupCode,
            x.CustomerGroupCode is null ? null : groups.GetValueOrDefault(x.CustomerGroupCode), x.ValidFrom, x.ValidTo, x.Note, x.IsActive,
            counts.GetValueOrDefault(x.Code), stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(PriceList row, SavePriceListRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.priceListName");
        var currency = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await Db.Currencies.AnyAsync(x => x.Code == currency && x.IsActive, ct)) throw new BusinessRuleException("priceList.currencyInvalid", currency);
        if (request.ValidTo is { } to && to < request.ValidFrom) throw new BusinessRuleException("priceList.dateOrder");
        if (await Db.PriceLists.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("priceList.nameExists", name);
        row.Name = name;
        row.CurrencyCode = currency;
        row.CustomerGroupCode = string.IsNullOrWhiteSpace(request.CustomerGroupCode) ? null : request.CustomerGroupCode.Trim().ToUpperInvariant();
        row.ValidFrom = request.ValidFrom;
        row.ValidTo = request.ValidTo;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    /// <summary>
    /// The lines grid of the form: rows not in it are deleted, the others replaced (a price list with thousands of lines is rewritten
    /// in one go). Null = keep the saved lines. Each line needs an active material, a unit the material may use and a price not
    /// below 0; one price per material, unit and quantity step.
    /// </summary>
    protected override async Task AfterApplyAsync(PriceList row, SavePriceListRequest request, bool isNew, CancellationToken ct)
    {
        if (request.Lines is null) return;
        if (request.Lines.Count > MaxLines) throw new BusinessRuleException("priceList.tooManyLines", MaxLines);
        var wanted = new List<PriceListLine>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var materialCodes = request.Lines.Select(x => (x.MaterialCode ?? string.Empty).Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await Db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var checkedUnits = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in request.Lines)
        {
            var material = Guard.Code(item.MaterialCode, 64, "field.materialCode");
            var uom = Guard.Code(item.UomCode, 30, "field.uomCode");
            if (!materials.TryGetValue(material, out var entity) || !entity.IsActive) throw new BusinessRuleException("voucherLine.materialInvalid", material);
            if (item.UnitPrice < 0 || decimal.Round(item.UnitPrice, 4) != item.UnitPrice || item.MinQuantity < 0 || decimal.Round(item.MinQuantity, 4) != item.MinQuantity)
                throw new BusinessRuleException("priceList.lineInvalid", material);
            if (!seen.Add($"{material}|{uom}|{item.MinQuantity}")) throw new BusinessRuleException("priceList.lineDuplicate", material, uom);
            if (checkedUnits.Add($"{material}|{uom}"))
            {
                if (!await Db.Uoms.AnyAsync(x => x.Code == uom && x.IsActive, ct)) throw new BusinessRuleException("voucherLine.uomInvalid", uom, material);
                await UomRules.EnsureUsableAsync(Db, entity, uom, ct);
            }
            wanted.Add(new PriceListLine
            {
                PriceListCode = row.Code, MaterialCode = material, UomCode = uom, MinQuantity = item.MinQuantity,
                UnitPrice = item.UnitPrice, Note = Guard.Optional(item.Note, 300, "field.note")
            });
        }
        var existing = isNew ? [] : await Db.PriceListLines.Where(x => x.PriceListCode == row.Code).ToListAsync(ct);
        string Summary(IEnumerable<PriceListLine> lines) => string.Join("; ", lines.OrderBy(x => x.MaterialCode).ThenBy(x => x.UomCode).ThenBy(x => x.MinQuantity)
            .Select(x => $"{x.MaterialCode} {x.UomCode} >={x.MinQuantity:0.####} = {x.UnitPrice:0.####}"));
        var before = Summary(existing);
        var after = Summary(wanted);
        if (before == after) return;
        Db.PriceListLines.RemoveRange(existing);
        Db.PriceListLines.AddRange(wanted);
        AuditLog.Attach(row, [new AuditChange("lines", before.Length == 0 ? null : before, after.Length == 0 ? null : after)]);
        // A lines-only edit must advance the price list version so concurrent forms cannot overwrite it.
        if (!isNew) Db.Entry(row).Property(x => x.Name).IsModified = true;
    }

    protected override async Task BeforeDeleteAsync(PriceList row, CancellationToken ct) =>
        Db.PriceListLines.RemoveRange(await Db.PriceListLines.Where(x => x.PriceListCode == row.Code).ToListAsync(ct));

    public async Task<IReadOnlyList<PriceListLineDto>> GetLinesAsync(string code, CancellationToken ct)
    {
        var key = KeyText(code);
        if (!await Db.PriceLists.AnyAsync(x => x.Code == key, ct)) throw new NotFoundException("priceList.notFound");
        var lines = await Db.PriceListLines.AsNoTracking().Where(x => x.PriceListCode == key)
            .OrderBy(x => x.MaterialCode).ThenBy(x => x.UomCode).ThenBy(x => x.MinQuantity).ToListAsync(ct);
        var codes = lines.Select(x => x.MaterialCode).Distinct().ToList();
        var names = await Db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return lines.Select(x => new PriceListLineDto(x.MaterialCode, names.GetValueOrDefault(x.MaterialCode), x.UomCode, x.MinQuantity, x.UnitPrice, x.Note)).ToList();
    }

    public async Task<ResolvedPriceDto?> ResolveAsync(string? customerCode, string materialCode, string uomCode, string currencyCode,
        DateOnly? date, decimal quantity, CancellationToken ct)
    {
        var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var currency = Guard.Code(currencyCode, 10, "field.currencyCode");
        var material = Guard.Code(materialCode, 64, "field.materialCode");
        var uom = Guard.Code(uomCode, 30, "field.uomCode");
        string? customerGroup = null;
        if (!string.IsNullOrWhiteSpace(customerCode))
        {
            var customer = customerCode.Trim().ToUpperInvariant();
            customerGroup = await Db.Customers.AsNoTracking().Where(x => x.Code == customer).Select(x => x.CustomerGroupCode).FirstOrDefaultAsync(ct);
        }
        return await (from line in Db.PriceListLines.AsNoTracking()
                      join list in Db.PriceLists.AsNoTracking() on line.PriceListCode equals list.Code
                      where line.MaterialCode == material && line.UomCode == uom && line.MinQuantity <= quantity
                            && list.IsActive && list.CurrencyCode == currency && list.ValidFrom <= day && (list.ValidTo == null || list.ValidTo >= day)
                            && (list.CustomerGroupCode == null || list.CustomerGroupCode == customerGroup)
                      orderby list.CustomerGroupCode != null descending, list.ValidFrom descending, line.MinQuantity descending, list.Code
                      select new ResolvedPriceDto(list.Code, list.Name, list.CurrencyCode, line.UomCode, line.MinQuantity, line.UnitPrice))
            .FirstOrDefaultAsync(ct);
    }
}
