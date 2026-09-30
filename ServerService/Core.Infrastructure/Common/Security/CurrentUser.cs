using System.Security.Claims;
using Core.Application.Common.Security;
using Microsoft.AspNetCore.Http;

namespace Core.Infrastructure.Common.Security;

/// <summary>Reads the signed-in user from the JWT claims of the current HTTP request.</summary>
public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true
        && int.TryParse(Principal.FindFirstValue(ClaimTypes.NameIdentifier), out _);

    public int UserId => int.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    public string UnitCode => Principal?.FindFirstValue(ErpClaimTypes.UnitCode) ?? string.Empty;
}
