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
    IPermissionService permissions, UserProfileBuilder profiles) : IAuthService
{
    private const string WrongCredentials = "Tên đăng nhập hoặc mật khẩu không đúng.";

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
            throw new AuthenticationFailedException("Tài khoản không được phép truy cập đơn vị cơ sở đã chọn.");
        return await IssueAsync(user, unitCode, ct);
    }

    public async Task<AuthResult> SwitchUnitAsync(int userId, string unitCode, CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        if (!await HasUnitAccessAsync(userId, unitCode, ct))
            throw new ForbiddenException("Tài khoản không được phép truy cập đơn vị cơ sở này.");
        return await IssueAsync(user, unitCode, ct);
    }

    public async Task<UserProfileDto> UpdateMyProfileAsync(int userId, string unitCode,
        UpdateMyProfileRequest request, CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        user.FullName = Guard.Required(request.FullName, 100, "họ tên");
        user.Email = Guard.Optional(request.Email, 150, "Email");
        user.Phone = Guard.Optional(request.Phone, 20, "Số điện thoại");
        user.Department = Guard.Optional(request.Department, 100, "Phòng ban") ?? string.Empty;
        user.Avatar = Guard.Optional(request.Avatar, 2000, "Ảnh đại diện") ?? string.Empty;
        user.ThemePref = request.ThemePref is "dark" ? "dark" : "light";
        user.NotificationsEnabled = request.NotificationsEnabled;
        if (user.Email is { } email && await db.Users.NotDeleted().AnyAsync(x => x.UserId != userId
                && x.Email != null && x.Email.ToLower() == email.ToLower(), ct))
            throw new BusinessRuleException("Email đã được dùng cho tài khoản khác.");
        await db.SaveChangesAsync(ct);
        return await profiles.BuildAsync(user, unitCode, ct);
    }

    public async Task<AuthResult> ChangePasswordAsync(int userId, string unitCode, ChangePasswordRequest request,
        CancellationToken ct)
    {
        var user = await FindActiveAsync(userId, ct);
        if (!passwords.Verify(user, request.CurrentPassword ?? string.Empty, out _))
            throw new BusinessRuleException("Mật khẩu hiện tại không đúng.");
        PasswordPolicy.Validate(request.NewPassword);
        user.PasswordHash = passwords.Hash(user, request.NewPassword);
        user.SecurityVersion++;
        await db.SaveChangesAsync(ct);
        return await IssueAsync(user, unitCode, ct);
    }

    public async Task<bool> HasUnitAccessAsync(int userId, string unitCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(unitCode)
            || !await db.CompanyUnits.AnyAsync(x => x.Code == unitCode && x.IsActive, ct))
            return false;
        return await permissions.IsAdminAsync(userId, ct)
            || await db.UserCompanyUnits.AnyAsync(x => x.UserId == userId && x.UnitCode == unitCode, ct);
    }

    private async Task<SysUser> FindActiveAsync(int userId, CancellationToken ct) =>
        await db.Users.ActiveUsers().FirstOrDefaultAsync(x => x.UserId == userId, ct)
        ?? throw new AuthenticationFailedException("Tài khoản không tồn tại hoặc đã bị khóa.");

    private async Task<AuthResult> IssueAsync(SysUser user, string unitCode, CancellationToken ct)
    {
        var token = tokens.Issue(user, unitCode);
        return new AuthResult(token.Token, token.ExpiresAtUtc, await profiles.BuildAsync(user, unitCode, ct));
    }
}
