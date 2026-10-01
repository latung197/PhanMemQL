using System.Text.RegularExpressions;
using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Languages;
using Core.Domain.Modules.Languages;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Languages;

/// <summary>Danh mục ngôn ngữ: a plain catalog with one default language (like the base currency).</summary>
public sealed partial class LanguageService(CoreContext db, IUnitOfWork unitOfWork, IAuditLog auditLog) : ILanguageService
{
    /// <summary>Language tags as browsers send them: "vi", "en", "zh-cn", "pt-br".</summary>
    [GeneratedRegex("^[a-z]{2,3}(-[a-z0-9]{2,8})?$")]
    private static partial Regex CodePattern();

    public async Task<IReadOnlyList<LanguageDto>> GetAllAsync(CancellationToken ct)
    {
        var languages = await Ordered().ToListAsync(ct);
        var counts = await db.Users.AsNoTracking().Where(x => x.ValidFlg == 1 && x.Language != null)
            .GroupBy(x => x.Language!).Select(g => new { Code = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Code, x => x.Count, ct);
        return languages.Select(x => ToDto(x, counts.GetValueOrDefault(x.Code))).ToList();
    }

    public async Task<IReadOnlyList<LanguageOptionDto>> GetActiveAsync(CancellationToken ct) =>
        await Ordered().Where(x => x.IsActive).Select(x => new LanguageOptionDto(x.Code, x.NativeName, x.IsDefault)).ToListAsync(ct);

    public async Task<LanguageDto> CreateAsync(SaveLanguageRequest request, CancellationToken ct)
    {
        var code = (request.Code ?? string.Empty).Trim().ToLowerInvariant();
        if (!CodePattern().IsMatch(code))
            throw new BusinessRuleException("language.invalidCode");
        if (await db.Languages.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("language.exists", code);
        var language = new Language
        {
            Code = code,
            SortOrder = (await db.Languages.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
        };
        Apply(language, request);
        db.Languages.Add(language);
        await SaveAsync(language, ct);
        return ToDto(language, 0);
    }

    public async Task<LanguageDto> UpdateAsync(string code, SaveLanguageRequest request, CancellationToken ct)
    {
        var language = await FindAsync(code, ct);
        if (language.IsDefault && !request.IsDefault)
            throw new BusinessRuleException("language.keepDefault");
        Apply(language, request);
        await SaveAsync(language, ct);
        return ToDto(language, await db.Users.CountAsync(x => x.ValidFlg == 1 && x.Language == language.Code, ct));
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var language = await FindAsync(code, ct);
        if (language.IsDefault) throw new BusinessRuleException("language.deleteDefault");
        // No foreign keys: check every table that refers to a language.
        var users = await db.Users.CountAsync(x => x.ValidFlg == 1 && x.Language == language.Code, ct);
        if (users > 0)
            throw new BusinessRuleException(
                "language.inUse", users, language.Name);
        db.Languages.Remove(language);
        await db.SaveChangesAsync(ct);
    }

    public async Task<string> GetDefaultCodeAsync(CancellationToken ct) =>
        await db.Languages.AsNoTracking().Where(x => x.IsDefault).Select(x => x.Code).FirstOrDefaultAsync(ct) ?? Language.Vietnamese;

    private IQueryable<Language> Ordered() =>
        db.Languages.AsNoTracking().OrderByDescending(x => x.IsDefault).ThenBy(x => x.SortOrder).ThenBy(x => x.Code);

    private async Task<Language> FindAsync(string code, CancellationToken ct) =>
        await db.Languages.FirstOrDefaultAsync(x => x.Code == code.Trim().ToLower(), ct)
        ?? throw new NotFoundException("language.notFound");

    private static void Apply(Language language, SaveLanguageRequest request)
    {
        language.Name = Guard.Required(request.Name, 50, "field.languageName");
        language.NativeName = Guard.Required(request.NativeName, 50, "field.languageNativeName");
        language.IsDefault = request.IsDefault;
        // The default language is always in use.
        language.IsActive = request.IsActive || request.IsDefault;
    }

    /// <summary>
    /// One default language (unique index ux_sys_language_default): a new default clears the old one first, in the
    /// same transaction, so the index never sees two.
    /// </summary>
    private Task SaveAsync(Language language, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        if (language.IsDefault)
        {
            var old = db.Languages.Where(x => x.IsDefault && x.Code != language.Code);
            // ExecuteUpdate bypasses the automatic log: the old default language is logged by hand.
            foreach (var x in await old.AsNoTracking().ToListAsync(token))
                await auditLog.RecordAsync(new AuditEntry("sys_languages", "language", x.Code, $"{x.Code} - {x.Name}",
                    AuditActions.Update, [new AuditChange("isDefault", "true", "false")]), token);
            await old.ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), token);
        }
        await db.SaveChangesAsync(token);
    }, ct);

    private static LanguageDto ToDto(Language x, int userCount) =>
        new(x.Code, x.Name, x.NativeName, x.IsActive, x.IsDefault, userCount);
}
