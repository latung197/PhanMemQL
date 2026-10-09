using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Microsoft.EntityFrameworkCore;
using Core.Infrastructure.Common.Persistence;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Danh mục đơn vị tính: the model of a catalog service (see CatalogService). Names can be translated per language.</summary>
public sealed class UomService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Uom, UomDto, SaveUomRequest>(db, batch, excel, audit), IUomService
{
    private static readonly CatalogSpec Info = new("inv_uom_cat", "uom", "field.uomCode", 20, "DanhMucDonViTinh");

    /// <summary>"localizedName" sorts by the original name.</summary>
    private static readonly SortMap<Uom> SortColumns = SortMap<Uom>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("localizedName", x => x.Name)
        .Add("symbol", x => x.Symbol).Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Uom> Sorts => SortColumns;

    protected override IQueryable<Uom> Search(IQueryable<Uom> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.Symbol, pattern) || SearchFunctions.Matches(x.Note, pattern)
            || Db.UomTranslations.Any(t => t.UomCode == x.Code && SearchFunctions.Matches(t.Name, pattern)));

    protected override IReadOnlyList<ExportColumn<Uom>> ExportColumns() =>
    [
        new("export.uom.code", x => x.Code), new("export.uom.name", x => x.Name), new("export.uom.symbol", x => x.Symbol),
        new("export.uom.note", x => x.Note), new("export.uom.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveUomRequest WithoutVersion(SaveUomRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<UomDto>> MapAsync(IReadOnlyList<Uom> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var translations = await Db.UomTranslations.AsNoTracking().Where(x => codes.Contains(x.UomCode)).ToListAsync(ct);
        var byCode = translations.GroupBy(x => x.UomCode).ToDictionary(x => x.Key, x => x.ToList());
        return rows.Select(x => ToDto(x, stamp(x), byCode.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    protected override async Task ApplyAsync(Uom uom, SaveUomRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.uomName");
        if (await Db.Uoms.AnyAsync(x => x.Code != uom.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("uom.nameExists", name);
        uom.Name = name;
        uom.Symbol = Guard.Optional(request.Symbol, 20, "field.symbol") ?? string.Empty;
        uom.Note = Guard.Optional(request.Note, 300, "field.note");
        uom.IsActive = request.IsActive;
    }

    protected override async Task AfterApplyAsync(Uom uom, SaveUomRequest request, bool isNew, CancellationToken ct)
    {
        await ApplyTranslationsAsync(uom.Code, request.Translations, ct);
        // A translation edit must advance the parent version so concurrent forms cannot overwrite it.
        if (!isNew && request.Translations is not null) Db.Entry(uom).Property(x => x.Name).IsModified = true;
    }

    protected override async Task BeforeDeleteAsync(Uom uom, CancellationToken ct)
    {
        // Conversions (and later materials, voucher lines) are checked from their [References<Uom>] columns.
        Db.UomTranslations.RemoveRange(await Db.UomTranslations.Where(x => x.UomCode == uom.Code).ToListAsync(ct));
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
        var active = await Db.Languages.AsNoTracking()
            .Select(x => x.Code).ToListAsync(ct);
        if (requested.Keys.Any(x => !active.Contains(x, StringComparer.OrdinalIgnoreCase)))
            throw new BusinessRuleException("uom.translationInvalid");

        var existing = await Db.UomTranslations.Where(x => x.UomCode == code).ToListAsync(ct);
        foreach (var translation in existing)
        {
            if (requested.Remove(translation.LanguageCode, out var name)) translation.Name = name;
            else Db.UomTranslations.Remove(translation);
        }
        foreach (var (language, name) in requested)
            Db.UomTranslations.Add(new UomTranslation { UomCode = code, LanguageCode = language, Name = name });
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
