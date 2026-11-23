using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using MiracleGamesAd;
using MiracleGamesAd.Models;
using MiracleGamesAd.Services.Core.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NexoraWindows.Config;

namespace NexoraWindows.Ads
{
    public sealed class AdEventNotification
    {
        [JsonProperty("event")]
        public string EventName { get; set; }

        [JsonProperty("format")]
        public string Format { get; set; }

        [JsonProperty("unitId")]
        public string UnitId { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("advertStatus")]
        public int? AdvertStatus { get; set; }

        [JsonProperty("completed")]
        public bool? Completed { get; set; }

        [JsonProperty("rewardId")]
        public string RewardId { get; set; }

        [JsonProperty("fulfilled")]
        public bool? Fulfilled { get; set; }

        [JsonProperty("reason")]
        public string Reason { get; set; }
    }

    public sealed class RewardedAdOutcome
    {
        [JsonProperty("shown")]
        public bool Shown { get; set; }

        [JsonProperty("completed")]
        public bool Completed { get; set; }

        [JsonProperty("fulfilled")]
        public bool Fulfilled { get; set; }

        [JsonProperty("rewardId")]
        public string RewardId { get; set; }

        [JsonProperty("reason")]
        public string Reason { get; set; }

        [JsonProperty("rewardDurationHours")]
        public int RewardDurationHours { get; set; }
    }

    public sealed class MgAdsPublicState
    {
        [JsonProperty("provider")]
        public string Provider { get; set; } = "mgads";

        [JsonProperty("sdkVersion")]
        public string SdkVersion { get; set; } = "1.2.1";

        [JsonProperty("appId")]
        public string AppId { get; set; }

        [JsonProperty("initialized")]
        public bool Initialized { get; set; }

        [JsonProperty("initStatus")]
        public string InitStatus { get; set; }

        [JsonProperty("cmpRequired")]
        public bool CmpRequired { get; set; }

        [JsonProperty("bannerConfigured")]
        public bool BannerConfigured { get; set; }

        [JsonProperty("bannerVisible")]
        public bool BannerVisible { get; set; }

        [JsonProperty("rewardedConfigured")]
        public bool RewardedConfigured { get; set; }

        [JsonProperty("coupletConfigured")]
        public bool CoupletConfigured { get; set; }

        [JsonProperty("coupletVisible")]
        public bool CoupletVisible { get; set; }

        [JsonProperty("interstitialConfigured")]
        public bool InterstitialConfigured { get; set; }

        [JsonProperty("adFreeUntilUtcMs")]
        public long AdFreeUntilUtcMs { get; set; }
    }

    /// <summary>
    /// Production integration of official MG Ads C# SDK V1.2.1.
    ///
    /// Enforces:
    ///   - Mandatory call order: SetAppId -> OpenCmp -> Initialize (up to 3 retries)
    ///   - Fail-closed behavior when secret key is missing, offline, VPN active, or no fill
    ///   - Zero empty ad placeholders (banner panel stays hidden unless a real creative renders)
    ///   - Strict production unit IDs with zero format substitution (Interstitial stays off until official ID is provided)
    ///   - Verified Rewarded callback + ReportAdRewardFulfillment back to MG Ads
    ///   - Couplet viewport + view-context protection (only on wide screens outside Studio editor)
    /// </summary>
    public sealed class MgAdsManager : IDisposable
    {
        private const string BannerTag = "MGADKEY_BANNER";
        private const string CoupletLeftTag = "MGADKEY_COUPLET_LEFT";
        private const string CoupletRightTag = "MGADKEY_COUPLET_RIGHT";

        private readonly Form _hostForm;
        private readonly Panel _bannerContainer;
        private readonly MgAdsConfig _config;
        private readonly SemaphoreSlim _initLock = new SemaphoreSlim(1, 1);

