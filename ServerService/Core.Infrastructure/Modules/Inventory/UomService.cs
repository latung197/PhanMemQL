using Core.Infrastructure.Common.Catalogs;
using Core.Application.Common.Catalogs;
using Core.Infrastructure.Common.Caching;
using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Danh mục đơn vị tính (same model as the department catalog). Changes are logged automatically ([Audited]).</summary>
public sealed class UomService(CoreContext db, IAppCache cache, CatalogBatch batch) : IUomService
{
    /// <summary>Read by every screen with a unit field; cached until the catalog (or a user name in the stamps) changes.</summary>
    public Task<IReadOnlyList<UomDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, "uoms:all", ["erp_uom", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<UomDto>> LoadAllAsync(CancellationToken ct)
    {
        var uoms = await db.Uoms.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var stamp = await RecordStamps.ForAsync(db, uoms, ct);
        return uoms.Select(x => ToDto(x, stamp(x))).ToList();
    }

    public async Task<UomDto> CreateAsync(SaveUomRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.uomCode");
        if (await db.Uoms.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("uom.codeExists", code);
        var uom = new Uom { Code = code, SortOrder = (await db.Uoms.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(uom, request, ct);
        db.Uoms.Add(uom);
        await db.SaveChangesAsync(ct);
        return ToDto(uom, await RecordStamps.OfAsync(db, uom, ct));
    }

    public async Task<UomDto> UpdateAsync(string code, SaveUomRequest request, CancellationToken ct)
    {
        var uom = await FindAsync(code, ct);
        db.ExpectVersion(uom, request.Version);
        await ApplyAsync(uom, request, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(uom, await RecordStamps.OfAsync(db, uom, ct));
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var uom = await FindAsync(code, ct);
        // No foreign keys: when materials, unit conversions or voucher lines move to the backend, check here that
        // none of them uses the unit (message uom.inUse) before deleting it.
        db.Uoms.Remove(uom);
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveUomRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.Uoms.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<Uom> FindAsync(string code, CancellationToken ct) =>
        await db.Uoms.FirstOrDefaultAsync(x => x.Code == code, ct) ?? throw new NotFoundException("uom.notFound");

    private async Task ApplyAsync(Uom uom, SaveUomRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.uomName");
        if (await db.Uoms.AnyAsync(x => x.Code != uom.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("uom.nameExists", name);
        uom.Name = name;
        uom.Symbol = Guard.Optional(request.Symbol, 20, "field.symbol") ?? string.Empty;
        uom.Note = Guard.Optional(request.Note, 300, "field.note");
        uom.IsActive = request.IsActive;
    }

    private static UomDto ToDto(Uom x, RecordStampDto stamp) => new(x.Code, x.Name, x.Symbol, x.Note, x.IsActive, stamp, x.Version);
}
