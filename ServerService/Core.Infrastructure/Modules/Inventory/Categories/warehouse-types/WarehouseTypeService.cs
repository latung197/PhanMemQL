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
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Danh mục loại kho: a catalog on the shared CatalogService, with names translated per language (model: UomService).</summary>
public sealed class WarehouseTypeService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<WarehouseType, WarehouseTypeDto, SaveWarehouseTypeRequest>(db, batch, excel, audit), IWarehouseTypeService
{
    private static readonly CatalogSpec Info = new("inv_warehouse_type_cat", "warehouseType", "field.warehouseTypeCode", 20, "DanhMucLoaiKho");

    /// <summary>"localizedName" sorts by the original name.</summary>
    private static readonly SortMap<WarehouseType> SortColumns = SortMap<WarehouseType>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("localizedName", x => x.Name)
        .Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<WarehouseType> Sorts => SortColumns;

    protected override IQueryable<WarehouseType> Search(IQueryable<WarehouseType> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.Note, pattern)
            || Db.WarehouseTypeTranslations.Any(t => t.WarehouseTypeCode == x.Code && SearchFunctions.Matches(t.Name, pattern)));

    protected override IReadOnlyList<ExportColumn<WarehouseType>> ExportColumns() =>
    [
        new("export.warehouseType.code", x => x.Code), new("export.warehouseType.name", x => x.Name),
        new("export.warehouseType.note", x => x.Note), new("export.warehouseType.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveWarehouseTypeRequest WithoutVersion(SaveWarehouseTypeRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<WarehouseTypeDto>> MapAsync(IReadOnlyList<WarehouseType> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var translations = await Db.WarehouseTypeTranslations.AsNoTracking().Where(x => codes.Contains(x.WarehouseTypeCode)).ToListAsync(ct);
        var byCode = translations.GroupBy(x => x.WarehouseTypeCode).ToDictionary(x => x.Key, x => x.ToList());
        return rows.Select(x => ToDto(x, stamp(x), byCode.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    protected override async Task ApplyAsync(WarehouseType row, SaveWarehouseTypeRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.warehouseTypeName");
        if (await Db.WarehouseTypes.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("warehouseType.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    protected override async Task AfterApplyAsync(WarehouseType row, SaveWarehouseTypeRequest request, bool isNew, CancellationToken ct)
    {
        await ApplyTranslationsAsync(row.Code, request.Translations, ct);
        // A translation edit must advance the parent version so concurrent forms cannot overwrite it.
        if (!isNew && request.Translations is not null) Db.Entry(row).Property(x => x.Name).IsModified = true;
    }

    protected override async Task BeforeDeleteAsync(WarehouseType row, CancellationToken ct)
    {
        // Warehouses are checked from their [References<WarehouseType>] column; the translations go with the row.
        Db.WarehouseTypeTranslations.RemoveRange(
            await Db.WarehouseTypeTranslations.Where(x => x.WarehouseTypeCode == row.Code).ToListAsync(ct));
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
        var knownLanguages = await Db.Languages.AsNoTracking().Select(x => x.Code).ToListAsync(ct);
        if (requested.Keys.Any(x => !knownLanguages.Contains(x, StringComparer.OrdinalIgnoreCase)))
            throw new BusinessRuleException("warehouseType.translationInvalid");

        var existing = await Db.WarehouseTypeTranslations.Where(x => x.WarehouseTypeCode == code).ToListAsync(ct);
        foreach (var translation in existing)
        {
            if (requested.Remove(translation.LanguageCode, out var name)) translation.Name = name;
            else Db.WarehouseTypeTranslations.Remove(translation);
        }
        foreach (var (language, name) in requested)
            Db.WarehouseTypeTranslations.Add(new WarehouseTypeTranslation
                { WarehouseTypeCode = code, LanguageCode = language, Name = name });
    }

    private static WarehouseTypeDto ToDto(WarehouseType row, RecordStampDto stamp, IReadOnlyList<WarehouseTypeTranslation> translations)
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
