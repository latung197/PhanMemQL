using System.Text.Json;
using Core.Application.Common.Permissions;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Seeding;
using Xunit;

namespace Core.Tests.Common;

/// <summary>Checks Core/SeedData/seed.json (exported from the frontend mocks) against the backend rules.</summary>
public sealed class SeedDataFileTests
{
    private static SeedDataFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "SeedData", "seed.json");
        return JsonSerializer.Deserialize<SeedDataFile>(File.ReadAllText(path),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    }

    [Fact]
    public void ContainsTheFrontendMockRecords()
    {
        var seed = Load();
        Assert.NotEmpty(seed.CompanyUnits);
        Assert.Contains(seed.Roles, x => x.Code == SysRole.AdminCode);
        Assert.Contains(seed.Users, x => x.IsSystemAdmin);
        Assert.All(seed.Users, user => Assert.True(user.RoleId is null || seed.Roles.Any(r => r.Id == user.RoleId)));
    }

    [Fact]
    public void PermissionCodesAreKnownFunctions()
    {
        var seed = Load();
        var codes = seed.Roles.SelectMany(x => x.Permissions?.Keys ?? Enumerable.Empty<string>())
            .Concat(seed.Users.SelectMany(x => x.Permissions?.Keys ?? Enumerable.Empty<string>()));
        Assert.All(codes, code => Assert.True(FunctionCatalog.IsFunction(code), code));
    }

    [Fact]
    public void SystemConfigSectionsAreValid()
    {
        var seed = Load();
        Assert.Equal(SystemConfigSections.Keys.Count, seed.SystemConfig.Count);
        foreach (var (section, value) in seed.SystemConfig) SystemConfigSections.Validate(section, value);
    }
}
