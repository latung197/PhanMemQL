using Core.Application.Modules.Auth;
using Core.Application.Modules.CompanyUnits;
using Core.Application.Modules.Languages;
using Core.Application.Modules.Users;
using Core.Common.Controllers;
using Core.Common.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Core.Modules.Auth;

/// <summary>Login screen (Frontend modules/auth) and the signed-in user's own account.</summary>
[Route("api/auth")]
public sealed class AuthController(IAuthService auth, IUserService users, ICompanyUnitService units)
    : ApiControllerBase
{
    /// <summary>Active company units for the unit picker on the login screen.</summary>
    [HttpGet("company-units"), AllowAnonymous]
    public async Task<IActionResult> LoginUnits(CancellationToken ct) =>
        Ok((await units.GetAllAsync(true, ct)).Select(x => new { x.Id, x.Code, Name = x.LocalizedName ?? x.Name,
            x.ShortName, x.IsDefault }));

    /// <summary>Active languages for the language picker, also on the login screen.</summary>
    [HttpGet("languages"), AllowAnonymous]
    public Task<IReadOnlyList<LanguageOptionDto>> Languages([FromServices] ILanguageService languages, CancellationToken ct) =>
        languages.GetActiveAsync(ct);

    [HttpPost("login"), AllowAnonymous, EnableRateLimiting(ApiServiceExtensions.LoginRateLimit)]
    public Task<AuthResult> Login(LoginRequest request, CancellationToken ct) => auth.LoginAsync(request, ct);

    [HttpGet("me")]
    public Task<UserProfileDto> Me(CancellationToken ct) => users.GetProfileAsync(CurrentUserId, CurrentUnitCode, ct);

    /// <summary>Changes the working company unit; returns a new token for it.</summary>
    [HttpPost("switch-unit")]
    public Task<AuthResult> SwitchUnit(SwitchUnitRequest request, CancellationToken ct) =>
        auth.SwitchUnitAsync(CurrentUserId, request.UnitCode, ct);

    [HttpPut("me/profile")]
    public Task<UserProfileDto> UpdateProfile(UpdateMyProfileRequest request, CancellationToken ct) =>
        auth.UpdateMyProfileAsync(CurrentUserId, CurrentUnitCode, request, ct);

    /// <summary>The user's own language (header picker); null = the default language of the company.</summary>
    [HttpPut("me/language")]
    public Task<UserProfileDto> SetLanguage(SetMyLanguageRequest request, CancellationToken ct) =>
        auth.SetMyLanguageAsync(CurrentUserId, CurrentUnitCode, request.Language, ct);

    [HttpPut("me/password"), EnableRateLimiting(ApiServiceExtensions.LoginRateLimit)]
    public Task<AuthResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct) =>
        auth.ChangePasswordAsync(CurrentUserId, CurrentUnitCode, request, ct);
}
