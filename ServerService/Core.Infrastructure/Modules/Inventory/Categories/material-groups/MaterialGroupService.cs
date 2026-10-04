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

public sealed class MaterialGroupService(CoreContext db, IAppCache cache, CatalogBatch batch) : IMaterialGroupService
{
    public Task<IReadOnlyList<MaterialGroupDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, "material-groups:all", ["erp_material_group", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<MaterialGroupDto>> LoadAllAsync(CancellationToken ct)
    {
        var rows = await db.MaterialGroups.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var stamp = await RecordStamps.ForAsync(db, rows, ct);
        return rows.Select(x => ToDto(x, stamp(x))).ToList();
    }

    public async Task<MaterialGroupDto> CreateAsync(SaveMaterialGroupRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.materialGroupCode");
        if (await db.MaterialGroups.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("materialGroup.codeExists", code);
        var row = new MaterialGroup { Code = code, SortOrder = (await db.MaterialGroups.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        db.MaterialGroups.Add(row);
        await db.SaveChangesAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct));
    }

    public async Task<MaterialGroupDto> UpdateAsync(string code, SaveMaterialGroupRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        db.ExpectVersion(row, request.Version);
        await ApplyAsync(row, request, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct));
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        db.MaterialGroups.Remove(await FindAsync(code, ct));
        // Materials still live in browser storage; enforce reference checks when their backend is added.
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveMaterialGroupRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.MaterialGroups.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<MaterialGroup> FindAsync(string code, CancellationToken ct) =>
        await db.MaterialGroups.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("materialGroup.notFound");

    private async Task ApplyAsync(MaterialGroup row, SaveMaterialGroupRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.materialGroupName");
        if (await db.MaterialGroups.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("materialGroup.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    private static MaterialGroupDto ToDto(MaterialGroup row, RecordStampDto stamp) =>
        new(row.Code, row.Name, row.Note, row.IsActive, stamp, row.Version);
}
