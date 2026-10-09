using System.Reflection;
using System.Text.RegularExpressions;
using Core.Application.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// Lost-update protection must not depend on remembering it (docs/chong-ghi-de.md): every UpdateAsync of a service
/// returns the record's version, takes the version the screen loaded, and checks it with db.ExpectVersion.
/// </summary>
public sealed partial class ConcurrencyContractTests
{
    /// <summary>Update methods that do not edit a single record loaded in a form; give the reason.</summary>
    private static readonly Dictionary<string, string> Exempt = new(StringComparer.Ordinal)
    {
    };

    private static IEnumerable<(Type Service, MethodInfo Method)> UpdateMethods() =>
        typeof(IUomService).Assembly.GetTypes()
            .Where(t => t.IsInterface && t.Name.EndsWith("Service", StringComparison.Ordinal))
            .SelectMany(t => t.GetMethods().Where(m => m.Name == "UpdateAsync").Select(m => (t, m)))
            .Where(x => !Exempt.ContainsKey($"{x.t.Name}.UpdateAsync"));

    [Fact]
    // Catalogs on CatalogService get the version check from the base class (UpdateAsync lives there), so only the services
    // written by hand are counted here; the number falls as catalogs move to the framework.
    public void ThereAreUpdateMethodsToCheck() => Assert.True(UpdateMethods().Count() >= 3);

    [Fact]
    public void UpdateRequestsCarryTheLoadedVersion()
    {
        foreach (var (service, method) in UpdateMethods())
        {
            var request = method.GetParameters().SingleOrDefault(p => p.ParameterType.Name.EndsWith("Request", StringComparison.Ordinal));
            Assert.True(request is not null, $"{service.Name}.UpdateAsync: no *Request parameter");
            var version = request!.ParameterType.GetProperty("Version");
            Assert.True(version?.PropertyType == typeof(uint?),
                $"{request.ParameterType.Name} needs `uint? Version = null` (last parameter), see docs/chong-ghi-de.md");
        }
    }

    [Fact]
    public void UpdateResultsReturnTheNewVersion()
    {
        foreach (var (service, method) in UpdateMethods())
        {
            var dto = method.ReturnType.GetGenericArguments().Single();
            Assert.True(dto.GetProperty("Version")?.PropertyType == typeof(uint),
                $"{dto.Name} (result of {service.Name}.UpdateAsync) needs `uint Version` filled from the entity, see docs/chong-ghi-de.md");
        }
    }

    [Fact]
    public void UpdateMethodsCheckTheVersion()
    {
        var root = AppContext.BaseDirectory;
        while (!File.Exists(Path.Combine(root, "Core.sln"))) root = Path.GetDirectoryName(root) ?? throw new InvalidOperationException("Core.sln not found");
        var implementations = typeof(CoreContext).Assembly.GetTypes().Where(t => t.IsClass && !t.IsAbstract).ToList();
        foreach (var (service, _) in UpdateMethods())
        {
            var implementation = implementations.Single(t => service.IsAssignableFrom(t));
            var file = Directory.EnumerateFiles(Path.Combine(root, "Core.Infrastructure"), $"{implementation.Name}.cs", SearchOption.AllDirectories)
                .Single(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"));
            var source = File.ReadAllText(file);
            var start = UpdateDeclaration().Match(source);
            Assert.True(start.Success, $"{implementation.Name}: UpdateAsync not found in {file}");
            // The method body: up to the next member declared at class level.
            var next = NextMember().Match(source, start.Index + start.Length);
            var body = source[start.Index..(next.Success ? next.Index : source.Length)];
            Assert.True(body.Contains("ExpectVersion(", StringComparison.Ordinal),
                $"{implementation.Name}.UpdateAsync must call db.ExpectVersion(entity, request.Version) after loading the record, see docs/chong-ghi-de.md");
        }
    }

    [GeneratedRegex(@"public async Task<[^>]+> UpdateAsync\(")]
    private static partial Regex UpdateDeclaration();

    [GeneratedRegex(@"\n    (public|private|internal|protected) ")]
    private static partial Regex NextMember();
}
