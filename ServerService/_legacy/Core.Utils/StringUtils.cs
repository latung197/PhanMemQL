using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Core.Utils
{
    public static class StringUtils
    {
        /// <summary>
        /// Generate random string
        /// </summary>
        /// <param name="numberOfString"></param>
        /// <returns></returns>
        public static string GenerateRandomString(int numberOfString)
        {
            Random random = new Random();
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            return new string(Enumerable.Repeat(chars, numberOfString)
                .Select(s => s[random.Next(s.Length)]).ToArray());
        }
        /// <summary>
        /// Check a string is an email
        /// </summary>
        /// <param name="email"></param>
        /// <returns></returns>
        public static bool IsValidEmail(string email)
        {
            var emailRegex = new Regex(@"^([a-zA-Z0-9_\-\.]+)@((\[[0-9]{1,3}" +
                                       @"\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\" +
                                       @".)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$");
            return emailRegex.IsMatch(email);
        }
        /// <summary>
        /// Encode string to base64
        /// </summary>
        /// <param name="plainText"></param>
        /// <returns></returns>
        public static string Base64Encode(string plainText)
        {
            byte[] plainTextBytes = System.Text.Encoding.UTF8.GetBytes(plainText);
            return System.Convert.ToBase64String(plainTextBytes);
        }

        /// <summary>
        /// Decode base64 to string
        /// </summary>
        /// <param name="base64EncodedData"></param>
        /// <returns></returns>
        public static string Base64Decode(string base64EncodedData)
        {
            byte[] base64EncodedBytes = System.Convert.FromBase64String(base64EncodedData);
            return System.Text.Encoding.UTF8.GetString(base64EncodedBytes);
        }
        /// <summary>
        /// Encrypt string
        /// </summary>
        /// <param name="baseStr"></param>
        /// <param name="IV"></param>
        /// <param name="pwd"></param>
        /// <returns></returns>
        public static string Encrypt(string baseStr, byte[]? IV = null, string? pwd = null)
        {
            if (string.IsNullOrEmpty(baseStr))
            {
                return string.Empty;
            }
            byte[] bytes = Encoding.Unicode.GetBytes(baseStr);

            if (IV is null || IV.Length == 0)
            {
                IV = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
            }

            if (string.IsNullOrEmpty(pwd))
            {
                pwd = "https://Emax.com";
            }

            const int blockSize = 128;

            // Encrypt 
            using SymmetricAlgorithm crypt = Aes.Create();
            using HashAlgorithm hash = MD5.Create();
            crypt.BlockSize = blockSize;
            crypt.Key = hash.ComputeHash(Encoding.Unicode.GetBytes(pwd));
            crypt.IV = IV;

            using (MemoryStream memoryStream = new MemoryStream())
            {
                using (CryptoStream cryptoStream =
                    new CryptoStream(memoryStream, crypt.CreateEncryptor(), CryptoStreamMode.Write))
                {
                    cryptoStream.Write(bytes, 0, bytes.Length);
                }

                var result = Convert.ToBase64String(memoryStream.ToArray());
                return result.Replace('+', '-').Replace('/', '_');
            }
        }
        /// <summary>
        /// Decrypt string
        /// </summary>
        /// <param name="encryptStr"></param>
        /// <param name="IV"></param>
        /// <param name="pwd"></param>
        /// <returns></returns>encryptStr
        public static string Decrypt(string encryptStr, byte[]? IV = null, string? pwd = null)
        {
            try
            {
                if (IV is null || IV.Length == 0)
                {
                    IV = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
                }

                if (string.IsNullOrEmpty(pwd))
                {
                    pwd = "https://Emax.com";
                }

                //Decrypt
                encryptStr = encryptStr.Replace('-', '+');
                encryptStr = encryptStr.Replace('_', '/');
                byte[] bytes = Convert.FromBase64String(encryptStr);
                using SymmetricAlgorithm crypt = Aes.Create();
                using HashAlgorithm hash = MD5.Create();
                crypt.Key = hash.ComputeHash(Encoding.Unicode.GetBytes(pwd));
                crypt.IV = IV;

                using (MemoryStream memoryStream = new MemoryStream(bytes))
                {
                    using (CryptoStream cryptoStream =
                        new CryptoStream(memoryStream, crypt.CreateDecryptor(), CryptoStreamMode.Read))
                    {
                        byte[] decryptedBytes = new byte[bytes.Length];
                        cryptoStream.Read(decryptedBytes, 0, decryptedBytes.Length);
                        return Encoding.Unicode.GetString(decryptedBytes);
                    }
                }
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }
        /// <summary>
        /// MD5 encryption
        /// </summary>
        /// <param name="text"></param>
        /// <returns></returns>
        public static string Md5Encryption(string text)
        {
            if (string.IsNullOrEmpty(text))
                return string.Empty;

            MD5 md5Hasher = MD5.Create();
            byte[] bs = Encoding.UTF8.GetBytes(text);
            bs = md5Hasher.ComputeHash(bs);
            var s = new StringBuilder();
            foreach (byte b in bs)
            {
                s.Append(b.ToString("x2"));
            }
            return s.ToString();
        }
    }
}