        private bool _eventsBound;
        private bool _initialized;
        private bool _disposed;
        private bool _bannerVisible;
        private bool _coupletVisible;
        private bool _bannerBusy;
        private bool _coupletBusy;
        private bool _rewardedBusy;
        private bool _interstitialBusy;
        private string _initStatus = "pending";
        private DateTime _lastBannerAttemptUtc = DateTime.MinValue;
        private DateTime _coupletDismissedUntilUtc = DateTime.MinValue;
        private DateTime _lastInterstitialUtc = DateTime.MinValue;
        private DateTime _adFreeUntilUtc = DateTime.MinValue;
        private TaskCompletionSource<RewardedAdOutcome> _pendingRewarded;

        public event Action<AdEventNotification> AdEventRaised;
        public event Action<MgAdsPublicState> StateChanged;

        public MgAdsManager(Form hostForm, Panel bannerContainer, MgAdsConfig config)
        {
            _hostForm = hostForm ?? throw new ArgumentNullException(nameof(hostForm));
            _bannerContainer = bannerContainer ?? throw new ArgumentNullException(nameof(bannerContainer));
            _config = config ?? throw new ArgumentNullException(nameof(config));
        }

        public MgAdsPublicState GetPublicState()
        {
            bool cmpRequired = false;
            try
            {
                if (_initialized) cmpRequired = ApplicationManager.UserRegionCmpRequirement;
            }
            catch
            {
                cmpRequired = false;
            }

            long adFreeMs = _adFreeUntilUtc > DateTime.UtcNow
                ? new DateTimeOffset(_adFreeUntilUtc).ToUnixTimeMilliseconds()
                : 0;

            return new MgAdsPublicState
            {
                Provider = "mgads",
                SdkVersion = _config.SdkVersion ?? "1.2.1",
                AppId = _config.AppId ?? string.Empty,
                Initialized = _initialized,
                InitStatus = _initStatus,
                CmpRequired = cmpRequired,
                BannerConfigured = _config.IsValid && _config.Units.Banner.IsConfiguredAndEnabled,
                BannerVisible = _bannerVisible,
                RewardedConfigured = _config.IsValid && _config.Units.Rewarded.IsConfiguredAndEnabled,
                CoupletConfigured = _config.IsValid && _config.Units.Couplet.IsConfiguredAndEnabled,
                CoupletVisible = _coupletVisible,
                InterstitialConfigured = _config.IsValid && _config.Units.Interstitial.IsConfiguredAndEnabled,
                AdFreeUntilUtcMs = adFreeMs
            };
        }

