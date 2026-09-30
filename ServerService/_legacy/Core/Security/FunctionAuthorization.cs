using System.Security.Claims;
using Core.Application.Security;
using Microsoft.AspNetCore.Authorization;

namespace Core.Security;

public sealed class AdminRequirement : IAuthorizationRequirement;

public sealed class AdminAuthorizationHandler(IAccessControlService access) :
    AuthorizationHandler<AdminRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        AdminRequirement requirement)
    {
        if (int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
            && await access.IsAdminAsync(userId)) context.Succeed(requirement);
    }
}
