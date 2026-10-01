using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Security;

public static class ErpClaimTypes
{
    public const string UserName = "username";
    public const string UnitCode = "erp_unit";
    public const string SecurityVersion = "erp_security_version";
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

public sealed record IssuedToken(string Token, DateTime ExpiresAtUtc);

public interface ITokenService
{
    IssuedToken Issue(SysUser user, string unitCode);
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
