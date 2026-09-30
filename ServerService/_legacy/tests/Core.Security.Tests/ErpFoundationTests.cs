using System.Security.Claims;
using Core.Application.Features.Erp.Auth;
using Core.Application.Features.Erp.Menu;
using Core.Application.Features.Erp.Settings;
using Core.Application.Security;
using Core.Features.Erp;
using System.Text.Json;
using Xunit;

namespace Core.Security.Tests;

public sealed class ErpFoundationTests
{
    [Fact]
    public void MenuTreeBuilder_NestsAndSortsChildren()
    {
        var tree = MenuTreeBuilder.Build([
            new MenuNodeDto { Code = "ROOT", Text = "Root" },
            new MenuNodeDto { Code = "SECOND", ParentCode = "ROOT", SortOrder = 2 },
            new MenuNodeDto { Code = "FIRST", ParentCode = "ROOT", SortOrder = 1 }
        ]);

        Assert.Single(tree);
        Assert.Equal(["FIRST", "SECOND"], tree[0].Children.Select(x => x.Code));
    }

    [Fact]
    public void ErpClaims_RequireUnitButAllowOptionalPlant()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, "7"),
            new Claim(ErpClaimTypes.UnitCode, "DVCS01")
        ], "test"));
        Assert.True(ErpClaims.TryGet(user, out var unitUserId, out var unitOnly, out var noPlant));
        Assert.Equal(7, unitUserId);
        Assert.Equal("DVCS01", unitOnly);
        Assert.Empty(noPlant);

        user.AddIdentity(new ClaimsIdentity([new Claim(ErpClaimTypes.PlantCode, "PLANT01")]));
        Assert.True(ErpClaims.TryGet(user, out var userId, out var unit, out var plant));
        Assert.Equal(7, userId);
        Assert.Equal("DVCS01", unit);
        Assert.Equal("PLANT01", plant);
    }

    [Fact]
    public void Settings_PlantOverridesUnitAndGlobal()
    {
        SettingDto[] settings = [
            new("DATE_FORMAT", "global", "GLOBAL", true),
            new("DATE_FORMAT", "unit", "U:DVCS01", true),
            new("DATE_FORMAT", "plant", "P:PLANT01", true)
        ];
        var effective = SettingResolver.Resolve(settings, "DVCS01", "PLANT01");
        Assert.Equal("plant", Assert.Single(effective).Value);
    }

    [Fact]
    public void Settings_UnitOverridesGlobalWithoutPlant()
    {
        SettingDto[] settings = [
            new("DATE_FORMAT", "global", "GLOBAL", true),
            new("DATE_FORMAT", "unit", "U:DVCS01", true),
            new("DATE_FORMAT", "other", "P:PLANT01", true)
        ];
        Assert.Equal("unit", Assert.Single(SettingResolver.Resolve(settings, "DVCS01", null)).Value);
    }

    [Fact]
    public void FrontendPermissions_FitDatabaseKeyLength()
    {
        Assert.All(FrontendPermissionCatalog.Functions.Keys, code => Assert.InRange(code.Length, 1, 64));
        Assert.Contains("inv_uom_conversion_cat", FrontendPermissionCatalog.Functions.Keys);
        Assert.Contains("sys_users", FrontendPermissionCatalog.Functions.Keys);
    }

    [Fact]
    public void FrontendSystemConfig_RejectsInvalidShape()
    {
        using var missingFields = JsonDocument.Parse("{\"defaultWarehouse\":\"WH01\"}");
        Assert.Throws<ArgumentException>(() => FrontendSystemConfig.Validate(
            "systemDefaults", missingFields.RootElement));
        using var valid = JsonDocument.Parse("{\"defaultWarehouse\":\"WH01\",\"costingMethod\":\"FIFO\",\"defaultCurrency\":\"VND\",\"autoNumbering\":{}}");
        FrontendSystemConfig.Validate("systemDefaults", valid.RootElement);
    }
}
