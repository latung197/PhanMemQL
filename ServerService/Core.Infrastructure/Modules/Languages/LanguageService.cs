using System.Text.RegularExpressions;
using Core.Application.Common.Auditing;
using Core.Application.Common.Caching;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Languages;
using Core.Domain.Common;
using Core.Domain.Modules.Languages;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Languages;

/// <summary>Danh mục ngôn ngữ: a catalog on CatalogService with lower-case language tags as codes and one default language.</summary>
public sealed partial class LanguageService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit,
    IUnitOfWork unitOfWork, IAppCache cache)
    : CatalogService<Language, LanguageDto, SaveLanguageRequest>(db, batch, excel, audit), ILanguageService
{
    private static readonly CatalogSpec Info = new("sys_languages", "language", "field.languageCode", 10, "DanhMucNgonNgu");

    /// <summary>Language tags as browsers send them: "vi", "en", "zh-cn", "pt-br".</summary>
    [GeneratedRegex("^[a-z]{2,3}(-[a-z0-9]{2,8})?$")]
    private static partial Regex CodePattern();

    private static readonly SortMap<Language> SortColumns = SortMap<Language>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("nativeName", x => x.NativeName)
        .Add("isDefault", x => x.IsDefault).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Language> Sorts => SortColumns;

    /// <summary>Codes are lower-case language tags, not the upper-case codes of other catalogs.</summary>
    protected override string NormalizeCode(string? code)
    {
        var value = KeyText(code);
        if (!CodePattern().IsMatch(value)) throw new BusinessRuleException("language.invalidCode");
        return value;
    }

    protected override string KeyText(string? code) => (code ?? string.Empty).Trim().ToLowerInvariant();

    protected override IQueryable<Language> Search(IQueryable<Language> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.NativeName, pattern));

    protected override IReadOnlyList<ExportColumn<Language>> ExportColumns() =>
    [
        new("export.language.code", x => x.Code), new("export.language.name", x => x.Name),
        new("export.language.nativeName", x => x.NativeName), new("export.language.isDefault", x => YesNo(x.IsDefault)),
        new("export.language.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveLanguageRequest WithoutVersion(SaveLanguageRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<LanguageDto>> MapAsync(IReadOnlyList<Language> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var counts = await Db.Users.AsNoTracking().Where(x => x.ValidFlg == 1 && x.Language != null && codes.Contains(x.Language))
            .GroupBy(x => x.Language!).Select(g => new { Code = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Code, x => x.Count, ct);
        return rows.Select(x => new LanguageDto(x.Code, x.Name, x.NativeName, x.IsActive, x.IsDefault,
            counts.GetValueOrDefault(x.Code), stamp(x), x.Version)).ToList();
    }

    protected override Task ApplyAsync(Language language, SaveLanguageRequest request, CancellationToken ct)
    {
        if (language.IsDefault && !request.IsDefault) throw new BusinessRuleException("language.keepDefault");
        language.Name = Guard.Required(request.Name, 50, "field.languageName");
        language.NativeName = Guard.Required(request.NativeName, 50, "field.languageNativeName");
        language.IsDefault = request.IsDefault;
        // The default language is always in use.
        language.IsActive = request.IsActive || request.IsDefault;
        return Task.CompletedTask;
    }

    /// <summary>
    /// One default language (unique index ux_sys_language_default): a new default clears the old one first, in the
    /// same transaction, so the index never sees two.
    /// </summary>
    protected override Task SaveAsync(CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var chosen = Db.ChangeTracker.Entries<Language>()
            .FirstOrDefault(e => e.State is EntityState.Added or EntityState.Modified && e.Entity.IsDefault)?.Entity;
        if (chosen is not null)
        {
            var old = Db.Languages.Where(x => x.IsDefault && x.Code != chosen.Code);
            // ExecuteUpdate bypasses the automatic log: the old default language is logged by hand.
            foreach (var x in await old.AsNoTracking().ToListAsync(token))
                await AuditLog.RecordAsync(new AuditEntry("sys_languages", "language", x.Code, $"{x.Code} - {x.Name}",
                    AuditActions.Update, [new AuditChange("isDefault", "true", "false")]), token);
            await old.ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), token);
        }
        await Db.SaveChangesAsync(token);
    }, ct);

    protected override async Task BeforeDeleteAsync(Language language, CancellationToken ct)
    {
        if (language.IsDefault) throw new BusinessRuleException("language.deleteDefault");
        // sys_users.language holds the code but is not a *_code column; only accounts that are not deleted count.
        var users = await Db.Users.CountAsync(x => x.ValidFlg == 1 && x.Language == language.Code, ct);
        if (users > 0) throw new BusinessRuleException("language.inUse", users, language.Name);
    }

    /// <summary>Read by the sign-in screen and the language menu; cached until the catalog changes.</summary>
    public Task<IReadOnlyList<LanguageOptionDto>> GetActiveAsync(CancellationToken ct) =>
        Db.CachedAsync<IReadOnlyList<LanguageOptionDto>>(cache, "languages:active", ["sys_language"], async token =>
            await Db.Languages.AsNoTracking().Where(x => x.IsActive)
                .OrderByDescending(x => x.IsDefault).ThenBy(x => x.SortOrder).ThenBy(x => x.Code)
                .Select(x => new LanguageOptionDto(x.Code, x.NativeName, x.IsDefault)).ToListAsync(token), ct);

    public async Task<string> GetDefaultCodeAsync(CancellationToken ct) =>
        await Db.Languages.AsNoTracking().Where(x => x.IsDefault).Select(x => x.Code).FirstOrDefaultAsync(ct) ?? Language.Vietnamese;
}
