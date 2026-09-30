using Core.Application.Modules.Users;

namespace Core.Application.Modules.Auth;

public sealed record LoginRequest(string Username, string Password, string UnitCode);
public sealed record SwitchUnitRequest(string UnitCode);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UpdateMyProfileRequest(string FullName, string? Email, string? Phone,
    string? Department, string? Avatar, string? ThemePref, bool NotificationsEnabled);

public sealed record AuthResult(string Token, DateTime ExpiresAt, UserProfileDto User);

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
}
