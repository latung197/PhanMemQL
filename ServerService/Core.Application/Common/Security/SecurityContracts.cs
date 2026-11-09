using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Security;

public static class ErpClaimTypes
{
    public const string UserName = "username";
    public const string UnitCode = "erp_unit";
    public const string SecurityVersion = "erp_security_version";
    /// <summary>The session (one sign-in or unit switch): idle time is counted per session.</summary>
    public const string SessionId = "erp_sid";
    /// <summary>"1" while the password must be changed: every API but the few that change it is refused.</summary>
    public const string PasswordChange = "erp_pwd_change";
}

/// <summary>The signed-in user of the current request.</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    int UserId { get; }
    string UnitCode { get; }
}

public interface IPasswordService
{
    string Hash(SysUser user, string password);
    bool Verify(SysUser user, string password, out bool needsUpgrade);
}

public sealed record IssuedToken(string Token, DateTime ExpiresAtUtc, string SessionId);

public interface ITokenService
{
    /// <param name="mustChangePassword">Marks the token so that it only allows changing the password.</param>
    IssuedToken Issue(SysUser user, string unitCode, bool mustChangePassword = false);
}

public static class PasswordPolicy
{
    public const int MinLength = 8;

    public static void Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinLength)
            throw new BusinessRuleException("validation.passwordLength", MinLength);
    }
}
