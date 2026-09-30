using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Security;
using Xunit;

namespace Core.Tests.Common;

public sealed class PasswordServiceTests
{
    // Value of the old Core.Utils StringUtils.Encrypt("old-password").
    private const string LegacyOldPassword = "jZ78TUuds-Wh1pdgHpZ6Ze6avGjpT28bCyPTkT--hEA=";

    [Fact]
    public void IdentityHashVerifiesWithoutUpgrade()
    {
        var passwords = new PasswordService();
        var user = new SysUser();
        user.PasswordHash = passwords.Hash(user, "new-password");

        Assert.True(passwords.Verify(user, "new-password", out var needsUpgrade));
        Assert.False(needsUpgrade);
        Assert.False(passwords.Verify(user, "wrong-password", out _));
    }

    [Fact]
    public void LegacyPasswordVerifiesAndAsksForUpgrade()
    {
        var passwords = new PasswordService();
        var user = new SysUser { PasswordHash = LegacyOldPassword };

        Assert.True(passwords.Verify(user, "old-password", out var needsUpgrade));
        Assert.True(needsUpgrade);
        Assert.False(passwords.Verify(user, "wrong-password", out _));
    }
}
