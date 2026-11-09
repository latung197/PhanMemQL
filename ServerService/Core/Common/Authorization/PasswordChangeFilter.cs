using Core.Application.Common.Localization;
using Core.Application.Common.Security;
using Core.Common.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Core.Common.Authorization;

/// <summary>Endpoints a user may still call while their password must be changed (read the own profile, change the password, sign out...).</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AllowWhilePasswordChangeAttribute : Attribute;

/// <summary>
/// While the token says the password must be changed (claim erp_pwd_change, set at sign-in when the password was set by someone else or is
/// too old), every API except the ones marked <see cref="AllowWhilePasswordChangeAttribute"/> is refused with 403
/// "auth.passwordChangeRequired". Changing the password issues a new token without the claim.
/// </summary>
public sealed class PasswordChangeFilter : IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User.FindFirst(ErpClaimTypes.PasswordChange)?.Value != "1") return;
        var metadata = context.ActionDescriptor.EndpointMetadata;
        if (metadata.Any(x => x is AllowWhilePasswordChangeAttribute or IAllowAnonymous)) return;
        context.Result = ErrorResponse.Create(StatusCodes.Status403Forbidden, Messages.T("auth.passwordChangeRequired"));
    }
}
