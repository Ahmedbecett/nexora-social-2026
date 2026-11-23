using System;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NexoraWindows.Ads;

namespace NexoraWindows.Bridge
{
    /// <summary>
    /// Strict origin-verified WebView2 JS <-> Native bridge for NEXORA AI Windows.
    ///
    /// Security rules:
    ///   - Accepts messages ONLY from the official production origin (https://nexora-social-2026.vercel.app).
    ///   - Exposes ONLY an explicit allowlist of ad/privacy actions.
    ///   - NEVER exposes the MG Ads Private Key, AccessToken, or native system/filesystem access.
    /// </summary>
    public sealed class WebViewBridge : IDisposable
    {
        private readonly CoreWebView2 _coreWebView;
        private readonly MgAdsManager _adsManager;
        private readonly Uri _allowedOrigin;
        private bool _disposed;

        public string ActiveView { get; private set; } = "studio";
        public bool HasMessages { get; private set; }

        public WebViewBridge(CoreWebView2 coreWebView, MgAdsManager adsManager, string allowedOrigin)
        {
            _coreWebView = coreWebView ?? throw new ArgumentNullException(nameof(coreWebView));
            _adsManager = adsManager ?? throw new ArgumentNullException(nameof(adsManager));
            _allowedOrigin = new Uri(allowedOrigin);

            _coreWebView.WebMessageReceived += OnWebMessageReceived;
            _adsManager.AdEventRaised += OnNativeAdEvent;
            _adsManager.StateChanged += OnNativeStateChanged;
        }

        private bool IsTrustedSource(string sourceUri)
        {
            if (string.IsNullOrWhiteSpace(sourceUri)) return false;
            Uri parsed;
            if (!Uri.TryCreate(sourceUri, UriKind.Absolute, out parsed)) return false;
            return string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                && string.Equals(parsed.Host, _allowedOrigin.Host, StringComparison.OrdinalIgnoreCase)
                && parsed.Port == _allowedOrigin.Port;
        }

        private async void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            if (_disposed) return;
            if (!IsTrustedSource(e.Source))
            {
                return;
            }

            string raw = null;
            try
            {
                raw = e.WebMessageAsJson;
                if (string.IsNullOrWhiteSpace(raw)) return;

                JObject msg = JObject.Parse(raw);
                string type = (string)msg["type"];
                if (!string.Equals(type, "nx-mgads", StringComparison.Ordinal)) return;

                string requestId = (string)msg["requestId"] ?? string.Empty;
                string action = (string)msg["action"] ?? string.Empty;
                JObject payload = msg["payload"] as JObject;

                object response = await HandleActionAsync(action, payload);
                if (!string.IsNullOrEmpty(requestId))
                {
                    PostToWeb(new
                    {
                        type = "nx-mgads-response",
                        requestId = requestId,
                        ok = true,
                        data = response
                    });
                }
            }
            catch (Exception ex)
            {
                string reqId = string.Empty;
                try
                {
                    if (!string.IsNullOrEmpty(raw))
                    {
                        reqId = (string)JObject.Parse(raw)["requestId"] ?? string.Empty;
                    }
                }
                catch { /* ignore */ }

                if (!string.IsNullOrEmpty(reqId))
                {
                    PostToWeb(new
                    {
                        type = "nx-mgads-response",
                        requestId = reqId,
                        ok = false,
                        error = ex.GetType().Name
                    });
                }
            }
        }

        private async Task<object> HandleActionAsync(string action, JObject payload)
        {
            switch (action)
            {
                case "getState":
                    return _adsManager.GetPublicState();

                case "syncView":
                    ActiveView = payload != null && payload["view"] != null
                        ? Convert.ToString(payload["view"])
                        : "studio";
                    HasMessages = payload != null && payload["hasMessages"] != null
                        && Convert.ToBoolean(payload["hasMessages"]);

                    await _adsManager.SyncCoupletForContextAsync(ActiveView, HasMessages);
                    return _adsManager.GetPublicState();

                case "showBanner":
                    bool force = payload != null && payload["force"] != null && Convert.ToBoolean(payload["force"]);
                    bool shown = await _adsManager.ShowBannerAsync(force);
                    return new { shown = shown, state = _adsManager.GetPublicState() };

                case "hideBanner":
                    _adsManager.HideBanner("web-requested");
                    return new { hidden = true };

                case "showRewarded":
                    string comment = payload != null ? (string)payload["comment"] : null;
                    return await _adsManager.ShowRewardedAsync(comment);

                case "showCouplet":
                    bool coupletShown = await _adsManager.SyncCoupletForContextAsync(ActiveView, HasMessages);
                    return new { shown = coupletShown, state = _adsManager.GetPublicState() };

                case "hideCouplet":
                    _adsManager.HideCouplet("web-requested");
                    return new { hidden = true };

                case "showInterstitial":
                    return await _adsManager.ShowInterstitialAsync();

                case "openPrivacyChoices":
                    bool opened = await _adsManager.OpenPrivacyChoicesAsync();
                    return new { opened = opened };

                default:
                    return new { error = "unsupported-action" };
            }
        }

        private void OnNativeAdEvent(AdEventNotification evt)
        {
            PostToWeb(new
            {
                type = "nx-mgads-event",
                payload = evt
            });
        }

        private void OnNativeStateChanged(MgAdsPublicState state)
        {
            PostToWeb(new
            {
                type = "nx-mgads-state",
                payload = state
            });
        }

        public void PushCurrentState()
        {
            OnNativeStateChanged(_adsManager.GetPublicState());
        }

        private void PostToWeb(object message)
        {
            if (_disposed) return;
            try
            {
                if (!IsTrustedSource(_coreWebView.Source)) return;
                string json = JsonConvert.SerializeObject(message);
                _coreWebView.PostWebMessageAsJson(json);
            }
            catch
            {
                // WebView may be navigating or closing
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _coreWebView.WebMessageReceived -= OnWebMessageReceived;
            _adsManager.AdEventRaised -= OnNativeAdEvent;
            _adsManager.StateChanged -= OnNativeStateChanged;
        }
    }
}
