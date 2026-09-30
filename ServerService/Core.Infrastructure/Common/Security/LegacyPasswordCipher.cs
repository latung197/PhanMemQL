using System.Security.Cryptography;
using System.Text;

namespace Core.Infrastructure.Common.Security;

/// <summary>
/// Reproduces the reversible AES format of the old system so existing passwords still verify.
/// Such passwords are rehashed on the next successful login; never use this for new passwords.
/// </summary>
internal static class LegacyPasswordCipher
{
    private static readonly byte[] Iv = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    private const string Secret = "https://Emax.com";

    public static string Encrypt(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        using var aes = Aes.Create();
        aes.BlockSize = 128;
        aes.Key = MD5.HashData(Encoding.Unicode.GetBytes(Secret));
        aes.IV = Iv;
        var plain = Encoding.Unicode.GetBytes(value);
        var encrypted = aes.CreateEncryptor().TransformFinalBlock(plain, 0, plain.Length);
        return Convert.ToBase64String(encrypted).Replace('+', '-').Replace('/', '_');
    }
}
