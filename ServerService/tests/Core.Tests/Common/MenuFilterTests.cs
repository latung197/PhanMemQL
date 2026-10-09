using Core.Application.Modules.Menu;
using Xunit;

namespace Core.Tests.Common;

/// <summary>GET /api/menu returns only what the user may view; the tree is built here like sys_command holds it.</summary>
public sealed class MenuFilterTests
{
    private static MenuNodeDto Node(string id, string? parent, string type, string code, string? direct = null) =>
        new(id, parent, type, code, id, id, new Dictionary<string, string>(), "", null, null, direct, 1, true);

    private static readonly List<MenuNodeDto> Tree =
    [
        Node("MOD_OVERVIEW", null, "module", "overview", "overview_main"),
        Node("MOD_INV", null, "module", "inventory"),
        Node("GRP_DOC", "MOD_INV", "group", "docs"),
        Node("inv_receipt", "GRP_DOC", "function", "inv_receipt"),
        Node("inv_issue", "GRP_DOC", "function", "inv_issue"),
        Node("GRP_CAT", "MOD_INV", "group", "cats"),
        Node("inv_uom_cat", "GRP_CAT", "function", "inv_uom_cat"),
        Node("MOD_SET", null, "module", "settings"),
        Node("GRP_SYS", "MOD_SET", "group", "sys"),
        Node("sys_users", "GRP_SYS", "function", "sys_users"),
    ];

    private static List<string> Ids(params string[] viewable) =>
        MenuFilter.ForUser(Tree, code => viewable.Contains(code)).Select(x => x.Id).ToList();

    [Fact]
    public void NoRightsLeavesOnlyTheLandingPage() =>
        Assert.Equal(["MOD_OVERVIEW"], Ids());

    [Fact]
    public void KeepsViewableFunctionsWithTheirGroupAndModule()
    {
        var ids = Ids("inv_receipt");
        Assert.Equal(["MOD_OVERVIEW", "MOD_INV", "GRP_DOC", "inv_receipt"], ids);
    }

    [Fact]
    public void DropsGroupsAndModulesLeftEmpty()
    {
        var ids = Ids("inv_uom_cat");
        Assert.DoesNotContain("GRP_DOC", ids);
        Assert.DoesNotContain("MOD_SET", ids);
        Assert.Contains("GRP_CAT", ids);
    }

    [Fact]
    public void AllRightsReturnTheWholeTree() =>
        Assert.Equal(Tree.Count, Ids("inv_receipt", "inv_issue", "inv_uom_cat", "sys_users").Count);
}
