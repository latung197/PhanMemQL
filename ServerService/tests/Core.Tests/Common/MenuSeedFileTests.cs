using System.Text.Json;
using Core.Application.Common.Permissions;
using Xunit;

namespace Core.Tests.Common;

/// <summary>Core/SeedData/menu.json is what puts a function into the sidebar, so it must follow FunctionCatalog.</summary>
public sealed class MenuSeedFileTests
{
    private static List<JsonElement> Modules()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "SeedData", "menu.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        return document.RootElement.EnumerateArray().Select(x => x.Clone()).ToList();
    }

    private static List<string> FunctionCodes(List<JsonElement> modules) =>
        modules.SelectMany(m => m.TryGetProperty("subGroups", out var groups) ? groups.EnumerateArray() : [])
            .SelectMany(g => g.GetProperty("items").EnumerateArray())
            .Select(i => i.GetProperty("subKey").GetString()!)
            .Concat(modules.Select(m => m.TryGetProperty("directSubKey", out var d) ? d.GetString() : null).OfType<string>())
            .ToList();

    [Fact]
    public void EveryMenuFunctionIsInTheFunctionCatalog()
    {
        var codes = FunctionCodes(Modules());
        Assert.All(codes, code => Assert.True(FunctionCatalog.IsFunction(code), code));
        Assert.Equal(codes.Count, codes.Distinct().Count());
    }

    [Fact]
    public void EveryFunctionOfTheCatalogHasAMenuEntry()
    {
        // A function without a node never shows in the sidebar; add it to menu.json (the seeder inserts it on start).
        var codes = FunctionCodes(Modules()).ToHashSet();
        Assert.All(FunctionCatalog.Functions.Keys, code => Assert.True(codes.Contains(code), code));
    }

    [Fact]
    public void NodeIdsAreUnique()
    {
        var modules = Modules();
        var ids = modules.Select(m => m.GetProperty("id").GetString()!)
            .Concat(modules.SelectMany(m => m.TryGetProperty("subGroups", out var g) ? g.EnumerateArray() : [])
                .SelectMany(g => new[] { g.GetProperty("id").GetString()! }
                    .Concat(g.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()!))))
            .ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());
    }
}
