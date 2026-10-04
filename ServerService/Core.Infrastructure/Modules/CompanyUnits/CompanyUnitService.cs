using Core.Application.Common.Exceptions;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Localization;
using Core.Application.Common.Validation;
using Core.Application.Modules.CompanyUnits;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Catalogs;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.CompanyUnits;

public sealed class CompanyUnitService(CoreContext db, CatalogBatch batch) : ICompanyUnitService
{
    public async Task<IReadOnlyList<CompanyUnitDto>> GetAllAsync(bool activeOnly, CancellationToken ct)
    {
        var query = db.CompanyUnits.AsNoTracking();
        if (activeOnly) query = query.Where(x => x.IsActive);
        var units = await query.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        var translations = await db.CompanyUnitTranslations.AsNoTracking().ToListAsync(ct);
        var byCode = translations.GroupBy(x => x.UnitCode).ToDictionary(x => x.Key, x => x.ToList());
        return units.Select(x => ToDto(x, byCode.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    public async Task<CompanyUnitDto> CreateAsync(SaveCompanyUnitRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.unitCode");
        if (await db.CompanyUnits.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("companyUnit.codeExists", code);
        var unit = new CompanyUnit
        {
            Code = code,
            SortOrder = (await db.CompanyUnits.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
        };
        Apply(unit, request);
        db.CompanyUnits.Add(unit);
        await ApplyTranslationsAsync(code, request.Translations, ct);
        await ApplyDefaultAsync(unit, ct);
        await db.SaveChangesAsync(ct);
        return await ResultAsync(unit, ct);
    }

    /// <summary>The code is the key and cannot be changed; the request code is ignored.</summary>
    public async Task<CompanyUnitDto> UpdateAsync(string code, SaveCompanyUnitRequest request, CancellationToken ct)
    {
        var unit = await FindAsync(code, ct);
        db.ExpectVersion(unit, request.Version);
        Apply(unit, request);
        await ApplyTranslationsAsync(unit.Code, request.Translations, ct);
        if (request.Translations is not null) db.Entry(unit).Property(x => x.Name).IsModified = true;
        if (!unit.IsActive) await EnsureAnotherActiveAsync(unit.Code, ct);
        await ApplyDefaultAsync(unit, ct);
        await db.SaveChangesAsync(ct);
        return await ResultAsync(unit, ct);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var unit = await FindAsync(code, ct);
        var scope = SystemSetting.UnitScope(unit.Code);
        if (await db.UserCompanyUnits.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.Users.AnyAsync(x => x.ValidFlg == 1 && x.MaDvcs == unit.Code, ct)
            || await db.SystemSettings.AnyAsync(x => x.Scope == scope, ct)
            || await db.FiscalPeriods.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.VoucherSequences.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.ApprovalRules.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.DocumentApprovals.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.Notifications.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.GoodsReceipts.AnyAsync(x => x.UnitCode == unit.Code, ct))
            throw new BusinessRuleException(
                "companyUnit.inUse");
        await EnsureAnotherActiveAsync(unit.Code, ct);
        db.CompanyUnitTranslations.RemoveRange(
            await db.CompanyUnitTranslations.Where(x => x.UnitCode == code).ToListAsync(ct));
        // No foreign keys in the database, so every table that links to a unit is checked above.
        db.CompanyUnits.Remove(unit);
        await db.SaveChangesAsync(ct);
    }

    public Task<ImportResult> ImportAsync(ImportRequest<SaveCompanyUnitRequest> request, CancellationToken ct) =>
        batch.ImportAsync(request, row => (row.Code ?? string.Empty).Trim().ToUpperInvariant(),
            (code, token) => db.CompanyUnits.AnyAsync(x => x.Code == code, token),
            (row, token) => CreateAsync(row, token),
            (code, row, token) => UpdateAsync(code, row with { Version = null }, token), ct);

    public Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct) =>
        batch.DeleteManyAsync(request, DeleteAsync, ct);

    private async Task<CompanyUnit> FindAsync(string code, CancellationToken ct) =>
        await db.CompanyUnits.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("companyUnit.notFound");

    private static void Apply(CompanyUnit unit, SaveCompanyUnitRequest request)
    {
        unit.Name = Guard.Required(request.Name, 150, "field.unitName");
        unit.ShortName = Guard.Optional(request.ShortName, 100, "field.shortName");
        unit.Address = Guard.Optional(request.Address, 300, "field.address");
        unit.Phone = Guard.Optional(request.Phone, 30, "field.phone");
        unit.Email = Guard.Optional(request.Email, 150, "field.email");
        unit.TaxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
        unit.IsActive = request.Status != CompanyUnitStatus.Paused;
        unit.IsDefault = request.IsDefault && unit.IsActive;
    }

    /// <summary>At most one unit is the default.</summary>
    private async Task ApplyDefaultAsync(CompanyUnit unit, CancellationToken ct)
    {
        if (!unit.IsDefault) return;
        await foreach (var other in db.CompanyUnits.Where(x => x.IsDefault && x.Code != unit.Code)
                           .AsAsyncEnumerable().WithCancellation(ct))
            other.IsDefault = false;
    }

    private async Task EnsureAnotherActiveAsync(string code, CancellationToken ct)
    {
        if (!await db.CompanyUnits.AnyAsync(x => x.Code != code && x.IsActive, ct))
            throw new BusinessRuleException("companyUnit.lastActive");
    }

    private async Task ApplyTranslationsAsync(string code, IReadOnlyList<CompanyUnitTranslationDto>? input, CancellationToken ct)
    {
        // Older clients and Excel rows omit translations; keep translations already entered.
        if (input is null) return;
        var requested = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in input)
        {
            var language = Messages.Normalize(item.LanguageCode) ?? string.Empty;
            if (language.Length == 0 || language.Length > 10 || language.Split('-')[0] == "vi" ||
                !requested.TryAdd(language, Guard.Required(item.Name, 150, "field.unitName")))
                throw new BusinessRuleException("companyUnit.translationInvalid");
        }
        var knownLanguages = await db.Languages.AsNoTracking().Select(x => x.Code).ToListAsync(ct);
        if (requested.Keys.Any(x => !knownLanguages.Contains(x, StringComparer.OrdinalIgnoreCase)))
            throw new BusinessRuleException("companyUnit.translationInvalid");

        var existing = await db.CompanyUnitTranslations.Where(x => x.UnitCode == code).ToListAsync(ct);
        foreach (var translation in existing)
        {
            if (requested.Remove(translation.LanguageCode, out var name)) translation.Name = name;
            else db.CompanyUnitTranslations.Remove(translation);
        }
        foreach (var (language, name) in requested)
            db.CompanyUnitTranslations.Add(new CompanyUnitTranslation
                { UnitCode = code, LanguageCode = language, Name = name });
    }

    private async Task<CompanyUnitDto> ResultAsync(CompanyUnit unit, CancellationToken ct) =>
        ToDto(unit, await db.CompanyUnitTranslations.AsNoTracking().Where(x => x.UnitCode == unit.Code).ToListAsync(ct));

    private static CompanyUnitDto ToDto(CompanyUnit x, IReadOnlyList<CompanyUnitTranslation> translations)
    {
        var language = Messages.CurrentLanguage;
        var localized = translations.FirstOrDefault(t => t.LanguageCode == language)?.Name;
        var dash = language.IndexOf('-');
        if (localized is null && dash > 0)
            localized = translations.FirstOrDefault(t => t.LanguageCode == language[..dash])?.Name;
        return new CompanyUnitDto(x.Code, x.Code, x.Name, x.ShortName, x.Address,
            x.Phone, x.Email, x.TaxCode, x.IsActive ? CompanyUnitStatus.Active : CompanyUnitStatus.Paused,
            x.IsDefault, x.Version, localized ?? x.Name,
            translations.Select(t => new CompanyUnitTranslationDto(t.LanguageCode, t.Name)).ToList(), x.IsActive);
    }
}
