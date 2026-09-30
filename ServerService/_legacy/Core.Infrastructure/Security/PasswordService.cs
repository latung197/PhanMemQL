using System.Security.Cryptography;
using System.Text;
using Core.Application.Security;
using Core.Domain.Entity.SystemEntities;
using Core.Utils;
using Microsoft.AspNetCore.Identity;

namespace Core.Infrastructure.Security;

public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<SysUser> _hasher = new();

    public string Hash(SysUser user, string password) => _hasher.HashPassword(user, password);

    public bool Verify(SysUser user, string password, out bool needsUpgrade)
    {
        needsUpgrade = false;
        if (string.IsNullOrEmpty(user.PasswordHash)) return false;
        if (user.PasswordHash.StartsWith("AQAAAA", StringComparison.Ordinal))
        {
            var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
            needsUpgrade = result == PasswordVerificationResult.SuccessRehashNeeded;
            return result != PasswordVerificationResult.Failed;
        }

        var expected = Encoding.UTF8.GetBytes(user.PasswordHash);
        var actual = Encoding.UTF8.GetBytes(StringUtils.Encrypt(password));
        var valid = expected.Length == actual.Length && CryptographicOperations.FixedTimeEquals(expected, actual);
        needsUpgrade = valid;
        return valid;
    }
}
