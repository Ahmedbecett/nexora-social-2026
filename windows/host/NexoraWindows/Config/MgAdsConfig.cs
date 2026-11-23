using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Newtonsoft.Json;

namespace NexoraWindows.Config
{
    public sealed class MgAdsConfig
    {
        private static readonly Regex AppIdPattern = new Regex("^[a-f0-9]{24}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex UnitIdPattern = new Regex("^[a-f0-9]{32}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // Known official MG Ads demo/sample identifiers from adwin-sdk-win32-example:
        // must NEVER be accepted in production builds.
        private static readonly HashSet<string> ForbiddenDemoIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "69316b6861328938223cc124",
            "b871f83c5e8845f1b43325561bcdd6c7",
            "5076eab6ae1042b6b92f73ea01981475",
            "cb7d9688a2d9499992febb6b642b3625",
            "2cb66a1301404561881a3f26b6ce5ba7",
            "b502f6e6281c43e4b28ea22503471039",
            "2ae60936ba664fbfb7d92ce3a19c2915",
            "f152f6caf7a8440f8510bc31534baf4e",
            "4192966a9db343f48dd2f6308ea9ec30",
            "e9b34829a2ad4a959874f9a180278bfe",
            "c68cd45e8e374ccd98a704887e5b3582",
            "e333abaf22404c4a8d382c1e7ba42076",
            "d65b9c6612bd494fbd6844b490d536dc",
            "0f505442fac84f098e81d6f2ca04abe1"
        };

        [JsonProperty("schemaVersion")]
        public int SchemaVersion { get; set; }

        [JsonProperty("productTitle")]
        public string ProductTitle { get; set; }

        [JsonProperty("storePackageIdentity")]
        public string StorePackageIdentity { get; set; }

        [JsonProperty("platform")]
        public string Platform { get; set; }

        [JsonProperty("sdkVersion")]
        public string SdkVersion { get; set; }

        [JsonProperty("appOrigin")]
        public string AppOrigin { get; set; }

        [JsonProperty("startUrl")]
        public string StartUrl { get; set; }

        [JsonProperty("appId")]
        public string AppId { get; set; }

        [JsonProperty("cmp")]
        public CmpConfig Cmp { get; set; }

        [JsonProperty("retry")]
        public RetryConfig Retry { get; set; }

        [JsonProperty("units")]
        public AdUnitsConfig Units { get; set; }

        [JsonIgnore]
        public bool IsValid { get; private set; }

        [JsonIgnore]
        public List<string> ValidationErrors { get; private set; }

        public MgAdsConfig()
        {
            Cmp = new CmpConfig();
            Retry = new RetryConfig();
            Units = new AdUnitsConfig();
            ValidationErrors = new List<string>();
        }

        public static MgAdsConfig LoadFromApplicationDirectory()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string configPath = Path.Combine(baseDir, "Config", "mgads-config.json");
            if (!File.Exists(configPath))
            {
                configPath = Path.Combine(baseDir, "mgads-config.json");
            }
            return LoadFromFile(configPath);
        }

