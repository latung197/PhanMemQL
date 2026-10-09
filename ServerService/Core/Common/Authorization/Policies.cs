using System.Security.Claims;
using Core.Application.Common.Security;

namespace Core.Common.Authorization;

public static class Policies
{
    /// <summary>Signed in, and the token's company unit is active and allowed. Default for controllers.</summary>
    public const string UnitAccess = "UnitAccess";

    /// <summary>Administrator only (ADMIN role or legacy flag).</summary>
    public const string Admin = "Admin";

    /// <summary>The one configured super administrator (Security:SuperAdmin) who is also an ADMIN.</summary>
    public const string SuperAdmin = "SuperAdmin";

    /// <summary>Prefix of the dynamic policies created by <see cref="RequirePermissionAttribute"/>.</summary>
    public const string PermissionPrefix = "perm:";

    /// <summary>Prefix of the dynamic policies created by <see cref="RequireRightAttribute"/>.</summary>
    public const string RightPrefix = "right:";
}

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    public static string GetUnitCode(this ClaimsPrincipal user) =>
        user.FindFirstValue(ErpClaimTypes.UnitCode) ?? string.Empty;
}
