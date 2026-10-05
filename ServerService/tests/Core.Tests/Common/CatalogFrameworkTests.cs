using System.Reflection;
using System.Runtime.CompilerServices;
using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Catalogs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// Guards the shared catalog framework: every catalog controller (CatalogControllerBase) names its function and every
/// endpoint declares the rights it needs; every catalog service (CatalogService) has the message texts its base class uses.
/// </summary>
public sealed class CatalogFrameworkTests
{
    private static bool Derives(Type type, Type genericBase)
    {
        for (var t = type.BaseType; t is not null; t = t.BaseType)
            if (t.IsGenericType && t.GetGenericTypeDefinition() == genericBase) return true;
        return false;
    }

    private static IEnumerable<Type> Concrete(Type genericBase) =>
        typeof(CatalogControllerBase<,>).Assembly.GetTypes().Concat(typeof(CatalogService<,,>).Assembly.GetTypes())
            .Where(t => t is { IsClass: true, IsAbstract: false } && Derives(t, genericBase));

    [Fact]
    public void EveryCatalogControllerNamesAnExistingFunctionAndARoute()
    {
        var controllers = Concrete(typeof(CatalogControllerBase<,>)).ToList();
        Assert.NotEmpty(controllers);
        foreach (var controller in controllers)
        {
            var function = controller.GetCustomAttribute<CatalogFunctionAttribute>()?.Function;
            Assert.True(function is not null, $"{controller.Name} needs [CatalogFunction(\"...\")].");
            Assert.True(FunctionCatalog.Functions.ContainsKey(function!), $"{controller.Name}: unknown function '{function}'.");
            Assert.True(controller.GetCustomAttribute<RouteAttribute>() is not null, $"{controller.Name} needs [Route(\"api/...\")].");
        }
    }

    [Fact]
    public void EveryEndpointOfTheBaseControllerNeedsARight()
    {
        var endpoints = typeof(CatalogControllerBase<,>).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any()).ToList();
        Assert.Equal(7, endpoints.Count);
        Assert.All(endpoints, m => Assert.True(m.GetCustomAttributes<CatalogRightAttribute>().Any(), $"{m.Name} has no [CatalogRight]."));
        // Export hands out all the data: it needs both viewing and exporting.
        var export = endpoints.Single(m => m.Name == "Export").GetCustomAttributes<CatalogRightAttribute>().Select(a => a.Action).ToHashSet();
        Assert.Equal(new HashSet<PermissionAction> { PermissionAction.View, PermissionAction.Export }, export);
    }

    [Fact]
    public void RightsAreAllRequiredNotAny()
    {
        var matrix = new Dictionary<string, ActionPermissions>
        {
            ["inv_uom_cat"] = ActionPermissions.None with { View = true }
        };
        Assert.True(CatalogPermissionFilter.Allows(matrix, "inv_uom_cat", [PermissionAction.View]));
        Assert.False(CatalogPermissionFilter.Allows(matrix, "inv_uom_cat", [PermissionAction.View, PermissionAction.Export]));
        Assert.False(CatalogPermissionFilter.Allows(matrix, "other", [PermissionAction.View]));
    }

    [Fact]
    public void EveryCatalogServiceHasItsMessageTexts()
    {
        var services = Concrete(typeof(CatalogService<,,>)).ToList();
        Assert.NotEmpty(services);
        foreach (var service in services)
        {
            // Spec is a static value, so an instance without running the constructor is enough to read it.
            var instance = RuntimeHelpers.GetUninitializedObject(service);
            var spec = (CatalogSpec)service.GetProperty("Spec", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(instance)!;
            Assert.True(FunctionCatalog.Functions.ContainsKey(spec.Function), $"{service.Name}: unknown function '{spec.Function}'.");
            foreach (var key in new[] { $"{spec.ObjectType}.notFound", $"{spec.ObjectType}.codeExists", $"export.{spec.ObjectType}.sheet", spec.CodeField })
                foreach (var language in new[] { "vi", "en" })
                    Assert.True(Messages.Find(language, key) is not null, $"{service.Name}: message '{key}' is missing in Messages.{language}.json.");
        }
    }
}
