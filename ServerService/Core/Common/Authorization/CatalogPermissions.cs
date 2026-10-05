using System.Reflection;
using Core.Application.Modules.Users;
using Core.Common.Errors;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Core.Application.Common.Localization;

namespace Core.Common.Authorization;

/// <summary>The function code (inv_uom_cat) whose rights guard every endpoint of a catalog controller (CatalogControllerBase).</summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class CatalogFunctionAttribute(string function) : Attribute
{
    public string Function { get; } = function;
}

/// <summary>An action of the catalog's function that an endpoint needs; several mean all of them (export needs View and Export).</summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
public sealed class CatalogRightAttribute(PermissionAction action) : Attribute
{
    public PermissionAction Action { get; } = action;
}

/// <summary>
/// The rights check of catalog controllers: the same as <c>[RequirePermission(function, action)]</c> but with the function
/// taken from the controller's <see cref="CatalogFunctionAttribute"/> and the actions from each endpoint's
/// <see cref="CatalogRightAttribute"/>, so the endpoints can be written once in CatalogControllerBase.
/// </summary>
public sealed class CatalogPermissionFilter(IPermissionService permissions) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // Not signed in: the controller's [Authorize] answers (401).
        if (context.HttpContext.User.Identity?.IsAuthenticated != true) return;
        if (context.ActionDescriptor is not ControllerActionDescriptor action) return;

        var function = action.ControllerTypeInfo.GetCustomAttribute<CatalogFunctionAttribute>()?.Function;
        var required = action.MethodInfo.GetCustomAttributes<CatalogRightAttribute>().Select(a => a.Action).ToList();
        // A catalog endpoint without a declared function or right is a coding mistake: refuse rather than leave it open.
        var allowed = function is not null && required.Count > 0
            && Allows(await permissions.GetEffectiveAsync(context.HttpContext.User.GetUserId(), context.HttpContext.RequestAborted),
                function, required);
        if (!allowed) context.Result = ErrorResponse.Create(StatusCodes.Status403Forbidden, Messages.T("permission.denied"));
    }

    /// <summary>True when the matrix gives every one of the actions on the function.</summary>
    public static bool Allows(IReadOnlyDictionary<string, ActionPermissions> matrix, string function, IEnumerable<PermissionAction> actions) =>
        matrix.TryGetValue(function, out var granted) && actions.All(granted.Allows);
}
