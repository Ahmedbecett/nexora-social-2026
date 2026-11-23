using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace NexoraWindows.Config
{
    /// <summary>
    /// Native-only credential vault for the MG Ads Private/Secret Key.
    ///
    /// Security invariants:
    ///   1. Never committed to Git or stored in mgads-config.json / JS / HTML.
    ///   2. Never exposed to WebView2 or JavaScript under any circumstance.
    ///   3. Never written to logs or error messages.
    ///
    /// Resolution order (all native-side):
    ///   1. Local Windows DPAPI-protected store (%LOCALAPPDATA%\NEXORA\mgads.cred.dat)
    ///   2. Environment variable (NEXORA_MG_ADS_SECRET_KEY or MG_ADS_SECRET_KEY) for local QA
    ///   3. CI-only build-injected encrypted vault (NativeSecretVault.g.cs, .gitignored,
    ///      generated exclusively inside GitHub Actions from secrets.MG_ADS_SECRET_KEY)
    /// </summary>
    internal static partial class NativeSecretVault
    {
        private static readonly byte[] DpapiEntropy = Encoding.UTF8.GetBytes("NEXORA.AI.BECETTI.MGADS.V1");

        // Optional partial method implemented ONLY by CI-generated NativeSecretVault.g.cs
        // (which is gitignored and deleted immediately after compilation).
        static partial void TryLoadBuildInjectedSecret(ref byte[] cipherBytes, ref byte[] keyBytes, ref byte[] ivBytes);

        public static string GetDpapiStorePath()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(localAppData, "NEXORA", "mgads.cred.dat");
        }

        /// <summary>
        /// Stores an MG Ads secret key into the current user's Windows DPAPI vault
        /// for local Windows testing without keeping plaintext files on disk.
        /// </summary>
        public static void StoreInDpapi(string secretKey)
        {
            if (string.IsNullOrWhiteSpace(secretKey))
            {
                throw new ArgumentException("Secret key cannot be empty.", nameof(secretKey));
            }

            string trimmed = NormalizeKey(secretKey);
            string path = GetDpapiStorePath();
            string dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            byte[] plain = Encoding.UTF8.GetBytes(trimmed);
            try
            {
                byte[] protectedBytes = ProtectedData.Protect(plain, DpapiEntropy, DataProtectionScope.CurrentUser);
                File.WriteAllBytes(path, protectedBytes);
            }
            finally
            {
                Array.Clear(plain, 0, plain.Length);
            }
        }

        /// <summary>
        /// Resolves the MG Ads Private/Secret Key purely in native memory.
        /// Returns null (fail-closed) when no secret key is configured.
        /// </summary>
        public static string ResolveSecretKey(out string source)
        {
            // 1. Windows DPAPI user store
            string dpapiSecret = TryReadFromDpapi();
            if (!string.IsNullOrEmpty(dpapiSecret))
            {
                source = "dpapi-user-store";
                return dpapiSecret;
            }

            // 2. Local environment variables (for Windows QA / local runs)
            string envSecret = Environment.GetEnvironmentVariable("NEXORA_MG_ADS_SECRET_KEY");
            if (string.IsNullOrWhiteSpace(envSecret))
            {
                envSecret = Environment.GetEnvironmentVariable("MG_ADS_SECRET_KEY");
            }
            if (!string.IsNullOrWhiteSpace(envSecret))
            {
                source = "process-env";
                return NormalizeKey(envSecret);
            }

            // 3. CI build-injected encrypted native payload (never in source control)
            string ciSecret = TryDecryptBuildInjected();
            if (!string.IsNullOrEmpty(ciSecret))
            {
                source = "ci-native-vault";
                return ciSecret;
            }

            source = "unconfigured";
            return null;
        }

        private static string TryReadFromDpapi()
        {
            try
            {
                string path = GetDpapiStorePath();
                if (!File.Exists(path)) return null;
                byte[] encrypted = File.ReadAllBytes(path);
                if (encrypted == null || encrypted.Length == 0) return null;

                byte[] plain = ProtectedData.Unprotect(encrypted, DpapiEntropy, DataProtectionScope.CurrentUser);
                try
                {
                    return NormalizeKey(Encoding.UTF8.GetString(plain));
                }
                finally
                {
                    Array.Clear(plain, 0, plain.Length);
                }
            }
            catch
            {
                return null;
            }
        }

        private static string TryDecryptBuildInjected()
        {
            byte[] cipherBytes = null;
            byte[] keyBytes = null;
            byte[] ivBytes = null;

            TryLoadBuildInjectedSecret(ref cipherBytes, ref keyBytes, ref ivBytes);
            if (cipherBytes == null || keyBytes == null || ivBytes == null ||
                cipherBytes.Length == 0 || keyBytes.Length == 0 || ivBytes.Length == 0)
            {
                return null;
            }

            try
            {
                using (var aes = Aes.Create())
                {
                    aes.Mode = CipherMode.CBC;
                    aes.Padding = PaddingMode.PKCS7;
                    aes.Key = keyBytes;
                    aes.IV = ivBytes;
                    using (var ms = new MemoryStream(cipherBytes))
                    using (var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read))
                    using (var sr = new StreamReader(cs, Encoding.UTF8))
                    {
                        return NormalizeKey(sr.ReadToEnd());
                    }
                }
            }
            catch
            {
                return null;
            }
            finally
            {
                if (cipherBytes != null) Array.Clear(cipherBytes, 0, cipherBytes.Length);
                if (keyBytes != null) Array.Clear(keyBytes, 0, keyBytes.Length);
                if (ivBytes != null) Array.Clear(ivBytes, 0, ivBytes.Length);
            }
        }

        private static string NormalizeKey(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            string cleaned = raw.Trim();
            // Strip PEM headers/newlines if the developer pasted a PEM-formatted EC private key
            cleaned = cleaned.Replace("-----BEGIN PRIVATE KEY-----", string.Empty)
                             .Replace("-----END PRIVATE KEY-----", string.Empty)
                             .Replace("-----BEGIN EC PRIVATE KEY-----", string.Empty)
                             .Replace("-----END EC PRIVATE KEY-----", string.Empty)
                             .Replace("\r", string.Empty)
                             .Replace("\n", string.Empty)
                             .Trim();
            return string.IsNullOrEmpty(cleaned) ? null : cleaned;
        }
    }
}
