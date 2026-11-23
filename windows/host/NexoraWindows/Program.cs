using System;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Newtonsoft.Json;
using NexoraWindows.Config;
using NexoraWindows.UI;

namespace NexoraWindows
{
    internal static class Program
    {
        private const string SingleInstanceMutexName = "Local\\Ahmedbecetti.NEXORAAIbyBECETTI.MainInstance";

        [STAThread]
        private static int Main(string[] args)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            // Headless CI / QA verification mode: verifies config, MG Ads SDK assembly loading,
            // WebView2 assembly loading, production IDs, and secret vault hygiene without UI.
            if (HasArg(args, "--smoke-check"))
            {
                return RunSmokeCheck();
            }

            // Local developer utility: stores MG Ads Private Key securely in Windows DPAPI
            // (%LOCALAPPDATA%\NEXORA\mgads.cred.dat) by reading from stdin.
            if (HasArg(args, "--store-mgads-key"))
            {
                return RunStoreSecretKey();
            }

            bool createdNew;
            using (var mutex = new Mutex(true, SingleInstanceMutexName, out createdNew))
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += (s, e) =>
                {
                    // Prevent ad/third-party UI exceptions from terminating the NEXORA workspace
                    System.Diagnostics.Debug.WriteLine("[NEXORA] UI exception: " + e.Exception);
                };

                MgAdsConfig config = MgAdsConfig.LoadFromApplicationDirectory();
                string launchUrl = ExtractLaunchUrl(args);

                using (var form = new MainForm(config, launchUrl))
                {
                    Application.Run(form);
                }
            }

            return 0;
        }

        private static int RunSmokeCheck()
        {
            try
            {
                MgAdsConfig config = MgAdsConfig.LoadFromApplicationDirectory();

                // Verify MG Ads C# SDK V1.2.1 & WebView2 assemblies load cleanly
                Assembly mgAssembly = typeof(MiracleGamesAd.ApplicationManager).Assembly;
                Assembly wvAssembly = typeof(Microsoft.Web.WebView2.WinForms.WebView2).Assembly;

                string secretSource;
                string secret = NativeSecretVault.ResolveSecretKey(out secretSource);
                bool secretConfigured = !string.IsNullOrEmpty(secret);
                secret = null; // never output or retain secret

                var report = new
                {
                    ok = config.IsValid && mgAssembly != null && wvAssembly != null,
                    productTitle = config.ProductTitle,
                    storePackageIdentity = config.StorePackageIdentity,
                    sdkVersion = config.SdkVersion,
                    mgAssembly = mgAssembly != null ? mgAssembly.GetName().FullName : null,
                    webView2Assembly = wvAssembly != null ? wvAssembly.GetName().FullName : null,
                    appId = config.AppId,
                    secretConfigured = secretConfigured,
                    secretSource = secretSource,
                    units = new
                    {
                        bannerEnabled = config.Units.Banner.IsConfiguredAndEnabled,
                        bannerUnitId = config.Units.Banner.UnitId,
                        rewardedEnabled = config.Units.Rewarded.IsConfiguredAndEnabled,
                        rewardedUnitId = config.Units.Rewarded.UnitId,
                        coupletEnabled = config.Units.Couplet.IsConfiguredAndEnabled,
                        coupletUnitId = config.Units.Couplet.UnitId,
                        interstitialEnabled = config.Units.Interstitial.IsConfiguredAndEnabled,
                        interstitialUnitId = config.Units.Interstitial.UnitId
                    },
                    validationErrors = config.ValidationErrors
                };

                Console.WriteLine(JsonConvert.SerializeObject(report, Formatting.Indented));
                return report.ok ? 0 : 1;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Smoke check failed: " + ex.GetType().Name + ": " + ex.Message);
                return 1;
            }
        }

        private static int RunStoreSecretKey()
        {
            try
            {
                string key = Console.In.ReadToEnd();
                if (string.IsNullOrWhiteSpace(key))
                {
                    Console.Error.WriteLine("No key provided on stdin.");
                    return 2;
                }

                NativeSecretVault.StoreInDpapi(key);
                Console.WriteLine("MG Ads secret key stored securely in Windows DPAPI vault: " + NativeSecretVault.GetDpapiStorePath());
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Failed to store key: " + ex.Message);
                return 1;
            }
        }

        private static bool HasArg(string[] args, string flag)
        {
            if (args == null) return false;
            foreach (string arg in args)
            {
                if (string.Equals(arg, flag, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static string ExtractLaunchUrl(string[] args)
        {
            if (args == null) return null;
            foreach (string arg in args)
            {
                if (!string.IsNullOrWhiteSpace(arg) &&
                    arg.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    return arg;
                }
            }
            return null;
        }
    }
}
