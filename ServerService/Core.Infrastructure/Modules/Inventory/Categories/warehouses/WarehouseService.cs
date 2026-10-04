using Core.Application.Common.Caching;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Common.Localization;
using Core.Application.Modules.Inventory;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

public sealed class WarehouseService(CoreContext db, IAppCache cache, CatalogBatch batch) : IWarehouseService
{
    public Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, $"warehouses:all:{Messages.CurrentLanguage}",
            ["erp_warehouse", "erp_warehouse_type", "erp_warehouse_type_translation", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<WarehouseDto>> LoadAllAsync(CancellationToken ct)
    {
        var rows = await db.Warehouses.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var typeNames = await LoadTypeNamesAsync(ct);
        var stamp = await RecordStamps.ForAsync(db, rows, ct);
        return rows.Select(x => ToDto(x, stamp(x), typeNames.GetValueOrDefault(x.WarehouseTypeCode ?? ""))).ToList();
    }

    public async Task<WarehouseDto> CreateAsync(SaveWarehouseRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.warehouseCode");
        if (await db.Warehouses.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("warehouse.codeExists", code);
        var row = new Warehouse { Code = code, SortOrder = (await db.Warehouses.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        db.Warehouses.Add(row);
        await db.SaveChangesAsync(ct);
        return await ResultAsync(row, ct);
    }

    public async Task<WarehouseDto> UpdateAsync(string code, SaveWarehouseRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        db.ExpectVersion(row, request.Version);
        await ApplyAsync(row, request, ct);
        await db.SaveChangesAsync(ct);
        return await ResultAsync(row, ct);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        if (await db.GoodsReceipts.AnyAsync(x => x.WarehouseCode == code, ct))
            throw new BusinessRuleException("receipt.warehouseInUse");
        db.Warehouses.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveWarehouseRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.Warehouses.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<Warehouse> FindAsync(string code, CancellationToken ct) =>
        await db.Warehouses.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("warehouse.notFound");

    private async Task ApplyAsync(Warehouse row, SaveWarehouseRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.warehouseName");
        if (await db.Warehouses.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("warehouse.nameExists", name);
        row.Name = name;
        if (request.WarehouseTypeCode is not null)
        {
            var typeCode = request.WarehouseTypeCode.Trim().ToUpperInvariant();
            if (typeCode.Length > 20) throw new BusinessRuleException("warehouseType.notFound");
            if (typeCode.Length > 0)
            {
                var type = await db.WarehouseTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Code == typeCode, ct)
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

    private async Task<WarehouseDto> ResultAsync(Warehouse row, CancellationToken ct)
    {
        var typeNames = await LoadTypeNamesAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct), typeNames.GetValueOrDefault(row.WarehouseTypeCode ?? ""));
    }

    private async Task<Dictionary<string, string>> LoadTypeNamesAsync(CancellationToken ct)
    {
        var types = await db.WarehouseTypes.AsNoTracking().ToListAsync(ct);
        var translations = await db.WarehouseTypeTranslations.AsNoTracking().ToListAsync(ct);
        var language = Messages.CurrentLanguage;
        var baseLanguage = language.Split('-')[0];
        return types.ToDictionary(x => x.Code, x =>
            translations.FirstOrDefault(t => t.WarehouseTypeCode == x.Code && t.LanguageCode == language)?.Name
            ?? translations.FirstOrDefault(t => t.WarehouseTypeCode == x.Code && t.LanguageCode == baseLanguage)?.Name
            ?? x.Name);
    }

    private static WarehouseDto ToDto(Warehouse row, RecordStampDto stamp, string? typeName) =>
        new(row.Code, row.Name, row.WarehouseTypeCode, typeName, row.Address, row.Manager, row.Capacity,
            row.IsActive, stamp, row.Version);
}
