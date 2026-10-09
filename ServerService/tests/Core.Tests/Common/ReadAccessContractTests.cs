using System.Reflection;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// The full data of a function (its GET endpoints) is for users who may view that function. Screens that only need to
/// pick a code use the lookups (GET /api/lookups/{name}: code, name and a few columns, paged), open to every signed-in
/// user. A function controller declares <c>private const string Function</c>; each of its GET actions needs
/// [RequirePermission(Function, PermissionAction.View)] (or another action of that function), unless listed below with
/// the reason and the plan.
/// </summary>
public sealed class ReadAccessContractTests
{
    private static readonly Dictionary<string, string> Exempt = new(StringComparer.Ordinal)
    {
        ["FiscalPeriodsController.GetYear"] = "Trạng thái khóa sổ hiện trên phiếu; chỉ đọc",
        ["FiscalPeriodsController.Check"] = "Mọi người lập phiếu cần biết ngày đã khóa sổ chưa",
        ["VoucherNumberingController.Preview"] = "Số phiếu dự kiến hiện khi lập phiếu",
    };

    private static IEnumerable<(Type Controller, string Function, MethodInfo Action)> FunctionGets() =>
        typeof(ApiControllerBase).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t))
            .Select(t => (t, Field: t.GetField("Function", BindingFlags.NonPublic | BindingFlags.Static)))
            .Where(x => x.Field is { IsLiteral: true })
            .SelectMany(x => x.t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes<HttpGetAttribute>().Any())
                .Select(m => (x.t, (string)x.Field!.GetRawConstantValue()!, m)));

    [Fact]
    public void FunctionDataNeedsTheViewRight()
    {
        var open = FunctionGets()
            .Where(x => !x.Action.GetCustomAttributes<AuthorizeAttribute>(true).Concat(x.Controller.GetCustomAttributes<AuthorizeAttribute>(true))
                .Any(a => a.Policy?.StartsWith($"perm:{x.Function}:", StringComparison.Ordinal) == true))
            .Select(x => $"{x.Controller.Name}.{x.Action.Name}")
            .Where(name => !Exempt.ContainsKey(name))
            .ToList();
        Assert.True(open.Count == 0,
            "GET without [RequirePermission(Function, PermissionAction.View)]: " + string.Join(", ", open)
            + ". Pickers on other screens use CatalogLookup (GET /api/lookups/{name}) instead.");
    }

    [Fact]
    public void ExemptionsStillExist()
    {
        var names = FunctionGets().Select(x => $"{x.Controller.Name}.{x.Action.Name}").ToHashSet(StringComparer.Ordinal);
        Assert.All(Exempt.Keys, key => Assert.Contains(key, names));
    }
}
