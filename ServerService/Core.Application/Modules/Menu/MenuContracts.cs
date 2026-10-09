using System.Text.RegularExpressions;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;

namespace Core.Application.Modules.Menu;

public sealed record MenuNodeDto(string Id, string? ParentId, string NodeType, string Code,
    string TitleVi, string TitleEn, IReadOnlyDictionary<string, string> Titles,
    string Icon, string? IconColor, string? BadgeType, string? DirectFunctionCode, int OrderNo, bool IsActive);

/// <summary>Titles are keyed by language code ("vi" is required, an empty text removes that translation).</summary>
public sealed record SaveMenuNodeRequest(IReadOnlyDictionary<string, string> Titles, string Icon, string? IconColor,
    int OrderNo, bool IsActive, string? ParentId);

public sealed record CreateMenuGroupRequest(string ModuleId, string Code, IReadOnlyDictionary<string, string> Titles,
    string Icon, string? IconColor, int OrderNo);

/// <summary>New order of children of one parent: their ids, first to last.</summary>
public sealed record ReorderMenuRequest(string? ParentId, IReadOnlyList<string> Ids);

public sealed record MenuAccessDto(bool CanEditStructure);

public interface IMenuService
{
    /// <summary>The whole tree, cached.</summary>
    Task<List<MenuNodeDto>> GetTreeAsync(CancellationToken ct);
    Task<MenuNodeDto> UpdateNodeAsync(string id, SaveMenuNodeRequest request, CancellationToken ct);
    Task<MenuNodeDto> CreateGroupAsync(CreateMenuGroupRequest request, CancellationToken ct);
    Task ReorderAsync(ReorderMenuRequest request, CancellationToken ct);
}

/// <summary>Cuts the menu tree to the functions a user may view, dropping groups and modules left empty.</summary>
public static class MenuFilter
{
    public static List<MenuNodeDto> ForUser(IReadOnlyList<MenuNodeDto> tree, Func<string, bool> canView)
    {
        bool Allowed(string code) => code == PermissionMatrix.LandingFunction || canView(code);
        var functions = tree.Where(x => x.NodeType == "function" && Allowed(x.Code)).ToList();
        var groupIds = functions.Select(x => x.ParentId).OfType<string>().ToHashSet(StringComparer.Ordinal);
        var groups = tree.Where(x => x.NodeType == "group" && groupIds.Contains(x.Id)).ToList();
        var moduleIds = groups.Select(x => x.ParentId).OfType<string>().ToHashSet(StringComparer.Ordinal);
        var modules = tree.Where(x => x.NodeType == "module"
            && (moduleIds.Contains(x.Id) || (x.DirectFunctionCode is { } direct && Allowed(direct)))).ToList();
        var keep = new HashSet<string>(modules.Concat(groups).Concat(functions).Select(x => x.Id), StringComparer.Ordinal);
        return tree.Where(x => keep.Contains(x.Id)).ToList();
    }
}

/// <summary>Rules for editing the menu structure; the service applies them, the tests pin them down.</summary>
public static partial class MenuRules
{
    public const int MaxTitleLength = 100;
    private static readonly HashSet<string> ProtectedModules = new(StringComparer.Ordinal) { "overview", "settings" };
    private static readonly HashSet<string> ProtectedFunctions = new(StringComparer.Ordinal) { "sys_menu" };

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9]{0,63}$")] private static partial Regex IconPattern();
    [GeneratedRegex(@"^[A-Za-z0-9\-\[\]#/:.]{1,64}$")] private static partial Regex ColorPattern();
    [GeneratedRegex("^[a-z][a-z0-9_]{1,39}$")] private static partial Regex CodePattern();

    /// <summary>Nodes that must stay reachable: turning them off or moving them could lock everyone out of this screen.</summary>
    public static bool IsProtected(MenuNodeDto node) => node.NodeType switch
    {
        "module" => ProtectedModules.Contains(node.Code),
        "function" => ProtectedFunctions.Contains(node.Code),
        _ => false
    };

    /// <summary>A protected node, or one that holds a protected function (its group).</summary>
    public static bool HoldsProtected(MenuNodeDto node, IReadOnlyList<MenuNodeDto> tree) =>
        IsProtected(node) || (node.NodeType == "group" && tree.Any(x => x.ParentId == node.Id && IsProtected(x)));

    public static void CheckTitles(IReadOnlyDictionary<string, string> titles, IReadOnlySet<string> languages)
    {
        if (!titles.TryGetValue("vi", out var vi) || string.IsNullOrWhiteSpace(vi)) throw new BusinessRuleException("menu.titleRequired");
        foreach (var (language, title) in titles)
        {
            if (!languages.Contains(language)) throw new BusinessRuleException("menu.languageUnknown", language);
            if (title.Trim().Length > MaxTitleLength) throw new BusinessRuleException("menu.titleTooLong", MaxTitleLength);
        }
    }

    public static void CheckLook(string icon, string? iconColor, int orderNo)
    {
        if (!IconPattern().IsMatch(icon)) throw new BusinessRuleException("menu.iconInvalid");
        if (!string.IsNullOrEmpty(iconColor) && !ColorPattern().IsMatch(iconColor)) throw new BusinessRuleException("menu.colorInvalid");
        if (orderNo is < 0 or > 100000) throw new BusinessRuleException("menu.orderInvalid");
    }

    public static void CheckCode(string code)
    {
        if (!CodePattern().IsMatch(code)) throw new BusinessRuleException("menu.codeInvalid");
    }

    /// <summary>The parent must be one level up (function → group → module → none); protected nodes stay put and on.</summary>
    public static void CheckNode(SaveMenuNodeRequest request, MenuNodeDto current, IReadOnlyList<MenuNodeDto> tree)
    {
        CheckLook(request.Icon, request.IconColor, request.OrderNo);
        var parent = request.ParentId is null ? null : tree.FirstOrDefault(x => x.Id == request.ParentId);
        var expected = current.NodeType switch { "function" => "group", "group" => "module", _ => null };
        if (expected is null ? request.ParentId is not null : parent?.NodeType != expected)
            throw new BusinessRuleException("menu.parentInvalid");
        if (HoldsProtected(current, tree) && !request.IsActive) throw new BusinessRuleException("menu.protected");
        if (IsProtected(current) && request.ParentId != current.ParentId) throw new BusinessRuleException("menu.protected");
    }
}
