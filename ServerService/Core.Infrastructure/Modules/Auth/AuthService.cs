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

public sealed class AuthService(CoreContext db, IPasswordService passwords, ITokenService tokens,
    IPermissionService permissions, UserProfileBuilder profiles, UserAccessAudit audit) : IAuthService
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
        var user = username.Length == 0 ? null
            : await db.Users.ActiveUsers().FirstOrDefaultAsync(x => x.UserName.ToLower() == username, ct);
        if (user is null)
        {
            passwords.Verify(TimingDummy, request.Password ?? string.Empty, out _);
            throw new AuthenticationFailedException(WrongCredentials);
        }
        if (!passwords.Verify(user, request.Password ?? string.Empty, out var needsUpgrade))
            throw new AuthenticationFailedException(WrongCredentials);
        if (needsUpgrade)
        {
            user.PasswordHash = passwords.Hash(user, request.Password!);
            await db.SaveChangesAsync(ct);
        }

        var unitCode = request.UnitCode?.Trim() ?? string.Empty;
        if (!await HasUnitAccessAsync(user.UserId, unitCode, ct))
            throw new AuthenticationFailedException("auth.selectedUnitDenied");
        return await IssueAsync(user, unitCode, ct);
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
        PasswordPolicy.Validate(request.NewPassword);
        user.PasswordHash = passwords.Hash(user, request.NewPassword);
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

    private async Task<AuthResult> IssueAsync(SysUser user, string unitCode, CancellationToken ct)
    {
        var token = tokens.Issue(user, unitCode);
        return new AuthResult(token.Token, token.ExpiresAtUtc, await profiles.BuildAsync(user, unitCode, ct));
    }
}
