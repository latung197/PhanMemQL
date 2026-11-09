using Core.Application.Modules.Users;

namespace Core.Application.Modules.Auth;

public sealed record LoginRequest(string Username, string Password, string UnitCode);
public sealed record SwitchUnitRequest(string UnitCode);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
/// <summary>The department is not here: it drives approval rules, so only user managers change it.</summary>
public sealed record UpdateMyProfileRequest(string FullName, string? Email, string? Phone,
    string? Avatar, string? ThemePref, bool NotificationsEnabled);

/// <summary>Null = follow the default language of the company.</summary>
public sealed record SetMyLanguageRequest(string? Language);

/// <param name="MustChangePassword">The password was set by someone else or is too old: the screens only offer changing it, and the API
/// refuses everything else until then. <paramref name="PasswordExpired"/> tells which.</param>
public sealed record AuthResult(string Token, DateTime ExpiresAt, UserProfileDto User, bool MustChangePassword = false, bool PasswordExpired = false);

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<AuthResult> SwitchUnitAsync(int userId, string unitCode, CancellationToken ct);
    Task<UserProfileDto> UpdateMyProfileAsync(int userId, string unitCode, UpdateMyProfileRequest request,
        CancellationToken ct);

    /// <summary>Changes the password and returns a new token (older tokens stop working).</summary>
    Task<AuthResult> ChangePasswordAsync(int userId, string unitCode, ChangePasswordRequest request,
        CancellationToken ct);

    Task<bool> HasUnitAccessAsync(int userId, string unitCode, CancellationToken ct);

    /// <summary>Saves the signed-in user's own language (must be active; null = the company default).</summary>
    Task<UserProfileDto> SetMyLanguageAsync(int userId, string unitCode, string? language, CancellationToken ct);

    /// <summary>Signs out: logs it and ends the session of the token.</summary>
    Task LogoutAsync(int userId, string unitCode, string sessionId, CancellationToken ct);

    /// <summary>The user works in the session (heartbeat of the browser): restarts its idle time.</summary>
    void Touch(string sessionId);

    Task<PasswordRulesDto> GetPasswordRulesAsync(CancellationToken ct);
}

/// <summary>One row of the login history (time in UTC).</summary>
public sealed record LoginHistoryDto(long Id, DateTime Time, string UserName, string? FullName, string? UnitCode, string? IpAddress,
    string? UserAgent, string Result);

/// <summary>Login history page: ?search= (user name, address)&amp;result=WRONG_PASSWORD&amp;from=&amp;to= (local days).</summary>
public sealed record LoginHistoryQuery(int Page = 1, int PageSize = 50, string? Sort = null, string? Dir = null, string? Search = null,
    string? Result = null, DateOnly? From = null, DateOnly? To = null) : Core.Application.Common.Paging.IPagedQuery;

public interface ILoginHistoryService
{
    Task RecordAsync(string userName, int? userId, string? unitCode, string result, CancellationToken ct);
    /// <summary>Times of the wrong passwords of a user name inside the window and after its last successful sign-in.</summary>
    Task<IReadOnlyList<DateTime>> FailuresSinceLastSuccessAsync(string userName, TimeSpan window, CancellationToken ct);
    Task<Core.Application.Common.Paging.PagedResult<LoginHistoryDto>> QueryAsync(int actorUserId, LoginHistoryQuery query, CancellationToken ct);
}

/// <summary>What the screens need of the security policy (password rules for the hints, idle time for the auto sign-out).</summary>
public sealed record PasswordRulesDto(int MinLength, bool RequireLetter, bool RequireDigit, bool RequireUpper, bool RequireSpecial,
    int History, int IdleTimeoutMinutes);
