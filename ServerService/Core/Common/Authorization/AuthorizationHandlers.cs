using Core.Application.Modules.Auth;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Core.Common.Authorization;

public sealed class UnitAccessRequirement : IAuthorizationRequirement;

public sealed class AdminRequirement : IAuthorizationRequirement;

public sealed record PermissionRequirement(string Function, PermissionAction Action) : IAuthorizationRequirement;

public sealed record SpecialRightRequirement(string Function, string RightCode) : IAuthorizationRequirement;

public sealed class UnitAccessHandler(IAuthService auth) : AuthorizationHandler<UnitAccessRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        UnitAccessRequirement requirement)
    {
        var userId = context.User.GetUserId();
        if (userId > 0 && await auth.HasUnitAccessAsync(userId, context.User.GetUnitCode(), CancellationToken.None))
            context.Succeed(requirement);
    }
}

public sealed class AdminHandler(IPermissionService permissions) : AuthorizationHandler<AdminRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        AdminRequirement requirement)
    {
        var userId = context.User.GetUserId();
        if (userId > 0 && await permissions.IsAdminAsync(userId)) context.Succeed(requirement);
    }
}

public sealed class PermissionHandler(IPermissionService permissions) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var userId = context.User.GetUserId();
        if (userId <= 0) return;
        var matrix = await permissions.GetEffectiveAsync(userId);
        if (matrix.TryGetValue(requirement.Function, out var actions) && actions.Allows(requirement.Action))
            context.Succeed(requirement);
    }
}

public sealed class SpecialRightHandler(IPermissionService permissions) : AuthorizationHandler<SpecialRightRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        SpecialRightRequirement requirement)
    {
        var userId = context.User.GetUserId();
        if (userId > 0 && await permissions.HasRightAsync(userId, requirement.Function, requirement.RightCode))
            context.Succeed(requirement);
    }
}

/// <summary>Protects an endpoint with a special right, e.g. [RequireRight("inv_receipt", SpecialRightCatalog.EditApproved)].</summary>
public sealed class RequireRightAttribute(string function, string rightCode)
    : AuthorizeAttribute($"{Policies.RightPrefix}{function}:{rightCode}");

/// <summary>Protects an endpoint with a frontend function right, e.g. [RequirePermission("sys_users", PermissionAction.Delete)].</summary>
public sealed class RequirePermissionAttribute(string function, PermissionAction action)
    : AuthorizeAttribute($"{Policies.PermissionPrefix}{function}:{action}");

/// <summary>Creates the "perm:{function}:{action}" policies on demand.</summary>
public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(Policies.RightPrefix, StringComparison.Ordinal))
        {
            var right = policyName[Policies.RightPrefix.Length..].Split(':');
            return right.Length != 2 ? null : new AuthorizationPolicyBuilder().RequireAuthenticatedUser()
                .AddRequirements(new UnitAccessRequirement(), new SpecialRightRequirement(right[0], right[1])).Build();
        }
        if (!policyName.StartsWith(Policies.PermissionPrefix, StringComparison.Ordinal))
            return await base.GetPolicyAsync(policyName);
        var parts = policyName[Policies.PermissionPrefix.Length..].Split(':');
        if (parts.Length != 2 || !Enum.TryParse<PermissionAction>(parts[1], out var action)) return null;
        return new AuthorizationPolicyBuilder().RequireAuthenticatedUser()
            .AddRequirements(new UnitAccessRequirement(), new PermissionRequirement(parts[0], action)).Build();
    }
}
