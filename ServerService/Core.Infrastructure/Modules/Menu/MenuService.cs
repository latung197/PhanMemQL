using Core.Application.Common.Auditing;
using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.Menu;
using Core.Application.Modules.Notifications;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Menu;

/// <summary>
/// Reads and edits the menu tree kept in sys_command (+ sys_command_translation). Functions cannot be added or
/// removed here: they are code (FunctionCatalog, screens, rights); only their look and place can change.
/// </summary>
public sealed class MenuService(CoreContext db, IAppCache cache, IAuditLog audit, INotificationStream stream) : IMenuService
{
    private const string AuditFunction = "sys_menu";

    public Task<List<MenuNodeDto>> GetTreeAsync(CancellationToken ct) =>
        db.CachedAsync(cache, "menu:tree", ["sys_command", "sys_command_translation"], LoadAsync, ct);

    private async Task<List<MenuNodeDto>> LoadAsync(CancellationToken ct)
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

    private async Task<HashSet<string>> LanguageCodesAsync(CancellationToken ct) =>
        (await db.Languages.AsNoTracking().Select(x => x.Code).ToListAsync(ct)).ToHashSet(StringComparer.OrdinalIgnoreCase);

    public async Task<MenuNodeDto> UpdateNodeAsync(string id, SaveMenuNodeRequest request, CancellationToken ct)
    {
        var tree = await LoadAsync(ct);
        var current = tree.FirstOrDefault(x => x.Id == id) ?? throw new NotFoundException("menu.notFound");
        var titles = Normalize(request.Titles);
        MenuRules.CheckTitles(titles, await LanguageCodesAsync(ct));
        MenuRules.CheckNode(request with { Titles = titles }, current, tree);

        var row = await db.Commands.FirstAsync(x => x.MenuId0 == id, ct);
        var rows = await db.CommandTranslations.Where(x => x.MenuId0 == id).ToListAsync(ct);
        var changes = new List<AuditChange>();
        void Track(string field, string? before, string? after)
        {
            if (before != after) changes.Add(new AuditChange(field, before, after));
        }

        foreach (var (language, title) in titles)
        {
            var existing = rows.FirstOrDefault(x => string.Equals(x.LanguageCode, language, StringComparison.OrdinalIgnoreCase));
            if (string.IsNullOrWhiteSpace(title))
            {
                if (existing is null) continue;
                db.CommandTranslations.Remove(existing);
                Track($"title.{language}", existing.Title, null);
            }
            else if (existing is null)
            {
                db.CommandTranslations.Add(new SysCommandTranslation { MenuId0 = id, LanguageCode = language, Title = title });
                Track($"title.{language}", null, title);
            }
            else
            {
                Track($"title.{language}", existing.Title, title);
                existing.Title = title;
            }
        }
        if (titles.TryGetValue("vi", out var vi)) row.Text = vi;
        if (titles.TryGetValue("en", out var en) && !string.IsNullOrWhiteSpace(en)) row.Text2 = en;

        var iconColor = string.IsNullOrWhiteSpace(request.IconColor) ? null : request.IconColor;
        Track("icon", row.MenuIcon, request.Icon);
        Track("iconColor", row.MenuIconColor, iconColor);
        Track("orderNo", row.MenuOrderNo.ToString(), request.OrderNo.ToString());
        Track("isActive", row.MenuIsActive.ToString(), request.IsActive.ToString());
        Track("parent", row.MenuParentId, request.ParentId);
        row.MenuIcon = request.Icon;
        row.MenuIconColor = iconColor;
        row.MenuOrderNo = request.OrderNo;
        row.MenuIsActive = request.IsActive;
        row.MenuParentId = request.ParentId;

        await audit.RecordAsync(new AuditEntry(AuditFunction, "menu", id, titles.GetValueOrDefault("vi") ?? current.TitleVi,
            AuditActions.Update, changes), ct);
        await db.SaveChangesAsync(ct);
        stream.PublishSettings();
        return (await LoadAsync(ct)).First(x => x.Id == id);
    }

    public async Task<MenuNodeDto> CreateGroupAsync(CreateMenuGroupRequest request, CancellationToken ct)
    {
        var tree = await LoadAsync(ct);
        if (tree.FirstOrDefault(x => x.Id == request.ModuleId)?.NodeType != "module") throw new BusinessRuleException("menu.parentInvalid");
        var titles = Normalize(request.Titles);
        MenuRules.CheckTitles(titles, await LanguageCodesAsync(ct));
        MenuRules.CheckLook(request.Icon, request.IconColor, request.OrderNo);
        MenuRules.CheckCode(request.Code);
        var id = "GRP_" + request.Code.ToUpperInvariant();
        if (tree.Any(x => x.Id == id || (x.NodeType == "group" && x.Code == request.Code))) throw new BusinessRuleException("menu.groupExists", request.Code);
        if (await db.Commands.AnyAsync(x => x.MenuId0 == id, ct)) throw new BusinessRuleException("menu.groupExists", request.Code);

        db.Commands.Add(new SysCommand
        {
            MenuId0 = id, MenuId = id, Type = "M", Text = titles["vi"], Text2 = titles.GetValueOrDefault("en") ?? titles["vi"],
            MenuKind = "group", MenuKey = request.Code, MenuParentId = request.ModuleId, MenuIcon = request.Icon,
            MenuIconColor = string.IsNullOrWhiteSpace(request.IconColor) ? null : request.IconColor,
            MenuOrderNo = request.OrderNo, MenuIsActive = true
        });
        foreach (var (language, title) in titles.Where(x => !string.IsNullOrWhiteSpace(x.Value)))
            db.CommandTranslations.Add(new SysCommandTranslation { MenuId0 = id, LanguageCode = language, Title = title });
        await audit.RecordAsync(new AuditEntry(AuditFunction, "menu", id, titles["vi"], AuditActions.Create,
            [new AuditChange("title.vi", null, titles["vi"]), new AuditChange("parent", null, request.ModuleId)]), ct);
        await db.SaveChangesAsync(ct);
        stream.PublishSettings();
        return (await LoadAsync(ct)).First(x => x.Id == id);
    }

    public async Task ReorderAsync(ReorderMenuRequest request, CancellationToken ct)
    {
        if (request.Ids.Count == 0 || request.Ids.Distinct(StringComparer.Ordinal).Count() != request.Ids.Count)
            throw new BusinessRuleException("menu.orderInvalid");
        var rows = await db.Commands.Where(x => request.Ids.Contains(x.MenuId0) && x.MenuKind != null).ToListAsync(ct);
        if (rows.Count != request.Ids.Count || rows.Any(x => x.MenuParentId != request.ParentId))
            throw new BusinessRuleException("menu.orderInvalid");
        var changes = new List<AuditChange>();
        for (var i = 0; i < request.Ids.Count; i++)
        {
            var row = rows.First(x => x.MenuId0 == request.Ids[i]);
            var order = (i + 1) * 10;
            if (row.MenuOrderNo != order) changes.Add(new AuditChange($"orderNo.{row.MenuId0}", row.MenuOrderNo.ToString(), order.ToString()));
            row.MenuOrderNo = order;
        }
        await audit.RecordAsync(new AuditEntry(AuditFunction, "menu", request.ParentId ?? "root", null, AuditActions.Update, changes), ct);
        await db.SaveChangesAsync(ct);
        stream.PublishSettings();
    }

    private static Dictionary<string, string> Normalize(IReadOnlyDictionary<string, string>? titles) =>
        (titles ?? new Dictionary<string, string>()).ToDictionary(x => x.Key.Trim().ToLowerInvariant(), x => (x.Value ?? string.Empty).Trim());
}
