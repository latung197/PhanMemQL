using System.Reflection;
using System.Security.Claims;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Core.Modules.Inventory;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Xunit;

namespace Core.Tests.Common;

/// <summary>The rights check of catalog controllers, run on the real endpoints of the UOM controller with a given rights matrix.</summary>
public sealed class CatalogPermissionFilterTests
{
    /// <summary>IPermissionService that only answers GetEffectiveAsync, from a fixed matrix.</summary>
    public class FixedMatrix : DispatchProxy
    {
        public IReadOnlyDictionary<string, ActionPermissions> Matrix { get; set; } = new Dictionary<string, ActionPermissions>();

        protected override object? Invoke(MethodInfo? method, object?[]? args) =>
            method!.Name == nameof(IPermissionService.GetEffectiveAsync)
                ? Task.FromResult(Matrix)
                : throw new NotSupportedException(method.Name);
    }

    private static async Task<IActionResult?> Run(string endpoint, ActionPermissions granted, bool signedIn = true)
    {
        var proxy = DispatchProxy.Create<IPermissionService, FixedMatrix>();
        ((FixedMatrix)(object)proxy).Matrix = new Dictionary<string, ActionPermissions> { ["inv_uom_cat"] = granted };
        var descriptor = new ControllerActionDescriptor
        {
            ControllerTypeInfo = typeof(UomsController).GetTypeInfo(),
            MethodInfo = typeof(CatalogControllerBase<UomDto, SaveUomRequest>).GetMethod(endpoint)!
        };
        var http = new DefaultHttpContext
        {
            User = signedIn ? new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "7")], "test")) : new ClaimsPrincipal()
        };
        var context = new AuthorizationFilterContext(new ActionContext(http, new RouteData(), descriptor), []);
        await new CatalogPermissionFilter(proxy).OnAuthorizationAsync(context);
        return context.Result;
    }

    private static ActionPermissions Only(PermissionAction action) => ActionPermissions.None with
    {
        View = action == PermissionAction.View, Create = action == PermissionAction.Create, Edit = action == PermissionAction.Edit,
        Delete = action == PermissionAction.Delete, Export = action == PermissionAction.Export
    };

    [Theory]
    [InlineData("List", PermissionAction.View)]
    [InlineData("Create", PermissionAction.Create)]
    [InlineData("Update", PermissionAction.Edit)]
    [InlineData("Delete", PermissionAction.Delete)]
    [InlineData("DeleteMany", PermissionAction.Delete)]
    [InlineData("Import", PermissionAction.Create)]
    public async Task AnEndpointNeedsItsOwnAction(string endpoint, PermissionAction needed)
    {
        Assert.Null(await Run(endpoint, Only(needed)));
        foreach (var other in Enum.GetValues<PermissionAction>().Where(a => a != needed))
            Assert.Equal(403, ((ObjectResult)(await Run(endpoint, Only(other)))!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await Run(endpoint, ActionPermissions.None))!).StatusCode);
    }

    [Fact]
    public async Task ExportNeedsViewAndExport()
    {
        Assert.Null(await Run("Export", ActionPermissions.None with { View = true, Export = true }));
        Assert.Equal(403, ((ObjectResult)(await Run("Export", Only(PermissionAction.Export)))!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await Run("Export", Only(PermissionAction.View)))!).StatusCode);
    }

    [Fact]
    public async Task AnonymousRequestsAreLeftToTheControllersAuthorizeAttribute() =>
        Assert.Null(await Run("List", ActionPermissions.None, signedIn: false));
}