        public async Task<bool> InitializeAsync()
        {
            if (_disposed) return false;

            await _initLock.WaitAsync();
            try
            {
                if (_initialized) return true;

                if (!_config.IsValid)
                {
                    _initStatus = "invalid-config:" + string.Join(",", _config.ValidationErrors);
                    NotifyStateChanged();
                    return false;
                }

                string secretSource;
                string secretKey = NativeSecretVault.ResolveSecretKey(out secretSource);
                if (string.IsNullOrEmpty(secretKey))
                {
                    _initStatus = "secret-key-not-configured";
                    Debug.WriteLine("[NEXORA][MGAds] Secret key not found in native vault/env; ads remain safely disabled.");
                    NotifyStateChanged();
                    return false;
                }

                BindSdkEventsOnce();

                // Step 1: Mandatory SetAppId with production Product ID and native-only Secret Key
                _initStatus = "configuring";
                ApplicationManager.SetAppId(_config.AppId, secretKey);

                // Clear local reference immediately (never log or persist secretKey)
                secretKey = null;

                // Step 2: Mandatory CMP check before SDK Initialize (GDPR/regional compliance)
                _initStatus = "cmp";
                try
                {
                    var cmpOptions = new CmpParameters
                    {
                        IgnoreExpiredCheck = _config.Cmp.IgnoreExpiredCheck,
                        Width = _config.Cmp.Width,
                        Height = _config.Cmp.Height
                    };
                    await ApplicationManager.OpenCmp(cmpOptions);
                }
                catch (Exception ex)
                {
                    // CMP dialog failure should not crash the host; continue to Initialize per MG SDK demo
                    Debug.WriteLine("[NEXORA][MGAds] OpenCmp exception: " + ex.GetType().Name);
                }

                // Step 3: Mandatory Initialize() with bounded retries (recommended by MG SDK FAQ)
                _initStatus = "initializing";
                int maxAttempts = _config.Retry.MaxInitAttempts;
                int backoffMs = _config.Retry.InitialBackoffMs;

                for (int attempt = 1; attempt <= maxAttempts; attempt++)
                {
                    if (_disposed) return false;
                    try
                    {
                        AsyncProcessResult initResult = await ApplicationManager.Initialize();
                        if (initResult != null && initResult.ReturnValue)
                        {
                            _initialized = true;
                            _initStatus = "ready:" + secretSource;
                            NotifyStateChanged();
                            return true;
                        }

                        string errCode = initResult != null ? Convert.ToString(initResult.ErrorCode) : "null-result";
                        _initStatus = "init-failed:" + errCode;
                        Debug.WriteLine("[NEXORA][MGAds] Initialize attempt " + attempt + " failed: " + errCode);
                    }
                    catch (Exception ex)
                    {
                        _initStatus = "init-exception:" + ex.GetType().Name;
                        Debug.WriteLine("[NEXORA][MGAds] Initialize attempt " + attempt + " threw: " + ex.GetType().Name);
                    }

                    if (attempt < maxAttempts)
                    {
                        await Task.Delay(backoffMs * attempt);
                    }
                }

                NotifyStateChanged();
                return false;
            }
            finally
            {
                _initLock.Release();
            }
        }

        private void BindSdkEventsOnce()
        {
            if (_eventsBound) return;
            AdvertManager.AdClickEvent += OnSdkAdClickEvent;
            AdvertManager.AdCloseEvent += OnSdkAdCloseEvent;
            _eventsBound = true;
        }

        private bool IsAdFreeActive()
        {
            return DateTime.UtcNow < _adFreeUntilUtc;
        }

