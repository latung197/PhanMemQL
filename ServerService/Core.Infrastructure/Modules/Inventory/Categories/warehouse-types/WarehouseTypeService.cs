using Core.Application.Common.Caching;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

public sealed class WarehouseTypeService(CoreContext db, IAppCache cache, CatalogBatch batch) : IWarehouseTypeService
{
    public Task<IReadOnlyList<WarehouseTypeDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, $"warehouse-types:all:{Messages.CurrentLanguage}",
            ["erp_warehouse_type", "erp_warehouse_type_translation", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<WarehouseTypeDto>> LoadAllAsync(CancellationToken ct)
    {
        var rows = await db.WarehouseTypes.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var translations = await db.WarehouseTypeTranslations.AsNoTracking().ToListAsync(ct);
        var byCode = translations.GroupBy(x => x.WarehouseTypeCode).ToDictionary(x => x.Key, x => x.ToList());
        var stamp = await RecordStamps.ForAsync(db, rows, ct);
        return rows.Select(x => ToDto(x, stamp(x), byCode.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    public async Task<WarehouseTypeDto> CreateAsync(SaveWarehouseTypeRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.warehouseTypeCode");
        if (await db.WarehouseTypes.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("warehouseType.codeExists", code);
        var row = new WarehouseType { Code = code,
            SortOrder = (await db.WarehouseTypes.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(row, request, ct);
        db.WarehouseTypes.Add(row);
        await ApplyTranslationsAsync(code, request.Translations, ct);
        await db.SaveChangesAsync(ct);
        return await ResultAsync(row, ct);
    }

    public async Task<WarehouseTypeDto> UpdateAsync(string code, SaveWarehouseTypeRequest request, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        db.ExpectVersion(row, request.Version);
        await ApplyAsync(row, request, ct);
        await ApplyTranslationsAsync(code, request.Translations, ct);
        if (request.Translations is not null) db.Entry(row).Property(x => x.Name).IsModified = true;
        await db.SaveChangesAsync(ct);
        return await ResultAsync(row, ct);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        if (await db.Warehouses.AnyAsync(x => x.WarehouseTypeCode == code, ct))
            throw new BusinessRuleException("warehouseType.inUse", row.Name);
        db.WarehouseTypeTranslations.RemoveRange(
            await db.WarehouseTypeTranslations.Where(x => x.WarehouseTypeCode == code).ToListAsync(ct));
        db.WarehouseTypes.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveWarehouseTypeRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.WarehouseTypes.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<WarehouseType> FindAsync(string code, CancellationToken ct) =>
        await db.WarehouseTypes.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("warehouseType.notFound");

    private async Task ApplyAsync(WarehouseType row, SaveWarehouseTypeRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.warehouseTypeName");
        if (await db.WarehouseTypes.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("warehouseType.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    private async Task ApplyTranslationsAsync(string code, IReadOnlyList<WarehouseTypeTranslationDto>? input, CancellationToken ct)
    {
        // Null means an older client or an Excel row: keep translations already saved.
        if (input is null) return;
        var requested = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in input)
        {
            var language = Messages.Normalize(item.LanguageCode) ?? string.Empty;
            if (language.Length == 0 || language.Length > 10 || language.Split('-')[0] == "vi" ||
                !requested.TryAdd(language, Guard.Required(item.Name, 100, "field.warehouseTypeName")))
                throw new BusinessRuleException("warehouseType.translationInvalid");
        }
        var knownLanguages = await db.Languages.AsNoTracking().Select(x => x.Code).ToListAsync(ct);
        if (requested.Keys.Any(x => !knownLanguages.Contains(x, StringComparer.OrdinalIgnoreCase)))
            throw new BusinessRuleException("warehouseType.translationInvalid");

        var existing = await db.WarehouseTypeTranslations.Where(x => x.WarehouseTypeCode == code).ToListAsync(ct);
        foreach (var translation in existing)
        {
            if (requested.Remove(translation.LanguageCode, out var name)) translation.Name = name;
            else db.WarehouseTypeTranslations.Remove(translation);
        }
        foreach (var (language, name) in requested)
            db.WarehouseTypeTranslations.Add(new WarehouseTypeTranslation
                { WarehouseTypeCode = code, LanguageCode = language, Name = name });
    }

    private async Task<WarehouseTypeDto> ResultAsync(WarehouseType row, CancellationToken ct)
    {
        var translations = await db.WarehouseTypeTranslations.AsNoTracking()
            .Where(x => x.WarehouseTypeCode == row.Code).ToListAsync(ct);
        return ToDto(row, await RecordStamps.OfAsync(db, row, ct), translations);
    }

    private static WarehouseTypeDto ToDto(WarehouseType row, RecordStampDto stamp,
        IReadOnlyList<WarehouseTypeTranslation> translations)
    {
        var language = Messages.CurrentLanguage;
        var localized = translations.FirstOrDefault(x => x.LanguageCode == language)?.Name;
        var dash = language.IndexOf('-');
        if (localized is null && dash > 0)
            localized = translations.FirstOrDefault(x => x.LanguageCode == language[..dash])?.Name;
        return new WarehouseTypeDto(row.Code, row.Name, localized ?? row.Name, row.Note, row.IsActive, stamp,
            row.Version, translations.Select(x => new WarehouseTypeTranslationDto(x.LanguageCode, x.Name)).ToList());
    }
}
