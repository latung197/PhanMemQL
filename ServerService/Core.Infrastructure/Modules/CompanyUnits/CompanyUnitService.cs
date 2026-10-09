using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.CompanyUnits;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.CompanyUnits;

/// <summary>Danh mục đơn vị cơ sở: a catalog on CatalogService with translated names and one default unit.</summary>
public sealed class CompanyUnitService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<CompanyUnit, CompanyUnitDto, SaveCompanyUnitRequest>(db, batch, excel, audit), ICompanyUnitService
{
    private static readonly CatalogSpec Info = new("inv_company_unit_cat", "companyUnit", "field.unitCode", 20, "DanhMucDonViCoSo");

    /// <summary>"localizedName" sorts by the original name; "status" by the active flag.</summary>
    private static readonly SortMap<CompanyUnit> SortColumns = SortMap<CompanyUnit>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("localizedName", x => x.Name)
        .Add("shortName", x => x.ShortName).Add("address", x => x.Address).Add("phone", x => x.Phone).Add("email", x => x.Email)
        .Add("taxCode", x => x.TaxCode).Add("status", x => x.IsActive).Add("isActive", x => x.IsActive)
        .Add("isDefault", x => x.IsDefault).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<CompanyUnit> Sorts => SortColumns;

    protected override IQueryable<CompanyUnit> Search(IQueryable<CompanyUnit> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.ShortName, pattern) || SearchFunctions.Matches(x.Address, pattern)
            || SearchFunctions.Matches(x.TaxCode, pattern) || SearchFunctions.Matches(x.Phone, pattern)
            || SearchFunctions.Matches(x.Email, pattern)
            || Db.CompanyUnitTranslations.Any(t => t.UnitCode == x.Code && SearchFunctions.Matches(t.Name, pattern)));

    protected override IReadOnlyList<ExportColumn<CompanyUnit>> ExportColumns() =>
    [
        new("export.companyUnit.code", x => x.Code), new("export.companyUnit.name", x => x.Name),
        new("export.companyUnit.shortName", x => x.ShortName), new("export.companyUnit.address", x => x.Address),
        new("export.companyUnit.phone", x => x.Phone), new("export.companyUnit.email", x => x.Email),
        new("export.companyUnit.taxCode", x => x.TaxCode),
        new("export.companyUnit.status", x => x.IsActive ? CompanyUnitStatus.Active : CompanyUnitStatus.Paused),
        new("export.companyUnit.isDefault", x => YesNo(x.IsDefault))
    ];

    protected override SaveCompanyUnitRequest WithoutVersion(SaveCompanyUnitRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<CompanyUnitDto>> MapAsync(IReadOnlyList<CompanyUnit> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var translations = await Db.CompanyUnitTranslations.AsNoTracking().Where(x => codes.Contains(x.UnitCode)).ToListAsync(ct);
        var byCode = translations.GroupBy(x => x.UnitCode).ToDictionary(x => x.Key, x => x.ToList());
        return rows.Select(x => ToDto(x, byCode.GetValueOrDefault(x.Code) ?? [], stamp(x))).ToList();
    }

    public async Task<IReadOnlyList<CompanyUnitDto>> GetAllAsync(bool activeOnly, CancellationToken ct)
    {
        var query = Db.CompanyUnits.AsNoTracking();
        if (activeOnly) query = query.Where(x => x.IsActive);
        var rows = await query.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        return await MapAsync(rows, await RecordStamps.ForAsync(Db, rows, ct), ct);
    }

    protected override Task ApplyAsync(CompanyUnit unit, SaveCompanyUnitRequest request, CancellationToken ct)
    {
        unit.Name = Guard.Required(request.Name, 150, "field.unitName");
        unit.ShortName = Guard.Optional(request.ShortName, 100, "field.shortName");
        unit.Address = Guard.Optional(request.Address, 300, "field.address");
        unit.Phone = Guard.Optional(request.Phone, 30, "field.phone");
        unit.Email = Guard.Optional(request.Email, 150, "field.email");
        unit.TaxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
        unit.IsActive = request.Status != CompanyUnitStatus.Paused;
        unit.IsDefault = request.IsDefault && unit.IsActive;
        return Task.CompletedTask;
    }

    protected override async Task AfterApplyAsync(CompanyUnit unit, SaveCompanyUnitRequest request, bool isNew, CancellationToken ct)
    {
        await ApplyTranslationsAsync(unit.Code, request.Translations, ct);
        // A translation edit must advance the parent version so concurrent forms cannot overwrite it.
        if (!isNew && request.Translations is not null) Db.Entry(unit).Property(x => x.Name).IsModified = true;
        if (!unit.IsActive) await EnsureAnotherActiveAsync(unit.Code, ct);
        await ApplyDefaultAsync(unit, ct);
    }

    protected override async Task BeforeDeleteAsync(CompanyUnit unit, CancellationToken ct)
    {
        // Tables with a [References<CompanyUnit>] column are checked by the base class; what no such column covers:
        // the legacy ma_dvcs of users and the settings kept for the unit.
        var scope = SystemSetting.UnitScope(unit.Code);
        if (await Db.Users.AnyAsync(x => x.ValidFlg == 1 && x.MaDvcs == unit.Code, ct)
            || await Db.SystemSettings.AnyAsync(x => x.Scope == scope, ct))
            throw new BusinessRuleException("companyUnit.inUse");
        await EnsureAnotherActiveAsync(unit.Code, ct);
        Db.CompanyUnitTranslations.RemoveRange(await Db.CompanyUnitTranslations.Where(x => x.UnitCode == unit.Code).ToListAsync(ct));
    }

    /// <summary>At most one unit is the default.</summary>
    private async Task ApplyDefaultAsync(CompanyUnit unit, CancellationToken ct)
    {
        if (!unit.IsDefault) return;
        await foreach (var other in Db.CompanyUnits.Where(x => x.IsDefault && x.Code != unit.Code)
                           .AsAsyncEnumerable().WithCancellation(ct))
            other.IsDefault = false;
    }

    private async Task EnsureAnotherActiveAsync(string code, CancellationToken ct)
    {
        if (!await Db.CompanyUnits.AnyAsync(x => x.Code != code && x.IsActive, ct))
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
        var knownLanguages = await Db.Languages.AsNoTracking().Select(x => x.Code).ToListAsync(ct);
        if (requested.Keys.Any(x => !knownLanguages.Contains(x, StringComparer.OrdinalIgnoreCase)))
            throw new BusinessRuleException("companyUnit.translationInvalid");

        var existing = await Db.CompanyUnitTranslations.Where(x => x.UnitCode == code).ToListAsync(ct);
        foreach (var translation in existing)
        {
            if (requested.Remove(translation.LanguageCode, out var name)) translation.Name = name;
            else Db.CompanyUnitTranslations.Remove(translation);
        }
        foreach (var (language, name) in requested)
            Db.CompanyUnitTranslations.Add(new CompanyUnitTranslation { UnitCode = code, LanguageCode = language, Name = name });
    }

    private static CompanyUnitDto ToDto(CompanyUnit x, IReadOnlyList<CompanyUnitTranslation> translations, RecordStampDto stamp)
    {
        var language = Messages.CurrentLanguage;
        var localized = translations.FirstOrDefault(t => t.LanguageCode == language)?.Name;
        var dash = language.IndexOf('-');
        if (localized is null && dash > 0)
            localized = translations.FirstOrDefault(t => t.LanguageCode == language[..dash])?.Name;
        return new CompanyUnitDto(x.Code, x.Code, x.Name, x.ShortName, x.Address,
            x.Phone, x.Email, x.TaxCode, x.IsActive ? CompanyUnitStatus.Active : CompanyUnitStatus.Paused,
            x.IsDefault, x.Version, localized ?? x.Name,
            translations.Select(t => new CompanyUnitTranslationDto(t.LanguageCode, t.Name)).ToList(), x.IsActive, stamp);
    }
}
