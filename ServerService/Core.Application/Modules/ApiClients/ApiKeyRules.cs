using System.Net;
using System.Security.Cryptography;
using System.Text;
using Core.Domain.Modules.ApiClients;

namespace Core.Application.Modules.ApiClients;

/// <summary>
/// Pure rules of API keys: the shape of a key, its hash, the address list and which APIs a scope may call.
/// A key looks like <c>serp_AbCd1234_</c> + 40 random characters: the 8 characters after <c>serp_</c> are the prefix shown in lists.
/// </summary>
public static class ApiKeyRules
{
    public const string Header = "X-Api-Key";
    public const string IdempotencyHeader = "Idempotency-Key";
    private const string Marker = "serp_";
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    /// <summary>A new key and its prefix.</summary>
    public static (string Key, string Prefix) Generate()
    {
        var prefix = RandomText(8);
        return ($"{Marker}{prefix}_{RandomText(40)}", prefix);
    }

    /// <summary>SHA-256 of the key as lower-case hex (64 characters): the only form kept in the database.</summary>
    public static string Hash(string key) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(key)));

    /// <summary>Whether the text can be a key at all (checked before any database call).</summary>
    public static bool LooksLikeKey(string? key) =>
        key is { Length: 54 } && key.StartsWith(Marker, StringComparison.Ordinal) && key[13] == '_';

    /// <summary>A strong random password for a service account (nobody ever knows it: the account cannot sign in anyway).</summary>
    public static string RandomPassword() => $"Aa1!{RandomText(44)}";

    private static readonly char[] ListSeparators = [',', ';', ' ', '\n', '\r'];

    /// <summary>Empty list = any address. Entries are single addresses or CIDR ranges (10.0.0.0/24); invalid entries never match.</summary>
    public static bool IpAllowed(string? allowedIps, string? ip)
    {
        if (string.IsNullOrWhiteSpace(allowedIps)) return true;
        if (!IPAddress.TryParse(ip, out var address)) return false;
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        foreach (var raw in allowedIps.Split(ListSeparators, StringSplitOptions.RemoveEmptyEntries))
        {
            if (raw.Contains('/'))
            {
                if (IPNetwork.TryParse(raw, out var network) && network.Contains(address)) return true;
            }
            else if (IPAddress.TryParse(raw, out var single))
            {
                if (single.IsIPv4MappedToIPv6) single = single.MapToIPv4();
                if (single.Equals(address)) return true;
            }
        }
        return false;
    }

    /// <summary>Whether the list is made only of addresses and CIDR ranges (checked when it is saved).</summary>
    public static bool IsValidIpList(string? allowedIps) =>
        string.IsNullOrWhiteSpace(allowedIps)
        || allowedIps.Split(ListSeparators, StringSplitOptions.RemoveEmptyEntries)
            .All(x => x.Contains('/') ? IPNetwork.TryParse(x, out _) : IPAddress.TryParse(x, out _));

    private static readonly string[] TransferPrefixes =
    [
        "/api/inventory/transfer-orders", "/api/inventory/transfer-issues", "/api/inventory/transfer-receipts"
    ];

    /// <summary>
    /// Whether a key of the scope may call the path. The transfer scope reaches the three transfer vouchers (any method, the
    /// rights of the service account still decide) and the lookups their forms read (GET only); nothing else, so a key can never
    /// open the admin screens even when the account behind it is an administrator.
    /// </summary>
    public static bool Allows(string scope, string method, string path)
    {
        if (!string.Equals(scope, ApiKeyScopes.Transfer, StringComparison.Ordinal)) return false;
        if (TransferPrefixes.Any(p => StartsWithSegment(path, p))) return true;
        return string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase) && StartsWithSegment(path, "/api/lookups");
    }

    private static bool StartsWithSegment(string path, string prefix) =>
        path.Equals(prefix, StringComparison.OrdinalIgnoreCase)
        || path.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase);

    private static string RandomText(int length) =>
        string.Create(length, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        });
}
