using Core.Common.Controllers;
using Core.Infrastructure.Common.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Core.Modules.Menu;

[Route("api/menu")]
public sealed class MenuController(CoreContext db) : ApiControllerBase
{
    /// <summary>Menu structure from sys_command; rights and visibility are applied separately.</summary>
    [HttpGet]
    public async Task<List<MenuNodeDto>> Get(CancellationToken ct)
    {
        var nodes = await db.Commands.AsNoTracking().Where(x => x.MenuKind != null)
            .OrderBy(x => x.MenuOrderNo).ThenBy(x => x.MenuId0).ToListAsync(ct);
        var ids = nodes.Select(x => x.MenuId0).ToArray();
        var translations = await db.CommandTranslations.AsNoTracking()
            .Where(x => ids.Contains(x.MenuId0)).ToListAsync(ct);
        var titles = translations.GroupBy(x => x.MenuId0, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToDictionary(x => x.LanguageCode, x => x.Title, StringComparer.OrdinalIgnoreCase),
                StringComparer.Ordinal);
        return nodes.Select(x =>
        {
            var localized = titles.GetValueOrDefault(x.MenuId0) ?? new Dictionary<string, string>();
            return new MenuNodeDto(x.MenuId0, x.MenuParentId, x.MenuKind!, x.MenuKey ?? x.MenuId0,
                localized.GetValueOrDefault("vi") ?? x.Text, localized.GetValueOrDefault("en") ?? x.Text2,
                localized, x.MenuIcon, x.MenuIconColor, x.MenuBadgeType, x.MenuDirectFunctionCode,
                x.MenuOrderNo, x.MenuIsActive);
        }).ToList();
    }
}

public sealed record MenuNodeDto(string Id, string? ParentId, string NodeType, string Code,
    string TitleVi, string TitleEn, IReadOnlyDictionary<string, string> Titles,
    string Icon, string? IconColor, string? BadgeType, string? DirectFunctionCode, int OrderNo, bool IsActive);
