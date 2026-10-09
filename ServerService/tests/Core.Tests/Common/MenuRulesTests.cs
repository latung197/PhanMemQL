using Core.Application.Common.Exceptions;
using Core.Application.Modules.Menu;
using Core.Infrastructure.Common.Security;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Core.Tests.Common;

/// <summary>Editing the menu structure: who may, and what a save may not break.</summary>
public sealed class MenuRulesTests
{
    private static MenuNodeDto Node(string id, string? parent, string type, string code, bool active = true) =>
        new(id, parent, type, code, id, id, new Dictionary<string, string>(), "FileText", null, null, null, 10, active);

    private static readonly List<MenuNodeDto> Tree =
    [
        Node("MOD_INV", null, "module", "inventory"),
        Node("MOD_SET", null, "module", "settings"),
        Node("GRP_CAT", "MOD_INV", "group", "cats"),
        Node("GRP_DOC", "MOD_INV", "group", "docs"),
        Node("GRP_SYS", "MOD_SET", "group", "sys"),
        Node("inv_uom_cat", "GRP_CAT", "function", "inv_uom_cat"),
        Node("sys_menu", "GRP_SYS", "function", "sys_menu"),
    ];

    private static SaveMenuNodeRequest Save(MenuNodeDto node, string? parent = null, bool? active = null, string icon = "Tag", int order = 10) =>
        new(new Dictionary<string, string> { ["vi"] = "Tên" }, icon, null, order, active ?? node.IsActive, parent ?? node.ParentId);

    private static Exception? Try(SaveMenuNodeRequest request, string id)
    {
        var node = Tree.First(x => x.Id == id);
        return Record.Exception(() => MenuRules.CheckNode(request, node, Tree));
    }

    [Fact]
    public void AnAllowedEditPasses() =>
        Assert.Null(Try(Save(Tree[5], parent: "GRP_DOC", order: 55), "inv_uom_cat"));

    [Fact]
    public void AFunctionMustSitInAGroupAndAGroupInAModule()
    {
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[5], parent: "MOD_INV"), "inv_uom_cat"));
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[2], parent: "GRP_DOC"), "GRP_CAT"));
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[0], parent: "MOD_SET"), "MOD_INV"));
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[5], parent: "NOPE"), "inv_uom_cat"));
    }

    [Fact]
    public void TheMenuScreenItsGroupAndItsModuleCannotBeTurnedOffOrMoved()
    {
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[6], active: false), "sys_menu"));
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[4], active: false), "GRP_SYS"));
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[1], active: false), "MOD_SET"));
        Assert.IsType<BusinessRuleException>(Try(Save(Tree[6], parent: "GRP_CAT"), "sys_menu"));
        Assert.Null(Try(Save(Tree[3], active: false), "GRP_DOC"));
    }

    [Theory]
    [InlineData("Tag", true)]
    [InlineData("ArrowDownLeft", true)]
    [InlineData("", false)]
    [InlineData("1Tag", false)]
    [InlineData("<script>", false)]
    public void IconIsAPlainName(string icon, bool valid)
    {
        var error = Record.Exception(() => MenuRules.CheckLook(icon, null, 10));
        Assert.Equal(valid, error is null);
    }

    [Fact]
    public void ColorOrderAndCodeAreChecked()
    {
        Assert.Null(Record.Exception(() => MenuRules.CheckLook("Tag", "text-emerald-400", 10)));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckLook("Tag", "red; x", 10)));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckLook("Tag", null, -1)));
        Assert.Null(Record.Exception(() => MenuRules.CheckCode("custom_group")));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckCode("Custom Group")));
    }

    [Fact]
    public void VietnameseTitleIsRequiredAndLanguagesMustExist()
    {
        var languages = new HashSet<string> { "vi", "en" };
        Assert.Null(Record.Exception(() => MenuRules.CheckTitles(new Dictionary<string, string> { ["vi"] = "A", ["en"] = "" }, languages)));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckTitles(new Dictionary<string, string> { ["en"] = "A" }, languages)));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckTitles(new Dictionary<string, string> { ["vi"] = " " }, languages)));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckTitles(new Dictionary<string, string> { ["vi"] = "A", ["xx"] = "B" }, languages)));
        Assert.NotNull(Record.Exception(() => MenuRules.CheckTitles(new Dictionary<string, string> { ["vi"] = new string('a', 101) }, languages)));
    }

    [Theory]
    [InlineData(null, "admin", true)]
    [InlineData(null, "ADMIN", true)]
    [InlineData(null, "hai.tran", false)]
    [InlineData("boss", "boss", true)]
    [InlineData("boss", "admin", false)]
    public void SuperAdminIsOneConfiguredAccount(string? configured, string user, bool expected)
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection(
            configured is null ? [] : new Dictionary<string, string?> { ["Security:SuperAdmin"] = configured }).Build();
        Assert.Equal(expected, new ConfiguredSuperAdmin(settings).IsSuperAdminName(user));
    }
}