        public static MgAdsConfig LoadFromFile(string path)
        {
            var fallback = CreateSafeDisabledFallback("config-file-missing");
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            {
                return fallback;
            }

            try
            {
                string raw = File.ReadAllText(path);

                // Security guard: private keys must NEVER appear in JSON config files.
                if (raw.IndexOf("MIGTAgEA", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    raw.IndexOf("BEGIN PRIVATE KEY", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    raw.IndexOf("3940256099942544", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return CreateSafeDisabledFallback("forbidden-secret-or-test-id-in-config");
                }

                var cfg = JsonConvert.DeserializeObject<MgAdsConfig>(raw) ?? new MgAdsConfig();
                cfg.ApplyEnvironmentOverrides();
                cfg.ValidateInPlace();
                return cfg;
            }
            catch (Exception ex)
            {
                return CreateSafeDisabledFallback("config-parse-error:" + ex.GetType().Name);
            }
        }

        private void ApplyEnvironmentOverrides()
        {
            // Interstitial Unit ID is intentionally blank until official 1024x768 Unit ID is issued.
            // Allow clean configuration via environment variable without touching code.
            string envInterstitial = Environment.GetEnvironmentVariable("MG_ADS_INTERSTITIAL_UNIT_ID");
            if (!string.IsNullOrWhiteSpace(envInterstitial) && Units != null && Units.Interstitial != null)
            {
                Units.Interstitial.UnitId = envInterstitial.Trim();
                Units.Interstitial.Enabled = true;
            }
        }

        private void ValidateInPlace()
        {
            ValidationErrors = new List<string>();

            if (string.IsNullOrWhiteSpace(AppOrigin) || !AppOrigin.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                AppOrigin = "https://nexora-social-2026.vercel.app";
            }

            if (string.IsNullOrWhiteSpace(StartUrl) || !StartUrl.StartsWith(AppOrigin, StringComparison.OrdinalIgnoreCase))
            {
                StartUrl = AppOrigin.TrimEnd('/') + "/?nx_surface=msix&nx_host=native-webview2";
            }

            if (!IsValidProductionAppId(AppId))
            {
                ValidationErrors.Add("invalid-or-demo-app-id");
            }

            if (Cmp == null) Cmp = new CmpConfig();
            if (Retry == null) Retry = new RetryConfig();
            if (Units == null) Units = new AdUnitsConfig();

            if (Retry.MaxInitAttempts < 1) Retry.MaxInitAttempts = 1;
            if (Retry.MaxInitAttempts > 5) Retry.MaxInitAttempts = 5;
            if (Retry.InitialBackoffMs < 500) Retry.InitialBackoffMs = 500;

            var seenUnitIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            ValidateUnit("banner", Units.Banner, seenUnitIds);
            ValidateUnit("rewarded", Units.Rewarded, seenUnitIds);
            ValidateUnit("couplet", Units.Couplet, seenUnitIds);
            ValidateUnit("interstitial", Units.Interstitial, seenUnitIds);

            IsValid = ValidationErrors.Count == 0;
        }

        private void ValidateUnit(string formatName, AdUnitConfig unit, HashSet<string> seenUnitIds)
        {
            if (unit == null)
            {
                return;
            }

            string id = (unit.UnitId ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(id))
            {
                // Empty ID means format is intentionally unconfigured (e.g. Interstitial pending official ID).
                unit.Enabled = false;
                unit.UnitId = string.Empty;
                return;
            }

            if (!IsValidProductionUnitId(id))
            {
                unit.Enabled = false;
                unit.UnitId = string.Empty;
                ValidationErrors.Add("invalid-or-demo-unit-id:" + formatName);
                return;
            }

            // Never substitute one format's Unit ID for another format.
            if (!seenUnitIds.Add(id))
            {
                unit.Enabled = false;
                unit.UnitId = string.Empty;
                ValidationErrors.Add("duplicate-unit-id-substitution:" + formatName);
                return;
            }

            unit.UnitId = id;
        }

        public static bool IsValidProductionAppId(string appId)
        {
            if (string.IsNullOrWhiteSpace(appId)) return false;
            string trimmed = appId.Trim();
            return AppIdPattern.IsMatch(trimmed) && !ForbiddenDemoIds.Contains(trimmed);
        }

        public static bool IsValidProductionUnitId(string unitId)
        {
            if (string.IsNullOrWhiteSpace(unitId)) return false;
            string trimmed = unitId.Trim();
            return UnitIdPattern.IsMatch(trimmed) && !ForbiddenDemoIds.Contains(trimmed);
        }

        private static MgAdsConfig CreateSafeDisabledFallback(string reason)
        {
            var cfg = new MgAdsConfig
            {
                ProductTitle = "NEXORA AI by BECETTI",
                StorePackageIdentity = "Ahmedbecetti.NEXORAAIbyBECETTI",
                Platform = "Miracle Games",
                SdkVersion = "1.2.1",
                AppOrigin = "https://nexora-social-2026.vercel.app",
                StartUrl = "https://nexora-social-2026.vercel.app/?nx_surface=msix&nx_host=native-webview2",
                AppId = string.Empty,
                IsValid = false
            };
            cfg.Units.Banner.Enabled = false;
            cfg.Units.Rewarded.Enabled = false;
            cfg.Units.Couplet.Enabled = false;
            cfg.Units.Interstitial.Enabled = false;
            cfg.ValidationErrors.Add(reason);
            return cfg;
        }
    }

    public sealed class CmpConfig
    {
        [JsonProperty("ignoreExpiredCheck")]
        public bool IgnoreExpiredCheck { get; set; }

        [JsonProperty("width")]
        public int Width { get; set; } = 900;

        [JsonProperty("height")]
        public int Height { get; set; } = 500;
    }

    public sealed class RetryConfig
    {
        [JsonProperty("maxInitAttempts")]
        public int MaxInitAttempts { get; set; } = 3;

        [JsonProperty("initialBackoffMs")]
        public int InitialBackoffMs { get; set; } = 1500;
    }

    public sealed class AdUnitsConfig
    {
        [JsonProperty("banner")]
        public BannerUnitConfig Banner { get; set; } = new BannerUnitConfig();

        [JsonProperty("rewarded")]
        public RewardedUnitConfig Rewarded { get; set; } = new RewardedUnitConfig();

        [JsonProperty("couplet")]
        public CoupletUnitConfig Couplet { get; set; } = new CoupletUnitConfig();

        [JsonProperty("interstitial")]
        public InterstitialUnitConfig Interstitial { get; set; } = new InterstitialUnitConfig();
    }

    public class AdUnitConfig
    {
        [JsonProperty("unitId")]
        public string UnitId { get; set; } = string.Empty;

        [JsonProperty("type")]
        public string Type { get; set; } = string.Empty;

        [JsonProperty("enabled")]
        public bool Enabled { get; set; }

        [JsonIgnore]
        public bool IsConfiguredAndEnabled
        {
            get { return Enabled && MgAdsConfig.IsValidProductionUnitId(UnitId); }
        }
    }

    public sealed class BannerUnitConfig : AdUnitConfig
    {
        [JsonProperty("width")]
        public int Width { get; set; } = 728;

        [JsonProperty("height")]
        public int Height { get; set; } = 90;

        [JsonProperty("refreshCooldownSeconds")]
        public int RefreshCooldownSeconds { get; set; } = 180;
    }

    public sealed class RewardedUnitConfig : AdUnitConfig
    {
        [JsonProperty("fullScreen")]
        public bool FullScreen { get; set; } = true;

        [JsonProperty("rewardDurationHours")]
        public int RewardDurationHours { get; set; } = 24;
    }

    public sealed class CoupletUnitConfig : AdUnitConfig
    {
        [JsonProperty("width")]
        public int Width { get; set; } = 300;

        [JsonProperty("height")]
        public int Height { get; set; } = 600;

        [JsonProperty("minWindowWidth")]
        public int MinWindowWidth { get; set; } = 1560;

        [JsonProperty("minWindowHeight")]
        public int MinWindowHeight { get; set; } = 760;

        [JsonProperty("dismissCooldownMinutes")]
        public int DismissCooldownMinutes { get; set; } = 30;
    }

    public sealed class InterstitialUnitConfig : AdUnitConfig
    {
        [JsonProperty("width")]
        public int Width { get; set; } = 1024;

        [JsonProperty("height")]
        public int Height { get; set; } = 768;

        [JsonProperty("minIntervalMinutes")]
        public int MinIntervalMinutes { get; set; } = 15;
    }
}