        /// <summary>
        /// Preloads and displays the official 728x90 Banner ad in the dedicated bottom container.
        /// Container remains completely hidden (0 px) unless a real creative is loaded.
        /// </summary>
        public async Task<bool> ShowBannerAsync(bool force = false)
        {
            if (_disposed || !_initialized) return false;
            if (!_config.Units.Banner.IsConfiguredAndEnabled) return false;
            if (IsAdFreeActive())
            {
                HideBanner("reward-ad-free-active");
                return false;
            }
            if (_bannerBusy) return _bannerVisible;

            if (!force && _bannerVisible) return true;

            if (!force && _lastBannerAttemptUtc != DateTime.MinValue)
            {
                double elapsedSec = (DateTime.UtcNow - _lastBannerAttemptUtc).TotalSeconds;
                if (elapsedSec < Math.Max(30, _config.Units.Banner.RefreshCooldownSeconds))
                {
                    return _bannerVisible;
                }
            }

            if (_hostForm.ClientSize.Width < _config.Units.Banner.Width)
            {
                HideBanner("viewport-too-narrow");
                return false;
            }

            _bannerBusy = true;
            _lastBannerAttemptUtc = DateTime.UtcNow;

            try
            {
                string payload = JsonConvert.SerializeObject(new
                {
                    unitId = _config.Units.Banner.UnitId,
                    tag = BannerTag
                });

                // Prefer preload-first so we NEVER reveal an empty banner container if inventory is unavailable
                bool shown = false;
                try
                {
                    AsyncProcessResult preload = await AdvertManager.PreloadAd(payload, AdType.Banner);
                    if (preload != null && preload.ReturnValue)
                    {
                        shown = InvokeOnUi(() =>
                        {
                            ClearBannerControlsCore();
                            _bannerContainer.Height = Math.Max(90, _config.Units.Banner.Height + 6);
                            AsyncProcessResult showResult = AdvertManager.ShowPreloadAd(_bannerContainer, payload, AdType.Banner);
                            bool hasChild = showResult != null && showResult.ReturnValue && _bannerContainer.Controls.Count > 0;
                            _bannerContainer.Visible = hasChild;
                            if (!hasChild) ClearBannerControlsCore();
                            return hasChild;
                        });
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[NEXORA][MGAds] Banner preload path fallback: " + ex.GetType().Name);
                }

                // Fallback to direct ShowAd ONLY if preload did not complete; still keep container hidden until verified
                if (!shown)
                {
                    ClearBannerControlsUi();
                    AsyncProcessResult directResult = await AdvertManager.ShowAd(_bannerContainer, payload, AdType.Banner);
                    shown = InvokeOnUi(() =>
                    {
                        bool hasChild = directResult != null && directResult.ReturnValue && _bannerContainer.Controls.Count > 0;
                        _bannerContainer.Height = Math.Max(90, _config.Units.Banner.Height + 6);
                        _bannerContainer.Visible = hasChild;
                        if (!hasChild) ClearBannerControlsCore();
                        return hasChild;
                    });
                }

                _bannerVisible = shown;
                RaiseAdEvent(new AdEventNotification
                {
                    EventName = shown ? "ad_shown" : "ad_unavailable",
                    Format = "banner",
                    UnitId = _config.Units.Banner.UnitId,
                    Status = shown ? "shown" : "no-fill"
                });
                NotifyStateChanged();
                return shown;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[NEXORA][MGAds] ShowBannerAsync error: " + ex.GetType().Name);
                HideBanner("sdk-error");
                return false;
            }
            finally
            {
                _bannerBusy = false;
            }
        }

        public void HideBanner(string reason = "hidden")
        {
            if (_disposed) return;
            bool wasVisible = _bannerVisible;
            ClearBannerControlsUi();
            _bannerVisible = false;
            if (wasVisible)
            {
                RaiseAdEvent(new AdEventNotification
                {
                    EventName = "ad_hidden",
                    Format = "banner",
                    UnitId = _config.Units.Banner.UnitId,
                    Status = "hidden",
                    Reason = reason
                });
                NotifyStateChanged();
            }
        }

        /// <summary>
        /// Displays an official MG Rewarded Ad on explicit user opt-in and verifies completion
        /// via AdCloseEvent (completeStatus == 1) + ReportAdRewardFulfillment.
        /// </summary>
        public async Task<RewardedAdOutcome> ShowRewardedAsync(string comment)
        {
            if (_disposed || !_initialized)
            {
                return new RewardedAdOutcome { Shown = false, Completed = false, Reason = "sdk-not-ready" };
            }

            if (!_config.Units.Rewarded.IsConfiguredAndEnabled)
            {
                return new RewardedAdOutcome { Shown = false, Completed = false, Reason = "rewarded-not-configured" };
            }

            if (_rewardedBusy)
            {
                return new RewardedAdOutcome { Shown = false, Completed = false, Reason = "rewarded-busy" };
            }

            _rewardedBusy = true;
            var tcs = new TaskCompletionSource<RewardedAdOutcome>(TaskCreationOptions.RunContinuationsAsynchronously);
            _pendingRewarded = tcs;

            try
            {
                string safeComment = string.IsNullOrWhiteSpace(comment) ? "nexora-windows-reward" : comment.Trim();
                if (safeComment.Length > 120) safeComment = safeComment.Substring(0, 120);

                string payload = JsonConvert.SerializeObject(new
                {
                    unitId = _config.Units.Rewarded.UnitId,
                    comment = Uri.EscapeDataString(safeComment),
                    isFullScreen = _config.Units.Rewarded.FullScreen
                });

                AsyncProcessResult result = await AdvertManager.ShowAd(_hostForm, payload, AdType.Rewarded);
                if (result == null || !result.ReturnValue)
                {
                    string reason = result != null && !string.IsNullOrEmpty(Convert.ToString(result.ErrorCode))
                        ? "unavailable:" + result.ErrorCode
                        : "unavailable";
                    TryCompletePendingRewarded(new RewardedAdOutcome
                    {
                        Shown = false,
                        Completed = false,
                        Reason = reason
                    });
                    return await tcs.Task;
                }

                // Wait for AdCloseEvent from MG SDK (bounded timeout so UI can never hang forever)
                Task completedTask = await Task.WhenAny(tcs.Task, Task.Delay(TimeSpan.FromMinutes(3)));
                if (completedTask != tcs.Task)
                {
                    TryCompletePendingRewarded(new RewardedAdOutcome
                    {
                        Shown = true,
                        Completed = false,
                        Reason = "timeout"
                    });
                }

                return await tcs.Task;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[NEXORA][MGAds] ShowRewardedAsync error: " + ex.GetType().Name);
                TryCompletePendingRewarded(new RewardedAdOutcome
                {
                    Shown = false,
                    Completed = false,
                    Reason = "sdk-error"
                });
                return await tcs.Task;
            }
            finally
            {
                _pendingRewarded = null;
                _rewardedBusy = false;
            }
        }

        /// <summary>
        /// Shows official 300x600 Couplet ads ONLY when the window is wide enough
        /// (>= 1560x760) and the user is on a suitable non-IDE view.
        /// </summary>
        public async Task<bool> SyncCoupletForContextAsync(string activeView, bool hasMessages)
        {
            if (_disposed || !_initialized) return false;
            if (!_config.Units.Couplet.IsConfiguredAndEnabled) return false;

            bool suitableView = string.Equals(activeView, "chat", StringComparison.OrdinalIgnoreCase) && !hasMessages;
            bool wideEnough = _hostForm.ClientSize.Width >= _config.Units.Couplet.MinWindowWidth
                           && _hostForm.ClientSize.Height >= _config.Units.Couplet.MinWindowHeight;

            if (!suitableView || !wideEnough || IsAdFreeActive() || DateTime.UtcNow < _coupletDismissedUntilUtc)
            {
                HideCouplet(suitableView ? "viewport-or-cooldown" : "view-not-suitable");
                return false;
            }

            if (_coupletVisible || _coupletBusy) return _coupletVisible;
            _coupletBusy = true;

            try
            {
                string payload = JsonConvert.SerializeObject(new
                {
                    unitId = _config.Units.Couplet.UnitId,
                    tag = CoupletLeftTag,
                    tag2 = CoupletRightTag
                });

                AsyncProcessResult preload = await AdvertManager.PreloadAd(payload, AdType.Couplet);
                if (preload == null || !preload.ReturnValue)
                {
                    return false;
                }

                bool shown = InvokeOnUi(() =>
                {
                    // Re-check viewport in case user resized while preloading
                    if (_hostForm.ClientSize.Width < _config.Units.Couplet.MinWindowWidth ||
                        _hostForm.ClientSize.Height < _config.Units.Couplet.MinWindowHeight)
                    {
                        return false;
                    }

                    RemoveCoupletControlsCore();
                    AsyncProcessResult showResult = AdvertManager.ShowPreloadAd(_hostForm, payload, AdType.Couplet);
                    return showResult != null && showResult.ReturnValue;
                });

                _coupletVisible = shown;
                if (shown)
                {
                    RaiseAdEvent(new AdEventNotification
                    {
                        EventName = "ad_shown",
                        Format = "couplet",
                        UnitId = _config.Units.Couplet.UnitId,
                        Status = "shown"
                    });
                    NotifyStateChanged();
                }

                return shown;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[NEXORA][MGAds] Couplet error: " + ex.GetType().Name);
                HideCouplet("sdk-error");
                return false;
            }
            finally
            {
                _coupletBusy = false;
            }
        }

        public void HideCouplet(string reason = "hidden")
        {
            if (_disposed) return;
            bool wasVisible = _coupletVisible;
            InvokeOnUi(() =>
            {
                RemoveCoupletControlsCore();
                return true;
            });
            _coupletVisible = false;
            if (wasVisible)
            {
                RaiseAdEvent(new AdEventNotification
                {
                    EventName = "ad_hidden",
                    Format = "couplet",
                    UnitId = _config.Units.Couplet.UnitId,
                    Status = "hidden",
                    Reason = reason
                });
                NotifyStateChanged();
            }
        }

        /// <summary>
        /// Interstitial (1024x768) remains strictly disabled until an official production
        /// Interstitial Unit ID is configured. Never substitutes Banner/Rewarded/Couplet.
        /// </summary>
        public async Task<object> ShowInterstitialAsync()
        {
            if (_disposed || !_initialized)
            {
                return new { shown = false, reason = "sdk-not-ready" };
            }

            if (!_config.Units.Interstitial.IsConfiguredAndEnabled)
            {
                return new { shown = false, reason = "interstitial-unit-not-configured" };
            }

            if (IsAdFreeActive())
            {
                return new { shown = false, reason = "reward-ad-free-active" };
            }

            if (_interstitialBusy)
            {
                return new { shown = false, reason = "interstitial-busy" };
            }

            if (_lastInterstitialUtc != DateTime.MinValue)
            {
                double mins = (DateTime.UtcNow - _lastInterstitialUtc).TotalMinutes;
                if (mins < _config.Units.Interstitial.MinIntervalMinutes)
                {
                    return new { shown = false, reason = "cooldown" };
                }
            }

            _interstitialBusy = true;
            try
            {
                string payload = JsonConvert.SerializeObject(new
                {
                    unitId = _config.Units.Interstitial.UnitId
                });

                AsyncProcessResult result = await AdvertManager.ShowAd(_hostForm, payload, AdType.Interstitial);
                bool shown = result != null && result.ReturnValue;
                if (shown)
                {
                    _lastInterstitialUtc = DateTime.UtcNow;
                }
                return new
                {
                    shown = shown,
                    reason = shown ? "shown" : "unavailable"
                };
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[NEXORA][MGAds] ShowInterstitialAsync error: " + ex.GetType().Name);
                return new { shown = false, reason = "sdk-error" };
            }
            finally
            {
                _interstitialBusy = false;
            }
        }

        public async Task<bool> OpenPrivacyChoicesAsync()
        {
            if (_disposed || !_initialized) return false;
            try
            {
                var cmpOptions = new CmpParameters
                {
                    IgnoreExpiredCheck = true,
                    Width = _config.Cmp.Width,
                    Height = _config.Cmp.Height
                };
                AsyncProcessResult res = await ApplicationManager.OpenCmp(cmpOptions);
                return res != null && res.ReturnValue;
            }
            catch
            {
                return false;
            }
        }

        private void OnSdkAdClickEvent(object sender, string rawJson)
        {
            try
            {
                JObject obj = SafeParseJson(rawJson);
                string unitId = obj != null ? (string)obj["unitId"] : string.Empty;
                RaiseAdEvent(new AdEventNotification
                {
                    EventName = "ad_clicked",
                    Format = ResolveFormatName(unitId),
                    UnitId = unitId,
                    Status = "clicked"
                });
            }
            catch
            {
                // Ignore malformed third-party telemetry
            }
        }

        private void OnSdkAdCloseEvent(object sender, string rawJson)
        {
            try
            {
                JObject obj = SafeParseJson(rawJson);
                if (obj == null) return;

                string unitId = (string)obj["unitId"] ?? string.Empty;
                int advertStatus = obj["advertStatus"] != null ? (int)obj["advertStatus"] : 0;
                string format = ResolveFormatName(unitId);

                // Status 2 = closed by backend, Status 3 = no ad material -> collapse immediately
                if (string.Equals(unitId, _config.Units.Banner.UnitId, StringComparison.OrdinalIgnoreCase))
                {
                    HideBanner(advertStatus == 3 ? "no-material" : advertStatus == 2 ? "backend-closed" : "user-closed");
                }
                else if (string.Equals(unitId, _config.Units.Couplet.UnitId, StringComparison.OrdinalIgnoreCase))
                {
                    if (advertStatus == 1)
                    {
                        _coupletDismissedUntilUtc = DateTime.UtcNow.AddMinutes(Math.Max(5, _config.Units.Couplet.DismissCooldownMinutes));
                    }
                    HideCouplet(advertStatus == 3 ? "no-material" : advertStatus == 2 ? "backend-closed" : "user-closed");
                }
                else if (string.Equals(unitId, _config.Units.Rewarded.UnitId, StringComparison.OrdinalIgnoreCase))
                {
                    HandleRewardedClose(obj, unitId, advertStatus);
                    return;
                }

                RaiseAdEvent(new AdEventNotification
                {
                    EventName = "ad_closed",
                    Format = format,
                    UnitId = unitId,
                    AdvertStatus = advertStatus,
                    Status = advertStatus == 1 ? "closed" : "unavailable"
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[NEXORA][MGAds] OnSdkAdCloseEvent error: " + ex.GetType().Name);
            }
        }

        private void HandleRewardedClose(JObject obj, string unitId, int advertStatus)
        {
            int completeStatus = obj["completeStatus"] != null ? (int)obj["completeStatus"] : 0;
            string resourceId = (string)obj["resourceId"] ?? string.Empty;
            string materialId = (string)obj["materialId"] ?? string.Empty;
            string rewardId = (string)obj["rewardId"] ?? string.Empty;

            if (advertStatus == 2 || advertStatus == 3)
            {
                var unavail = new RewardedAdOutcome
                {
                    Shown = false,
                    Completed = false,
                    Reason = advertStatus == 3 ? "no-material" : "backend-closed"
                };
                TryCompletePendingRewarded(unavail);
                RaiseAdEvent(new AdEventNotification
                {
                    EventName = "rewarded_unavailable",
                    Format = "rewarded",
                    UnitId = unitId,
                    AdvertStatus = advertStatus,
                    Completed = false,
                    Reason = unavail.Reason
                });
                return;
            }

            if (completeStatus == 1)
            {
                int hours = Math.Max(1, _config.Units.Rewarded.RewardDurationHours);
                _adFreeUntilUtc = DateTime.UtcNow.AddHours(hours);
                HideBanner("reward-granted");
                HideCouplet("reward-granted");

                Task.Run(async () =>
                {
                    bool fulfilled = false;
                    try
                    {
                        if (!string.IsNullOrEmpty(rewardId))
                        {
                            object rep = await AdvertManager.ReportAdRewardFulfillment(unitId, resourceId, materialId, rewardId);
                            if (rep is AsyncProcessResult apr) fulfilled = apr.ReturnValue;
                            else if (rep is bool b) fulfilled = b;
                            else fulfilled = rep != null;
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine("[NEXORA][MGAds] ReportAdRewardFulfillment error: " + ex.GetType().Name);
                    }

                    var outcome = new RewardedAdOutcome
                    {
                        Shown = true,
                        Completed = true,
                        Fulfilled = fulfilled,
                        RewardId = rewardId,
                        RewardDurationHours = hours,
                        Reason = "completed"
                    };
                    TryCompletePendingRewarded(outcome);

                    RaiseAdEvent(new AdEventNotification
                    {
                        EventName = "rewarded_completed",
                        Format = "rewarded",
                        UnitId = unitId,
                        AdvertStatus = advertStatus,
                        Completed = true,
                        Fulfilled = fulfilled,
                        RewardId = rewardId,
                        Status = "completed"
                    });
                    NotifyStateChanged();
                });
            }
            else
            {
                var dismissed = new RewardedAdOutcome
                {
                    Shown = true,
                    Completed = false,
                    Reason = "dismissed"
                };
                TryCompletePendingRewarded(dismissed);
                RaiseAdEvent(new AdEventNotification
                {
                    EventName = "rewarded_dismissed",
                    Format = "rewarded",
                    UnitId = unitId,
                    AdvertStatus = advertStatus,
                    Completed = false,
                    Status = "dismissed"
                });
            }
        }

        private void TryCompletePendingRewarded(RewardedAdOutcome outcome)
        {
            var pending = _pendingRewarded;
            if (pending != null)
            {
                pending.TrySetResult(outcome);
            }
        }

        private string ResolveFormatName(string unitId)
        {
            if (string.IsNullOrEmpty(unitId)) return "unknown";
            if (string.Equals(unitId, _config.Units.Banner.UnitId, StringComparison.OrdinalIgnoreCase)) return "banner";
            if (string.Equals(unitId, _config.Units.Rewarded.UnitId, StringComparison.OrdinalIgnoreCase)) return "rewarded";
            if (string.Equals(unitId, _config.Units.Couplet.UnitId, StringComparison.OrdinalIgnoreCase)) return "couplet";
            if (string.Equals(unitId, _config.Units.Interstitial.UnitId, StringComparison.OrdinalIgnoreCase)) return "interstitial";
            return "unknown";
        }

        private static JObject SafeParseJson(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            try { return JObject.Parse(raw); } catch { return null; }
        }

        private void ClearBannerControlsUi()
        {
            InvokeOnUi(() =>
            {
                ClearBannerControlsCore();
                _bannerContainer.Visible = false;
                return true;
            });
        }

        private void ClearBannerControlsCore()
        {
            for (int i = _bannerContainer.Controls.Count - 1; i >= 0; i--)
            {
                Control ctrl = _bannerContainer.Controls[i];
                _bannerContainer.Controls.RemoveAt(i);
                try { ctrl.Dispose(); } catch { /* ignore */ }
            }
        }

        private void RemoveCoupletControlsCore()
        {
            for (int i = _hostForm.Controls.Count - 1; i >= 0; i--)
            {
                Control ctrl = _hostForm.Controls[i];
                string tag = ctrl.Tag != null ? ctrl.Tag.ToString() : string.Empty;
                if (tag.IndexOf(CoupletLeftTag, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    tag.IndexOf(CoupletRightTag, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    _hostForm.Controls.RemoveAt(i);
                    try { ctrl.Dispose(); } catch { /* ignore */ }
                }
            }
        }

        private T InvokeOnUi<T>(Func<T> action)
        {
            if (_disposed || _hostForm.IsDisposed) return default(T);
            if (!_hostForm.IsHandleCreated) return action();
            if (_hostForm.InvokeRequired)
            {
                return (T)_hostForm.Invoke(action);
            }
            return action();
        }

        private void RaiseAdEvent(AdEventNotification notification)
        {
            var handler = AdEventRaised;
            if (handler != null)
            {
                try { handler(notification); } catch { /* ignore */ }
            }
        }

        private void NotifyStateChanged()
        {
            var handler = StateChanged;
            if (handler != null)
            {
                try { handler(GetPublicState()); } catch { /* ignore */ }
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            if (_eventsBound)
            {
                AdvertManager.AdClickEvent -= OnSdkAdClickEvent;
                AdvertManager.AdCloseEvent -= OnSdkAdCloseEvent;
                _eventsBound = false;
            }
            try { ClearBannerControlsCore(); } catch { /* ignore */ }
            try { RemoveCoupletControlsCore(); } catch { /* ignore */ }
            _initLock.Dispose();
        }
    }
}
