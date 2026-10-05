using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// Searches must ignore accents (users type "thung" for "Thùng"), so queries use SearchFunctions.Matches (SQL function
/// sys_search_match, unaccent + ILIKE) and never EF.Functions.ILike directly. This fails when someone writes a plain
/// ILike in the infrastructure project, so a new catalog cannot lose accent-insensitive search by accident.
/// </summary>
public sealed class AccentInsensitiveSearchContractTests
{
    private static string ServerServiceRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "Core.sln"))) return dir.FullName;
        throw new InvalidOperationException("Core.sln not found above " + AppContext.BaseDirectory);
    }

    [Fact]
    public void QueriesUseSearchFunctionsMatchesNotILike()
    {
        var offenders = Directory.EnumerateFiles(Path.Combine(ServerServiceRoot(), "Core.Infrastructure"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains(Path.DirectorySeparatorChar + "obj" + Path.DirectorySeparatorChar)
                && !f.Contains(Path.DirectorySeparatorChar + "bin" + Path.DirectorySeparatorChar))
            .Where(f => File.ReadAllText(f).Replace("///", "").Split('\n')
                .Any(line => line.Contains("EF.Functions.ILike(") && !line.TrimStart().StartsWith("//")))
            .Select(Path.GetFileName).ToList();
        Assert.True(offenders.Count == 0, "Use SearchFunctions.Matches(column, pattern) so the search ignores accents; plain ILike in: "
            + string.Join(", ", offenders));
    }

    [Fact]
    public void TheSqlFunctionsExistInTheHelpersScript()
    {
        var script = File.ReadAllText(Path.Combine(ServerServiceRoot(), "sql", "postgresql", "00-helpers.sql"));
        Assert.Contains("CREATE EXTENSION IF NOT EXISTS unaccent", script);
        Assert.Contains("FUNCTION sys_unaccent(", script);
        Assert.Contains("FUNCTION sys_search_match(", script);
    }
}
