using System.Security.Claims;
using Core.Application.Features.Erp.Auth;
using Microsoft.AspNetCore.Authorization;

namespace Core.Features.Erp;

public sealed class ErpContextRequirement : IAuthorizationRequirement;

public sealed class ErpContextAuthorizationHandler(IErpAuthService auth)
    : AuthorizationHandler<ErpContextRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        ErpContextRequirement requirement)
    {
        if (ErpClaims.TryGet(context.User, out var userId, out var unitCode, out var plantCode)
            && await auth.HasActiveContextAsync(userId, unitCode, plantCode,
                (context.Resource as HttpContext)?.RequestAborted ?? default))
            context.Succeed(requirement);
    }
}

public static class ErpClaims
{
    public static bool TryGet(ClaimsPrincipal principal, out int userId,
        out string unitCode, out string plantCode)
    {
        unitCode = principal.FindFirstValue(ErpClaimTypes.UnitCode) ?? string.Empty;
        plantCode = principal.FindFirstValue(ErpClaimTypes.PlantCode) ?? string.Empty;
        return int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId)
            && !string.IsNullOrWhiteSpace(unitCode);
    }
}
