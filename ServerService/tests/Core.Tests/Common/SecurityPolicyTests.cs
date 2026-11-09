using Core.Application.Common.Exceptions;
using Core.Application.Common.Security;
using Xunit;

namespace Core.Tests.Common;

public sealed class SecurityPolicyTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData("abc123", "validation.passwordLength")]
    [InlineData("abcdefgh", "security.passwordDigit")]
    [InlineData("12345678", "security.passwordLetter")]
    [InlineData("abcd1234", null)]
    public void DefaultPasswordRules(string password, string? problem) =>
        Assert.Equal(problem, SecurityPolicy.Default.PasswordProblem(password)?.Key);

    [Fact]
    public void StricterRules()
    {
        var policy = SecurityPolicy.Default with { PasswordRequireUpper = true, PasswordRequireSpecial = true };
        Assert.Equal("security.passwordUpper", policy.PasswordProblem("abcd1234")?.Key);
        Assert.Equal("security.passwordSpecial", policy.PasswordProblem("Abcd1234")?.Key);
        Assert.Null(policy.PasswordProblem("Abcd123!"));
    }

    [Fact]
    public void PasswordExpiry()
    {
        Assert.False(SecurityPolicy.Default.IsPasswordExpired(null, Now));
        Assert.False(SecurityPolicy.Default.IsPasswordExpired(Now.AddDays(-89), Now));
        Assert.True(SecurityPolicy.Default.IsPasswordExpired(Now.AddDays(-90), Now));
        Assert.False((SecurityPolicy.Default with { PasswordExpiryDays = 0 }).IsPasswordExpired(Now.AddYears(-3), Now));
    }

    [Fact]
    public void FiveWrongPasswordsMakeTheNameWait()
    {
        var policy = SecurityPolicy.Default;
        var four = Enumerable.Range(1, 4).Select(i => Now.AddMinutes(-i)).ToList();
        Assert.Equal(0, policy.BlockedMinutes(four, Now));
        var five = Enumerable.Range(1, 5).Select(i => Now.AddMinutes(-i)).ToList();
        Assert.Equal(14, policy.BlockedMinutes(five, Now));                        // 15 minutes after the last one (1 minute ago)
        Assert.Equal(0, policy.BlockedMinutes(five, Now.AddMinutes(15)));           // waited long enough
        var spread = Enumerable.Range(0, 5).Select(i => Now.AddMinutes(-10 * i)).ToList();
        Assert.Equal(0, policy.BlockedMinutes(spread, Now));                        // only 2 inside the 15-minute window
        Assert.Equal(0, (policy with { LoginMaxFailures = 0 }).BlockedMinutes(five, Now));
    }

    [Fact]
    public void OutOfRangeValuesAreRefused()
    {
        Assert.Throws<BusinessRuleException>(() => (SecurityPolicy.Default with { PasswordMinLength = 3 }).Validated());
        Assert.Throws<BusinessRuleException>(() => (SecurityPolicy.Default with { IdleTimeoutMinutes = -1 }).Validated());
        Assert.Same(SecurityPolicy.Default, SecurityPolicy.Default.Validated());
    }
}
