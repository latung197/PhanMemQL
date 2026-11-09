using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Security;
using Core.Application.Common.Validation;
using Core.Application.Modules.Auth;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Auth;

/// <summary>
/// Sign-in, unit switch and the user's own account. Every sign-in attempt is written to the login history; a user name with too many wrong
/// passwords in a short time has to wait (accounts are never locked); a password set by someone else or too old must be changed first
/// (the token then only allows that); each token is a session whose idle time is watched (SessionActivity).
/// </summary>
public sealed class AuthService(CoreContext db, IPasswordService passwords, ITokenService tokens,
    IPermissionService permissions, UserProfileBuilder profiles, UserAccessAudit audit, ISecurityPolicyService policies,
    ILoginHistoryService history, SessionActivity sessions) : IAuthService
{
    private const string WrongCredentials = "auth.wrongCredentials";

    // Verified when the username does not exist, so both failures take about the same time.
    private static readonly SysUser TimingDummy = new()
    {
        PasswordHash = new Microsoft.AspNetCore.Identity.PasswordHasher<SysUser>()
            .HashPassword(new SysUser(), Guid.NewGuid().ToString())
    };

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var username = request.Username?.Trim().ToLowerInvariant() ?? string.Empty;
        var unitCode = request.UnitCode?.Trim() ?? string.Empty;
        var policy = await policies.GetAsync(ct);
        // Too many wrong passwords for this name lately: wait, without even checking the password (no guessing meanwhile).
        if (username.Length > 0)
        {
            var failures = await history.FailuresSinceLastSuccessAsync(username, TimeSpan.FromMinutes(policy.LoginFailureWindowMinutes), ct);
            var wait = policy.BlockedMinutes(failures, DateTime.UtcNow);
            if (wait > 0)
            {
                await history.RecordAsync(username, null, unitCode, LoginResults.Blocked, ct);
                throw new AuthenticationFailedException("auth.tooManyFailures", wait);
            }
        }
        var user = username.Length == 0 ? null
            : await db.Users.ActiveUsers().FirstOrDefaultAsync(x => x.UserName.ToLower() == username, ct);
        if (user is null)
        {
            passwords.Verify(TimingDummy, request.Password ?? string.Empty, out _);
            if (username.Length > 0) await history.RecordAsync(username, null, unitCode, LoginResults.UnknownUser, ct);
            throw new AuthenticationFailedException(WrongCredentials);
        }
        if (!passwords.Verify(user, request.Password ?? string.Empty, out var needsUpgrade))
        {
            await history.RecordAsync(username, user.UserId, unitCode, LoginResults.WrongPassword, ct);
            throw new AuthenticationFailedException(WrongCredentials);
        }
        if (needsUpgrade)
        {
            user.PasswordHash = passwords.Hash(user, request.Password!);
            await db.SaveChangesAsync(ct);
        }

        if (!await HasUnitAccessAsync(user.UserId, unitCode, ct))
        {
            await history.RecordAsync(username, user.UserId, unitCode, LoginResults.UnitDenied, ct);
            throw new AuthenticationFailedException("auth.selectedUnitDenied");
        }
        await history.RecordAsync(username, user.UserId, unitCode, LoginResults.Success, ct);
        return await IssueAsync(user, unitCode, ct);
    }

    public async Task LogoutAsync(int userId, string unitCode, string sessionId, CancellationToken ct)
    {
        var name = await db.Users.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.UserName).FirstOrDefaultAsync(ct);
        if (name is not null) await history.RecordAsync(name, userId, unitCode, LoginResults.Logout, ct);
        sessions.End(sessionId);
    }

    public void Touch(string sessionId) => sessions.Touch(sessionId);

    public async Task<PasswordRulesDto> GetPasswordRulesAsync(CancellationToken ct)
    {
        var p = await policies.GetAsync(ct);
        return new PasswordRulesDto(p.PasswordMinLength, p.PasswordRequireLetter, p.PasswordRequireDigit, p.PasswordRequireUpper,
            p.PasswordRequireSpecial, p.PasswordHistory, p.IdleTimeoutMinutes);
    }

    public async Task<AuthResult> SwitchUnitAsync(int userId, string unitCode, CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        if (!await HasUnitAccessAsync(userId, unitCode, ct))
            throw new ForbiddenException("auth.unitDenied");
        return await IssueAsync(user, unitCode, ct);
    }

    public async Task<UserProfileDto> UpdateMyProfileAsync(int userId, string unitCode,
        UpdateMyProfileRequest request, CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        user.FullName = Guard.Required(request.FullName, 100, "field.fullName");
        user.Email = Guard.Optional(request.Email, 150, "field.email");
        user.Phone = Guard.Optional(request.Phone, 20, "field.phone");
        user.Avatar = Guard.Optional(request.Avatar, 2000, "field.avatar") ?? string.Empty;
        user.ThemePref = request.ThemePref is "dark" ? "dark" : "light";
        user.NotificationsEnabled = request.NotificationsEnabled;
        if (user.Email is { } email && await db.Users.NotDeleted().AnyAsync(x => x.UserId != userId
                && x.Email != null && x.Email.ToLower() == email.ToLower(), ct))
            throw new BusinessRuleException("users.emailTaken");
        await db.SaveChangesAsync(ct);
        return await profiles.BuildAsync(user, unitCode, ct);
    }

    public async Task<AuthResult> ChangePasswordAsync(int userId, string unitCode, ChangePasswordRequest request,
        CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        if (!passwords.Verify(user, request.CurrentPassword ?? string.Empty, out _))
            throw new BusinessRuleException("auth.wrongCurrentPassword");
        await policies.EnsureNewPasswordAsync(user, request.NewPassword, ct);
        await policies.SetPasswordAsync(user, request.NewPassword, mustChange: false, ct);
        user.SecurityVersion++;
        await audit.RecordActionAsync(user, AuditActions.ChangePassword, ct);
        await db.SaveChangesAsync(ct);
        return await IssueAsync(user, unitCode, ct);
    }

    public async Task<UserProfileDto> SetMyLanguageAsync(int userId, string unitCode, string? language, CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        var code = string.IsNullOrWhiteSpace(language) ? null : language.Trim().ToLowerInvariant();
        if (code is not null && !await db.Languages.AnyAsync(x => x.Code == code && x.IsActive, ct))
            throw new BusinessRuleException("language.notAvailable");
        user.Language = code;
        await db.SaveChangesAsync(ct);
        return await profiles.BuildAsync(user, unitCode, ct);
    }

    public Task<bool> HasUnitAccessAsync(int userId, string unitCode, CancellationToken ct) =>
        permissions.HasUnitAccessAsync(userId, unitCode, ct);

    private async Task<SysUser> FindActiveAsync(int userId, CancellationToken ct) =>
        await db.Users.ActiveUsers().FirstOrDefaultAsync(x => x.UserId == userId, ct)
        ?? throw new AuthenticationFailedException("auth.accountUnavailable");

    /// <summary>A token for the unit; while the password must be changed (set by someone else, or too old) the token only allows that.</summary>
    private async Task<AuthResult> IssueAsync(SysUser user, string unitCode, CancellationToken ct)
    {
        var policy = await policies.GetAsync(ct);
        var expired = policy.IsPasswordExpired(user.PasswordChangedAt, DateTime.UtcNow);
        var mustChange = user.MustChangePassword || expired;
        var token = tokens.Issue(user, unitCode, mustChange);
        sessions.Touch(token.SessionId);
        return new AuthResult(token.Token, token.ExpiresAtUtc, await profiles.BuildAsync(user, unitCode, ct), mustChange, expired && !user.MustChangePassword);
    }
}
