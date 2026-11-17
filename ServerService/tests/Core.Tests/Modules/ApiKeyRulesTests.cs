using Core.Application.Modules.ApiClients;
using Core.Domain.Modules.ApiClients;
using Xunit;

namespace Core.Tests.Modules;

/// <summary>The pure rules of API keys (docs/he-thong/tich-hop-api-key.md): shape, hash, address list and scope.</summary>
public sealed class ApiKeyRulesTests
{
    [Fact]
    public void AGeneratedKeyHasTheExpectedShapeAndIsDifferentEachTime()
    {
        var (key, prefix) = ApiKeyRules.Generate();
        Assert.True(ApiKeyRules.LooksLikeKey(key));
        Assert.Equal(54, key.Length);
        Assert.Equal(8, prefix.Length);
        Assert.StartsWith("serp_" + prefix + "_", key);
        Assert.NotEqual(key, ApiKeyRules.Generate().Key);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("serp_short")]
    [InlineData("xxxx_AbCd1234_0123456789012345678901234567890123456789")]
    [InlineData("serp_AbCd1234x0123456789012345678901234567890123456789")]
    public void ATextThatIsNotAKeyIsRefusedBeforeAnyLookup(string? text) => Assert.False(ApiKeyRules.LooksLikeKey(text));

    [Fact]
    public void OnlyTheHashOfAKeyIsKept()
    {
        var (key, _) = ApiKeyRules.Generate();
        var hash = ApiKeyRules.Hash(key);
        Assert.Equal(64, hash.Length);
        Assert.DoesNotContain(key, hash);
        Assert.Equal(hash, ApiKeyRules.Hash(key));
        Assert.NotEqual(hash, ApiKeyRules.Hash(key + "x"));
    }

    [Theory]
    [InlineData(null, "10.0.0.5", true)]            // empty list = any address
    [InlineData("", "203.0.113.9", true)]
    [InlineData("10.0.0.5", "10.0.0.5", true)]
    [InlineData("10.0.0.5", "10.0.0.6", false)]
    [InlineData("10.0.0.0/24", "10.0.0.200", true)]
    [InlineData("10.0.0.0/24", "10.0.1.1", false)]
    [InlineData("192.168.1.10, 10.0.0.0/24", "10.0.0.7", true)]
    [InlineData("10.0.0.5", "::ffff:10.0.0.5", true)] // an IPv4 address that arrives mapped into IPv6
    [InlineData("10.0.0.5", null, false)]
    [InlineData("10.0.0.5", "not-an-ip", false)]
    [InlineData("garbage", "10.0.0.5", false)]        // an invalid entry never matches
    public void TheAddressListIsAnAllowList(string? list, string? ip, bool expected) =>
        Assert.Equal(expected, ApiKeyRules.IpAllowed(list, ip));

    [Theory]
    [InlineData(null, true)]
    [InlineData("10.0.0.5, 10.0.0.0/24", true)]
    [InlineData("fe80::/10", true)]
    [InlineData("10.0.0.5, banana", false)]
    [InlineData("10.0.0.0/99", false)]
    public void AnAddressListIsCheckedWhenItIsSaved(string? list, bool valid) => Assert.Equal(valid, ApiKeyRules.IsValidIpList(list));

    [Theory]
    [InlineData("POST", "/api/inventory/transfer-issues", true)]
    [InlineData("POST", "/api/inventory/transfer-issues/12/post", true)]
    [InlineData("GET", "/api/inventory/transfer-receipts/open-issues", true)]
    [InlineData("PUT", "/api/inventory/transfer-orders/7", true)]
    [InlineData("GET", "/api/lookups/materials", true)]
    [InlineData("GET", "/api/inventory/Transfer-Issues", true)]   // paths are not case sensitive in ASP.NET
    [InlineData("POST", "/api/lookups/materials", false)]          // lookups are read only for a key
    [InlineData("GET", "/api/inventory/transfer-issues-secret", false)] // a prefix is a whole segment, not a text prefix
    [InlineData("GET", "/api/settings/users", false)]
    [InlineData("POST", "/api/settings/api-clients", false)]
    [InlineData("GET", "/api/inventory/goods-receipts", false)]
    [InlineData("POST", "/api/auth/login", false)]
    [InlineData("GET", "/api/inventory/stock/balances", false)]
    public void TheTransferScopeReachesOnlyTheTransferVouchersAndTheirLookups(string method, string path, bool allowed) =>
        Assert.Equal(allowed, ApiKeyRules.Allows(ApiKeyScopes.Transfer, method, path));

    [Fact]
    public void AnUnknownScopeReachesNothing() =>
        Assert.False(ApiKeyRules.Allows("ALL", "GET", "/api/inventory/transfer-issues"));

    [Fact]
    public void ARandomServicePasswordIsLongAndMeetsTheDefaultPolicyShape()
    {
        var password = ApiKeyRules.RandomPassword();
        Assert.True(password.Length >= 32);
        Assert.Contains(password, char.IsUpper);
        Assert.Contains(password, char.IsLower);
        Assert.Contains(password, char.IsDigit);
        Assert.Contains(password, c => !char.IsLetterOrDigit(c));
    }
}
