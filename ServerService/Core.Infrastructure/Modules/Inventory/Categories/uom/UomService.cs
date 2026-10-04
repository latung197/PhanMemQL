using Core.Infrastructure.Common.Catalogs;
using Core.Application.Common.Catalogs;
using Core.Infrastructure.Common.Caching;
using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Common.Localization;
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
        db.CachedAsync(cache, $"uoms:all:{Messages.CurrentLanguage}",
            ["erp_uom", "erp_uom_translation", "sys_users"], LoadAllAsync, ct);

    private async Task<IReadOnlyList<UomDto>> LoadAllAsync(CancellationToken ct)
    {
        var uoms = await db.Uoms.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var translations = await db.UomTranslations.AsNoTracking().ToListAsync(ct);
        var byCode = translations.GroupBy(x => x.UomCode).ToDictionary(x => x.Key, x => x.ToList());
        var stamp = await RecordStamps.ForAsync(db, uoms, ct);
        return uoms.Select(x => ToDto(x, stamp(x), byCode.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    public async Task<UomDto> CreateAsync(SaveUomRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.uomCode");
        if (await db.Uoms.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("uom.codeExists", code);
        var uom = new Uom { Code = code, SortOrder = (await db.Uoms.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1 };
        await ApplyAsync(uom, request, ct);
        db.Uoms.Add(uom);
        await ApplyTranslationsAsync(uom.Code, request.Translations, ct);
        await db.SaveChangesAsync(ct);
        return await ResultAsync(uom, ct);
    }

    public async Task<UomDto> UpdateAsync(string code, SaveUomRequest request, CancellationToken ct)
    {
        var uom = await FindAsync(code, ct);
        db.ExpectVersion(uom, request.Version);
        await ApplyAsync(uom, request, ct);
        await ApplyTranslationsAsync(uom.Code, request.Translations, ct);
        // A translation edit must advance the parent version so concurrent forms cannot overwrite it.
        if (request.Translations is not null) db.Entry(uom).Property(x => x.Name).IsModified = true;
        await db.SaveChangesAsync(ct);
        return await ResultAsync(uom, ct);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var uom = await FindAsync(code, ct);
        if (await db.UomConversions.AnyAsync(x => x.FromUomCode == code || x.ToUomCode == code, ct))
            throw new BusinessRuleException("uom.inUse", uom.Name);
        // Materials and voucher lines still use browser data; check them when those modules move to the backend.
        db.UomTranslations.RemoveRange(await db.UomTranslations.Where(x => x.UomCode == code).ToListAsync(ct));
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

    private async Task ApplyTranslationsAsync(string code, IReadOnlyList<UomTranslationDto>? input, CancellationToken ct)
    {
        // Older clients and Excel imports omit translations; preserve those already entered.
        if (input is null) return;
        var requested = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in input)
        {
            var language = Messages.Normalize(item.LanguageCode) ?? string.Empty;
            if (language.Length == 0 || language.Length > 10 || language.Split('-')[0] == "vi" || !requested.TryAdd(language,
                Guard.Required(item.Name, 100, "field.uomName")))
                throw new BusinessRuleException("uom.translationInvalid");
        }
        var active = await db.Languages.AsNoTracking()
            .Select(x => x.Code).ToListAsync(ct);
        if (requested.Keys.Any(x => !active.Contains(x, StringComparer.OrdinalIgnoreCase)))
            throw new BusinessRuleException("uom.translationInvalid");

        var existing = await db.UomTranslations.Where(x => x.UomCode == code).ToListAsync(ct);
        foreach (var translation in existing)
        {
            if (requested.Remove(translation.LanguageCode, out var name)) translation.Name = name;
            else db.UomTranslations.Remove(translation);
        }
        foreach (var (language, name) in requested)
            db.UomTranslations.Add(new UomTranslation { UomCode = code, LanguageCode = language, Name = name });
    }

    private async Task<UomDto> ResultAsync(Uom uom, CancellationToken ct)
    {
        var translations = await db.UomTranslations.AsNoTracking().Where(x => x.UomCode == uom.Code).ToListAsync(ct);
        return ToDto(uom, await RecordStamps.OfAsync(db, uom, ct), translations);
    }

    private static UomDto ToDto(Uom x, RecordStampDto stamp, IReadOnlyList<UomTranslation> translations)
    {
        var language = Messages.CurrentLanguage;
        var localized = translations.FirstOrDefault(t => t.LanguageCode == language)?.Name;
        var dash = language.IndexOf('-');
        if (localized is null && dash > 0)
            localized = translations.FirstOrDefault(t => t.LanguageCode == language[..dash])?.Name;
        return new UomDto(x.Code, x.Name, localized ?? x.Name, x.Symbol, x.Note, x.IsActive, stamp, x.Version,
            translations.Select(t => new UomTranslationDto(t.LanguageCode, t.Name)).ToList());
    }
}
