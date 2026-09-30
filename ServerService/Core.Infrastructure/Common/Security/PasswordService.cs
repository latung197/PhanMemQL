using System.Security.Cryptography;
using System.Text;
using Core.Application.Common.Security;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Identity;

namespace Core.Infrastructure.Common.Security;

/// <summary>ASP.NET Core Identity hashing, with verification of legacy encrypted passwords.</summary>
public sealed class PasswordService : IPasswordService
{
    private const string IdentityHashPrefix = "AQAAAA";
    private readonly PasswordHasher<SysUser> _hasher = new();

    public string Hash(SysUser user, string password) => _hasher.HashPassword(user, password);

    public bool Verify(SysUser user, string password, out bool needsUpgrade)
    {
        needsUpgrade = false;
        if (string.IsNullOrEmpty(user.PasswordHash) || string.IsNullOrEmpty(password)) return false;

        if (user.PasswordHash.StartsWith(IdentityHashPrefix, StringComparison.Ordinal))
        {
            var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
            needsUpgrade = result == PasswordVerificationResult.SuccessRehashNeeded;
            return result != PasswordVerificationResult.Failed;
        }

        var expected = Encoding.UTF8.GetBytes(user.PasswordHash);
        var actual = Encoding.UTF8.GetBytes(LegacyPasswordCipher.Encrypt(password));
        needsUpgrade = CryptographicOperations.FixedTimeEquals(expected, actual);
        return needsUpgrade;
    }
}
