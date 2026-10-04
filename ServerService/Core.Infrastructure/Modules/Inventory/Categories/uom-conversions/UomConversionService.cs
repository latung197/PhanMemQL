using Core.Application.Common.Caching;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

public sealed class UomConversionService(CoreContext db, IAppCache cache, CatalogBatch batch) : IUomConversionService
{
    public Task<IReadOnlyList<UomConversionDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, "uom-conversions:all", ["erp_uom_conversion", "erp_uom", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<UomConversionDto>> LoadAllAsync(CancellationToken ct)
    {
        var rows = await db.UomConversions.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        var names = await db.Uoms.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var stamp = await RecordStamps.ForAsync(db, rows, ct);
        return rows.Select(x => ToDto(x, names, stamp(x))).ToList();
    }

    public async Task<UomConversionDto> CreateAsync(SaveUomConversionRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 40, "field.uomConversionCode");
        if (await db.UomConversions.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("uomConversion.codeExists", code);
        var row = new UomConversion { Code = code, SortOrder = (await db.UomConversions.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        db.UomConversions.Add(row);
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(row, ct);
    }

    public async Task<UomConversionDto> UpdateAsync(string code, SaveUomConversionRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        db.ExpectVersion(row, request.Version);
        await ApplyAsync(row, request, ct);
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(row, ct);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        db.UomConversions.Remove(await FindAsync(code, ct));
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveUomConversionRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.UomConversions.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<UomConversion> FindAsync(string code, CancellationToken ct) =>
        await db.UomConversions.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("uomConversion.notFound");

    private async Task ApplyAsync(UomConversion row, SaveUomConversionRequest request, CancellationToken ct)
    {
        var from = Guard.Code(request.FromUomCode, 20, "field.fromUom");
        var to = Guard.Code(request.ToUomCode, 20, "field.toUom");
        if (from == to) throw new BusinessRuleException("uomConversion.sameUnit");
        if (request.Factor < 0.00000001m || request.Factor >= 1_000_000_000_000m
            || decimal.Round(request.Factor, 8) != request.Factor)
            throw new BusinessRuleException("uomConversion.invalidFactor");
        if (!await db.Uoms.AnyAsync(x => x.Code == from && x.IsActive, ct))
            throw new BusinessRuleException("uomConversion.unitUnavailable", from);
        if (!await db.Uoms.AnyAsync(x => x.Code == to && x.IsActive, ct))
            throw new BusinessRuleException("uomConversion.unitUnavailable", to);

        var materialCode = Guard.Optional(request.MaterialCode, 50, "field.materialCode")?.ToUpperInvariant();
        if (await db.UomConversions.AnyAsync(x => x.Code != row.Code && x.MaterialCode == materialCode
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

    private async Task<UomConversionDto> ToDtoAsync(UomConversion row, CancellationToken ct)
    {
        var names = await db.Uoms.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return ToDto(row, names, await RecordStamps.OfAsync(db, row, ct));
    }

    private static UomConversionDto ToDto(UomConversion x, IReadOnlyDictionary<string, string> names, RecordStampDto stamp) =>
        new(x.Code, x.MaterialCode, x.MaterialName,
            x.FromUomCode, names.GetValueOrDefault(x.FromUomCode) ?? x.FromUomCode,
            x.ToUomCode, names.GetValueOrDefault(x.ToUomCode) ?? x.ToUomCode,
            x.Factor, x.Note, x.IsActive, stamp, x.Version);
}
